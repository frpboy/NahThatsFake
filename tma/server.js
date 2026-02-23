
const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const Razorpay = require('razorpay');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Razorpay client
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Serve the main app
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Admin Stats Endpoint
app.get('/api/admin/stats', async (req, res) => {
  try {
    const { data: users, error: usersError } = await supabase.from('users').select('id, is_banned');
    const { data: checks, error: checksError } = await supabase.from('checks').select('id');
    const { data: revenue, error: revenueError } = await supabase.rpc('get_revenue_stats'); // Need to create RPC or view query
    
    // For now, manual query for revenue
    const { data: payments } = await supabase.from('payments').select('amount_inr, amount_stars, status').eq('status', 'success');
    
    const revenueInr = payments?.reduce((acc, curr) => acc + (curr.amount_inr || 0), 0) / 100 || 0;
    const revenueStars = payments?.reduce((acc, curr) => acc + (curr.amount_stars || 0), 0) || 0;

    if (usersError || checksError) throw new Error('Database error');

    res.json({
      users: users.length,
      banned: users.filter(u => u.is_banned).length,
      checks: checks.length,
      revenue: {
        inr: revenueInr,
        stars: revenueStars
      }
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// User Profile Endpoint
app.get('/api/user/profile', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });

  try {
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_user_id', userId)
      .single();

    if (!user) return res.status(404).json({ error: 'User not found' });

    // Get check count manually for now
    const { count: checkCount } = await supabase
      .from('checks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    res.json({ ...user, total_checks: checkCount });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// User Role Endpoint
app.get('/api/user/role', async (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'Missing userId' });
  
    try {
        // Check env override first
        if (userId === process.env.OWNER_TELEGRAM_ID) {
             return res.json({ role: 'owner' });
        }

      const { data: user } = await supabase
        .from('users')
        .select('role')
        .eq('telegram_user_id', userId)
        .single();
  
      res.json({ role: user?.role || 'user' });
    } catch (error) {
      console.error('Role error:', error);
      res.status(500).json({ error: 'Failed to fetch role' });
    }
});

// User Checks Endpoint
app.get('/api/user/checks', async (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'Missing userId' });
  
    try {
      const { data: user } = await supabase.from('users').select('id').eq('telegram_user_id', userId).single();
      if (!user) return res.status(404).json({ error: 'User not found' });

      const { data: checks } = await supabase
        .from('checks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);
  
      res.json({ checks });
    } catch (error) {
      console.error('Checks error:', error);
      res.status(500).json({ error: 'Failed to fetch checks' });
    }
  });

// -----------------------------------------------------------------------------
// PAYMENT ENDPOINTS
// -----------------------------------------------------------------------------

// Plan Details Helper
function getPlanDetails(planId) {
  const plans = {
    'ind_weekly': { amount: 2900, days: 7, is_credit: false },
    'ind_monthly': { amount: 9900, days: 30, is_credit: false },
    'ind_annual': { amount: 79900, days: 365, is_credit: false },
    'ind_lifetime': { amount: 199900, days: 36500, is_credit: false },
    'credits_50': { amount: 4900, credits: 50, is_credit: true },
    'credits_100': { amount: 8900, credits: 100, is_credit: true },
    'grp_monthly': { amount: 29900, days: 30, is_credit: false },
    'grp_annual': { amount: 299900, days: 365, is_credit: false }
  };
  return plans[planId];
}

// 1. Create Razorpay Order
app.post('/api/payment/create-razorpay-order', async (req, res) => {
  const { userId, planId, amount } = req.body;
  
  try {
    const options = {
      amount: amount, // amount in the smallest currency unit (paise)
      currency: "INR",
      receipt: `receipt_${userId}_${Date.now()}`,
      notes: {
        planId: planId,
        telegramUserId: userId
      }
    };
    
    const order = await razorpay.orders.create(options);
    
    // Return order details + key_id for frontend
    res.json({
      id: order.id,
      amount: order.amount,
      keyId: process.env.RAZORPAY_KEY_ID
    });
    
  } catch (error) {
    console.error('Razorpay create order error:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// 2. Verify Razorpay Payment
app.post('/api/payment/verify-razorpay', async (req, res) => {
  const { userId, planId, razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

  const generated_signature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(razorpay_order_id + "|" + razorpay_payment_id)
    .digest('hex');

  if (generated_signature === razorpay_signature) {
    // Payment verified
    try {
      // Find user UUID from telegram ID
      const { data: user } = await supabase
        .from('users')
        .select('id, permanent_credits')
        .eq('telegram_user_id', userId.toString())
        .single();
        
      if (!user) throw new Error('User not found');

      const planDetails = getPlanDetails(planId);
      if (!planDetails) throw new Error('Invalid plan');

      // Record payment
      await supabase.from('payments').insert({
        user_id: user.id,
        plan_id: planId,
        amount_inr: planDetails.amount,
        payment_method: 'razorpay',
        payment_id: razorpay_payment_id,
        order_id: razorpay_order_id,
        status: 'success',
        premium_from: new Date().toISOString(),
        premium_until: planDetails.is_credit ? null : new Date(Date.now() + planDetails.days * 24 * 60 * 60 * 1000).toISOString()
      });

      if (planDetails.is_credit) {
        // Add credits
        await supabase.from('users').update({
          permanent_credits: (user.permanent_credits || 0) + planDetails.credits,
          last_payment_id: razorpay_payment_id,
          last_paid_at: new Date().toISOString()
        }).eq('id', user.id);
      } else {
        // Update subscription
        await supabase.from('users').update({
          plan: planId,
          premium_until: new Date(Date.now() + planDetails.days * 24 * 60 * 60 * 1000).toISOString(),
          last_payment_id: razorpay_payment_id,
          last_paid_at: new Date().toISOString()
        }).eq('id', user.id);
      }

      res.json({ success: true });
    } catch (error) {
      console.error('DB Update Error:', error);
      res.status(500).json({ error: 'Database update failed' });
    }
  } else {
    res.status(400).json({ success: false, error: 'Signature verification failed' });
  }
});

// 3. Create Stars Invoice (Proxy to Bot)
app.post('/api/payment/create-stars-invoice', async (req, res) => {
  const { userId, planId, amount } = req.body;
  const BOT_TOKEN = process.env.BOT_TOKEN;

  if (!BOT_TOKEN) {
    return res.status(500).json({ error: 'Bot token not configured' });
  }

  try {
    let title = 'Premium';
    let description = 'Subscription';
    
    if (planId === 'ind_weekly') { title = 'Weekly Pass'; description = '7 Days Premium'; }
    if (planId === 'ind_monthly') { title = 'Monthly Premium'; description = '30 Days Premium'; }
    if (planId === 'ind_annual') { title = 'Annual Premium'; description = '365 Days Premium'; }
    if (planId === 'credits_50') { title = '50 Credits'; description = '50 Permanent Checks'; }
    if (planId === 'credits_100') { title = '100 Credits'; description = '100 Permanent Checks'; }
    
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/createInvoiceLink`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        description,
        payload: JSON.stringify({ userId, planId, type: 'stars' }), 
        provider_token: "", // Empty for Stars
        currency: "XTR",
        prices: [{ label: title, amount: amount }] // amount in Stars
      })
    });

    const data = await response.json();
    
    if (data.ok) {
      res.json({ invoiceLink: data.result });
    } else {
      console.error('Telegram API Error:', data);
      res.status(500).json({ error: 'Failed to create invoice link' });
    }
  } catch (error) {
    console.error('Create Invoice Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start server
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
