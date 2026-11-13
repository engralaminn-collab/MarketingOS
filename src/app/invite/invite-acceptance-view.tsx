'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, ShieldCheck } from 'lucide-react';

interface InvitationPreview {
  email: string;
  companyName: string;
  role: string;
  expiresAt: string;
  accountExists: boolean;
}

interface ApiError {
  error?: string;
}

const INVITE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function InviteAcceptanceView({ inviteToken }: { inviteToken: string }) {
  const router = useRouter();
  const [invitation, setInvitation] = useState<InvitationPreview | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const loadInvitation = async () => {
      if (!INVITE_TOKEN_PATTERN.test(inviteToken)) {
        setError('This invitation link is invalid. Ask the workspace administrator to create a new one.');
        setLoading(false);
        return;
      }
      try {
        const response = await fetch(`/api/team/accept?token=${encodeURIComponent(inviteToken)}`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        const data = await response.json().catch(() => ({} as ApiError));
        if (!response.ok) throw new Error(data.error || 'Unable to load this invitation');
        if (controller.signal.aborted) return;
        setInvitation(data.invitation);
        setName((previous) => previous || data.invitation?.email?.split('@')[0] || '');

        const savedToken = localStorage.getItem('mos_token');
        if (savedToken) {
          const userResponse = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${savedToken}` },
            cache: 'no-store',
            signal: controller.signal,
          });
          const userData = await userResponse.json().catch(() => ({}));
          if (controller.signal.aborted) return;
          if (userResponse.ok && userData.user?.email) {
            setAuthToken(savedToken);
            setSignedInEmail(String(userData.user.email));
          } else {
            localStorage.removeItem('mos_token');
            localStorage.removeItem('mos_user');
          }
        }
      } catch (loadError) {
        if (!controller.signal.aborted) setError(loadError instanceof Error ? loadError.message : 'Unable to load this invitation');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void loadInvitation();
    return () => controller.abort();
  }, [inviteToken]);

  const currentAccountMatches = Boolean(
    authToken && signedInEmail && invitation && signedInEmail.trim().toLowerCase() === invitation.email.trim().toLowerCase(),
  );

  const acceptInvitation = async (event: FormEvent) => {
    event.preventDefault();
    if (!invitation || submitting) return;
    setSubmitting(true);
    setError('');

    try {
      let bearerToken = currentAccountMatches ? authToken : null;
      if (invitation.accountExists && !bearerToken) {
        const loginResponse = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: invitation.email, password }),
        });
        const loginData = await loginResponse.json().catch(() => ({} as ApiError));
        if (!loginResponse.ok) throw new Error(loginData.error || 'Unable to sign in');
        bearerToken = loginData.token;
      }

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (bearerToken) headers.Authorization = `Bearer ${bearerToken}`;
      const body = invitation.accountExists
        ? { token: inviteToken }
        : { token: inviteToken, name: name.trim(), password };
      const response = await fetch('/api/team/accept', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({} as ApiError));
      if (!response.ok) throw new Error(data.error || 'Unable to accept this invitation');
      if (!data.token) throw new Error('Invitation accepted but a session could not be started. Please sign in.');

      localStorage.setItem('mos_token', data.token);
      localStorage.removeItem('mos_user');
      router.replace('/');
      router.refresh();
    } catch (acceptError) {
      setError(acceptError instanceof Error ? acceptError.message : 'Unable to accept this invitation');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-lg shadow-xl">
        <CardHeader className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-orange-500/10 p-2 text-orange-600"><Users className="h-5 w-5" /></div>
            <Badge variant="outline">Workspace invitation</Badge>
          </div>
          <CardTitle className="text-2xl">Join your team</CardTitle>
          <CardDescription>
            {loading ? 'Checking invitation…' : invitation ? `You have been invited to ${invitation.companyName}.` : 'Review and accept your workspace invitation.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading invitation</div>
          ) : invitation ? (
            <>
              <div className="mb-6 rounded-lg border bg-muted/30 p-4 text-sm">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><p className="text-xs text-muted-foreground">Invited email</p><p className="font-medium break-all">{invitation.email}</p></div>
                  <div><p className="text-xs text-muted-foreground">Workspace role</p><p className="font-medium">{invitation.role}</p></div>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">Link expires {new Date(invitation.expiresAt).toLocaleString()}.</p>
              </div>

              {currentAccountMatches && (
                <div className="mb-4 flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <p>Signed in as <strong>{signedInEmail}</strong>. Accepting adds this account to the invited workspace.</p>
                </div>
              )}
              {authToken && !currentAccountMatches && (
                <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-muted-foreground">
                  You are signed in as {signedInEmail}. This invitation is for {invitation.email}; sign in with that address below. Your current session is kept until acceptance succeeds.
                </div>
              )}

              <form onSubmit={acceptInvitation} className="space-y-4">
                {!invitation.accountExists && !currentAccountMatches && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="invite-name">Your name</Label>
                      <Input id="invite-name" autoComplete="name" maxLength={120} value={name} onChange={(event) => setName(event.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="invite-password">Create a password</Label>
                      <Input id="invite-password" type="password" autoComplete="new-password" minLength={12} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} required />
                      <p className="text-xs text-muted-foreground">Use 12–128 characters. This creates an account only for the invited email.</p>
                    </div>
                  </>
                )}
                {invitation.accountExists && !currentAccountMatches && (
                  <div className="space-y-2">
                    <Label htmlFor="invite-login-password">Password for {invitation.email}</Label>
                    <Input id="invite-login-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
                  </div>
                )}
                {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={submitting || loading || (!currentAccountMatches && !password.trim())}>
                  {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Accepting…</> : 'Accept Invitation'}
                </Button>
              </form>
              <p className="mt-5 text-center text-xs text-muted-foreground">Invitation links are single-use. No email is sent from this page.</p>
            </>
          ) : (
            <div className="space-y-4">
              {error && <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
              <p className="text-sm text-muted-foreground">Ask the workspace administrator to create a new invitation link.</p>
            </div>
          )}
          <div className="mt-6 text-center"><Link href="/" className="text-sm text-muted-foreground underline underline-offset-4">Back to sign in</Link></div>
        </CardContent>
      </Card>
    </main>
  );
}
