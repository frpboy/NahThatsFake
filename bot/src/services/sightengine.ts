
import axios from 'axios';
import crypto from 'crypto';
import { supabase } from '../supabase';

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

export interface SightengineScores {
  synthetic: number;
  human: number;
}

const SIGHTENGINE_SCORE_FIELDS = ['synthetic', 'human'] as const;

/**
 * Validate a Sightengine response before any score is read from it.
 * A non-success status, or a missing / non-numeric / out-of-range score,
 * throws: an invalid response is a provider failure and must never be
 * turned into a verdict (previously, a missing `scores` object produced
 * `undefined`, failed both thresholds, and returned a fabricated LOW).
 */
export function validateSightengineScores(data: unknown): SightengineScores {
  if (!data || typeof data !== 'object') {
    throw new Error('Sightengine returned an invalid response');
  }
  const record = data as { status?: unknown; scores?: unknown };
  if (record.status !== 'success') {
    throw new Error('Sightengine returned a non-success response');
  }
  if (!record.scores || typeof record.scores !== 'object') {
    throw new Error('Sightengine response is missing scores');
  }
  const scores = record.scores as Record<string, unknown>;
  const validated = {} as SightengineScores;
  for (const field of SIGHTENGINE_SCORE_FIELDS) {
    const value = scores[field];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
      throw new Error(`Sightengine score "${field}" is missing or invalid`);
    }
    validated[field] = value;
  }
  return validated;
}

/** Compute the verdict from an already-received response, validating first. */
export function interpretSightengineResult(data: SightengineResponse): {
  score: number;
  risk_level: 'HIGH' | 'MEDIUM' | 'LOW';
  confidence: number;
} {
  const scores = validateSightengineScores(data);

  let riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  if (scores.synthetic >= 0.8) {
    riskLevel = 'HIGH';
  } else if (scores.synthetic >= 0.5) {
    riskLevel = 'MEDIUM';
  } else {
    riskLevel = 'LOW';
  }

  return {
    score: scores.synthetic,
    risk_level: riskLevel,
    confidence: Math.max(scores.synthetic, scores.human)
  };
}

export async function detectDeepfake(imageBuffer: Buffer): Promise<{
  score: number;
  risk_level: 'HIGH' | 'MEDIUM' | 'LOW';
  confidence: number;
  raw_response: SightengineResponse;
}> {
  const apiKey = process.env.SIGHTENGINE_API_KEY;
  const apiSecret = process.env.SIGHTENGINE_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error('Sightengine API credentials not configured');
  }

  let data: SightengineResponse;
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
      timeout: 30000 // 30 second timeout
    });

    data = response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      // Preserve timeouts as timeouts: callers report them as an
      // inconclusive image check, not as a generic failure or a verdict.
      if (error.code === 'ECONNABORTED' || /timeout/i.test(error.message)) {
        throw new Error('Image analysis timed out');
      }

      const status = error.response?.status;
      
      console.error('Sightengine API error:', {
        status: status,
        data: error.response?.data,
        message: error.message
      });
      
      if (status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      } else if (status === 401) {
        throw new Error('Invalid API credentials');
      } else if (status && status >= 500) {
        throw new Error('Service temporarily unavailable');
      }
    }
    
    throw new Error('Failed to analyze image. Please try again.');
  }

  // Validation runs outside the request try/catch on purpose: a malformed
  // or error response throws here and surfaces to the caller as an
  // inconclusive image check, never as a LOW verdict.
  const verdict = interpretSightengineResult(data);
  return {
    ...verdict,
    raw_response: data
  };
}

export async function checkImageCache(imageHash: string): Promise<{
  found: boolean;
  score?: number;
  risk_level?: 'HIGH' | 'MEDIUM' | 'LOW';
  api_source?: string;
}> {
  try {
    const { data, error } = await supabase
      .from('check_cache')
      .select('score, risk_level, api_source')
      .eq('check_type', 'image')
      .eq('content_hash', imageHash)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !data) {
      return { found: false };
    }

    return {
      found: true,
      score: data.score,
      risk_level: data.risk_level,
      api_source: data.api_source
    };
  } catch (error) {
    console.error('Cache check error:', error);
    return { found: false };
  }
}

export async function saveImageCache(
  imageHash: string,
  score: number,
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW',
  apiSource: string
): Promise<void> {
  try {
    await supabase.from('check_cache').insert({
      check_type: 'image',
      content_hash: imageHash,
      score,
      risk_level: riskLevel,
      api_source: apiSource,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
    });
  } catch (error) {
    console.error('Cache save error:', error);
    // Don't throw - cache failure shouldn't break the main flow
  }
}