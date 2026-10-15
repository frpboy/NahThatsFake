
import { Context } from 'grammy';
import { supabase } from '../supabase';

// Plan Configuration
const PLANS: Record<string, { days?: number; credits?: number; name: string }> = {
  'ind_weekly': { days: 7, name: 'Weekly Pass' },
  'ind_monthly': { days: 30, name: 'Monthly Premium' },
  'ind_annual': { days: 365, name: 'Annual Premium' },
  'ind_lifetime': { days: 36500, name: 'Lifetime Premium' },
  'credits_50': { credits: 50, name: '50 Credits Pack' },
  'credits_100': { credits: 100, name: '100 Credits Pack' },
};

// Handle pre-checkout query (must be answered within 10 seconds)
export async function handlePreCheckout(ctx: Context) {
  await ctx.answerPreCheckoutQuery(true);
}

// Handle successful payment
export async function handleSuccessfulPayment(ctx: Context) {
  if (!ctx.message?.successful_payment) return;

  const payment = ctx.message.successful_payment;
  const user = ctx.from;
  
  if (!user) return;

  // Extract payload info
  // Payload: JSON string { userId, planId, type: 'stars' }
  let payload;
  try {
    payload = JSON.parse(payment.invoice_payload);
  } catch (e) {
    console.error('Failed to parse invoice payload:', payment.invoice_payload);
    return;
  }

  const { planId } = payload;
  const amountStars = payment.total_amount; // amount in Stars
  const chargeId = payment.telegram_payment_charge_id;
  const planDetails = PLANS[planId];

  if (!planDetails) {
    console.error('Invalid plan ID:', planId);
    return;
  }

  try {
    // 1. Find user UUID
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('telegram_user_id', user.id.toString())
      .single();

    if (!userData) {
      console.error('User not found for payment:', user.id);
      return;
    }

    const premiumUntil = planDetails.days 
      ? new Date(Date.now() + planDetails.days * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const { error: fulfillmentError } = await supabase.rpc('fulfill_payment', {
      p_user_id: userData.id,
      p_plan_id: planId,
      p_payment_id: chargeId,
      p_payment_method: 'stars',
      p_amount_stars: amountStars,
      p_premium_until: premiumUntil,
      p_credits: planDetails.credits || 0
    });
    if (fulfillmentError) {
      console.error('Failed to fulfill payment:', fulfillmentError);
      return;
    }

    if (planDetails.credits) {
      await ctx.reply(`🎉 *Payment Successful!*

Added ${planDetails.credits} permanent credits to your account.
Use /credits to check your balance.`, { parse_mode: 'Markdown' });

    } else {
      await ctx.reply(`🎉 *Payment Successful!*

You are now a Premium member.
Enjoy unlimited checks and priority support!

Plan: ${planDetails.name}`, { parse_mode: 'Markdown' });
    }

  } catch (error) {
    console.error('Payment processing error:', error);
    await ctx.reply('⚠️ Payment received but there was an error updating your account. Please contact support.');
  }
}
