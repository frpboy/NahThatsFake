export type AbuseEnforcementAction = 'HARD_BAN' | 'TEMP_BAN' | 'THROTTLE';

export type EnforcementWriteResult = {
  data: { id: string } | null;
  error: { code?: string | null } | null;
};

/**
 * Treat an enforcement update as successful only when Supabase returns the
 * updated user row. PostgREST errors and zero-row updates are not success.
 */
export async function persistEnforcementWrite(
  action: AbuseEnforcementAction,
  write: () => Promise<EnforcementWriteResult>,
  reportFailure: (action: AbuseEnforcementAction, code: string) => void,
): Promise<boolean> {
  try {
    const result = await write();
    if (result.error) {
      reportFailure(action, result.error.code ?? 'database_error');
      return false;
    }

    if (!result.data?.id) {
      reportFailure(action, 'no_row_updated');
      return false;
    }

    return true;
  } catch {
    reportFailure(action, 'transport_error');
    return false;
  }
}
