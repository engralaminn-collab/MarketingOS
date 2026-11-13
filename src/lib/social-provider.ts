export type SocialPlatform =
  | 'Facebook'
  | 'Instagram'
  | 'LinkedIn'
  | 'X'
  | 'YouTube'
  | 'TikTok'
  | 'Pinterest'
  | 'Telegram';

export type SocialCredentialVerification = {
  platform: SocialPlatform;
  accountId: string | null;
  accountName: string | null;
};

/**
 * Makes a live, read-only identity request to the selected platform.
 * This proves the token is accepted, not that every requested publish scope
 * has been granted. Tokens are never included in error messages or responses.
 */
export async function verifySocialCredential(
  platform: string,
  token: string,
): Promise<SocialCredentialVerification> {
  if (!token || token.length > 10_000) throw new Error('Access token is missing or invalid');
  let url: string;
  let headers: Record<string, string> = { Accept: 'application/json' };
  let telegram = false;

  switch (platform as SocialPlatform) {
    case 'Facebook':
    case 'Instagram':
      url = 'https://graph.facebook.com/me?fields=id,name,username';
      headers.Authorization = `Bearer ${token}`;
      break;
    case 'LinkedIn':
      url = 'https://api.linkedin.com/v2/me';
      headers.Authorization = `Bearer ${token}`;
      break;
    case 'X':
      url = 'https://api.x.com/2/users/me?user.fields=name,username';
      headers.Authorization = `Bearer ${token}`;
      break;
    case 'YouTube':
      url = 'https://youtube.googleapis.com/youtube/v3/channels?part=id,snippet&mine=true';
      headers.Authorization = `Bearer ${token}`;
      break;
    case 'TikTok':
      url = 'https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,username';
      headers.Authorization = `Bearer ${token}`;
      break;
    case 'Pinterest':
      url = 'https://api.pinterest.com/v5/user_account';
      headers.Authorization = `Bearer ${token}`;
      break;
    case 'Telegram':
      // Telegram Bot API requires its bot token in the URL path.
      url = `https://api.telegram.org/bot${encodeURIComponent(token)}/getMe`;
      telegram = true;
      break;
    default:
      throw new Error('Unsupported social platform');
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(8_000),
      cache: 'no-store',
    });
  } catch {
    throw new Error(`${platform} verification service could not be reached`);
  }

  const payload = await response.json().catch(() => null) as any;
  const providerOk = response.ok && (telegram ? payload?.ok === true : true);
  if (!providerOk) {
    const status = response.status || 502;
    throw new Error(`${platform} rejected the supplied credential (HTTP ${status})`);
  }

  const data = telegram ? payload.result : platform === 'YouTube'
    ? payload.items?.[0]
    : platform === 'TikTok' ? payload.data?.user
    : payload.data || payload;
  if (platform === 'YouTube' && !data) {
    throw new Error('The Google credential is valid, but no YouTube channel is available for it');
  }

  const accountId = data?.id || data?.open_id || data?.user_id || null;
  if (!accountId) throw new Error(`${platform} did not return an account identity for this credential`);
  const accountName = data?.name
    || data?.username
    || data?.display_name
    || [data?.localizedFirstName || data?.firstName?.localized?.en_US, data?.localizedLastName || data?.lastName?.localized?.en_US].filter(Boolean).join(' ')
    || data?.snippet?.title
    || [data?.first_name, data?.last_name].filter(Boolean).join(' ')
    || null;

  return {
    platform: platform as SocialPlatform,
    accountId: accountId ? String(accountId) : null,
    accountName: accountName ? String(accountName) : null,
  };
}
