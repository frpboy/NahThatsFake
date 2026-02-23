import { supabase } from '../supabase';

export async function logAdminAction(
  adminTelegramId: string,
  action: string,
  details: any,
  targetUserId?: string,
  targetGroupId?: string
) {
  try {
    // Get admin's internal ID
    const { data: admin } = await supabase
      .from('users')
      .select('id')
      .eq('telegram_user_id', adminTelegramId)
      .single();

    if (!admin) {
      console.error(`Admin log failed: Admin ${adminTelegramId} not found`);
      return;
    }

    // Resolve target IDs if provided as Telegram IDs
    let targetUserUuid = null;
    if (targetUserId) {
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('telegram_user_id', targetUserId)
        .single();
      targetUserUuid = user?.id;
    }

    // Insert log
    await supabase.from('admin_logs').insert({
      admin_id: admin.id,
      action,
      details,
      target_user_id: targetUserUuid,
      target_group_id: targetGroupId // Assuming UUID for now
    });

  } catch (error) {
    console.error('Admin logging error:', error);
  }
}
