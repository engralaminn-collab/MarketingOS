'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Mail, Send, CheckCircle2, Layers } from 'lucide-react';
import { apiFetch } from '@/hooks/use-api';
import { toast } from 'sonner';

const LIFECYCLE_SEQUENCES = [
  {
    id: 'onboarding-5',
    name: '5-Step SaaS Activation Drip',
    emails: [
      { day: 'Day 0', subject: 'Welcome — achieve your first quick win in 3 minutes', body: '<p>Hi {{first_name}},</p><p>Here is the single fastest step to activate your workspace today: connect your first channel and run an instant audit.</p>' },
      { day: 'Day 2', subject: 'Did you hit this roadblock?', body: '<p>Most teams get stuck picking their first template. Reply to this email and we will configure it for you.</p>' },
      { day: 'Day 5', subject: 'Case study: How teams cut campaign setup from 6 hours to 18 minutes', body: '<p>See the exact editorial workflow and UTM attribution setup top operators use.</p>' },
    ],
  },
  {
    id: 'cold-b2b',
    name: '3-Touch B2B Problem-First Cold Sequence',
    emails: [
      { day: 'Touch 1', subject: 'Quick question on {{company}} organic funnel', body: '<p>Noticed {{company}} is scaling content across 3 channels — are you tracking assisted conversions past last-click UTM?</p>' },
      { day: 'Touch 2 (+3d)', subject: 'Re: {{company}} attribution benchmark', body: '<p>Sharing a 90-second teardown we ran on your public landing page headings and schema markup. Happy to send the full checklist.</p>' },
    ],
  },
  {
    id: 'ghost-newsletter',
    name: 'Ghost / Substack Editorial Weekly Issue',
    emails: [
      { day: 'Weekly Issue', subject: 'The Operator Dispatch: 3 Growth Experiments That Worked This Week', body: '<h2>1. Programmatic Comparison Pages</h2><p>Specific breakdown with verified benchmarks...</p><h2>2. Zero-Slop Editorial Diagrams</h2><p>Why flat SVG architecture beats AI stock art...</p>' },
    ],
  },
];

export function PublishingAndEmailSequencePanel({ onSaved }: { onSaved?: () => void }) {
  const [selectedSeqId, setSelectedSeqId] = useState(LIFECYCLE_SEQUENCES[0].id);
  const [stepIdx, setStepIdx] = useState(0);
  const seq = LIFECYCLE_SEQUENCES.find((s) => s.id === selectedSeqId) || LIFECYCLE_SEQUENCES[0];
  const activeStep = seq.emails[stepIdx] || seq.emails[0];

  const [toEmail, setToEmail] = useState('');
  const [adapter, setAdapter] = useState<'auto' | 'resend' | 'brevo' | 'webhook' | 'stage'>('stage');
  const [subject, setSubject] = useState(activeStep.subject);
  const [html, setHtml] = useState(activeStep.body);
  const [sending, setSending] = useState(false);

  function selectSequence(id: string) {
    setSelectedSeqId(id);
    setStepIdx(0);
    const found = LIFECYCLE_SEQUENCES.find((s) => s.id === id) || LIFECYCLE_SEQUENCES[0];
    setSubject(found.emails[0].subject);
    setHtml(found.emails[0].body);
  }

  function selectStep(i: number) {
    setStepIdx(i);
    const step = seq.emails[i];
    if (step) {
      setSubject(step.subject);
      setHtml(step.body);
    }
  }

  async function dispatchEmail() {
    setSending(true);
    try {
      const res = await apiFetch<{ data: { status: string; adapter: string; note?: string } }>('/api/email/send', {
        method: 'POST',
        body: JSON.stringify({ to: toEmail, subject, html, adapter }),
      });
      toast.success(
        res.data.status === 'sent'
          ? `Dispatched via ${res.data.adapter}`
          : res.data.note || 'Staged in Editorial & Newsletter Queue'
      );
      onSaved?.();
    } catch (e: any) {
      toast.error(e.message || 'Email dispatch failed');
    } finally {
      setSending(false);
    }
  }

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" />
              Ghost / Buffer Approval Queue & Lifecycle Email Sequence Studio
            </CardTitle>
            <CardDescription className="text-xs">
              Multi-step drip sequences & editorial newsletters with Resend (3k/mo free), Brevo (300/day free), SMTP/Webhook, and Content Queue staging
            </CardDescription>
          </div>
          <Badge variant="secondary">Resend · Brevo · Ghost · Buffer</Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-4 space-y-2.5">
          <div className="text-xs font-semibold text-muted-foreground">SEQUENCE BLUEPRINT</div>
          {LIFECYCLE_SEQUENCES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => selectSequence(s.id)}
              className={`w-full text-left rounded border p-2.5 text-xs transition ${
                selectedSeqId === s.id ? 'border-primary bg-primary/5 font-semibold' : 'hover:bg-muted/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span>{s.name}</span>
                <Badge variant="outline" className="text-[10px]">{s.emails.length} steps</Badge>
              </div>
            </button>
          ))}

          <div className="pt-2 space-y-1">
            <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
              <Layers className="h-3.5 w-3.5" /> SEQUENCE STEPS
            </div>
            <div className="flex flex-wrap gap-1.5">
              {seq.emails.map((st, idx) => (
                <Button
                  key={st.day}
                  size="sm"
                  variant={stepIdx === idx ? 'default' : 'outline'}
                  className="h-7 text-xs"
                  onClick={() => selectStep(idx)}
                >
                  {st.day}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-8 space-y-2.5">
          <div className="grid gap-2 sm:grid-cols-3">
            <Input
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
              placeholder="Recipient (optional when staging)"
              className="sm:col-span-2"
            />
            <Select value={adapter} onValueChange={(v: any) => setAdapter(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="stage">Stage in Approval Queue</SelectItem>
                <SelectItem value="auto">Auto (Resend → Brevo → Webhook)</SelectItem>
                <SelectItem value="resend">Resend API</SelectItem>
                <SelectItem value="brevo">Brevo Transactional</SelectItem>
                <SelectItem value="webhook">SMTP / n8n Webhook</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject line" />
          <Textarea value={html} onChange={(e) => setHtml(e.target.value)} rows={4} className="font-mono text-xs" />
          <div className="flex justify-end gap-2">
            <Button onClick={dispatchEmail} disabled={sending} className="gap-1.5">
              {adapter === 'stage' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
              {sending ? 'Processing...' : adapter === 'stage' ? 'Stage in Editorial Queue' : 'Send / Stage Sequence Step'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
