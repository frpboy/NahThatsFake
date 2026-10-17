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
    let targetGroupUuid = null;

    const promises = [];
    let userPromiseIndex = -1;
    let groupPromiseIndex = -1;

    if (targetUserId) {
      promises.push(
        supabase
          .from('users')
          .select('id')
          .eq('telegram_user_id', targetUserId)
          .maybeSingle()
      );
      userPromiseIndex = promises.length - 1;
    }

    if (targetGroupId) {
      const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidLike.test(targetGroupId)) {
        targetGroupUuid = targetGroupId;
      } else {
        promises.push(
          supabase
            .from('groups')
            .select('id')
            .eq('telegram_group_id', targetGroupId)
            .maybeSingle()
        );
        groupPromiseIndex = promises.length - 1;
      }
    }

    if (promises.length > 0) {
      const results = await Promise.all(promises);

      if (userPromiseIndex !== -1) {
        targetUserUuid = results[userPromiseIndex].data?.id || null;
      }

      if (groupPromiseIndex !== -1) {
        targetGroupUuid = results[groupPromiseIndex].data?.id || null;
      }
    }

    // Insert log
    await supabase.from('admin_logs').insert({
      admin_id: admin.id,
      action,
      details,
      target_user_id: targetUserUuid,
      target_group_id: targetGroupUuid
    });

  } catch (error) {
    console.error('Admin logging error:', error);
  }
}
