import { createClient } from '@supabase/supabase-js';
import { config } from './config';

// Bound every PostgREST/Auth call: without a timeout a hung DB connection
// would pin a webhook delivery (and its claim) until the platform kill.
// An explicit caller signal always wins over the default 30s timeout.
const fetchWithTimeout: typeof fetch = (input, init) =>
  fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(30_000) });

export const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
  global: { fetch: fetchWithTimeout }
});
