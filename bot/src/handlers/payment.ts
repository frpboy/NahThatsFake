
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
      .select('id, permanent_credits')
      .eq('telegram_user_id', user.id.toString())
      .single();

    if (!userData) {
      console.error('User not found for payment:', user.id);
      return;
    }

    // 2. Record payment
    const premiumUntil = planDetails.days 
      ? new Date(Date.now() + planDetails.days * 24 * 60 * 60 * 1000).toISOString()
      : null;

    await supabase.from('payments').insert({
      user_id: userData.id,
      plan_id: planId,
      amount_stars: amountStars,
      payment_method: 'stars',
      payment_id: chargeId,
      status: 'success',
      premium_from: new Date().toISOString(),
      premium_until: premiumUntil
    });

    // 3. Update user
    if (planDetails.credits) {
      // Credit Pack: Add credits, don't change plan
      await supabase.from('users').update({
        permanent_credits: (userData.permanent_credits || 0) + planDetails.credits,
        last_payment_id: chargeId,
        last_paid_at: new Date().toISOString()
      }).eq('id', userData.id);

      await ctx.reply(`🎉 *Payment Successful!*

Added ${planDetails.credits} permanent credits to your account.
Use /credits to check your balance.`, { parse_mode: 'Markdown' });

    } else {
      // Subscription: Update plan
      await supabase.from('users').update({
        plan: planId,
        premium_until: premiumUntil,
        last_payment_id: chargeId,
        last_paid_at: new Date().toISOString()
      }).eq('id', userData.id);

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
