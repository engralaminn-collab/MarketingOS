'use client';

import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Circle,
  Download,
  GraduationCap,
  Info,
  PlaneTakeoff,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

/**
 * Study-abroad roadmap planner.
 *
 * Deterministic by design: every milestone is derived from the intake date and
 * the applicant's stated status. No model call, no invented "live" data. Cost
 * figures are broad planning ranges and are labelled as such.
 *
 * Inspired by the studytra / NextStep-Abroad / ALO Education reference patterns
 * in the Ecosystem Library — the upstream projects are not bundled or copied.
 */

type DestinationId = 'uk' | 'us' | 'ca' | 'de' | 'au';
type LevelId = 'foundation' | 'bachelor' | 'master' | 'phd';
type ReadinessKey = 'english' | 'offer' | 'funding' | 'documents';

interface Destination {
  id: DestinationId;
  label: string;
  currency: 'GBP' | 'USD' | 'CAD' | 'EUR' | 'AUD';
  symbol: string;
  tuition: Record<LevelId, [number, number]>;
  livingPerYear: [number, number];
  visaName: string;
  intakes: string[];
  note: string;
}

const DESTINATIONS: Destination[] = [
  {
    id: 'uk',
    label: 'United Kingdom',
    currency: 'GBP',
    symbol: '£',
    tuition: {
      foundation: [9000, 18000],
      bachelor: [15000, 28000],
      master: [16000, 35000],
      phd: [18000, 30000],
    },
    livingPerYear: [12000, 16000],
    visaName: 'Student route visa + IHS surcharge',
    intakes: ['September', 'January'],
    note: '28-day CAS rule applies; maintain the funds for the required consecutive period.',
  },
  {
    id: 'us',
    label: 'United States',
    currency: 'USD',
    symbol: '$',
    tuition: {
      foundation: [15000, 35000],
      bachelor: [25000, 55000],
      master: [25000, 60000],
      phd: [20000, 50000],
    },
    livingPerYear: [14000, 22000],
    visaName: 'F-1 visa + SEVIS fee',
    intakes: ['Fall (August)', 'Spring (January)'],
    note: 'Many PhD places are funded through assistantships; confirm the offer letter wording.',
  },
  {
    id: 'ca',
    label: 'Canada',
    currency: 'CAD',
    symbol: 'C$',
    tuition: {
      foundation: [14000, 25000],
      bachelor: [18000, 35000],
      master: [16000, 30000],
      phd: [8000, 20000],
    },
    livingPerYear: [13000, 18000],
    visaName: 'Study permit + PAL where required',
    intakes: ['September', 'January'],
    note: 'Proof-of-funds thresholds change; check the current IRCC figure before filing.',
  },
  {
    id: 'de',
    label: 'Germany',
    currency: 'EUR',
    symbol: '€',
    tuition: {
      foundation: [5000, 15000],
      bachelor: [0, 3500],
      master: [0, 6000],
      phd: [0, 1000],
    },
    livingPerYear: [11000, 14000],
    visaName: 'National student visa + blocked account',
    intakes: ['October', 'April'],
    note: 'Public universities are largely tuition-free; the blocked-account amount is set annually.',
  },
  {
    id: 'au',
    label: 'Australia',
    currency: 'AUD',
    symbol: 'A$',
    tuition: {
      foundation: [18000, 30000],
      bachelor: [22000, 40000],
      master: [22000, 45000],
      phd: [20000, 35000],
    },
    livingPerYear: [17000, 22000],
    visaName: 'Student visa (subclass 500) + OSHC',
    intakes: ['February', 'July'],
    note: 'Genuine Student requirement and OSHC cover must be documented with the application.',
  },
];

const LEVELS: Array<{ id: LevelId; label: string }> = [
  { id: 'foundation', label: 'Foundation / pathway' },
  { id: 'bachelor', label: 'Bachelor' },
  { id: 'master', label: 'Master' },
  { id: 'phd', label: 'PhD / research' },
];

const READINESS_OPTIONS: Record<ReadinessKey, Array<{ value: string; label: string; score: number }>> = {
  english: [
    { value: 'ready', label: 'Test score in hand', score: 30 },
    { value: 'booked', label: 'Test booked', score: 15 },
    { value: 'exempt', label: 'Exempt / taught in English', score: 25 },
    { value: 'none', label: 'Not started', score: 0 },
  ],
  offer: [
    { value: 'unconditional', label: 'Unconditional offer', score: 30 },
    { value: 'conditional', label: 'Conditional offer', score: 20 },
    { value: 'applied', label: 'Applications submitted', score: 10 },
    { value: 'none', label: 'Not applied yet', score: 0 },
  ],
  funding: [
    { value: 'arranged', label: 'Funds arranged and evidenced', score: 25 },
    { value: 'partial', label: 'Partly arranged / loan in progress', score: 12 },
    { value: 'none', label: 'Not arranged', score: 0 },
  ],
  documents: [
    { value: 'ready', label: 'Pack complete', score: 15 },
    { value: 'partial', label: 'Partially collected', score: 7 },
    { value: 'none', label: 'Not started', score: 0 },
  ],
};

const DEFAULT_READINESS: Record<ReadinessKey, string> = {
  english: 'none',
  offer: 'none',
  funding: 'none',
  documents: 'none',
};

const MILESTONES: Array<{ weeksBefore: number; title: string; detail: string; owner: string }> = [
  { weeksBefore: 40, title: 'Define the shortlist and entry requirements', detail: 'Pick 5–8 programmes, confirm grades, prerequisites and English thresholds.', owner: 'Counsellor' },
  { weeksBefore: 34, title: 'Book the English test', detail: 'Book IELTS / TOEFL / PTE with enough time for a resit before deadlines.', owner: 'Student' },
  { weeksBefore: 30, title: 'Assemble the academic pack', detail: 'Transcripts, certificates, references, statement of purpose, passport copy.', owner: 'Student' },
  { weeksBefore: 26, title: 'Submit applications', detail: 'File applications and scholarship forms; record each portal reference number.', owner: 'Counsellor' },
  { weeksBefore: 20, title: 'Chase decisions and scholarships', detail: 'Follow up on offers, funding rounds and deposit deadlines.', owner: 'Counsellor' },
  { weeksBefore: 16, title: 'Accept the offer and pay the deposit', detail: 'Accept the chosen offer; keep every receipt for the visa file.', owner: 'Student' },
  { weeksBefore: 12, title: 'Receive the CAS / CoE / I-20 / admission letter', detail: 'The visa application needs this document; check the spelling of every field.', owner: 'Institution' },
  { weeksBefore: 10, title: 'Prepare funds evidence', detail: 'Bank statements, sponsor letters and loan sanctions in the required format and dates.', owner: 'Student' },
  { weeksBefore: 8, title: 'File the visa application', detail: 'Pay the visa fee and health surcharge/insurance, book biometrics.', owner: 'Student' },
  { weeksBefore: 6, title: 'Book accommodation', detail: 'Confirm halls or private tenancy; check the cancellation policy.', owner: 'Student' },
  { weeksBefore: 4, title: 'Pre-departure and compliance checks', detail: 'Visa decision, travel insurance, health checks, registration documents.', owner: 'Counsellor' },
  { weeksBefore: 2, title: 'Flights, arrival and orientation', detail: 'Book travel, arrange airport pickup, complete online enrolment.', owner: 'Student' },
];

const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;

function addMonths(date: Date, months: number) {
  const copy = new Date(date.getTime());
  copy.setMonth(copy.getMonth() + months);
  return copy;
}

function formatDate(date: Date) {
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatMoney(value: number, symbol: string) {
  if (value >= 1000) return `${symbol}${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`;
  return `${symbol}${value}`;
}

function readinessLabel(score: number) {
  if (score >= 80) return { label: 'On track', tone: 'text-emerald-600 dark:text-emerald-400' };
  if (score >= 50) return { label: 'Needs attention', tone: 'text-amber-600 dark:text-amber-400' };
  return { label: 'At risk', tone: 'text-rose-600 dark:text-rose-400' };
}

export function StudyRoadmapPanel() {
  const [destinationId, setDestinationId] = useState<DestinationId>('uk');
  const [level, setLevel] = useState<LevelId>('master');
  const [intake, setIntake] = useState(() => {
    const next = addMonths(new Date(), 9);
    return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [readiness, setReadiness] = useState<Record<ReadinessKey, string>>(DEFAULT_READINESS);
  const [budget, setBudget] = useState('');
  const [done, setDone] = useState<string[]>([]);

  const destination = DESTINATIONS.find((item) => item.id === destinationId) ?? DESTINATIONS[0];

  const plan = useMemo(() => {
    const intakeDate = new Date(`${intake}T00:00:00`);
    const safeIntake = Number.isNaN(intakeDate.getTime()) ? addMonths(new Date(), 9) : intakeDate;
    const now = new Date();
    const weeksToIntake = Math.ceil((safeIntake.getTime() - now.getTime()) / WEEK);

    const milestones = MILESTONES.map((milestone) => {
      const date = new Date(safeIntake.getTime() - milestone.weeksBefore * WEEK);
      const daysAway = Math.ceil((date.getTime() - now.getTime()) / DAY);
      const state = daysAway < 0 ? 'overdue' : daysAway <= 14 ? 'due' : 'upcoming';
      return { ...milestone, date, daysAway, state };
    }).sort((a, b) => a.date.getTime() - b.date.getTime());

    const score = (Object.keys(readiness) as ReadinessKey[]).reduce((total, key) => {
      const option = READINESS_OPTIONS[key].find((item) => item.value === readiness[key]);
      return total + (option?.score ?? 0);
    }, 0);

    const [tuitionLow, tuitionHigh] = destination.tuition[level];
    const totalLow = tuitionLow + destination.livingPerYear[0];
    const totalHigh = tuitionHigh + destination.livingPerYear[1];
    const budgetValue = Number(budget);
    const gap = Number.isFinite(budgetValue) && budgetValue > 0 ? budgetValue - totalHigh : null;

    const openActions = milestones.filter((milestone) => milestone.state !== 'upcoming' && !done.includes(milestone.title));

    return { safeIntake, weeksToIntake, milestones, score, totalLow, totalHigh, gap, openActions };
  }, [destination, level, intake, readiness, budget, done]);

  const readinessState = readinessLabel(plan.score);

  const toggleDone = (title: string) => {
    setDone((current) => (current.includes(title) ? current.filter((item) => item !== title) : [...current, title]));
  };

  const downloadPlan = () => {
    const lines = [
      `# Study-abroad plan — ${destination.label}, ${LEVELS.find((item) => item.id === level)?.label}`,
      '',
      `- Intake: ${formatDate(plan.safeIntake)} (${plan.weeksToIntake} weeks away)`,
      `- Readiness score: ${plan.score}/100 (${readinessState.label})`,
      `- Indicative annual cost: ${formatMoney(plan.totalLow, destination.symbol)} – ${formatMoney(plan.totalHigh, destination.symbol)} (tuition + living)`,
      budget ? `- Stated budget: ${destination.symbol}${budget}` : '- Stated budget: not provided',
      '',
      '## Milestones',
      '',
      ...plan.milestones.map(
        (milestone) =>
          `- [${done.includes(milestone.title) ? 'x' : ' '}] ${formatDate(milestone.date)} — ${milestone.title} (${milestone.owner}) · ${milestone.state}`
      ),
      '',
      '## Visa route',
      '',
      `${destination.visaName}. ${destination.note}`,
      '',
      '## Disclaimer',
      '',
      'Indicative planning aid only. Costs, fund thresholds and visa rules change; confirm every requirement with the institution and the official immigration authority before acting. This is not legal or immigration advice.',
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'study-abroad-plan.md';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    toast.success('Study-abroad plan downloaded');
  };

  return (
    <div className="grid gap-4 lg:grid-cols-12">
      <Card className="lg:col-span-4">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <GraduationCap className="h-4 w-4" /> Applicant plan inputs
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Destination</Label>
            <Select value={destinationId} onValueChange={(value) => setDestinationId(value as DestinationId)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DESTINATIONS.map((item) => (
                  <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Study level</Label>
              <Select value={level} onValueChange={(value) => setLevel(value as LevelId)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LEVELS.map((item) => (
                    <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Intake date</Label>
              <Input type="date" value={intake} onChange={(event) => setIntake(event.target.value)} />
            </div>
          </div>

          {(Object.keys(READINESS_OPTIONS) as ReadinessKey[]).map((key) => (
            <div key={key} className="space-y-1.5">
              <Label className="text-xs capitalize">
                {key === 'english' ? 'English test' : key === 'offer' ? 'Offer status' : key === 'funding' ? 'Funding' : 'Document pack'}
              </Label>
              <Select
                value={readiness[key]}
                onValueChange={(value) => setReadiness((current) => ({ ...current, [key]: value }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {READINESS_OPTIONS[key].map((item) => (
                    <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}

          <div className="space-y-1.5">
            <Label className="text-xs">Annual budget ({destination.currency}) — optional</Label>
            <Input
              type="number"
              min={0}
              placeholder={`e.g. ${destination.symbol}30000`}
              value={budget}
              onChange={(event) => setBudget(event.target.value)}
            />
          </div>

          <Button className="w-full" size="sm" onClick={downloadPlan}>
            <Download className="mr-1.5 h-3.5 w-3.5" /> Download plan (.md)
          </Button>
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            Intakes for {destination.label}: {destination.intakes.join(' · ')}. The plan recomputes as you change any input.
          </p>
        </CardContent>
      </Card>

      <div className="space-y-4 lg:col-span-8">
        <div className="grid gap-3 sm:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Readiness</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{plan.score}<span className="text-sm text-muted-foreground">/100</span></p>
              <Progress value={plan.score} className="mt-2 h-1.5" />
              <p className={`mt-1.5 text-[11px] font-medium ${readinessState.tone}`}>{readinessState.label}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Time to intake</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{plan.weeksToIntake}<span className="text-sm text-muted-foreground"> weeks</span></p>
              <p className="mt-2 text-[11px] text-muted-foreground">{formatDate(plan.safeIntake)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-muted-foreground"><Wallet className="h-3 w-3" /> Indicative cost / year</p>
              <p className="mt-1 text-lg font-bold tabular-nums">
                {formatMoney(plan.totalLow, destination.symbol)} – {formatMoney(plan.totalHigh, destination.symbol)}
              </p>
              <p className="mt-2 text-[11px] text-muted-foreground">
                {plan.gap === null
                  ? 'Add a budget to see the gap.'
                  : plan.gap >= 0
                    ? `Budget covers the top estimate (${destination.symbol}${plan.gap.toLocaleString('en-GB')} spare).`
                    : `Shortfall of ${destination.symbol}${Math.abs(plan.gap).toLocaleString('en-GB')} against the top estimate.`}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="h-4 w-4" /> Back-planned timeline
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Derived from the intake date — {plan.milestones.length} milestones, newest first.
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {plan.milestones.map((milestone) => {
              const isDone = done.includes(milestone.title);
              return (
                <div
                  key={milestone.title}
                  className={`flex items-start gap-3 rounded-lg border p-2.5 transition-colors ${
                    isDone ? 'border-emerald-300/50 bg-emerald-500/5' : milestone.state === 'overdue' ? 'border-amber-300/60 bg-amber-500/5' : 'border-border/60'
                  }`}
                >
                  <button
                    onClick={() => toggleDone(milestone.title)}
                    aria-label={isDone ? `Mark ${milestone.title} not done` : `Mark ${milestone.title} done`}
                    className="mt-0.5 shrink-0"
                  >
                    {isDone ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className={`text-xs font-medium ${isDone ? 'line-through opacity-60' : ''}`}>{milestone.title}</p>
                      <Badge variant="outline" className="text-[9px]">{milestone.owner}</Badge>
                      {milestone.state !== 'upcoming' && !isDone && (
                        <Badge variant={milestone.state === 'overdue' ? 'warning' : 'info'} className="text-[9px]">
                          {milestone.state === 'overdue' ? 'window passed' : 'due now'}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{milestone.detail}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[10px] font-medium">{formatDate(milestone.date)}</p>
                    <p className="text-[9px] text-muted-foreground">-{milestone.weeksBefore}w</p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <ShieldCheck className="h-4 w-4" /> Visa route
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">{destination.visaName}</p>
              <p>{destination.note}</p>
              <Separator />
              <p className="flex items-start gap-1.5 text-[10px]">
                <Info className="mt-0.5 h-3 w-3 shrink-0" />
                Confirm current fees, fund thresholds and document formats with the official immigration authority — rules change between intakes.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-amber-500" /> Next actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {plan.openActions.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Nothing is due right now. Keep the document pack current and re-check the plan after any visa rule change.
                </p>
              ) : (
                plan.openActions.slice(0, 5).map((action) => (
                  <div key={action.title} className="rounded-lg border border-amber-300/50 bg-amber-500/5 p-2">
                    <p className="text-[11px] font-medium">{action.title}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {action.state === 'overdue' ? 'Window passed' : 'Due now'} · target {formatDate(action.date)} · {action.owner}
                    </p>
                  </div>
                ))
              )}
              <p className="flex items-start gap-1.5 pt-1 text-[10px] text-muted-foreground">
                <PlaneTakeoff className="mt-0.5 h-3 w-3 shrink-0" />
                Planning aid only — not legal or immigration advice.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
