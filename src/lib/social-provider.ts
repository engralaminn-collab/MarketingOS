import { safeFetchText, SafeFetchError } from './ssrf';

export interface VerifiedSocialAccount {
  id: string;
  name: string | null;
  handle: string | null;
}

export class SocialTokenVerificationError extends Error {
  constructor(message: string, readonly httpStatus: 400 | 422 | 502 | 503) {
    super(message);
    this.name = 'SocialTokenVerificationError';
  }
}

type ProviderEndpoint = { url: string; headers: Record<string, string> };
const PLATFORM_ENDPOINTS: Record<string, (token: string) => ProviderEndpoint> = {
  Facebook: () => ({ url: 'https://graph.facebook.com/me?fields=id,name', headers: {} }),
  Instagram: () => ({ url: 'https://graph.facebook.com/me?fields=id,username', headers: {} }),
  LinkedIn: () => ({
    url: 'https://api.linkedin.com/v2/me',
    headers: { 'X-Restli-Protocol-Version': '2.0.0' },
  }),
  X: () => ({ url: 'https://api.x.com/2/users/me?user.fields=name,username', headers: {} }),
  YouTube: () => ({ url: 'https://www.googleapis.com/youtube/v3/channels?part=id,snippet&mine=true', headers: {} }),
  TikTok: () => ({ url: 'https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,username', headers: {} }),
  Pinterest: () => ({ url: 'https://api.pinterest.com/v5/user_account', headers: {} }),
  Telegram: (token) => ({ url: `https://api.telegram.org/bot${encodeURIComponent(token)}/getMe`, headers: {} }),
};

/** Make a minimal authenticated read request to prove that a supplied token works. */
export async function verifySocialAccessToken(platform: string, accessToken: string): Promise<VerifiedSocialAccount> {
  if (typeof accessToken !== 'string' || accessToken.length < 12 || accessToken.length > 4096) {
    throw new SocialTokenVerificationError('Access token must be between 12 and 4,096 characters', 400);
  }
  const endpointFactory = PLATFORM_ENDPOINTS[platform];
  if (!endpointFactory) throw new SocialTokenVerificationError('Unsupported social platform', 400);

  const endpoint = endpointFactory(accessToken);
  let response;
  try {
    response = await safeFetchText(endpoint.url, {
      timeoutMs: 8_000,
      maxResponseBytes: 128 * 1024,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
        ...endpoint.headers,
      },
    });
  } catch (error) {
    if (error instanceof SafeFetchError && error.code === 'TIMEOUT') {
      throw new SocialTokenVerificationError('Provider token verification timed out', 503);
    }
    throw new SocialTokenVerificationError('Unable to reach the provider for token verification', 503);
  }

  let data: any;
  try {
    data = JSON.parse(await response.text());
  } catch {
    throw new SocialTokenVerificationError('Provider returned an invalid response', 502);
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new SocialTokenVerificationError('Provider rejected the token or required profile permissions are missing', 422);
    }
    if (response.status === 429 || response.status >= 500) {
      throw new SocialTokenVerificationError('Provider is temporarily unavailable for token verification', 503);
    }
    throw new SocialTokenVerificationError(`Provider verification failed (HTTP ${response.status})`, 502);
  }

  if (platform === 'Telegram') {
    if (data?.ok !== true || !data?.result?.id) throw new SocialTokenVerificationError('Provider rejected the bot token', 422);
    return {
      id: String(data.result.id),
      name: data.result.first_name || data.result.username || null,
      handle: data.result.username ? `@${data.result.username}` : null,
    };
  }
  if (platform === 'TikTok') {
    const user = data?.data?.user;
    if (data?.error?.code !== 'ok' || !user?.open_id) {
      throw new SocialTokenVerificationError('Provider rejected the token or required profile permissions are missing', 422);
    }
    return {
      id: String(user.open_id),
      name: user.display_name || null,
      handle: user.username ? `@${user.username}` : null,
    };
  }
  if (platform === 'YouTube') {
    const channel = Array.isArray(data?.items) ? data.items[0] : null;
    if (!channel?.id) throw new SocialTokenVerificationError('No YouTube channel is available for this token', 422);
    return { id: String(channel.id), name: channel.snippet?.title || null, handle: channel.snippet?.customUrl || null };
  }

  const user = data?.data || data;
  const id = user?.id || user?.sub;
  if (!id) throw new SocialTokenVerificationError('Provider rejected the token or required profile permissions are missing', 422);
  const name = user.name || [user.localizedFirstName, user.localizedLastName].filter(Boolean).join(' ') || user.username || user.display_name || null;
  const handle = user.username ? (platform === 'X' ? `@${user.username}` : user.username) : null;
  return { id: String(id), name: name ? String(name).slice(0, 120) : null, handle: handle ? String(handle).slice(0, 120) : null };
}
