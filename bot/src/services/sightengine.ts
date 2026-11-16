
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
  | { state: 'pending' }   // a provider call may be in flight / may have happened (webhook mode)
  | { state: 'none' };

export async function checkImageCache(imageHash: string): Promise<ImageCacheState> {
  try {
    const { data, error } = await supabase
      .from('check_cache')
      .select('score, risk_level, api_source, scan_status')
      .eq('check_type', 'image')
      .eq('content_hash', imageHash)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !data) {
      return { state: 'none' };
    }

    if (data.scan_status === 'pending') {
      return { state: 'pending' };
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
 * Webhook mode: record the provider-call phase BEFORE the call. The pending
 * row expires after 10 minutes (a real call completes in well under one), so
 * a crash-orphaned marker cannot block later manual attempts for long.
 * Returns false when a live row already exists (another attempt owns it or a
 * previous attempt's outcome is uncertain) - the caller must NOT call the
 * provider then.
 */
export async function claimImagePendingScan(imageHash: string): Promise<'claimed' | 'blocked'> {
  const pendingExpiry = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const { error } = await supabase.from('check_cache').insert({
    check_type: 'image',
    content_hash: imageHash,
    score: 0,
    risk_level: 'LOW',
    api_source: 'sightengine',
    scan_status: 'pending',
    expires_at: pendingExpiry
  });
  if (!error) return 'claimed';
  if ((error as { code?: string }).code !== '23505') {
    console.error('Pending-scan claim error:', error);
    return 'blocked';
  }
  // Row exists: reclaim only an EXPIRED pending marker, guarded so a
  // concurrent claimant cannot both reclaim.
  const { data: reclaimed } = await supabase
    .from('check_cache')
    .update({ scan_status: 'pending', expires_at: pendingExpiry })
    .eq('check_type', 'image')
    .eq('content_hash', imageHash)
    .eq('scan_status', 'pending')
    .lt('expires_at', new Date().toISOString())
    .select('content_hash');
  return reclaimed && reclaimed.length === 1 ? 'claimed' : 'blocked';
}

/** Definitive provider failure: drop the pending marker so a retry is safe. */
export async function clearImagePendingScan(imageHash: string): Promise<void> {
  try {
    await supabase
      .from('check_cache')
      .delete()
      .eq('check_type', 'image')
      .eq('content_hash', imageHash)
      .eq('scan_status', 'pending');
  } catch (error) {
    console.error('Pending-scan clear error:', error);
  }
}

export async function saveImageCache(
  imageHash: string,
  score: number,
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW',
  apiSource: string
): Promise<void> {
  try {
    // Upsert so the row flips from 'pending' to 'complete' in webhook mode and
    // a plain insert still works in long-poll mode.
    await supabase.from('check_cache').upsert({
      check_type: 'image',
      content_hash: imageHash,
      score,
      risk_level: riskLevel,
      api_source: apiSource,
      scan_status: 'complete',
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
    }, { onConflict: 'check_type,content_hash' });
  } catch (error) {
    console.error('Cache save error:', error);
    // Don't throw - cache failure shouldn't break the main flow
  }
}