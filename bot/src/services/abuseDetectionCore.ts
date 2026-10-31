export type AbuseFlagInsertError = { code?: string | null };

export type AbuseFlagResult =
  | { recorded: false; enforcement: 'skipped'; reason: 'insert_failed' }
  | { recorded: true; enforcement: 'completed' }
  | { recorded: true; enforcement: 'failed'; reason: 'enforcement_failed' };

export type AbuseFlagDependencies = {
  insertFlag: (flag: { user_id: string; flag_type: string; details: any; auto_action: 'pending' }) => Promise<{ error: AbuseFlagInsertError | null }>;
  enforce: (userId: string) => Promise<void>;
  logError: (event: 'insert_failed' | 'enforcement_failed', code?: string) => void;
};

export async function recordAbuseFlag(
  userId: string,
  flagType: string,
  details: any,
  dependencies: AbuseFlagDependencies
): Promise<AbuseFlagResult> {
  let insertResult: { error: AbuseFlagInsertError | null };

  try {
    insertResult = await dependencies.insertFlag({
      user_id: userId,
      flag_type: flagType,
      details,
      auto_action: 'pending'
    });
  } catch {
    dependencies.logError('insert_failed', 'transport_error');
    return { recorded: false, enforcement: 'skipped', reason: 'insert_failed' };
  }

  if (insertResult.error) {
    dependencies.logError('insert_failed', insertResult.error.code ?? 'database_error');
    return { recorded: false, enforcement: 'skipped', reason: 'insert_failed' };
  }

  try {
    await dependencies.enforce(userId);
    return { recorded: true, enforcement: 'completed' };
  } catch {
    dependencies.logError('enforcement_failed');
    return { recorded: true, enforcement: 'failed', reason: 'enforcement_failed' };
  }
}
