
import axios from 'axios';
import crypto from 'crypto';
import { supabase } from '../supabase';
import { ScanAmbiguousError, ScanDefinitiveError } from '../errors';

interface SightengineResponse {
  status: string;
  request: {
    id: string;
    timestamp: number;
    operations: number;
  };
  scores: {
    synthetic: number;
    human: number;
  };
  media: {
    id: string;
    uri: string;
  };
}

export async function detectDeepfake(imageBuffer: Buffer, signal?: AbortSignal): Promise<{
  score: number;
  risk_level: 'HIGH' | 'MEDIUM' | 'LOW';
  confidence: number;
  raw_response: SightengineResponse;
}> {
  const apiKey = process.env.SIGHTENGINE_API_KEY;
  const apiSecret = process.env.SIGHTENGINE_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new ScanDefinitiveError('Sightengine API credentials not configured');
  }

  try {
    // Convert buffer to base64
    const base64Image = imageBuffer.toString('base64');

    // Call Sightengine API
    const response = await axios.post('https://api.sightengine.com/1.0/check.json', {
      'api_user': apiKey,
      'api_secret': apiSecret,
      'models': 'genai',
      'base64': base64Image,
      'workflow': 'standard'
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 30000, // 30 second timeout
      signal
    });

    const data: SightengineResponse = response.data;

    // Calculate risk level based on synthetic score
    const syntheticScore = data.scores.synthetic;
    let riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
    
    if (syntheticScore >= 0.8) {
      riskLevel = 'HIGH';
    } else if (syntheticScore >= 0.5) {
      riskLevel = 'MEDIUM';
    } else {
      riskLevel = 'LOW';
    }

    return {
      score: syntheticScore,
      risk_level: riskLevel,
      confidence: Math.max(data.scores.synthetic, data.scores.human),
      raw_response: data
    };

  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;

      console.error('Sightengine API error:', {
        status: status,
        data: error.response?.data,
        message: error.message
      });

      // A definitive response (incl. HTTP errors) means the provider answered:
      // no analysis spend is uncertain, and a later retry is safe. Timeouts,
      // aborts and connection failures leave the spend unknown.
      if (error.response) {
        if (status === 429) {
          throw new ScanDefinitiveError('Rate limit exceeded. Please try again later.');
        } else if (status === 401) {
          throw new ScanDefinitiveError('Invalid API credentials');
        } else if (status && status >= 500) {
          throw new ScanDefinitiveError('Service temporarily unavailable');
        }
        throw new ScanDefinitiveError('Failed to analyze image. Please try again.');
      }
      throw new ScanAmbiguousError('No response from analysis provider (timeout/abort/network)');
    }

    throw new ScanAmbiguousError('Failed to analyze image. Please try again.');
  }
}

export type ImageCacheState =
  | { state: 'complete'; score: number; risk_level: 'HIGH' | 'MEDIUM' | 'LOW'; api_source?: string }
  // a provider call may be in flight / may have happened (webhook mode);
  // pendingUpdateId identifies the operation that owns the marker
  | { state: 'pending'; pendingUpdateId: number | null }
  | { state: 'none' };

// A cache lookup must see pending markers regardless of their (short) expiry:
// expiry bounds cache reuse, never spend uncertainty.
export async function checkImageCache(imageHash: string): Promise<ImageCacheState> {
  try {
    const { data, error } = await supabase
      .from('check_cache')
      .select('score, risk_level, api_source, scan_status, pending_update_id, expires_at')
      .eq('check_type', 'image')
      .eq('content_hash', imageHash)
      .single();

    if (error || !data) {
      return { state: 'none' };
    }

    if (data.scan_status === 'pending') {
      return { state: 'pending', pendingUpdateId: data.pending_update_id ?? null };
    }

    if (new Date(data.expires_at).getTime() <= Date.now()) {
      return { state: 'none' };
    }

    return {
      state: 'complete',
      score: data.score,
      risk_level: data.risk_level,
      api_source: data.api_source
    };
  } catch (error) {
    console.error('Cache check error:', error);
    return { state: 'none' };
  }
}

/**
 * Webhook mode: record the provider-call phase BEFORE the call, bound to the
 * operation that owns it. 'claimed' = this operation owns a fresh marker.
 * 'blocked' = another/uncertain attempt owns the marker: the caller must NOT
 * call the provider. A marker is never reclaimed because time passed; only an
 * explicit NEW user operation (different update_id) may take it over, via a
 * guarded update so exactly one claimant wins.
 */
export async function claimImagePendingScan(imageHash: string, updateId: number): Promise<'claimed' | 'blocked'> {
  const pendingExpiry = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const { error } = await supabase.from('check_cache').insert({
    check_type: 'image',
    content_hash: imageHash,
    score: 0,
    risk_level: 'LOW',
    api_source: 'sightengine',
    scan_status: 'pending',
    pending_update_id: updateId,
    expires_at: pendingExpiry
  });
  if (!error) return 'claimed';
  if ((error as { code?: string }).code !== '23505') {
    console.error('Pending-scan claim error:', error);
    return 'blocked';
  }
  // Row exists. Only a DIFFERENT operation (a fresh user-initiated scan, not a
  // retry of the uncertain attempt) may reclaim it, guarded by the observed
  // owner so concurrent reclaimers cannot both win.
  const { data: existing } = await supabase
    .from('check_cache')
    .select('pending_update_id')
    .eq('check_type', 'image')
    .eq('content_hash', imageHash)
    .eq('scan_status', 'pending')
    .single();
  if (!existing || existing.pending_update_id == null || existing.pending_update_id === updateId) {
    return 'blocked';
  }
  const { data: reclaimed } = await supabase
    .from('check_cache')
    .update({ pending_update_id: updateId, expires_at: pendingExpiry })
    .eq('check_type', 'image')
    .eq('content_hash', imageHash)
    .eq('scan_status', 'pending')
    .eq('pending_update_id', existing.pending_update_id)
    .select('content_hash');
  return reclaimed && reclaimed.length === 1 ? 'claimed' : 'blocked';
}

/**
 * Definitive provider failure: drop the pending marker (only if this operation
 * still owns it) so a later retry is safe.
 */
export async function clearImagePendingScan(imageHash: string, updateId?: number): Promise<void> {
  try {
    let q = supabase
      .from('check_cache')
      .delete()
      .eq('check_type', 'image')
      .eq('content_hash', imageHash)
      .eq('scan_status', 'pending');
    if (updateId !== undefined) q = q.eq('pending_update_id', updateId);
    await q;
  } catch (error) {
    console.error('Pending-scan clear error:', error);
  }
}

export async function saveImageCache(
  imageHash: string,
  score: number,
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW',
  apiSource: string,
  updateId?: number
): Promise<void> {
  const completed = {
    score,
    risk_level: riskLevel,
    api_source: apiSource,
    scan_status: 'complete' as const,
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
  };
  try {
    if (updateId !== undefined) {
      // Webhook mode: flip OUR pending marker. Identity-bound: another
      // operation's marker is never overwritten (a fresh user operation that
      // reclaimed it owns the row now; its own result will land there).
      const { data, error } = await supabase
        .from('check_cache')
        .update(completed)
        .eq('check_type', 'image')
        .eq('content_hash', imageHash)
        .eq('scan_status', 'pending')
        .eq('pending_update_id', updateId)
        .select('content_hash');
      if (error || !data || data.length !== 1) {
        // The result stays deliverable to the user (the spend happened and we
        // hold the value), but it is not durably cached: log loudly and leave
        // any marker in place so re-scans stay conservative.
        console.error('Cache completion write did not match our pending marker:', error ?? '0 rows / marker lost');
      }
      return;
    }
    // Long-poll mode: plain insert (legacy behavior).
    await supabase.from('check_cache').insert({
      check_type: 'image',
      content_hash: imageHash,
      score,
      risk_level: riskLevel,
      api_source: apiSource,
      expires_at: completed.expires_at
    });
  } catch (error) {
    console.error('Cache save error:', error);
    // Don't throw - cache failure shouldn't break the main flow
  }
}