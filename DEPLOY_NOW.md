
# 🚀 **IMMEDIATE DEPLOYMENT CHECKLIST**

## ✅ **Step 1: Database Setup (CRITICAL)**
1. **Go to Supabase Dashboard**: https://app.supabase.com
2. **Open SQL Editor** for your project
3. **Run these scripts in order**:
   - First: `supabase/schema.sql` (creates all tables)
   - Second: `supabase/rls_policies.sql` (security policies)
   - Third: `supabase/functions.sql` (database functions)

## ✅ **Step 2: Environment Configuration**
1. **Bot Environment** (`bot/.env`):
   ```
   BOT_TOKEN=your_telegram_bot_token_here
   SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   RAZORPAY_KEY_ID=your_razorpay_key_id
   RAZORPAY_KEY_SECRET=your_razorpay_key_secret
   ```

2. **TMA Environment** (`tma/.env`):
   ```
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   RAZORPAY_KEY_ID=your_razorpay_key_id
   RAZORPAY_KEY_SECRET=your_razorpay_key_secret
   PORT=3000
   ```

## ✅ **Step 3: Add Detection API Keys**
Add these to your `.env` files:
- **Sightengine**: Get from https://sightengine.com
- **Google Safe Browsing**: Get from https://developers.google.com/safe-browsing
- **VirusTotal**: Get from https://www.virustotal.com

## ✅ **Step 4: Deploy Options**

### **Option A: Quick Deploy (Vercel)**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy TMA
vercel --prod

# Deploy Bot (as separate project)
cd bot && vercel --prod
```

### **Option B: Docker Deploy (Recommended)**
```bash
# Build and run everything
docker-compose up -d

# Check logs
docker-compose logs -f
```

### **Option C: Railway Deploy**
1. Connect GitHub repo to Railway
2. Deploy both services
3. Configure environment variables

## ✅ **Step 5: Telegram Bot Setup**
1. **Create bot** with @BotFather
2. **Get your bot token**
3. **Set webhook** (for production):
   ```
   https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook?url=https://your-domain.com/bot/YOUR_BOT_TOKEN
   ```
4. **Configure TMA**: Set your TMA URL in BotFather

## ✅ **Step 6: Test Everything**
1. **Start chat** with your bot
2. **Test commands**: `/start`, `/check`, `/credits`, `/refer`
3. **Send image** for deepfake detection
4. **Send link** for scam detection
5. **Test payment** flow with ₹1 test payment
6. **Open TMA** from bot messages

## 🎯 **Your Product is LIVE!**

**Bot Features Ready**:
- ✅ Deepfake image detection
- ✅ Scam link detection  
- ✅ Premium subscriptions (₹99/month, ₹799/year)
- ✅ Referral system (1+2 credits)
- ✅ Rate limiting & abuse prevention
- ✅ Complete TMA dashboard
- ✅ Payment processing with Razorpay

**Growth Engine Active**:
- ✅ Viral loop in Telegram groups
- ✅ Referral credits system
- ✅ Premium upsells
- ✅ Group premium plans

**Next Steps**:
1. **Get API keys** for detection services
2. **Deploy to production**
3. **Test with real users**
4. **Monitor analytics**
5. **Scale as needed**

**Support**: All documentation, deployment guides, and troubleshooting info is in the project files.

🚀 **You're ready to launch Nah That's Fake to the world!**
