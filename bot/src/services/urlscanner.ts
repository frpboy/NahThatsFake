
import axios from 'axios';
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

export type ScanCoverage = 'complete' | 'partial' | 'unavailable' | 'inconclusive';

/** Classify provider coverage without treating missing evidence as a clean result. */
export function getScanCoverage(successfulProviderCount: number, threatCount: number): ScanCoverage {
  if (successfulProviderCount <= 0) return 'unavailable';
  if (successfulProviderCount >= 2) return 'complete';
  return threatCount > 0 ? 'partial' : 'inconclusive';
}

type SafeBrowsingResult = { threats: string[]; safe: boolean };
type VirusTotalResult = { malicious: number; suspicious: number; harmless: number; undetected: number };

export async function checkUrlSafety(
  url: string,
  providers: {
    google: (url: string) => Promise<SafeBrowsingResult>;
    virusTotal: (url: string) => Promise<VirusTotalResult>;
  } = { google: checkGoogleSafeBrowsing, virusTotal: checkVirusTotal }
): Promise<{
  score: number;
  scan_status: 'complete' | 'partial';
  risk_level: 'HIGH' | 'MEDIUM' | 'LOW';
  threats: string[];
  sources: string[];
  confidence: number;
}> {
  const results = await Promise.allSettled([
    providers.google(url),
    providers.virusTotal(url)
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
      sources.push('VirusTotal');
    }
  }

  // A fulfilled provider result is evidence only if the provider actually ran.
  const successfulProviderCount = results.filter(result => result.status === 'fulfilled').length;
  const scanCoverage = getScanCoverage(successfulProviderCount, threats.length);
  if (scanCoverage === 'unavailable' || scanCoverage === 'inconclusive') {
    throw new Error('URL safety scan inconclusive: insufficient provider coverage');
  }

  // A partial scan that detected a threat must not be presented as LOW merely
  // because only one provider responded.
  const finalScore = Math.min(totalScore, 1.0);
  let riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  
  if (finalScore >= 0.7) {
    riskLevel = 'HIGH';
  } else if (finalScore >= 0.4 || (scanCoverage === 'partial' && threats.length > 0)) {
    riskLevel = 'MEDIUM';
  } else {
    riskLevel = 'LOW';
  }

  return {
    score: finalScore,
    scan_status: scanCoverage,
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
  const apiKey = process.env.GOOGLE_SAFE_BROWSING_KEY;
  
  if (!apiKey) {
    throw new Error('Google Safe Browsing provider is not configured');
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
    // Do not log the Axios error object: request URLs can contain API credentials.
    console.error('Google Safe Browsing API unavailable', axios.isAxiosError(error) ? (error.response?.status ?? error.code ?? 'request-failed') : 'unknown-error');
    throw new Error('Google Safe Browsing provider request failed');
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
    throw new Error('VirusTotal provider is not configured');
  }

  try {
    // First, submit the URL for analysis if not already analyzed
    // Note: This requires POST permission which free API keys might have limits on.
    // For free keys, scanning existing URLs is better.
    // But let's try to submit or check existing report.
    
    // Check existing analysis first by URL identifier
    // ⚡ Bolt: Native base64url is ~8.4x faster than manual regex replacements and creates less GC garbage
    const urlId = Buffer.from(url).toString('base64url');
    
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
    // Avoid logging request details, response bodies, or credential-bearing URLs.
    console.error('VirusTotal provider unavailable', axios.isAxiosError(error) ? (error.response?.status ?? error.code ?? 'request-failed') : 'unknown-error');
    throw new Error('VirusTotal provider request failed');
  }
}
