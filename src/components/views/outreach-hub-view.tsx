'use client';

import React, { useState } from 'react';
import {
  Globe,
  Inbox,
  MessageSquare,
  PhoneCall,
  Send,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch, useApiQuery } from '@/hooks/use-api';

export default function OutreachHubView() {
  // SMS state (/api/sms/*)
  const { data: smsRaw, refetch: refetchSms } = useApiQuery<any>('/api/sms/messages');
  const smsList: Array<{ id: string; to: string; body: string; status: string; error?: string | null; createdAt: string }> =
    Array.isArray(smsRaw) ? smsRaw : smsRaw?.data || [];
  const { data: smsTplRaw, refetch: refetchTemplates } = useApiQuery<any>('/api/sms/templates');
  const smsTemplates: Array<{ id: string; title: string; body: string }> =
    Array.isArray(smsTplRaw) ? smsTplRaw : smsTplRaw?.data || [];

  const [smsTo, setSmsTo] = useState('+447700900123');
  const [smsBody, setSmsBody] = useState('Hi {{name}}, your consultation slot with our admissions advisor is confirmed. Reply STOP to opt out.');
  const [tplTitle, setTplTitle] = useState('');
  const [tplBody, setTplBody] = useState('');
  const [sendingSms, setSendingSms] = useState(false);

  // VoIP state (/api/voip/*)
  const { data: voipRaw, refetch: refetchVoip } = useApiQuery<any>('/api/voip/calls');
  const voipCalls: Array<{ id: string; to: string; status: string; body: string; createdAt: string }> =
    Array.isArray(voipRaw) ? voipRaw : voipRaw?.data || [];
  const [voipTo, setVoipTo] = useState('+442079460192');
  const [voipScript, setVoipScript] = useState('Hello, calling from MarketingOS Admissions Desk regarding your UK university application checklist.');
  const [calling, setCalling] = useState(false);

  // Unified Social/Support Inbox + Auto-Reply (/api/social/inbox + /api/ai/auto-reply)
  const { data: inboxRaw, refetch: refetchInbox } = useApiQuery<any>('/api/social/inbox');
  const inboxItems: Array<{ id: string; subject: string; status: string; priority: string; createdAt: string; messages?: Array<{ content: string }> }> =
    Array.isArray(inboxRaw) ? inboxRaw : inboxRaw?.data || inboxRaw?.tickets || [];
  const [incomingMsg, setIncomingMsg] = useState('Hi! How much does your UKVI CAS counseling and CRM onboarding package cost?');
  const [replyTone, setReplyTone] = useState('friendly');
  const [draftedReply, setDraftedReply] = useState<string | null>(null);
  const [draftingReply, setDraftingReply] = useState(false);

  // Web Scraper / Firecrawl (/api/scraper)
  const [scrapeUrl, setScrapeUrl] = useState('https://github.com/coreyhaines31/marketingskills');
  const [scrapeMode, setScrapeMode] = useState<'summary' | 'full' | 'metadata'>('summary');
  const [scraping, setScraping] = useState(false);
  const [scrapeResult, setScrapeResult] = useState<{
    url: string;
    title?: string;
    description?: string;
    markdown?: string;
    headings?: string[];
    linksCount?: number;
    engine?: string;
  } | null>(null);

  async function handleSendSms() {
    if (!smsTo.trim() || !smsBody.trim()) return;
    setSendingSms(true);
    try {
      await apiFetch('/api/sms/send', {
        method: 'POST',
        body: JSON.stringify({ to: smsTo, message: smsBody }),
      });
      toast.success('SMS dispatched to gateway');
      refetchSms();
    } catch (err) {
      toast.info(err instanceof Error ? err.message : 'SMS logged as blocked until Twilio/httpSMS credentials are added');
      refetchSms();
    } finally {
      setSendingSms(false);
    }
  }

  async function handleCreateTemplate() {
    if (!tplTitle.trim() || !tplBody.trim()) return;
    try {
      await apiFetch('/api/sms/templates', {
        method: 'POST',
        body: JSON.stringify({ title: tplTitle, body: tplBody }),
      });
      setTplTitle('');
      setTplBody('');
      refetchTemplates();
      toast.success('Saved SMS template');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save template');
    }
  }

  async function handlePlaceCall() {
    if (!voipTo.trim()) return;
    setCalling(true);
    try {
      const res = await apiFetch<{ data?: { status?: string; note?: string }; error?: string }>('/api/voip/call', {
        method: 'POST',
        body: JSON.stringify({ to: voipTo, script: voipScript }),
      });
      toast.success(res.data?.note || `Call status: ${res.data?.status || 'logged'}`);
      refetchVoip();
    } catch (err) {
      toast.info(err instanceof Error ? err.message : 'Call attempt logged (configure Telnyx/Twilio SIP to place live PSTN calls)');
      refetchVoip();
    } finally {
      setCalling(false);
    }
  }

  async function handleDraftReply() {
    if (!incomingMsg.trim()) return;
    setDraftingReply(true);
    try {
      const res = await apiFetch<{ data: { reply: string; generationMode: string } }>('/api/ai/auto-reply', {
        method: 'POST',
        body: JSON.stringify({ message: incomingMsg, tone: replyTone }),
      });
      setDraftedReply(res.data.reply);
      toast.success(`Drafted reply (${res.data.generationMode})`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not draft reply');
    } finally {
      setDraftingReply(false);
    }
  }

  async function handleScrape() {
    if (!scrapeUrl.trim()) return;
    setScraping(true);
    try {
      const res = await apiFetch<{ data: NonNullable<typeof scrapeResult> }>('/api/scraper', {
        method: 'POST',
        body: JSON.stringify({ url: scrapeUrl, extractMode: scrapeMode }),
      });
      setScrapeResult(res.data);
      toast.success('Extracted clean page content');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Scrape blocked or host unreachable');
    } finally {
      setScraping(false);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Omni-Channel Outreach, VoIP & Web Scraper Hub</h1>
          <Badge variant="secondary">SMS · VoIP · Unified Inbox · Firecrawl</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          SMS and voice sending are disabled until consent, opt-out suppression and human approval are implemented. The inbox and scraper remain available; legacy delivery statuses are unverified.
        </p>
      </div>

      <Tabs defaultValue="sms" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="sms" className="gap-1.5"><MessageSquare className="h-4 w-4" /> SMS & Templates</TabsTrigger>
          <TabsTrigger value="voip" className="gap-1.5"><PhoneCall className="h-4 w-4" /> VoIP Dialer & Logs</TabsTrigger>
          <TabsTrigger value="inbox" className="gap-1.5"><Inbox className="h-4 w-4" /> Unified Inbox & AI Reply</TabsTrigger>
          <TabsTrigger value="scraper" className="gap-1.5"><Globe className="h-4 w-4" /> Firecrawl Web Scraper</TabsTrigger>
        </TabsList>

        <TabsContent value="sms">
          <div className="grid gap-6 lg:grid-cols-12">
            <Card className="lg:col-span-5">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Send Transactional / Consented SMS</CardTitle>
                <CardDescription>Sending is disabled; consent, opt-out suppression and approvals are not yet implemented.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs">Recipient E.164 Phone</Label>
                  <Input value={smsTo} onChange={(e) => setSmsTo(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">SMS Copy ({smsBody.length}/160 chars)</Label>
                  <Textarea rows={3} value={smsBody} onChange={(e) => setSmsBody(e.target.value)} />
                </div>
                <Button className="w-full" onClick={handleSendSms} disabled={true}>
                  <Send className="mr-1.5 h-4 w-4" /> {sendingSms ? 'Dispatching...' : 'SMS sending unavailable'}
                </Button>

                <div className="border-t pt-3 space-y-2">
                  <Label className="text-xs font-semibold">Create Reusable SMS Template</Label>
                  <Input placeholder="Template title (e.g. UKVI Interview Reminder)" value={tplTitle} onChange={(e) => setTplTitle(e.target.value)} className="h-8 text-xs" />
                  <Textarea rows={2} placeholder="Template body..." value={tplBody} onChange={(e) => setTplBody(e.target.value)} className="text-xs" />
                  <Button size="sm" variant="outline" className="w-full" onClick={handleCreateTemplate} disabled>Saving templates unavailable</Button>
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-7">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">SMS history & example templates (unverified)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {smsTemplates.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-xs font-semibold text-muted-foreground">TEMPLATES (CLICK TO USE)</div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {smsTemplates.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setSmsBody(t.body || '')}
                          className="text-left rounded border p-2 text-xs hover:bg-muted"
                        >
                          <div className="font-semibold">{t.title}</div>
                          <div className="text-muted-foreground line-clamp-1">{t.body}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-1.5 max-h-72 overflow-y-auto">
                  <div className="text-xs font-semibold text-muted-foreground">RECENT SMS LOG ({smsList.length})</div>
                  {smsList.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-4">No SMS messages recorded yet.</p>
                  ) : (
                    smsList.map((m) => (
                      <div key={m.id} className="rounded border p-2.5 text-xs flex items-start justify-between gap-2">
                        <div>
                          <div className="font-mono font-semibold">{m.to}</div>
                          <div className="text-muted-foreground">{m.body}</div>
                          {m.error && <div className="text-amber-600 text-[11px] mt-0.5">{m.error}</div>}
                        </div>
                        <Badge variant={m.status === 'sent' ? 'default' : 'outline'}>{m.status}</Badge>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="voip">
          <div className="grid gap-6 lg:grid-cols-12">
            <Card className="lg:col-span-5">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">VoIP Click-to-Dial & Script Prompter</CardTitle>
                <CardDescription>Outbound calling is unavailable until consent and approvals are implemented.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs">Destination Phone (E.164)</Label>
                  <Input value={voipTo} onChange={(e) => setVoipTo(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Call Script / Advisory Notes</Label>
                  <Textarea rows={4} value={voipScript} onChange={(e) => setVoipScript(e.target.value)} />
                </div>
                <Button className="w-full" onClick={handlePlaceCall} disabled={true}>
                  <PhoneCall className="mr-1.5 h-4 w-4" /> {calling ? 'Dialing...' : 'Calling unavailable'}
                </Button>
              </CardContent>
            </Card>

            <Card className="lg:col-span-7">
              <CardHeader className="pb-3"><CardTitle className="text-base">VoIP Call History ({voipCalls.length})</CardTitle></CardHeader>
              <CardContent className="space-y-2 max-h-80 overflow-y-auto">
                {voipCalls.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-6 text-center">No outbound VoIP calls logged yet.</p>
                ) : (
                  voipCalls.map((c) => (
                    <div key={c.id} className="rounded border p-2.5 text-xs flex justify-between">
                      <div>
                        <div className="font-mono font-semibold">{c.to}</div>
                        <div className="text-muted-foreground">{c.body}</div>
                      </div>
                      <Badge variant="outline">{c.status}</Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="inbox">
          <div className="grid gap-6 lg:grid-cols-12">
            <Card className="lg:col-span-6">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">AI Customer Reply Drafter (Human-in-the-Loop)</CardTitle>
                <CardDescription>Drafts safe, policy-grounded replies without auto-sending</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea rows={4} value={incomingMsg} onChange={(e) => setIncomingMsg(e.target.value)} />
                <div className="flex flex-wrap gap-1.5">
                  {(['professional', 'friendly', 'empathetic', 'concise'] as const).map((t) => (
                    <Button key={t} size="sm" variant={replyTone === t ? 'default' : 'outline'} className="text-xs capitalize" onClick={() => setReplyTone(t)}>
                      {t}
                    </Button>
                  ))}
                  <Button size="sm" className="ml-auto" onClick={handleDraftReply} disabled={draftingReply}>
                    <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Draft Reply
                  </Button>
                </div>
                {draftedReply && (
                  <div className="rounded-lg border bg-emerald-500/5 border-emerald-500/30 p-3 text-sm">
                    {draftedReply}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-6">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-base">Unified Support & Social Queue ({inboxItems.length})</CardTitle>
                <Button size="sm" variant="outline" onClick={() => refetchInbox()}>Refresh</Button>
              </CardHeader>
              <CardContent className="space-y-2 max-h-80 overflow-y-auto">
                {inboxItems.slice(0, 12).map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setIncomingMsg(item.messages?.[0]?.content || item.subject)}
                    className="rounded border p-2.5 text-xs cursor-pointer hover:bg-muted/50"
                  >
                    <div className="flex justify-between font-semibold">
                      <span>{item.subject}</span>
                      <Badge variant="outline">{item.priority}</Badge>
                    </div>
                    <div className="text-muted-foreground mt-0.5">Click to load into AI Reply Drafter</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="scraper">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">SSRF-Protected Web & Firecrawl Scraper</CardTitle>
              <CardDescription>Extracts clean LLM-ready Markdown, metadata, and headings from public pages (uses Firecrawl /v2/scrape when FIRECRAWL_BASE_URL is set)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Input value={scrapeUrl} onChange={(e) => setScrapeUrl(e.target.value)} className="flex-1 min-w-[260px]" placeholder="https://..." />
                {(['summary', 'full', 'metadata'] as const).map((m) => (
                  <Button key={m} size="sm" variant={scrapeMode === m ? 'default' : 'outline'} onClick={() => setScrapeMode(m)} className="capitalize">
                    {m}
                  </Button>
                ))}
                <Button onClick={handleScrape} disabled={scraping}>
                  {scraping ? 'Scraping...' : 'Extract Page'}
                </Button>
              </div>
              {scrapeResult && (
                <div className="rounded-lg border p-4 space-y-2 text-xs">
                  <div className="font-semibold text-sm">{scrapeResult.title || scrapeResult.url}</div>
                  {scrapeResult.description && <p className="text-muted-foreground">{scrapeResult.description}</p>}
                  {scrapeResult.markdown && (
                    <pre className="rounded bg-muted/40 p-3 font-mono text-xs overflow-x-auto max-h-80 whitespace-pre-wrap">
                      {scrapeResult.markdown}
                    </pre>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
