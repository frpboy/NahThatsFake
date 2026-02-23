import axios from 'axios';

export interface AdsGramAd {
  text_html: string;
  click_url: string;
  button_name: string;
  image_url?: string;
  button_reward_name?: string;
  reward_url?: string;
}

export async function fetchAdsGramAd(params: {
  tgid: string;
  blockid: string;
  language?: string;
  token: string;
}): Promise<AdsGramAd | null> {
  const { tgid, blockid, language, token } = params;
  const normalizedBlockId = blockid.replace(/^bot-/i, '');

  try {
    const res = await axios.get<AdsGramAd>('https://api.adsgram.ai/advbot', {
      params: {
        tgid,
        blockid: normalizedBlockId,
        language: language || 'en',
        token
      },
      timeout: 10_000
    });

    const ad = res.data;
    if (!ad?.text_html || !ad?.button_name || !ad?.click_url) return null;
    return ad;
  } catch {
    return null;
  }
}

