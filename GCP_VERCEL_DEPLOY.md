
# 🚀 **GCP DEPLOYMENT GUIDE (Bot on e2-micro)**

## ✅ **Step 1: Prepare GCP Instance**
1. **Create e2-micro instance** (Ubuntu 22.04 LTS)
2. **Open SSH terminal**
3. **Install Docker & Git**:
   ```bash
   sudo apt update && sudo apt install -y git docker.io docker-compose
   sudo usermod -aG docker $USER
   # Log out and back in for group changes to take effect
   ```

## ✅ **Step 2: Deploy Bot**
1. **Clone Repository**:
   ```bash
   git clone https://github.com/frpboy/NahThatsFake.git
   cd NahThatsFake
   ```

2. **Configure Environment**:
   ```bash
   # Create .env file with your production keys
   nano bot/.env
   # Paste contents from your local bot/.env
   ```

3. **Start Bot with Docker**:
   ```bash
   # Build and start bot container in background
   docker-compose up -d bot
   
   # Check logs to confirm startup
   docker-compose logs -f bot
   ```

4. **Verify Running**:
   - Bot should be online in Telegram
   - Logs should show "Bot @NahThatsFakeBot started!"

## ✅ **Step 3: Maintenance**
- **Update Bot**: `git pull && docker-compose up -d --build bot`
- **Restart**: `docker-compose restart bot`
- **View Logs**: `docker-compose logs --tail=100 -f bot`

---

# 🚀 **VERCEL DEPLOYMENT GUIDE (TMA)**

## ✅ **Step 1: Project Setup**
1. **Install Vercel CLI**:
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

## ✅ **Step 2: Deploy TMA**
1. **Navigate to TMA folder**:
   ```bash
   cd tma
   ```

2. **Deploy to Production**:
   ```bash
   vercel --prod
   ```

3. **Configure Environment Variables**:
   - Go to Vercel Dashboard > Project > Settings > Environment Variables
   - Add the following keys from `tma/.env`:
     - `SUPABASE_URL`
     - `SUPABASE_ANON_KEY`
     - `RAZORPAY_KEY_ID`
     - `RAZORPAY_KEY_SECRET`

## ✅ **Step 3: Final Configuration**
1. **Get Vercel URL**: Copy the production URL (e.g., `https://nahthatsfake-tma.vercel.app`)
2. **Update Bot**:
   - Update `TMA_URL` in `bot/.env` on GCP
   - Restart bot: `docker-compose restart bot`
3. **Update Telegram**:
   - Open @BotFather
   - Select your bot
   - Menu Button > Configure Menu Button > Set URL to your Vercel URL

## 🎉 **DEPLOYMENT COMPLETE!**
- **Bot**: Running 24/7 on GCP e2-micro (Docker)
- **TMA**: Hosted globally on Vercel (Serverless)
- **Database**: Managed Supabase
