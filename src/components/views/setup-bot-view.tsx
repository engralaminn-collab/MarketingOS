'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  ArrowLeft, ArrowRight, Bot, Check, CheckCircle2, CircleHelp, ClipboardCheck,
  ExternalLink, Globe2, KeyRound, Loader2, LockKeyhole, Pause, Play, RefreshCw,
  ShieldCheck, Sparkles, TriangleAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAppStore } from '@/stores/app-store';
import { GROUPS, type HealthCheck, type SafeAnswer, type SetupLanguage, type SetupSnapshot, type SetupStep } from '@/lib/setup-bot/contract';

const COPY = {
  bn: {
    eyebrow: 'আপনার নিরাপদ সেটআপ সহকারী', title: 'ইন্টিগ্রেশন সেটআপ, সহজভাবে।',
    subtitle: 'একবারে একটি তথ্য দিন। বাকি পথটুকুতে আমরা আপনাকে সাহায্য করব।',
    private: 'ব্যক্তিগত ও এনক্রিপ্টেড', language: 'English', workspace: 'ওয়ার্কস্পেস',
    saved: 'অগ্রগতি স্বয়ংক্রিয়ভাবে সংরক্ষিত', step: 'ধাপ', of: '/', complete: 'সম্পন্ন',
    question: 'এখন শুধু এই তথ্যটি দিন', recommended: 'প্রস্তাবিত', optional: 'ঐচ্ছিক',
    continue: 'সেভ করে এগিয়ে যান', skip: 'আপাতত স্কিপ', back: 'আগের ধাপ',
    keep: 'আগের তথ্য রেখে এগিয়ে যান', savedSecret: 'আগের তথ্য নিরাপদে সংরক্ষিত আছে। বদলাতে চাইলে নতুন তথ্য দিন।',
    help: 'নির্দেশিকা দেখুন', skipHelp: 'স্কিপ করলে সংশ্লিষ্ট ফিচার সীমিত থাকবে; পরে যোগ করতে পারবেন।',
    safeTitle: 'আপনার তথ্য নিরাপদ', safeBody: 'সিক্রেট শুধু এনক্রিপ্ট করে রাখা হয়। পাসওয়ার্ড বা OTP এখানে চাইব না।',
    tokenTitle: 'পাসওয়ার্ড বদলালেও?', tokenBody: 'সংযোগ পাসওয়ার্ডের বদলে API token ব্যবহার করে। তবে provider token মেয়াদোত্তীর্ণ বা বাতিল করতে পারে।',
    otpTitle: 'OTP বা 2FA এসেছে?', otpBody: 'কোড শুধু সংশ্লিষ্ট প্ল্যাটফর্মের নিজস্ব স্ক্রিনে দিন। প্রয়োজনে সেটআপ পজ করে পরে ফিরুন।',
    idle: '৩০ মিনিট নিষ্ক্রিয় থাকলে সেটআপ পজ হবে। সেভ করা ধাপগুলো থাকবে; অসমাপ্ত ইনপুট মুছে যাবে।',
    pause: 'পজ করুন', paused: 'সেটআপ পজ করা আছে', pausedBody: 'আপনার সেভ করা তথ্য নিরাপদে আছে। প্রস্তুত হলে যেখান থেকে থেমেছিলেন সেখান থেকেই শুরু করুন।',
    resume: 'সেটআপ চালিয়ে যান', review: 'একবার দেখে নিন', reviewSub: 'তথ্যগুলো যাচাই করুন। সিক্রেট আর কখনো এখানে দেখানো হবে না।',
    checkTitle: 'সংযোগ পরীক্ষা', checkSub: 'Meta ও webhook-এ read-only পরীক্ষা। অন্য provider-এর সেটিংস যাচাইবিহীন থাকতে পারে।',
    checking: 'যাচাই চলছে…', rerun: 'আবার পরীক্ষা করুন', edit: 'বদলান', value: 'তথ্য', status: 'অবস্থা',
    confirm: 'কনফার্ম ও সংরক্ষণ', confirmHint: 'ত্রুটি বা সংযোগ না পাওয়া গেলে তথ্য বদলান বা সেই ধাপ স্কিপ করুন।',
    ready: 'নিশ্চিত করার জন্য প্রস্তুত', incomplete: 'কিছু সংযোগ স্কিপ করা হয়েছে — সংশ্লিষ্ট সুবিধা সীমিত থাকবে।',
    exporting: 'মূল প্রজেক্টে পাঠানো হচ্ছে…', exportingBody: 'অনুগ্রহ করে অপেক্ষা করুন। স্বীকৃতি না পাওয়া পর্যন্ত সেটআপ সম্পন্ন দেখানো হবে না।',
    done: 'সেটআপ সংরক্ষিত!', doneBody: 'আপনার কনফার্ম করা তথ্য এই MarketingOS ওয়ার্কস্পেসে সংরক্ষণ করা হয়েছে।', doneRemote: 'মূল প্রজেক্টও তথ্য গ্রহণ করেছে।',
    donePartial: 'কিছু তথ্য স্কিপ করা হয়েছে, তাই সেটআপ আংশিক। বাকি সংযোগ পরে যোগ করুন।',
    doneVerified: 'Facebook, WhatsApp ও webhook-এর মৌলিক পরীক্ষাগুলো সফল হয়েছে।',
    adapterNote: 'WhatsApp, CRM ও পেমেন্টের তথ্য সংরক্ষণ করা হয়েছে; আলাদা provider adapter ছাড়া চালু হয়েছে বলে ধরে নেওয়া যাবে না।',
    editSetup: 'সেটআপ পরিবর্তন করুন', dashboard: 'ড্যাশবোর্ডে ফিরুন', discard: 'ড্রাফট মুছুন',
    discardConfirm: 'আপনার সেভ করা ড্রাফট মুছবেন? কনফার্ম করা ইন্টিগ্রেশন মুছে যাবে না।',
    erase: 'ওয়ার্কস্পেসের সেটআপ ডেটা মুছুন', eraseConfirm: 'এই ওয়ার্কস্পেসের সব সেটআপ ড্রাফট, ইমপোর্ট ও অপরিবর্তিত সেটআপ-সংযোগ মুছে যাবে। রিমোট প্রজেক্ট থেকে আলাদাভাবে মুছতে হবে। চালিয়ে যাবেন?', eraseSuccess: 'স্থানীয় সেটআপ ডেটা মুছে দেওয়া হয়েছে। রিমোট প্রজেক্টে কপি থাকলে সেখান থেকেও মুছুন।',
    loading: 'আপনার সেটআপ লোড হচ্ছে…', error: 'সেটআপ লোড করা যায়নি।', retry: 'আবার চেষ্টা করুন',
    secure: 'সিক্রেট দিতে HTTPS-সহ নিরাপদ সংযোগ ব্যবহার করুন।',
    verified: 'যাচাই সফল', format_valid: 'ফরম্যাট ঠিক', stored: 'সংরক্ষিত', unverified: 'যাচাই বাকি', skipped: 'স্কিপ করা',
    failed: 'ব্যর্থ', unavailable: 'পাওয়া যায়নি', noValue: '—', secretValue: 'নিরাপদে সংরক্ষিত', choose: 'একটি নির্বাচন করুন',
  },
  en: {
    eyebrow: 'YOUR SECURE SETUP ASSISTANT', title: 'Integrations, made simple.',
    subtitle: 'One detail at a time. We’ll guide you through the rest.',
    private: 'Private & encrypted', language: 'বাংলা', workspace: 'WORKSPACE',
    saved: 'Progress saved automatically', step: 'STEP', of: 'OF', complete: 'complete',
    question: 'LET’S START WITH ONE DETAIL', recommended: 'Recommended', optional: 'Optional',
    continue: 'Save & continue', skip: 'Skip for now', back: 'Previous',
    keep: 'Keep saved answer & continue', savedSecret: 'A secret is already saved. Enter a new one only if you want to replace it.',
    help: 'View the guide', skipHelp: 'Skipping limits the related features. You can add this later.',
    safeTitle: 'Your details stay protected', safeBody: 'Secrets are encrypted at rest. We never ask for passwords or OTPs here.',
    tokenTitle: 'Changing your password?', tokenBody: 'Connections use API tokens rather than your password. Providers can still expire or revoke tokens.',
    otpTitle: 'Need an OTP or 2FA?', otpBody: 'Enter codes only on the platform’s own screen. Pause setup and return when you’re ready.',
    idle: 'After 30 minutes of inactivity, setup pauses. Saved steps remain; unfinished input is cleared.',
    pause: 'Pause setup', paused: 'Your setup is paused', pausedBody: 'Your saved progress is safe. Pick up exactly where you left off when you’re ready.',
    resume: 'Resume setup', review: 'Let’s review everything', reviewSub: 'Check your details before confirming. Secrets are never shown again.',
    checkTitle: 'Connection checks', checkSub: 'Read-only checks for Meta and your webhook. Other providers may remain unverified.',
    checking: 'Checking connections…', rerun: 'Run checks again', edit: 'Edit', value: 'VALUE', status: 'STATUS',
    confirm: 'Confirm & save setup', confirmHint: 'Fix a failed or unavailable check, or skip that integration before confirming.',
    ready: 'Ready for your confirmation', incomplete: 'Some connections were skipped, so related features will be limited.',
    exporting: 'Sending to the main project…', exportingBody: 'Please wait. Setup will not be marked complete until the project acknowledges the handoff.',
    done: 'Setup saved!', doneBody: 'Your confirmed details were saved to this MarketingOS workspace.', doneRemote: 'The main project also acknowledged the handoff.',
    donePartial: 'Some information was skipped, so this is a partial setup. You can add the rest later.',
    doneVerified: 'The basic Facebook, WhatsApp and webhook checks passed.',
    adapterNote: 'WhatsApp, CRM and payment details are stored; they are not enabled without separate provider adapters.',
    editSetup: 'Edit setup', dashboard: 'Back to dashboard', discard: 'Delete draft',
    discardConfirm: 'Delete your saved draft? Confirmed integrations will not be removed.',
    erase: 'Erase workspace setup data', eraseConfirm: 'Delete all setup drafts, imports and unchanged setup-managed connections for this workspace? Remote project copies must be erased separately.', eraseSuccess: 'Local setup data was erased. Remove any copies from the remote project separately.',
    loading: 'Loading your setup…', error: 'Could not load your setup.', retry: 'Try again',
    secure: 'Use a secure HTTPS connection before entering secrets.',
    verified: 'Verified', format_valid: 'Format valid', stored: 'Stored', unverified: 'Unverified', skipped: 'Skipped',
    failed: 'Failed', unavailable: 'Unavailable', noValue: '—', secretValue: 'Stored securely', choose: 'Select an option',
  },
} as const;

const BANGLA_ERRORS: Record<string, string> = {
  'Enter a value or choose Skip.': 'একটি তথ্য দিন অথবা স্কিপ করুন।',
  'The Facebook Page ID must contain 15–16 digits.': 'Facebook Page ID অবশ্যই ১৫–১৬ সংখ্যার হতে হবে।',
  'Enter the numeric ID (5–32 digits), not a phone number or name.': 'নাম বা ফোন নম্বর নয়, ৫–৩২ সংখ্যার ID দিন।',
  'Enter a phone number in E.164 format, for example +8801712345678.': 'দেশের কোডসহ E.164 নম্বর দিন, যেমন +8801712345678।',
  'Enter a valid public HTTPS URL.': 'একটি সঠিক পাবলিক HTTPS URL দিন।',
  'Use an HTTPS URL without credentials, a non-standard port, query string, or fragment.': 'শুধু HTTPS URL দিন; credentials, আলাদা port, query বা fragment রাখবেন না।',
  'Meta could not be reached. Try again or skip this integration.': 'Meta-তে সংযোগ করা যায়নি। আবার চেষ্টা করুন অথবা স্কিপ করুন।',
  'Meta rejected this token or its permissions. Check the credential and API version.': 'Meta token বা অনুমতি গ্রহণ করেনি। তথ্য ও API version পরীক্ষা করুন।',
  'The token is not for the supplied Facebook Page ID.': 'Token-টি দেওয়া Facebook Page ID-এর নয়।',
  'Webhook must return HTTP 200 with the exact hub.challenge for this verify token.': 'Webhook-কে HTTP 200 এবং সঠিক hub.challenge ফেরত দিতে হবে।',
  'Webhook is unreachable or is not a permitted public HTTPS destination.': 'Webhook-এ পৌঁছানো যায়নি বা এটি অনুমোদিত পাবলিক HTTPS ঠিকানা নয়।',
  'Choose a CRM provider first, or skip this step.': 'আগে CRM provider নির্বাচন করুন, অথবা ধাপটি স্কিপ করুন।',
  'Choose a payment provider first, or skip this step.': 'আগে payment provider নির্বাচন করুন, অথবা ধাপটি স্কিপ করুন।',
  'Enter a webhook URL before adding a verify token, or skip this step.': 'Verify token দেওয়ার আগে webhook URL দিন, অথবা ধাপটি স্কিপ করুন।',
  'Secure setup storage is unavailable. Configure CREDENTIAL_ENCRYPTION_KEY.': 'নিরাপদ স্টোরেজ প্রস্তুত নয়। অ্যাডমিনকে CREDENTIAL_ENCRYPTION_KEY সেট করতে বলুন।',
  'This setup changed or paused. Refresh to continue.': 'সেটআপ অন্য ট্যাবে বদলেছে বা পজ হয়েছে। রিফ্রেশ করে এগিয়ে যান।',
  'This setup changed in another tab. Refresh to continue.': 'সেটআপ অন্য ট্যাবে বদলেছে। রিফ্রেশ করে এগিয়ে যান।',
  'Meta reports a short-lived token. Use Meta’s access-token tools and select Extend Access Token, then try again.': 'এটি short-lived token। Meta Developer Tools → Graph API Explorer-এর access-token tools থেকে Extend Access Token নির্বাচন করে আবার চেষ্টা করুন।',
  'Run the health checks before confirming.': 'কনফার্ম করার আগে সংযোগ পরীক্ষা করুন।',
};

function localizedError(message: string, lang: SetupLanguage): string {
  return lang === 'bn' ? (BANGLA_ERRORS[message] || `সমস্যা হয়েছে: ${message}`) : message;
}

function localizedDetail(message: string, lang: SetupLanguage): string {
  if (lang === 'en') return message;
  if (BANGLA_ERRORS[message]) return BANGLA_ERRORS[message];
  if (message.startsWith('Meta accepted the credential.')) {
    if (message.includes('lifetime could not be checked') || message.includes('lifetime was not checked')) return 'Meta তথ্যটি গ্রহণ করেছে, তবে token-এর মেয়াদ যাচাই করা যায়নি।';
    if (message.includes('no token expiry')) return 'Meta কোনো মেয়াদ জানায়নি; তবে অনুমতি বাতিল হতে পারে।';
    const expiry = message.match(/expiry on (\d{4}-\d{2}-\d{2})/);
    return expiry ? `Meta তথ্যটি গ্রহণ করেছে। মেয়াদ ${expiry[1]}; অনুমতি বাতিল হতে পারে।` : 'Meta তথ্যটি গ্রহণ করেছে। Token-এর মেয়াদ ও অনুমতি provider-এর উপর নির্ভর করে।';
  }
  if (message === 'The HTTPS webhook returned the expected verification challenge.') return 'HTTPS webhook সঠিক verification challenge ফেরত দিয়েছে।';
  if (message === 'Not configured or a required field was skipped.') return 'সেটিংস দেওয়া হয়নি অথবা প্রয়োজনীয় তথ্য স্কিপ করা হয়েছে।';
  return message;
}

function StatusPill({ status, language }: { status: SafeAnswer['status'] | HealthCheck['status']; language: SetupLanguage }) {
  const t = COPY[language];
  const good = status === 'verified';
  const bad = status === 'failed' || status === 'unavailable';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap ${good ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : bad ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400' : 'bg-muted text-muted-foreground'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${good ? 'bg-emerald-500' : bad ? 'bg-rose-500' : 'bg-muted-foreground/60'}`} />
      {t[status]}
    </span>
  );
}

const subscribeSecureContext = () => () => {};
const browserIsSecure = () => window.isSecureContext;
const serverIsSecure = () => true;

async function requestSetup(method: 'GET' | 'POST' | 'DELETE', data?: Record<string, unknown>): Promise<SetupSnapshot | null> {
  const token = localStorage.getItem('mos_token');
  if (!token) throw new Error('Please sign in to continue.');
  const response = await fetch('/api/setup-bot', {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(data ? { 'Content-Type': 'application/json' } : {}) },
    body: data ? JSON.stringify(data) : undefined,
    cache: 'no-store',
  });
  if (response.status === 204) return null;
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : 'Setup request failed.');
  return result as SetupSnapshot;
}

export function SetupBotView() {
  const { user, setActiveView, setupLanguage: language, setSetupLanguage: setLanguage } = useAppStore();
  const [snapshot, setSnapshot] = useState<SetupSnapshot | null>(null);
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const secure = useSyncExternalStore(subscribeSecureContext, browserIsSecure, serverIsSecure);
  const snapshotRef = useRef<SetupSnapshot | null>(null);
  const busyRef = useRef(false);
  const autoChecked = useRef<number | null>(null);
  const t = COPY[language];
  const current = snapshot?.steps.find((step) => step.id === snapshot.currentStep);
  const currentAnswer = snapshot?.answers.find((answer) => answer.stepId === current?.id);
  const index = current && snapshot ? snapshot.steps.findIndex((step) => step.id === current.id) : -1;
  const answeredCount = snapshot?.answers.length || 0;
  const progress = snapshot?.steps.length ? Math.round((answeredCount / snapshot.steps.length) * 100) : 0;

  useEffect(() => {
    const previous = document.documentElement.lang;
    document.documentElement.lang = language;
    return () => { document.documentElement.lang = previous; };
  }, [language]);
  useEffect(() => { snapshotRef.current = snapshot; }, [snapshot]);
  useEffect(() => { busyRef.current = busy; }, [busy]);

  const applySnapshot = useCallback((result: SetupSnapshot) => {
    snapshotRef.current = result;
    setSnapshot(result);
    const answer = result.answers.find((item) => item.stepId === result.currentStep);
    setValue(answer && !answer.isSecret && answer.value ? answer.value : '');
  }, []);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const result = await requestSetup('GET');
      if (result) applySnapshot(result);
    } catch (err) { setError(err instanceof Error ? err.message : 'Setup request failed.'); }
    finally { setLoading(false); }
  }, [applySnapshot]);
  useEffect(() => {
    let active = true;
    void requestSetup('GET').then((result) => {
      if (active && result) applySnapshot(result);
    }).catch((err) => {
      if (active) setError(err instanceof Error ? err.message : 'Setup request failed.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [applySnapshot]);

  const act = useCallback(async (action: string, extra: Record<string, unknown> = {}) => {
    const state = snapshotRef.current;
    if (!state || busyRef.current) return;
    busyRef.current = true; setBusy(true); setError('');
    try {
      const result = await requestSetup('POST', { action, version: state.version, ...extra });
      if (result) applySnapshot(result);
    } catch (err) {
      // Never retain a failed credential submission in the form.
      if (state.steps.find((step) => step.id === state.currentStep)?.secret) setValue('');
      setError(err instanceof Error ? err.message : 'Setup request failed.');
    } finally { busyRef.current = false; setBusy(false); }
  }, [applySnapshot]);

  // Every accepted answer is persisted server-side. Inactivity discards only
  // unsent input. A throttled heartbeat records actual interaction, not polling.
  useEffect(() => {
    if (!snapshot || !['in_progress', 'review'].includes(snapshot.status)) return;
    let lastTouch = Date.now();
    let timer: ReturnType<typeof setTimeout>;
    const expire = () => {
      setValue('');
      const state = snapshotRef.current;
      if (!state) return;
      void requestSetup('POST', { action: 'pause', version: state.version }).then((next) => {
        if (next) applySnapshot(next);
        else void load();
      }).catch(() => { void load(); });
    };
    const activity = () => {
      clearTimeout(timer); timer = setTimeout(expire, 30 * 60_000);
      if (Date.now() - lastTouch >= 60_000) {
        lastTouch = Date.now();
        void requestSetup('POST', { action: 'touch' }).catch(() => { void load(); });
      }
    };
    timer = setTimeout(expire, 30 * 60_000);
    window.addEventListener('keydown', activity);
    window.addEventListener('pointerdown', activity);
    window.addEventListener('touchstart', activity, { passive: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', activity);
      window.removeEventListener('pointerdown', activity);
      window.removeEventListener('touchstart', activity);
    };
  }, [snapshot?.status, load, applySnapshot]);

  useEffect(() => {
    if (snapshot?.status === 'review' && !snapshot.lastCheckedAt && !busy && autoChecked.current !== snapshot.version) {
      autoChecked.current = snapshot.version;
      void act('verify');
    }
  }, [snapshot, busy, act]);

  useEffect(() => {
    if (snapshot?.status !== 'exporting') return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      try {
        const result = await requestSetup('GET');
        if (active && result) applySnapshot(result);
      } catch { /* Allow a later retry without exposing provider errors. */ }
      if (active) timer = setTimeout(() => void refresh(), 4000);
    };
    timer = setTimeout(() => void refresh(), 4000);
    return () => { active = false; clearTimeout(timer); };
  }, [snapshot?.status, applySnapshot]);

  const discard = async () => {
    if (!window.confirm(t.discardConfirm)) return;
    setBusy(true); setError('');
    try { await requestSetup('DELETE'); snapshotRef.current = null; setSnapshot(null); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Setup request failed.'); }
    finally { setBusy(false); }
  };

  const erase = async () => {
    if (!window.confirm(t.eraseConfirm)) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const token = localStorage.getItem('mos_token');
      const response = await fetch('/api/setup-bot/import', { method: 'DELETE', headers: { Authorization: `Bearer ${token || ''}`, 'X-Confirm-Setup-Erasure': 'yes' }, cache: 'no-store' });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(typeof result.error === 'string' ? result.error : 'Setup erasure failed.');
      }
      snapshotRef.current = null; setSnapshot(null); setNotice(t.eraseSuccess); await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Setup erasure failed.'); }
    finally { setBusy(false); }
  };

  if (loading) return <div className="flex min-h-[55vh] items-center justify-center gap-3 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{t.loading}</div>;
  if (!snapshot) return <div className="mx-auto max-w-xl rounded-2xl border bg-card p-8 text-center"><TriangleAlert className="mx-auto mb-3 h-6 w-6 text-amber-500" /><p className="font-semibold">{t.error}</p><p className="mt-2 text-sm text-muted-foreground">{localizedError(error, language)}</p><Button className="mt-5" onClick={() => void load()}>{t.retry}</Button></div>;

  return (
    <div className="mx-auto max-w-[1440px] space-y-6 pb-12 text-foreground">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400"><Sparkles className="h-3.5 w-3.5" />{t.eyebrow}</div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t.title}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 sm:inline-flex"><ShieldCheck className="h-3.5 w-3.5" />{t.private}</span>
          <Button variant="outline" size="sm" className="rounded-full" onClick={() => setLanguage(language === 'bn' ? 'en' : 'bn')}><Globe2 className="mr-1.5 h-3.5 w-3.5" />{t.language}</Button>
        </div>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[230px_minmax(0,1fr)_260px]">
        <aside className="rounded-2xl border border-border/70 bg-card p-4 lg:sticky lg:top-4">
          <div className="mb-5 flex items-center gap-3 border-b border-border/60 pb-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"><Bot className="h-5 w-5" /></div>
            <div className="min-w-0"><p className="truncate text-sm font-semibold">SetupBot</p><p className="mt-0.5 truncate text-[11px] text-muted-foreground">{user?.companyName || t.workspace}</p></div>
          </div>
          <div className="mb-2 flex items-center justify-between text-xs"><span className="font-medium">{language === 'bn' ? 'আপনার অগ্রগতি' : 'Your progress'}</span><span className="font-semibold text-emerald-600 dark:text-emerald-400">{progress}%</span></div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} /></div>
          <div className="mt-5 grid grid-cols-2 gap-1 sm:grid-cols-5 lg:grid-cols-1 lg:gap-1.5">
            {GROUPS.map((group, groupIndex) => {
              const groupSteps = snapshot.steps.filter((step) => step.group === group.id);
              const complete = groupSteps.every((step) => snapshot.answers.some((answer) => answer.stepId === step.id));
              const active = current?.group === group.id;
              return <div key={group.id} className={`flex items-center gap-2.5 rounded-lg px-2 py-2 text-xs ${active ? 'bg-emerald-500/10 font-semibold text-emerald-700 dark:text-emerald-300' : 'text-muted-foreground'}`}>
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] ${complete ? 'border-emerald-500 bg-emerald-500 text-white' : active ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'border-border'}`}>{complete ? <Check className="h-3 w-3" /> : groupIndex + 1}</span>
                <span className="truncate">{group.label[language]}</span>
              </div>;
            })}
          </div>
          <div className="mt-5 hidden items-center gap-2 border-t border-border/60 pt-4 text-[11px] text-muted-foreground lg:flex"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />{t.saved}</div>
        </aside>

        <main className="min-w-0 space-y-4">
          {notice && <div role="status" className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3 text-sm text-emerald-700 dark:text-emerald-300">{notice}</div>}
          {!secure && <div role="alert" className="flex gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-600 dark:text-rose-300"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />{t.secure}</div>}
          {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-500/25 bg-rose-500/5 p-3 text-sm text-rose-600 dark:text-rose-300"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /><span>{localizedError(error, language)}</span><button className="ml-auto underline underline-offset-2" onClick={() => void load()}>{t.retry}</button></div>}

          {snapshot.status === 'in_progress' && current && (
            <section className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
              <div className="flex items-center justify-between border-b border-border/60 px-6 py-4 sm:px-8">
                <span className="text-[11px] font-bold tracking-[0.12em] text-muted-foreground">{t.step} {index + 1} {t.of} {snapshot.steps.length}</span>
                <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">{current.recommended ? t.recommended : t.optional}</span>
              </div>
              <form className="px-6 py-8 sm:px-8 sm:py-10" onSubmit={(event) => { event.preventDefault(); if (secure && !busy) void act('save', { stepId: current.id, value }); }}>
                <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"><StepIcon step={current} /></div>
                <p className="mb-2 text-[10px] font-bold tracking-[0.18em] text-emerald-600 dark:text-emerald-400">{t.question}</p>
                <h2 className="max-w-xl text-xl font-semibold leading-snug tracking-tight sm:text-2xl">{current.label[language]}</h2>
                <p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground">{current.hint[language]}</p>
                <div className="mt-7 max-w-xl">
                  <label htmlFor="setup-answer" className="sr-only">{current.label[language]}</label>
                  {current.kind === 'choice' ? (
                    <select id="setup-answer" value={value} onChange={(event) => setValue(event.target.value)} disabled={busy || !secure} className="h-12 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50">
                      <option value="">{t.choose}</option>{current.choices?.map((choice) => <option key={choice} value={choice}>{choice}</option>)}
                    </select>
                  ) : (
                    <Input id="setup-answer" type={current.secret ? 'password' : current.kind === 'url' ? 'url' : 'text'} inputMode={current.kind === 'numeric_id' || current.kind === 'page_id' ? 'numeric' : current.kind === 'phone' ? 'tel' : undefined} value={value} onChange={(event) => setValue(event.target.value)} disabled={busy || !secure} placeholder={current.placeholder || (current.secret ? '••••••••••••••••' : '')} autoComplete="off" spellCheck={false} maxLength={current.secret ? 8192 : 2048} className="h-12 rounded-xl bg-background px-4 text-sm focus-visible:ring-emerald-500/50" />
                  )}
                  {currentAnswer?.isSecret && currentAnswer.status !== 'skipped' && <p className="mt-2 text-xs leading-5 text-muted-foreground"><LockKeyhole className="mr-1 inline h-3 w-3" />{t.savedSecret}</p>}
                  {current.guideUrl && <a href={current.guideUrl} target="_blank" rel="noreferrer noopener" className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:underline dark:text-emerald-400"><CircleHelp className="h-3.5 w-3.5" />{t.help}<ExternalLink className="h-3 w-3" /></a>}
                </div>
                <div className="mt-9 flex flex-wrap items-center gap-3">
                  <Button type="submit" disabled={busy || !secure || !value.trim()} className="h-11 rounded-xl bg-emerald-600 px-5 text-white hover:bg-emerald-700">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{t.continue}<ArrowRight className="ml-2 h-4 w-4" /></Button>
                  <Button type="button" variant="ghost" disabled={busy} onClick={() => void act('skip', { stepId: current.id })} className="h-11 rounded-xl text-muted-foreground">{t.skip}</Button>
                </div>
                {currentAnswer && <Button type="button" variant="outline" disabled={busy} className="mt-3 h-9 rounded-lg text-xs" onClick={() => void act('keep', { stepId: current.id })}>{t.keep}</Button>}
                <p className="mt-4 text-xs leading-5 text-muted-foreground">{t.skipHelp}</p>
              </form>
              <div className="flex items-center justify-between border-t border-border/60 bg-muted/20 px-6 py-3 sm:px-8">
                <Button variant="ghost" size="sm" disabled={busy || index <= 0} onClick={() => void act('previous')} className="text-xs text-muted-foreground"><ArrowLeft className="mr-1.5 h-3.5 w-3.5" />{t.back}</Button>
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => void act('pause')} className="text-xs text-muted-foreground"><Pause className="mr-1.5 h-3.5 w-3.5" />{t.pause}</Button>
              </div>
            </section>
          )}

          {snapshot.status === 'paused' && (
            <section className="rounded-2xl border border-border/70 bg-card px-6 py-14 text-center sm:px-10">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600"><Pause className="h-7 w-7" /></div>
              <h2 className="mt-5 text-xl font-semibold">{t.paused}</h2><p className="mx-auto mt-3 max-w-md text-sm leading-7 text-muted-foreground">{t.pausedBody}</p>
              <Button disabled={busy} onClick={() => void act('resume')} className="mt-7 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"><Play className="mr-2 h-4 w-4" />{t.resume}</Button>
            </section>
          )}

          {snapshot.status === 'review' && <Review snapshot={snapshot} language={language} busy={busy} onAction={act} />}

          {snapshot.status === 'exporting' && <section className="rounded-2xl border border-border/70 bg-card px-6 py-14 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-emerald-500" /><h2 className="mt-5 text-xl font-semibold">{t.exporting}</h2><p className="mx-auto mt-3 max-w-md text-sm leading-7 text-muted-foreground">{t.exportingBody}</p></section>}

          {snapshot.status === 'completed' && (
            <section className="rounded-2xl border border-border/70 bg-card px-6 py-12 text-center sm:px-10">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="h-8 w-8" /></div>
              <h2 className="mt-5 text-2xl font-semibold">{t.done}</h2><p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-muted-foreground">{t.doneBody} {snapshot.handoffTarget === 'remote' && t.doneRemote}</p>
              <p className="mx-auto mt-2 max-w-lg text-sm font-medium">{snapshot.handoff === 'verified' ? t.doneVerified : t.donePartial}</p>
              <div className="mx-auto mt-6 max-w-lg rounded-xl border border-border/70 bg-muted/30 p-4 text-left text-xs leading-6 text-muted-foreground">{t.adapterNote}<br /><span className="font-medium text-foreground">{t.tokenBody}</span></div>
              <div className="mt-7 flex flex-wrap justify-center gap-3"><Button disabled={busy} onClick={() => void act('reopen')} className="rounded-xl bg-emerald-600 text-white hover:bg-emerald-700">{t.editSetup}</Button><Button variant="outline" className="rounded-xl" onClick={() => setActiveView('dashboard')}>{t.dashboard}</Button></div>
            </section>
          )}
          <div className="flex flex-wrap gap-x-5 gap-y-2 px-1">
            {snapshot.status !== 'completed' && snapshot.status !== 'exporting' && <button disabled={busy} onClick={() => void discard()} className="text-xs text-muted-foreground underline-offset-4 hover:underline disabled:opacity-50">{t.discard}</button>}
            {snapshot.status !== 'exporting' && ['super_admin', 'superadmin', 'company_owner', 'admin'].includes(user?.role || '') && <button disabled={busy} onClick={() => void erase()} className="text-xs text-muted-foreground underline-offset-4 hover:text-rose-600 hover:underline disabled:opacity-50">{t.erase}</button>}
          </div>
        </main>

        <aside className="space-y-3 lg:sticky lg:top-4">
          <InfoCard icon={<ShieldCheck className="h-4 w-4" />} title={t.safeTitle} text={t.safeBody} accent />
          <InfoCard icon={<KeyRound className="h-4 w-4" />} title={t.tokenTitle} text={t.tokenBody} />
          <InfoCard icon={<CircleHelp className="h-4 w-4" />} title={t.otpTitle} text={t.otpBody} />
          <p className="px-1 text-[11px] leading-5 text-muted-foreground">{t.idle}</p>
        </aside>
      </div>
    </div>
  );
}

function StepIcon({ step }: { step: SetupStep }) {
  if (step.secret) return <KeyRound className="h-5 w-5" />;
  if (step.group === 'webhook') return <Globe2 className="h-5 w-5" />;
  return <ClipboardCheck className="h-5 w-5" />;
}

function InfoCard({ icon, title, text, accent = false }: { icon: React.ReactNode; title: string; text: string; accent?: boolean }) {
  return <div className={`rounded-2xl border p-4 ${accent ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-border/70 bg-card'}`}><div className={`mb-3 ${accent ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>{icon}</div><p className="text-xs font-semibold">{title}</p><p className="mt-2 text-xs leading-6 text-muted-foreground">{text}</p></div>;
}

function Review({ snapshot, language, busy, onAction }: { snapshot: SetupSnapshot; language: SetupLanguage; busy: boolean; onAction: (action: string, extra?: Record<string, unknown>) => Promise<void> }) {
  const t = COPY[language];
  const failed = snapshot.checks.some((check) => check.status === 'failed' || check.status === 'unavailable');
  const partial = snapshot.checks.some((check) => check.status === 'skipped') || snapshot.answers.some((answer) => answer.status === 'skipped');
  const labels: Record<HealthCheck['id'], string> = { facebook: 'Facebook Page', whatsapp: 'WhatsApp Cloud API', webhook: 'Webhook', messenger: 'Messenger' };
  return <section className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
    <div className="border-b border-border/60 px-6 py-6 sm:px-8"><p className="mb-2 text-[10px] font-bold tracking-[0.18em] text-emerald-600 dark:text-emerald-400">{t.ready}</p><h2 className="text-xl font-semibold sm:text-2xl">{t.review}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{t.reviewSub}</p></div>
    <div className="px-6 py-6 sm:px-8">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-sm font-semibold">{t.checkTitle}</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">{t.checkSub}</p></div><Button variant="outline" size="sm" className="rounded-lg text-xs" disabled={busy} onClick={() => void onAction('verify')}><RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} />{t.rerun}</Button></div>
      {busy && !snapshot.lastCheckedAt ? <div className="mt-4 flex items-center gap-2 rounded-xl bg-muted/30 p-4 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{t.checking}</div> : <div className="mt-4 grid gap-2 sm:grid-cols-2">{snapshot.checks.map((check) => <div key={check.id} className="rounded-xl border border-border/70 p-3"><div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold">{labels[check.id]}</span><StatusPill status={check.status} language={language} /></div><p className="mt-2 text-[11px] leading-5 text-muted-foreground">{localizedDetail(check.detail, language)}</p></div>)}</div>}
      <div className="mt-7 overflow-x-auto rounded-xl border border-border/70"><table className="w-full min-w-[500px] text-left text-xs"><thead className="bg-muted/30 text-[10px] font-semibold tracking-wider text-muted-foreground"><tr><th className="px-4 py-3">{language === 'bn' ? 'ইন্টিগ্রেশন' : 'INTEGRATION'}</th><th className="px-4 py-3">{t.value}</th><th className="px-4 py-3">{t.status}</th><th className="px-4 py-3" /></tr></thead><tbody>{snapshot.steps.map((step) => {
        const answer = snapshot.answers.find((item) => item.stepId === step.id);
        if (!answer) return null;
        return <tr key={step.id} className="border-t border-border/60"><th scope="row" className="max-w-[190px] px-4 py-3 font-medium leading-5">{step.label[language]}</th><td className="max-w-[180px] break-all px-4 py-3 text-muted-foreground">{answer.status === 'skipped' ? t.noValue : answer.isSecret ? t.secretValue : answer.value}</td><td className="px-4 py-3"><StatusPill status={answer.status} language={language} /></td><td className="px-4 py-3 text-right"><button disabled={busy} onClick={() => void onAction('edit', { stepId: step.id })} className="font-semibold text-emerald-600 hover:underline disabled:opacity-50 dark:text-emerald-400">{t.edit}</button></td></tr>;
      })}</tbody></table></div>
      <p className="mt-4 text-xs leading-6 text-muted-foreground">{failed ? t.confirmHint : partial ? t.incomplete : t.ready}</p>
      <div className="mt-5 flex flex-wrap gap-3"><Button disabled={busy || !snapshot.lastCheckedAt || failed} onClick={() => void onAction('confirm')} className="h-11 rounded-xl bg-emerald-600 px-5 text-white hover:bg-emerald-700">{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t.confirm}<ArrowRight className="ml-2 h-4 w-4" /></Button><Button variant="ghost" disabled={busy} onClick={() => void onAction('pause')} className="h-11 text-muted-foreground"><Pause className="mr-2 h-4 w-4" />{t.pause}</Button></div>
    </div>
  </section>;
}
