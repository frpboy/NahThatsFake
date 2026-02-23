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
  OWNER_TELEGRAM_ID: process.env.OWNER_TELEGRAM_ID!,
  // Optional but recommended
  SIGHTENGINE_API_KEY: process.env.SIGHTENGINE_API_KEY,
  SIGHTENGINE_API_SECRET: process.env.SIGHTENGINE_API_SECRET,
  GOOGLE_SAFE_BROWSING_KEY: process.env.GOOGLE_SAFE_BROWSING_KEY,
  VIRUSTOTAL_API_KEY: process.env.VIRUSTOTAL_API_KEY,
  TMA_URL: process.env.TMA_URL || 'https://google.com'
};

export function validateConfig() {
  const missing = requiredEnvVars.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
