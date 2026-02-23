
import axios from 'axios';
import { supabase } from '../supabase';

interface SafeBrowsingThreat {
  threatType: string;
  platformType: string;
  threatEntryType: string;
  threat: {
    url: string;
  };
}

interface VirusTotalResponse {
  data: {
    attributes: {
      last_analysis_stats: {
        malicious: number;
        suspicious: number;
        harmless: number;
        undetected: number;
      };
      last_analysis_results: {
        [engine: string]: {
          category: string;
          result: string;
        };
      };
    };
  };
}

export async function checkUrlSafety(url: string): Promise<{
  score: number;
  risk_level: 'HIGH' | 'MEDIUM' | 'LOW';
  threats: string[];
  sources: string[];
  confidence: number;
}> {
  const results = await Promise.allSettled([
    checkGoogleSafeBrowsing(url),
    checkVirusTotal(url)
  ]);

  let totalScore = 0;
  let threatCount = 0;
  const threats: string[] = [];
  const sources: string[] = [];

  // Process Google Safe Browsing results
  if (results[0].status === 'fulfilled') {
    const safeBrowsingResult = results[0].value;
    if (safeBrowsingResult.threats.length > 0) {
      totalScore += 0.8; // High weight for Google Safe Browsing
      threatCount++;
      threats.push(...safeBrowsingResult.threats);
      sources.push('Google Safe Browsing');
    }
  }

  // Process VirusTotal results
  if (results[1].status === 'fulfilled') {
    const virusTotalResult = results[1].value;
    if (virusTotalResult.malicious > 0) {
      totalScore += virusTotalResult.malicious * 0.1;
      threatCount++;
      threats.push(`VirusTotal: ${virusTotalResult.malicious} engines flagged`);
      sources.push('VirusTotal');
    }
    
    if (virusTotalResult.suspicious > 0) {
      totalScore += virusTotalResult.suspicious * 0.05;
      threats.push(`VirusTotal: ${virusTotalResult.suspicious} engines suspicious`);
    }
  }

  // Calculate final score and risk level
  const finalScore = Math.min(totalScore, 1.0);
  let riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  
  if (finalScore >= 0.7) {
    riskLevel = 'HIGH';
  } else if (finalScore >= 0.4) {
    riskLevel = 'MEDIUM';
  } else {
    riskLevel = 'LOW';
  }

  return {
    score: finalScore,
    risk_level: riskLevel,
    threats: [...new Set(threats)], // Remove duplicates
    sources: [...new Set(sources)],
    confidence: Math.min(threatCount * 0.3 + 0.4, 1.0) // Base confidence
  };
}

async function checkGoogleSafeBrowsing(url: string): Promise<{
  threats: string[];
  safe: boolean;
}> {
  const apiKey = process.env.GOOGLE_SAFE_BROWSING_API_KEY;
  
  if (!apiKey) {
    console.warn('Google Safe Browsing API key not configured');
    return { threats: [], safe: true };
  }

  try {
    const response = await axios.post(
      `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey}`,
      {
        client: {
          clientId: 'nahthatsfake',
          clientVersion: '1.0.0'
        },
        threatInfo: {
          threatTypes: [
            'MALWARE',
            'SOCIAL_ENGINEERING',
            'UNWANTED_SOFTWARE',
            'POTENTIALLY_HARMFUL_APPLICATION'
          ],
          platformTypes: ['ANY_PLATFORM'],
          threatEntryTypes: ['URL'],
          threatEntries: [{ url }]
        }
      },
      {
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    const matches = response.data.matches || [];
    const threats = matches.map((match: SafeBrowsingThreat) => match.threatType);
    
    return {
      threats,
      safe: threats.length === 0
    };

  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('Google Safe Browsing API error:', error.response?.data || error.message);
    }
    
    // Fail safe - assume URL is safe if API fails
    return { threats: [], safe: true };
  }
}

async function checkVirusTotal(url: string): Promise<{
  malicious: number;
  suspicious: number;
  harmless: number;
  undetected: number;
}> {
  const apiKey = process.env.VIRUSTOTAL_API_KEY;
  
  if (!apiKey) {
    console.warn('VirusTotal API key not configured');
    return { malicious: 0, suspicious: 0, harmless: 0, undetected: 0 };
  }

  try {
    // First, submit the URL for analysis if not already analyzed
    // Note: This requires POST permission which free API keys might have limits on.
    // For free keys, scanning existing URLs is better.
    // But let's try to submit or check existing report.
    
    // Check existing analysis first by URL identifier
    const urlId = Buffer.from(url).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    
    try {
        const reportResponse = await axios.get(
            `https://www.virustotal.com/api/v3/urls/${urlId}`,
            {
                headers: {
                    'x-apikey': apiKey
                },
                timeout: 5000
            }
        );
        
        const stats = reportResponse.data.data.attributes.last_analysis_stats;
        return {
            malicious: stats.malicious || 0,
            suspicious: stats.suspicious || 0,
            harmless: stats.harmless || 0,
            undetected: stats.undetected || 0
        };
    } catch (e) {
        // If not found, submit it
        const submitResponse = await axios.post(
          'https://www.virustotal.com/api/v3/urls',
          `url=${encodeURIComponent(url)}`,
          {
            headers: {
              'x-apikey': apiKey,
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            timeout: 10000
          }
        );

        const analysisId = submitResponse.data.data.id;
        
        // Wait a moment for analysis to complete
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Get analysis results
        const analysisResponse = await axios.get(
          `https://www.virustotal.com/api/v3/analyses/${analysisId}`,
          {
            headers: {
              'x-apikey': apiKey
            },
            timeout: 10000
          }
        );

        const stats = analysisResponse.data.data.attributes.stats;
        
        return {
          malicious: stats.malicious || 0,
          suspicious: stats.suspicious || 0,
          harmless: stats.harmless || 0,
          undetected: stats.undetected || 0
        };
    }

  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('VirusTotal API error:', error.response?.data || error.message);
    }
    
    // Return neutral results if API fails
    return { malicious: 0, suspicious: 0, harmless: 0, undetected: 0 };
  }
}
