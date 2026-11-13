import type { Prisma } from '@prisma/client';
import { encryptSecret, decryptSecret, isEncryptedSecret } from '@/lib/credentials';
import { SetupError, validateField, type Answers } from './validation';
import { BASE_STEPS } from './contract';
import { recordManagedCredential } from './privacy';
import type { HealthCheck, SetupStep } from './contract';

/** Only this allowlisted structure crosses the handoff boundary. */
export interface SetupPayload {
  client_id: string;
  setup_completed_at: string;
  integrations: {
    facebook: { page_id: string; page_access_token: string; app_id: string; app_secret_encrypted: string };
    whatsapp: { phone_number_id: string; waba_id: string; phone_number: string; cloud_api_token: string };
    webhook: { url: string; verify_token: string };
    instagram: { account_id: string };
    messenger: { platform_token: string };
    crm: { provider: string; api_key_encrypted: string };
    payment: { provider: string; account_id: string; secret_encrypted: string };
    custom: Record<string, { value?: string; value_encrypted?: string }>;
  };
  password_dependency: false;
  notes: string;
}

function answer(answers: Answers, id: string): string { return answers[id]?.value || ''; }
function encrypted(value: string): string { return value ? encryptSecret(value) : ''; }

export function buildPayload(accountId: string, answers: Answers, steps: SetupStep[], at = new Date()): SetupPayload {
  const custom: SetupPayload['integrations']['custom'] = {};
  for (const step of steps.filter((item) => item.id.startsWith('custom_'))) {
    const value = answer(answers, step.id);
    if (!value) continue;
    custom[step.id.slice('custom_'.length)] = step.secret ? { value_encrypted: encrypted(value) } : { value };
  }
  return {
    client_id: accountId,
    setup_completed_at: at.toISOString(),
    integrations: {
      facebook: { page_id: answer(answers, 'pageId'), page_access_token: answer(answers, 'pageToken'), app_id: answer(answers, 'appId'), app_secret_encrypted: encrypted(answer(answers, 'appSecret')) },
      whatsapp: { phone_number_id: answer(answers, 'phoneId'), waba_id: answer(answers, 'wabaId'), phone_number: answer(answers, 'phoneNumber'), cloud_api_token: answer(answers, 'whatsappToken') },
      webhook: { url: answer(answers, 'webhookUrl'), verify_token: answer(answers, 'webhookToken') },
      instagram: { account_id: answer(answers, 'instagramId') },
      messenger: { platform_token: answer(answers, 'messengerToken') },
      crm: { provider: answer(answers, 'crmProvider'), api_key_encrypted: encrypted(answer(answers, 'crmKey')) },
      payment: { provider: answer(answers, 'paymentProvider'), account_id: answer(answers, 'paymentAccountId'), secret_encrypted: encrypted(answer(answers, 'paymentSecret')) },
      custom,
    },
    password_dependency: false,
    notes: 'Connections use API tokens, not the login password. Tokens may expire or be revoked by their provider.',
  };
}

/** Strictly parse untrusted service-to-service imports; never accept passwords, OTPs, or unknown fields. */
export function parseImportPayload(input: unknown): SetupPayload {
  const object = (value: unknown, allowed: string[], required: string[] = allowed): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new SetupError('Invalid import payload.');
    const record = value as Record<string, unknown>;
    if (Object.keys(record).some((key) => !allowed.includes(key)) || required.some((key) => !Object.hasOwn(record, key))) {
      throw new SetupError('Import contains missing or unsupported fields.');
    }
    return record;
  };
  const text = (value: unknown, max = 8192): string => {
    if (typeof value !== 'string' || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) throw new SetupError('Invalid import field.');
    return value;
  };
  const secret = (value: unknown): string => {
    const result = text(value, 12000);
    if (result) {
      if (!isEncryptedSecret(result)) throw new SetupError('Import secrets must use the configured encryption key.');
      try { decryptSecret(result); } catch { throw new SetupError('An imported secret cannot be decrypted with the configured key.'); }
    }
    return result;
  };
  const root = object(input, ['client_id', 'setup_completed_at', 'integrations', 'password_dependency', 'notes']);
  if (root.password_dependency !== false) throw new SetupError('Password-dependent imports are not supported.');
  const integrations = object(root.integrations, ['facebook', 'whatsapp', 'webhook', 'instagram', 'messenger', 'crm', 'payment', 'custom'], ['facebook', 'whatsapp', 'webhook', 'instagram', 'crm']);
  const fb = object(integrations.facebook, ['page_id', 'page_access_token', 'app_id', 'app_secret_encrypted']);
  const wa = object(integrations.whatsapp, ['phone_number_id', 'waba_id', 'phone_number', 'cloud_api_token'], ['phone_number_id', 'waba_id', 'cloud_api_token']);
  const wh = object(integrations.webhook, ['url', 'verify_token']);
  const ig = object(integrations.instagram, ['account_id']);
  const messenger = object(integrations.messenger ?? { platform_token: '' }, ['platform_token']);
  const crm = object(integrations.crm, ['provider', 'api_key_encrypted']);
  const payment = object(integrations.payment ?? { provider: '', account_id: '', secret_encrypted: '' }, ['provider', 'account_id', 'secret_encrypted']);
  const rawCustom = integrations.custom ?? {};
  if (!rawCustom || typeof rawCustom !== 'object' || Array.isArray(rawCustom) || Object.keys(rawCustom).length > 12) throw new SetupError('Invalid custom fields.');
  const custom: SetupPayload['integrations']['custom'] = {};
  for (const [key, value] of Object.entries(rawCustom)) {
    if (!/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(key)) throw new SetupError('Invalid custom field key.');
    const field = object(value, ['value', 'value_encrypted'], []);
    if (Object.keys(field).length !== 1) throw new SetupError('Invalid custom field value.');
    custom[key] = Object.hasOwn(field, 'value_encrypted') ? { value_encrypted: secret(field.value_encrypted) } : { value: text(field.value, 2048) };
  }
  const clientId = text(root.client_id, 254);
  const date = text(root.setup_completed_at, 40);
  if (!clientId || !Number.isFinite(Date.parse(date))) throw new SetupError('A client ID and valid completion time are required.');
  const parsed: SetupPayload = {
    client_id: clientId,
    setup_completed_at: date,
    integrations: {
      facebook: { page_id: text(fb.page_id, 32), page_access_token: text(fb.page_access_token), app_id: text(fb.app_id, 32), app_secret_encrypted: secret(fb.app_secret_encrypted) },
      whatsapp: { phone_number_id: text(wa.phone_number_id, 32), waba_id: text(wa.waba_id, 32), phone_number: text(wa.phone_number ?? '', 16), cloud_api_token: text(wa.cloud_api_token) },
      webhook: { url: text(wh.url, 2048), verify_token: text(wh.verify_token) },
      instagram: { account_id: text(ig.account_id, 32) },
      messenger: { platform_token: text(messenger.platform_token) },
      crm: { provider: text(crm.provider, 120), api_key_encrypted: secret(crm.api_key_encrypted) },
      payment: { provider: text(payment.provider, 120), account_id: text(payment.account_id, 2048), secret_encrypted: secret(payment.secret_encrypted) },
      custom,
    },
    password_dependency: false,
    // Free-form notes could accidentally contain secrets; keep a fixed safe note.
    notes: 'Connections use API tokens, not the login password. Tokens may expire or be revoked by their provider.',
  };
  // The service endpoint must enforce the same formats as the wizard, even
  // though it intentionally cannot trust external claims of verification.
  const fields: Record<string, string> = {
    pageId: parsed.integrations.facebook.page_id, appId: parsed.integrations.facebook.app_id,
    pageToken: parsed.integrations.facebook.page_access_token,
    phoneId: parsed.integrations.whatsapp.phone_number_id, wabaId: parsed.integrations.whatsapp.waba_id,
    phoneNumber: parsed.integrations.whatsapp.phone_number, whatsappToken: parsed.integrations.whatsapp.cloud_api_token,
    webhookUrl: parsed.integrations.webhook.url, webhookToken: parsed.integrations.webhook.verify_token,
    instagramId: parsed.integrations.instagram.account_id, messengerToken: parsed.integrations.messenger.platform_token,
    crmProvider: parsed.integrations.crm.provider, paymentProvider: parsed.integrations.payment.provider,
    paymentAccountId: parsed.integrations.payment.account_id,
  };
  for (const [id, value] of Object.entries(fields)) {
    if (value) {
      const step = BASE_STEPS.find((item) => item.id === id);
      if (!step) throw new SetupError('Invalid import field.');
      validateField(step, value);
    }
  }
  return parsed;
}

export function overallVerification(answers: Answers, checks: HealthCheck[]): 'verified' | 'partial' {
  const coreFields = ['pageId', 'pageToken', 'phoneId', 'wabaId', 'whatsappToken', 'webhookUrl', 'webhookToken'];
  return coreFields.every((key) => Boolean(answers[key]?.value)) && ['facebook', 'whatsapp', 'webhook'].every((id) => checks.some((check) => check.id === id && check.status === 'verified'))
    ? 'verified' : 'partial';
}

/**
 * In-app handoff. Called inside a transaction after confirmation, or by the
 * service endpoint. External imports are always unverified and never create an
 * active social account merely because a caller says they were checked.
 */
export async function importSetup(
  tx: Prisma.TransactionClient,
  companyId: string,
  payload: SetupPayload,
  verification: 'verified' | 'partial' | 'unverified',
  verifiedFacebook: boolean,
): Promise<void> {
  const encryptedPayload = encryptSecret(JSON.stringify(payload));
  const imported = await tx.setupImport.upsert({
    where: { companyId },
    create: { companyId, encryptedPayload, verification },
    update: { encryptedPayload, verification },
  });

  const facebook = payload.integrations.facebook;
  if (verifiedFacebook && facebook.page_id && facebook.page_access_token) {
    const existing = await tx.socialAccount.findFirst({ where: { companyId, platform: 'Facebook', accountId: facebook.page_id }, select: { id: true } });
    const accessToken = encryptSecret(facebook.page_access_token);
    const account = existing
      ? await tx.socialAccount.update({ where: { id: existing.id }, data: { accessToken, status: 'active', lastSyncedAt: new Date() } })
      : await tx.socialAccount.create({ data: {
        companyId, platform: 'Facebook', accountId: facebook.page_id,
        accountName: `Facebook Page ${facebook.page_id}`, accessToken,
        status: 'active', lastSyncedAt: new Date(),
      } });
    await recordManagedCredential(tx, companyId, 'social_account', account.id, facebook.page_access_token);
    // Also populate the existing Facebook Pages catalog connection when all of
    // its required credentials exist; this is configured, not a publishing adapter.
    if (facebook.app_id && facebook.app_secret_encrypted) {
      const tool = await tx.toolDefinition.findUnique({ where: { toolNumber: 9 }, select: { id: true } });
      if (tool) {
        const credentials = JSON.stringify({ FACEBOOK_APP_ID: facebook.app_id, FACEBOOK_APP_SECRET: facebook.app_secret_encrypted, FACEBOOK_PAGE_ACCESS_TOKEN: accessToken });
        const connection = await tx.toolConnection.upsert({
          where: { companyId_toolId: { companyId, toolId: tool.id } },
          create: { companyId, toolId: tool.id, credentials, status: 'configured', lastError: 'Publishing adapter is not verified by SetupBot.' },
          update: { credentials, status: 'configured', connectedAt: null, lastError: 'Publishing adapter is not verified by SetupBot.' },
        });
        await recordManagedCredential(tx, companyId, 'tool_connection', connection.id, facebook.page_access_token);
      }
    }
  }

  const existingConfig = await tx.clientConfig.findUnique({ where: { companyId } });
  let refs: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(existingConfig?.channelCredentials || '{}');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) refs = parsed as Record<string, unknown>;
  } catch { /* Preserve other configuration; replace malformed references only. */ }
  const sections = ['facebook', 'whatsapp', 'webhook', 'instagram', 'messenger', 'crm', 'payment'] as const;
  for (const section of sections) {
    const values = payload.integrations[section];
    if (Object.values(values).some(Boolean)) refs[section] = { mode: 'managed', reference: `setup-import:${imported.id}` };
  }
  const channelCredentials = JSON.stringify(refs);
  await tx.clientConfig.upsert({
    where: { companyId },
    create: { companyId, credentialMode: 'managed', onboardingStatus: verification === 'verified' ? 'configured' : 'pending', channelCredentials },
    update: { onboardingStatus: verification === 'verified' ? 'configured' : 'pending', channelCredentials },
  });
}
