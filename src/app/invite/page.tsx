import type { Metadata } from 'next';
import { InviteAcceptanceView } from './invite-acceptance-view';

export const metadata: Metadata = {
  title: 'Accept workspace invitation',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default async function InvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const params = await searchParams;
  const token = Array.isArray(params.token) ? params.token[0] : params.token;
  return <InviteAcceptanceView inviteToken={token || ''} />;
}
