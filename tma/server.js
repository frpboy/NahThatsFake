
const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const Razorpay = require('razorpay');
const crypto = require('crypto');
require('dotenv').config();

function timingSafeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'https://nahthatsfake.vercel.app').split(',');
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // Allow requests with no origin
    if (allowedOrigins.includes(origin)) return callback(null, true);
    if (process.env.NODE_ENV !== 'production' && origin.startsWith('http://localhost')) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  allowedHeaders: ['Content-Type', 'X-Telegram-Init-Data']
}));
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
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

// Telegram Init Data Validation Middleware
let cachedSecretKey = null;

const validateTelegramData = (req, res, next) => {
  const initData = req.header('X-Telegram-Init-Data');
  
  // Allow skipping validation in dev if explicitly configured (optional)
  if (!initData && process.env.NODE_ENV === 'development') {
    console.warn('Skipping Telegram validation in development (missing header)');
    return next(); 
  }

  if (!initData) {
    return res.status(401).json({ error: 'Missing X-Telegram-Init-Data header' });
  }

  const urlParams = new URLSearchParams(initData);
  const hash = urlParams.get('hash');
  const authDateStr = urlParams.get('auth_date');
  
  if (!hash) {
    return res.status(401).json({ error: 'Missing hash in init data' });
  }

  // 🛡️ Sentinel: Enforce auth_date expiration to prevent replay attacks
  if (!authDateStr) {
    return res.status(401).json({ error: 'Missing auth_date in init data' });
  }

  const authDate = parseInt(authDateStr, 10);
  const now = Math.floor(Date.now() / 1000);
  // 24 hours in seconds
  if (now - authDate > 86400) {
    return res.status(401).json({ error: 'Telegram init data expired' });
  }

  urlParams.delete('hash');
  
  const params = [];
  for (const [key, value] of urlParams.entries()) {
    params.push(`${key}=${value}`);
  }
  
  const dataCheckString = params.sort().join('\n');
  
  // 🛡️ Sentinel: Fail securely if BOT_TOKEN is missing instead of using a fallback string
  if (!process.env.BOT_TOKEN) {
    console.error('CRITICAL: BOT_TOKEN is not configured for Telegram validation');
    return res.status(500).json({ error: 'Internal server error: Authentication misconfigured' });
  }

  // ⚡ Bolt: Cache the expensive HMAC computation of the static BOT_TOKEN
  // to avoid redundant cryptographic operations on every single API request.
  if (!cachedSecretKey) {
    cachedSecretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(process.env.BOT_TOKEN)
      .digest();
  }

  const calculatedHash = crypto
    .createHmac('sha256', cachedSecretKey)
    .update(dataCheckString)
    .digest('hex');
    
  if (timingSafeCompare(calculatedHash, hash)) {
    // Valid data
    // Parse user data to attach to req
    const userStr = urlParams.get('user');
    if (userStr) {
      req.telegramUser = JSON.parse(userStr);
    }
    next();
  } else {
    return res.status(403).json({ error: 'Invalid Telegram data hash' });
  }
};

// Serve the main app
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Admin Stats Endpoint (Protected)
app.get('/api/admin/stats', validateTelegramData, async (req, res) => {
  try {
    const userId = req.telegramUser ? req.telegramUser.id : null;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    // 🛡️ Sentinel: Ensure only owners and admins can access stats
    if (userId.toString() !== process.env.OWNER_TELEGRAM_ID) {
      const { data: user } = await supabase
        .from('users')
        .select('role')
        .eq('telegram_user_id', userId.toString())
        .single();

      if (!user || (user.role !== 'admin' && user.role !== 'owner')) {
        return res.status(403).json({ error: 'Forbidden: Admin access required' });
      }
    }

    // ⚡ Bolt: Fetch DB-level counts concurrently instead of pulling all rows into memory
    const [
      { count: usersCount, error: usersError },
      { count: bannedCount, error: bannedError },
      { count: checksCount, error: checksError },
      { data: payments, error: paymentsError }
    ] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('is_banned', true),
      supabase.from('checks').select('*', { count: 'exact', head: true }),
      supabase.from('payments').select('amount_inr, amount_stars').eq('status', 'success')
    ]);
    
    const revenueInr = payments?.reduce((acc, curr) => acc + (curr.amount_inr || 0), 0) / 100 || 0;
    const revenueStars = payments?.reduce((acc, curr) => acc + (curr.amount_stars || 0), 0) || 0;

    if (usersError || bannedError || checksError || paymentsError) throw new Error('Database error');

    res.json({
      users: usersCount || 0,
      banned: bannedCount || 0,
      checks: checksCount || 0,
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
app.get('/api/user/profile', validateTelegramData, async (req, res) => {
  // Prefer validated user ID from middleware, fallback to query for dev/legacy
  const userId = req.telegramUser ? req.telegramUser.id : null;
  
  if (!userId) return res.status(400).json({ error: 'Missing userId' });

  try {
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_user_id', userId.toString()) // Ensure string comparison
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
app.get('/api/user/role', validateTelegramData, async (req, res) => {
    const userId = req.telegramUser ? req.telegramUser.id : null;
    if (!userId) return res.status(400).json({ error: 'Missing userId' });
  
    try {
        // Check env override first
        if (userId.toString() === process.env.OWNER_TELEGRAM_ID) {
             return res.json({ role: 'owner' });
        }

      const { data: user } = await supabase
        .from('users')
        .select('role')
        .eq('telegram_user_id', userId.toString())
        .single();
  
      res.json({ role: user?.role || 'user' });
    } catch (error) {
      console.error('Role error:', error);
      res.status(500).json({ error: 'Failed to fetch role' });
    }
});

// User Checks Endpoint
app.get('/api/user/checks', validateTelegramData, async (req, res) => {
    const userId = req.telegramUser ? req.telegramUser.id : null;
    if (!userId) return res.status(400).json({ error: 'Missing userId' });
  
    try {
      // ⚡ Bolt: Fetch user and their recent checks in a single round-trip using Supabase resource embedding,
      // avoiding N+1 sequential DB queries while preserving the strict .single() 404 behavior for missing users.
      const { data: user } = await supabase
        .from('users')
        .select('id, checks(*)')
        .eq('telegram_user_id', userId.toString())
        .order('created_at', { ascending: false, referencedTable: 'checks' })
        .limit(10, { referencedTable: 'checks' })
        .single();

      if (!user) return res.status(404).json({ error: 'User not found' });

      res.json({ checks: user.checks || [] });
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
app.post('/api/payment/create-razorpay-order', validateTelegramData, async (req, res) => {
  const { planId } = req.body;
  const userId = req.telegramUser ? req.telegramUser.id : null;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });
  
  const planDetails = getPlanDetails(planId);
  if (!planDetails) return res.status(400).json({ error: 'Invalid plan' });

  try {
    const options = {
      amount: planDetails.amount, // derive amount from trusted server-side config
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
app.post('/api/payment/verify-razorpay', validateTelegramData, async (req, res) => {
  const { planId, razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;
  const userId = req.telegramUser ? req.telegramUser.id : null;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });

  if (!process.env.RAZORPAY_KEY_SECRET) {
    return res.status(500).json({ error: 'Razorpay secret not configured' });
  }

  const generated_signature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update((razorpay_order_id || '') + "|" + (razorpay_payment_id || ''))
    .digest('hex');

  if (timingSafeCompare(generated_signature, razorpay_signature)) {
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
app.post('/api/payment/create-stars-invoice', validateTelegramData, async (req, res) => {
  const { planId } = req.body;
  const userId = req.telegramUser ? req.telegramUser.id : null;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });
  const BOT_TOKEN = process.env.BOT_TOKEN;

  if (!BOT_TOKEN) {
    return res.status(500).json({ error: 'Bot token not configured' });
  }

  const starsAmountMap = {
    'ind_weekly': 150,
    'ind_monthly': 500,
    'ind_annual': 4000,
    'credits_50': 250,
    'credits_100': 450
  };

  const amount = starsAmountMap[planId];
  if (!amount) return res.status(400).json({ error: 'Invalid plan' });

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
        prices: [{ label: title, amount: amount }] // derive amount from trusted mapping
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

// 4. Razorpay Webhook (Server-to-Server)
app.post('/api/payment/razorpay-webhook', async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET;
  
  // Validate signature
  const signature = req.headers['x-razorpay-signature'];
  if (!signature) return res.status(400).send('Missing signature');
  if (!secret) return res.status(500).send('Webhook secret not configured');
  
  const shasum = crypto.createHmac('sha256', secret);
  shasum.update(req.rawBody || '');
  const digest = shasum.digest('hex');

  // If testing, log both for debugging (remove in production)
  // console.log('Webhook Debug:', { digest, signature, secret: !!secret });

  if (timingSafeCompare(digest, signature)) {
    // Verified
    const event = req.body.event;
    const payload = req.body.payload;

    console.log(`Received Razorpay webhook: ${event}`);

    try {
      if (event === 'order.paid' || event === 'payment.captured') {
        const payment = payload.payment.entity;
        const order = payload.order.entity;
        
        // Extract metadata from notes
        const { telegramUserId, planId } = payment.notes || order.notes || {};
        
        if (telegramUserId && planId) {
          // Process fulfillment (duplicate logic from verify endpoint)
          const { data: user } = await supabase
            .from('users')
            .select('id, permanent_credits, last_payment_id')
            .eq('telegram_user_id', telegramUserId.toString())
            .single();

          if (user) {
            // Idempotency check
            if (user.last_payment_id === payment.id) {
               console.log('Payment already processed:', payment.id);
               return res.json({ status: 'ok' });
            }

            const planDetails = getPlanDetails(planId);
            if (planDetails) {
              // Insert Payment Record
              await supabase.from('payments').insert({
                user_id: user.id,
                plan_id: planId,
                amount_inr: payment.amount,
                payment_method: 'razorpay_webhook',
                payment_id: payment.id,
                order_id: order.id,
                status: 'success',
                premium_from: new Date().toISOString(),
                premium_until: planDetails.is_credit ? null : new Date(Date.now() + planDetails.days * 24 * 60 * 60 * 1000).toISOString()
              });

              // Update User
              if (planDetails.is_credit) {
                await supabase.from('users').update({
                  permanent_credits: (user.permanent_credits || 0) + planDetails.credits,
                  last_payment_id: payment.id,
                  last_paid_at: new Date().toISOString()
                }).eq('id', user.id);
              } else {
                await supabase.from('users').update({
                  plan: planId,
                  premium_until: new Date(Date.now() + planDetails.days * 24 * 60 * 60 * 1000).toISOString(),
                  last_payment_id: payment.id,
                  last_paid_at: new Date().toISOString()
                }).eq('id', user.id);
              }
              console.log(`Webhook: Fulfilled ${planId} for user ${telegramUserId}`);
            }
          }
        }
      }
    } catch (err) {
      console.error('Webhook processing error:', err);
      // Return 200 anyway to prevent Razorpay from retrying indefinitely on logic errors
    }
    
    res.json({ status: 'ok' });
  } else {
    res.status(400).send('Invalid signature');
  }
});

// Start server
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
