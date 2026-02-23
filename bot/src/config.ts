import dotenv from 'dotenv';

dotenv.config();

const requiredEnvVars = [
  'BOT_TOKEN',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'OWNER_TELEGRAM_ID'
];

export const config = {
  BOT_TOKEN: process.env.BOT_TOKEN!,
  SUPABASE_URL: process.env.SUPABASE_URL!,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  OWNER_TELEGRAM_ID: process.env.OWNER_TELEGRAM_ID || '', // Optional to prevent crash
  // Optional but recommended
  SIGHTENGINE_API_KEY: process.env.SIGHTENGINE_API_KEY,
  SIGHTENGINE_API_SECRET: process.env.SIGHTENGINE_API_SECRET,
  GOOGLE_SAFE_BROWSING_KEY: process.env.GOOGLE_SAFE_BROWSING_KEY,
  VIRUSTOTAL_API_KEY: process.env.VIRUSTOTAL_API_KEY,
  TMA_URL: process.env.TMA_URL || 'https://nahthatsfake.vercel.app',
  ADSGRAM_TOKEN: process.env.ADSGRAM_TOKEN,
  ADSGRAM_BLOCK_ID: process.env.ADSGRAM_BLOCK_ID,
  ADSGRAM_LANGUAGE: process.env.ADSGRAM_LANGUAGE
};

export function validateConfig() {
  const missing = requiredEnvVars.filter(key => {
    // Optional vars that might be in the list but are now handled gracefully
    if (key === 'OWNER_TELEGRAM_ID') return false;
    return !process.env[key];
  });
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  if (!process.env.OWNER_TELEGRAM_ID) {
    console.warn('⚠️ OWNER_TELEGRAM_ID is not set. Admin commands will be disabled.');
  }
}
