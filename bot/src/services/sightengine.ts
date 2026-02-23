
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