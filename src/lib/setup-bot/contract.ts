/** Browser-safe definitions for the one-question-at-a-time setup flow. */
export type SetupLanguage = 'bn' | 'en';
export type SetupGroup = 'facebook' | 'whatsapp' | 'meta' | 'webhook' | 'extra';
export type SetupFieldKind = 'page_id' | 'numeric_id' | 'phone' | 'secret' | 'url' | 'text' | 'choice';
export type FieldStatus = 'verified' | 'format_valid' | 'stored' | 'unverified' | 'skipped';
export type CheckStatus = 'verified' | 'failed' | 'unavailable' | 'skipped';

export interface SetupStep {
  id: string;
  group: SetupGroup;
  kind: SetupFieldKind;
  label: Record<SetupLanguage, string>;
  hint: Record<SetupLanguage, string>;
  placeholder?: string;
  secret?: boolean;
  recommended?: boolean;
  guideUrl?: string;
  choices?: string[];
}

export const GROUPS: { id: SetupGroup; label: Record<SetupLanguage, string> }[] = [
  { id: 'facebook', label: { bn: 'Facebook', en: 'Facebook' } },
  { id: 'whatsapp', label: { bn: 'WhatsApp', en: 'WhatsApp' } },
  { id: 'meta', label: { bn: 'Meta অ্যাপ', en: 'Meta app' } },
  { id: 'webhook', label: { bn: 'Webhook', en: 'Webhook' } },
  { id: 'extra', label: { bn: 'অন্যান্য', en: 'Extras' } },
];

export const BASE_STEPS: SetupStep[] = [
  {
    id: 'pageId', group: 'facebook', kind: 'page_id', recommended: true,
    label: { bn: 'আপনার Facebook Page ID দিন।', en: 'What is your Facebook Page ID?' },
    hint: { bn: 'Page Settings → Page Info থেকে ১৫–১৬ সংখ্যার Page ID কপি করুন।', en: 'Copy the 15–16 digit Page ID from Page Settings → Page Info.' },
    placeholder: '123456789012345', guideUrl: 'https://www.facebook.com/help/1503421039731588',
  },
  {
    id: 'phoneId', group: 'whatsapp', kind: 'numeric_id', recommended: true,
    label: { bn: 'আপনার WhatsApp Phone Number ID দিন।', en: 'What is your WhatsApp Phone Number ID?' },
    hint: { bn: 'Meta App Dashboard → WhatsApp → API Setup-এ এই সংখ্যাসূচক ID পাবেন। এটি ফোন নম্বর নয়।', en: 'Find this numeric ID in Meta App Dashboard → WhatsApp → API Setup. It is not the phone number.' },
    placeholder: '123456789012345', guideUrl: 'https://developers.facebook.com/docs/whatsapp/cloud-api/get-started',
  },
  {
    id: 'wabaId', group: 'whatsapp', kind: 'numeric_id', recommended: true,
    label: { bn: 'আপনার WhatsApp Business Account ID (WABA ID) দিন।', en: 'What is your WhatsApp Business Account ID (WABA ID)?' },
    hint: { bn: 'Meta Business Settings বা WhatsApp API Setup থেকে সংখ্যাসূচক WABA ID কপি করুন।', en: 'Copy the numeric WABA ID from Meta Business Settings or WhatsApp API Setup.' },
    placeholder: '123456789012345', guideUrl: 'https://developers.facebook.com/docs/whatsapp/cloud-api/get-started',
  },
  {
    id: 'phoneNumber', group: 'whatsapp', kind: 'phone',
    label: { bn: 'আপনার WhatsApp ফোন নম্বরটি কী? (ঐচ্ছিক)', en: 'What is your WhatsApp phone number? (optional)' },
    hint: { bn: 'দেশের কোডসহ E.164 ফরম্যাট ব্যবহার করুন, যেমন +8801712345678। Phone Number ID আলাদা।', en: 'Use E.164 with a country code, for example +8801712345678. This is separate from the Phone Number ID.' },
    placeholder: '+8801712345678',
  },
  {
    id: 'appId', group: 'meta', kind: 'numeric_id', recommended: true,
    label: { bn: 'আপনার Meta App ID দিন।', en: 'What is your Meta App ID?' },
    hint: { bn: 'Meta Developer Portal → App Dashboard → Settings → Basic-এ App ID পাবেন।', en: 'Find it in Meta Developer Portal → App Dashboard → Settings → Basic.' },
    placeholder: '123456789012345', guideUrl: 'https://developers.facebook.com/apps/',
  },
  {
    id: 'appSecret', group: 'meta', kind: 'secret', secret: true, recommended: true,
    label: { bn: 'আপনার Meta App Secret দিন।', en: 'Enter your Meta App Secret.' },
    hint: { bn: 'শুধু এই নিরাপদ ফিল্ডে দিন; চ্যাট বা ইমেলে শেয়ার করবেন না। সংরক্ষণের আগে এটি এনক্রিপ্ট হবে।', en: 'Enter it only in this secure field, never in chat or email. It is encrypted before storage.' },
    guideUrl: 'https://developers.facebook.com/apps/',
  },
  {
    id: 'pageToken', group: 'meta', kind: 'secret', secret: true, recommended: true,
    label: { bn: 'আপনার Facebook Page Access Token দিন।', en: 'Enter your Facebook Page Access Token.' },
    hint: { bn: 'সম্ভব হলে long-lived Page token ব্যবহার করুন। Meta-তে একটি নিরাপদ read-only পরীক্ষা করা হবে।', en: 'Use a long-lived Page token where possible. We will run a read-only check with Meta.' },
    guideUrl: 'https://developers.facebook.com/docs/facebook-login/guides/access-tokens/',
  },
  {
    id: 'whatsappToken', group: 'meta', kind: 'secret', secret: true, recommended: true,
    label: { bn: 'আপনার WhatsApp Cloud API System User Token দিন।', en: 'Enter your WhatsApp Cloud API System User Token.' },
    hint: { bn: 'Phone Number ID-এর সঙ্গে token পরীক্ষা করা হবে। প্রয়োজনীয় permissions আছে কি না নিশ্চিত করুন।', en: 'We will check the token against your Phone Number ID. Ensure it has the required permissions.' },
    guideUrl: 'https://developers.facebook.com/docs/whatsapp/cloud-api/get-started',
  },
  {
    id: 'webhookUrl', group: 'webhook', kind: 'url', recommended: true,
    label: { bn: 'আপনার Webhook-এর HTTPS URL দিন।', en: 'What is your webhook HTTPS URL?' },
    hint: { bn: 'এটি সর্বসাধারণের জন্য HTTPS-এ পৌঁছানো যায় এমন endpoint হতে হবে; query string বা secret URL-এ রাখবেন না।', en: 'Use a publicly reachable HTTPS endpoint; do not put secrets or a query string in the URL.' },
    placeholder: 'https://example.com/webhooks/meta', guideUrl: 'https://developers.facebook.com/docs/graph-api/webhooks/getting-started',
  },
  {
    id: 'webhookToken', group: 'webhook', kind: 'secret', secret: true, recommended: true,
    label: { bn: 'আপনার Webhook Verify Token দিন।', en: 'Enter your webhook verify token.' },
    hint: { bn: 'Webhook-এ Meta-এর verification challenge পাঠিয়ে সঠিক response পরীক্ষা করা হবে।', en: 'We will send a Meta-style verification challenge and check the exact response.' },
    guideUrl: 'https://developers.facebook.com/docs/graph-api/webhooks/getting-started',
  },
  {
    id: 'instagramId', group: 'extra', kind: 'numeric_id',
    label: { bn: 'আপনার Instagram Business Account ID দিন। (ঐচ্ছিক)', en: 'What is your Instagram Business Account ID? (optional)' },
    hint: { bn: 'সংখ্যাসূচক Business Account ID দিন; username নয়।', en: 'Enter the numeric Business Account ID, not the username.' },
    placeholder: '123456789012345', guideUrl: 'https://developers.facebook.com/docs/instagram-platform/',
  },
  {
    id: 'messengerToken', group: 'extra', kind: 'secret', secret: true,
    label: { bn: 'আপনার Messenger Platform Token দিন। (ঐচ্ছিক)', en: 'Enter your Messenger Platform Token. (optional)' },
    hint: { bn: 'Meta-তে read-only পরীক্ষা করা হবে।', en: 'We will run a read-only check with Meta.' },
    guideUrl: 'https://developers.facebook.com/docs/messenger-platform/',
  },
  {
    id: 'crmProvider', group: 'extra', kind: 'choice', choices: ['HubSpot', 'Zoho', 'Custom'],
    label: { bn: 'আপনি কোন CRM ব্যবহার করেন? (ঐচ্ছিক)', en: 'Which CRM do you use? (optional)' },
    hint: { bn: 'প্রযোজ্য না হলে স্কিপ করুন।', en: 'Skip this if you do not use one.' },
  },
  {
    id: 'crmKey', group: 'extra', kind: 'secret', secret: true,
    label: { bn: 'আপনার CRM API Key দিন। (ঐচ্ছিক)', en: 'Enter your CRM API key. (optional)' },
    hint: { bn: 'এটি এনক্রিপ্ট করে রাখা হবে। CRM-এর জন্য এখানে কোনো live verification adapter নেই।', en: 'It will be encrypted. A live CRM verification adapter is not available here.' },
  },
  {
    id: 'paymentProvider', group: 'extra', kind: 'choice', choices: ['Stripe', 'SSLCommerz', 'Custom'],
    label: { bn: 'আপনার Payment Gateway কোনটি? (ঐচ্ছিক)', en: 'Which payment gateway do you use? (optional)' },
    hint: { bn: 'প্রযোজ্য না হলে স্কিপ করুন।', en: 'Skip this if it does not apply.' },
  },
  {
    id: 'paymentAccountId', group: 'extra', kind: 'text',
    label: { bn: 'আপনার Payment Account / Store ID দিন। (ঐচ্ছিক)', en: 'Enter your payment account or store ID. (optional)' },
    hint: { bn: 'SSLCommerz ব্যবহার করলে Store ID দিন। অন্য ক্ষেত্রে প্রযোজ্য না হলে স্কিপ করুন।', en: 'For SSLCommerz, enter the Store ID. Otherwise skip if not applicable.' },
  },
  {
    id: 'paymentSecret', group: 'extra', kind: 'secret', secret: true,
    label: { bn: 'আপনার Payment Gateway API Key / Store Password দিন। (ঐচ্ছিক)', en: 'Enter your payment API key or store password. (optional)' },
    hint: { bn: 'এটি এনক্রিপ্ট করে রাখা হবে। Payment gateway-এর জন্য এখানে live verification adapter নেই।', en: 'It will be encrypted. A live payment verification adapter is not available here.' },
  },
];

export interface SafeAnswer {
  stepId: string;
  status: FieldStatus;
  value: string | null; // Secrets are always null, never masked token fragments.
  isSecret: boolean;
  note?: string;
}

export interface HealthCheck {
  id: 'facebook' | 'whatsapp' | 'webhook' | 'messenger';
  status: CheckStatus;
  detail: string;
  checkedAt: string;
}

export interface SetupSnapshot {
  status: 'in_progress' | 'paused' | 'review' | 'exporting' | 'completed';
  currentStep: string;
  steps: SetupStep[];
  answers: SafeAnswer[];
  checks: HealthCheck[];
  lastCheckedAt: string | null;
  completedAt: string | null;
  lastActivityAt: string;
  version: number;
  handoff: 'verified' | 'partial' | null;
  handoffTarget: 'local' | 'remote' | null;
}
