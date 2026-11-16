
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

app.disable('x-powered-by');

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

let paymentSupabase;
function getPaymentSupabase() {
  if (!paymentSupabase) {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for payment fulfillment');
    }
    paymentSupabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  }
  return paymentSupabase;
}

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

  // Reject malformed, expired, and materially future-dated init data.
  // Allow up to 60 seconds of clock skew for small server/client time differences.
  if (!/^\d+$/.test(authDateStr)) {
    return res.status(401).json({ error: 'Invalid auth_date in init data' });
  }
  const authDate = Number(authDateStr);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(authDate) || authDate <= 0 || authDate > now + 60) {
    return res.status(401).json({ error: 'Invalid auth_date in init data' });
  }
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
    if (!userStr) {
      return res.status(401).json({ error: 'Missing user in init data' });
    }
    try {
      const parsedUser = JSON.parse(userStr);
      if (!parsedUser || typeof parsedUser !== 'object' ||
          !Number.isSafeInteger(parsedUser.id) || parsedUser.id <= 0) {
        return res.status(401).json({ error: 'Invalid user in init data' });
      }
      req.telegramUser = parsedUser;
    } catch {
      return res.status(401).json({ error: 'Invalid user in init data' });
    }
    return next();
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
    // and use database-level RPC to calculate total revenue to avoid memory bloat
    const [
      { count: usersCount, error: usersError },
      { count: bannedCount, error: bannedError },
      { count: checksCount, error: checksError },
      { data: revenueData, error: revenueError }
    ] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('is_banned', true),
      supabase.from('checks').select('*', { count: 'exact', head: true }),
      supabase.rpc('get_total_revenue')
    ]);

    if (usersError || bannedError || checksError || revenueError) throw new Error('Database error');

    res.json({
      users: usersCount || 0,
      banned: bannedCount || 0,
      checks: checksCount || 0,
      revenue: {
        inr: revenueData?.inr || 0,
        stars: revenueData?.stars || 0
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
    // ⚡ Bolt: Fetch user profile and check count concurrently in a single query
    // using resource embedding to reduce database round-trip latency.
    const { data: user } = await supabase
      .from('users')
      .select('*, checks(count)')
      .eq('telegram_user_id', userId.toString()) // Ensure string comparison
      .single();

    if (!user) return res.status(404).json({ error: 'User not found' });

    const checkCount = user.checks && user.checks.length > 0 ? user.checks[0].count : 0;
    delete user.checks; // Maintain flat API response shape

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
      // ⚡ Bolt: Fetch user and their recent checks in a single query
      // using parent-to-child resource embedding instead of sequential queries.
      // This saves a database round-trip while maintaining 404 behavior.
      const { data: user, error } = await supabase
        .from('users')
        .select('id, checks(*)')
        .eq('telegram_user_id', userId.toString())
        .order('created_at', { ascending: false, referencedTable: 'checks' })
        .limit(10, { referencedTable: 'checks' })
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

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


// --- Payment correctness (bounded patch, 2026-11-16, rev2) -----------------
// Webhook acknowledgment contract: a non-2xx response makes Razorpay retry
// with exponential backoff for 24h after event creation, then disables the
// webhook and sends an alert email; delivery is at-least-once with a 5s
// response timeout. Ref: https://razorpay.com/docs/webhooks/best-practices/
// So no failure path below acknowledges the event: every one returns 5xx
// (fail closed - no fulfillment, order stays pending, the provider still
// holds the captured payment) and redelivery is idempotent via the live
// fulfill_payment dedupe. No permanent/transient classification is made: an
// unresolved user or missing identity can be delayed state or a lookup
// error, not proven permanent invalidity. Payload shapes are event-specific:
// order.paid carries payment+order entities; payment.captured carries ONLY
// the payment entity. Ref: https://razorpay.com/docs/webhooks/orders

// Captured-payment + identity validation for the verify route. Signature and
// order checks prove the Checkout callback is authentic, NOT that money
// settled: only `captured` payments are fulfillable - `authorized` payments
// auto-refund if never captured ("payments that are not captured within this
// period will be refunded automatically to customers"). Ref:
// https://razorpay.com/docs/payments/payments/capture-settings
function validateCapturedPayment(payment, order, planDetails, paymentId, orderId) {
  if (!payment || payment.id !== paymentId) return { ok: false, reason: 'payment-not-found' };
  if (payment.status !== 'captured') return { ok: false, reason: 'payment-not-captured', status: payment.status || 'unknown' };
  if (payment.order_id !== orderId) return { ok: false, reason: 'payment-order-mismatch' };
  if (!order || order.id !== orderId) return { ok: false, reason: 'order-not-found' };
  if (payment.currency !== 'INR' || Number(payment.amount) !== Number(planDetails.amount))
    return { ok: false, reason: 'payment-amount-mismatch' };
  return { ok: true };
}

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
      // 🛡️ Sentinel: Fetch authentic order details from Razorpay to prevent parameter spoofing
      const razorpayOrder = await razorpay.orders.fetch(razorpay_order_id);
      if (!razorpayOrder || !razorpayOrder.notes) {
        throw new Error('Invalid order metadata from Razorpay');
      }

      const authenticPlanId = razorpayOrder.notes.planId;
      const authenticUserId = razorpayOrder.notes.telegramUserId;

      if (authenticPlanId !== planId || authenticUserId?.toString() !== userId.toString()) {
        console.error('Parameter spoofing detected:', {
           clientPlan: planId, authenticPlan: authenticPlanId,
           clientUser: userId, authenticUser: authenticUserId
        });
        throw new Error('Payment metadata mismatch');
      }

      const planDetails = getPlanDetails(planId);
      if (!planDetails) throw new Error('Invalid plan');
      if (razorpayOrder.currency !== 'INR' || razorpayOrder.amount !== planDetails.amount) {
        throw new Error('Payment amount mismatch');
      }

      // Captured-payment + identity validation: do not fulfill on signature +
      // order metadata alone. 409 (not 500) so the mini app can distinguish
      // "payment not settled yet, retry" from a server fault.
      const razorpayPayment = await razorpay.payments.fetch(razorpay_payment_id);
      const paymentCheck = validateCapturedPayment(razorpayPayment, razorpayOrder, planDetails, razorpay_payment_id, razorpay_order_id);
      if (!paymentCheck.ok) {
        console.error('Payment validation rejected:', paymentCheck);
        return res.status(409).json({
          success: false,
          error: 'Payment not fulfillable',
          reason: paymentCheck.reason,
          ...(paymentCheck.status ? { paymentStatus: paymentCheck.status } : {})
        });
      }

      const paymentClient = getPaymentSupabase();
      const { data: user } = await paymentClient
        .from('users')
        .select('id')
        .eq('telegram_user_id', userId.toString())
        .single();
      if (!user) throw new Error('User not found');

      const premiumUntil = planDetails.is_credit
        ? null
        : new Date(Date.now() + planDetails.days * 24 * 60 * 60 * 1000).toISOString();
      const { error: fulfillmentError } = await paymentClient.rpc('fulfill_payment', {
        p_user_id: user.id,
        p_plan_id: planId,
        p_payment_id: razorpay_payment_id,
        p_payment_method: 'razorpay',
        p_amount_inr: planDetails.amount,
        p_order_id: razorpay_order_id,
        p_premium_until: premiumUntil,
        p_credits: planDetails.is_credit ? planDetails.credits : 0
      });
      if (fulfillmentError) {
        throw new Error('Failed to fulfill payment');
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

    const eventId = req.headers['x-razorpay-event-id'] || null;
    // Minimal non-personal diagnostics only: reason + provider event/payment/
    // order ids. No payload, notes, signature, initData or user identifiers.
    const diag = { reason: null, eventId, paymentId: null, orderId: null };
    try {
      if (event === 'order.paid' || event === 'payment.captured') {
        // Event-specific payload shape (https://razorpay.com/docs/webhooks/orders):
        // order.paid carries payment+order entities; payment.captured carries
        // ONLY the payment entity (contains: ["payment"]).
        const payment = payload && payload.payment && payload.payment.entity;
        if (!payment || !payment.id || !payment.order_id) {
          diag.reason = 'malformed-payment-entity';
          throw new Error(diag.reason);
        }
        diag.paymentId = payment.id;
        diag.orderId = payment.order_id;

        // A signed event type is not shape validation: fulfill only captured
        // payments; authorized payments auto-refund if never captured
        // (https://razorpay.com/docs/payments/payments/capture-settings).
        if (payment.status !== 'captured') {
          diag.reason = 'payment-not-captured';
          throw new Error(diag.reason);
        }

        // Trusted order: use the payload order entity when present, else
        // resolve it from the provider by payment.order_id (payment.captured
        // has no order entity). A payload/fetched order must bind to this
        // payment.
        let order = payload && payload.order && payload.order.entity;
        if (order && order.id !== payment.order_id) {
          diag.reason = 'payment-order-mismatch';
          throw new Error(diag.reason);
        }
        if (!order) {
          try {
            order = await razorpay.orders.fetch(payment.order_id);
          } catch (orderFetchErr) {
            diag.reason = 'order-fetch-failed';
            throw new Error(diag.reason);
          }
          if (!order || order.id !== payment.order_id) {
            diag.reason = 'order-fetch-mismatch';
            throw new Error(diag.reason);
          }
        }

        // Identity/plan come from the ORDER's notes only: they are written
        // server-side at order creation. Payment notes may be empty ({} or
        // the documented []) and must not mask order notes; a conflicting
        // non-empty payment note is rejected, never silently preferred.
        const orderNotes = order.notes || {};
        const paymentNotes = payment.notes || {};
        const telegramUserId = orderNotes.telegramUserId;
        const planId = orderNotes.planId;
        if (!telegramUserId || !planId) {
          diag.reason = 'missing-payment-identity';
          throw new Error(diag.reason);
        }
        if ((paymentNotes.telegramUserId != null && paymentNotes.telegramUserId.toString() !== telegramUserId.toString())
            || (paymentNotes.planId != null && paymentNotes.planId !== planId)) {
          diag.reason = 'payment-notes-conflict';
          throw new Error(diag.reason);
        }

        {
          const planDetails = getPlanDetails(planId);
          if (!planDetails || payment.currency !== 'INR' || order.currency !== 'INR'
              || Number(payment.amount) !== Number(planDetails.amount) || Number(order.amount) !== Number(planDetails.amount)) {
            diag.reason = 'metadata-mismatch';
            throw new Error(diag.reason);
          }

          const paymentClient = getPaymentSupabase();
          const { data: user, error: userError } = await paymentClient
            .from('users')
            .select('id')
            .eq('telegram_user_id', telegramUserId.toString())
            .single();

          // An unresolved user is NOT proven permanent invalidity (signup
          // ordering, replication lag or lookup error), so it stays on the
          // same fail-closed retryable path as every other failure.
          if (userError || !user) {
            diag.reason = 'user-unresolved';
            throw new Error(diag.reason);
          }

          // Entitlement arithmetic intentionally unchanged (existing policy).
          const premiumUntil = planDetails.is_credit
            ? null
            : new Date(Date.now() + planDetails.days * 24 * 60 * 60 * 1000).toISOString();
          const { error: fulfillmentError } = await paymentClient.rpc('fulfill_payment', {
            p_user_id: user.id,
            p_plan_id: planId,
            p_payment_id: payment.id,
            p_payment_method: 'razorpay',
            p_amount_inr: payment.amount,
            p_order_id: order.id,
            p_premium_until: premiumUntil,
            p_credits: planDetails.is_credit ? planDetails.credits : 0
          });
          if (fulfillmentError) {
            diag.reason = 'fulfillment-failed';
            throw new Error(diag.reason);
          }
          console.log(`Webhook: Fulfilled ${planId} for user ${telegramUserId}`);
        }
      }
      return res.json({ status: 'ok' });
    } catch (err) {
      // Fail closed, always retryable: a non-2xx response keeps Razorpay's
      // exponential-backoff retry schedule alive (24h after event creation,
      // then the webhook is disabled and an alert email is sent -
      // https://razorpay.com/docs/webhooks/best-practices/). That is a
      // bounded retry window, not a guaranteed eventual repair. Redelivery is
      // idempotent via the live fulfill_payment dedupe
      // (payments_payment_id_unique, grant on insert win).
      diag.reason = diag.reason || 'unexpected-error';
      console.error('Webhook not fulfilled:', diag.reason, {
        eventId: diag.eventId, paymentId: diag.paymentId, orderId: diag.orderId
      });
      return res.status(500).send('Fulfillment failed - retry expected');
    }
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
module.exports.validateCapturedPayment = validateCapturedPayment;
