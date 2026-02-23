
import { Context } from 'grammy';
import { supabase } from '../supabase';
import { consumeCredit } from '../utils/credits';
import crypto from 'crypto';

export async function processLinkCheck(ctx: Context) {
  const user = ctx.from;
  if (!user) return;

  const telegramUserId = user.id.toString();
  const text = ctx.message?.text;
  
  if (!text) return;

  try {
    // Extract URL from text
    const urlMatch = text.match(/https?:\/\/[^\s]+/);
    if (!urlMatch) {
      await ctx.reply('❌ No valid URL found in your message.');
      return;
    }

    const url = urlMatch[0];
    
    // Check credits
    const creditAvailable = await consumeCredit(telegramUserId, 'daily');
    if (!creditAvailable) {
      await ctx.reply('❌ No credits remaining. Use /refer to earn more or upgrade to premium!');
      return;
    }

    // Normalize URL for hashing
    const normalizedUrl = normalizeUrl(url);
    const urlHash = crypto.createHash('sha256').update(normalizedUrl).digest('hex');

    // Check cache first
    const { data: cached } = await supabase
      .from('check_cache')
      .select('*')
      .eq('check_type', 'link')
      .eq('content_hash', urlHash)
      .gt('expires_at', new Date().toISOString())
      .single();

    let result;
    if (cached) {
      result = {
        score: cached.score,
        risk_level: cached.risk_level,
        cached: true,
        api_source: cached.api_source
      };
    } else {
      // Call multiple APIs for link checking
      result = await checkLinkSafety(url);
      
      // Cache the result
      await supabase.from('check_cache').insert({
        check_type: 'link',
        content_hash: urlHash,
        score: result.score,
        risk_level: result.risk_level,
        api_source: result.api_source,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toString() // 7 days
      });
    }

    // Record the check
    await supabase.from('checks').insert({
      user_id: telegramUserId,
      check_type: 'link',
      content_hash: urlHash,
      score: result.score,
      risk_level: result.risk_level,
      cached: result.cached,
      api_source: result.api_source,
      credit_source: creditAvailable ? 'daily' : 'permanent'
    });

    // Send result
    const riskEmoji = result.risk_level === 'HIGH' ? '🔴' : result.risk_level === 'MEDIUM' ? '🟡' : '🟢';
    const scorePercent = (result.score * 100).toFixed(1);
    
    await ctx.reply(`${riskEmoji} *Link Check Result*

URL: \`${url}\`
Risk Level: *${result.risk_level}*
Threat Probability: *${scorePercent}%*

${result.cached ? '⚡ Cached result' : '🔄 Fresh analysis'}

⚠️ *Never click suspicious links!*

Need a detailed report? Open the full app for more insights.`, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: '📱 Open Full Report', web_app: { url: 'https://your-tma-url.com' } }
        ]]
      }
    });

  } catch (error) {
    console.error('Link check error:', error);
    await ctx.reply('❌ Sorry, I couldn\'t check that link. Please try again.');
  }
}

function normalizeUrl(url: string): string {
  // Basic URL normalization
  let normalized = url.toLowerCase().trim();
  
  // Remove common tracking parameters
  const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'fbclid', 'gclid'];
  const urlObj = new URL(normalized);
  
  trackingParams.forEach(param => {
    urlObj.searchParams.delete(param);
  });
  
  return urlObj.toString();
}

async function checkLinkSafety(url: string): Promise<any> {
  // Placeholder for link checking APIs
  // In production, implement calls to:
  // 1. Google Safe Browsing API
  // 2. VirusTotal API
  
  return {
    score: Math.random(), // Random for demo
    risk_level: Math.random() > 0.8 ? 'HIGH' : Math.random() > 0.5 ? 'MEDIUM' : 'LOW',
    api_source: 'combined',
    cached: false
  };
}