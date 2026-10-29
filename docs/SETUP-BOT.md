# SetupBot: secure integration onboarding

SetupBot is available at **Connect → SetupBot** after signing in to a company workspace.
The interface defaults to Bengali and can switch to English. It asks one question at a time,
lets the user skip any question with a functionality warning, and saves every accepted step.
A browser session for a company owner, admin, super-admin or `client_user` is required;
read-only viewers and API keys cannot edit drafts. A draft belongs to both the signed-in user
and their company. An incomplete draft pauses after 30 minutes of inactivity and needs an
explicit resume. Submitted steps persist; **an unfinished input is not saved**. There is no
password or OTP field in SetupBot.

## Deploying safely

1. Configure HTTPS at a trusted reverse proxy, restrict direct access to the app port, and
   have the proxy set `X-Forwarded-Proto: https`. In production, SetupBot, its import
   endpoint, sign-in and registration reject requests not identified as HTTPS. The browser
   also disables secret input
   outside a secure context. The existing app stores its session bearer in browser local
   storage, so protect the origin against XSS, use the existing CSP and keep dependencies
   updated. SetupBot does not store passwords, integration secrets or OTPs in local storage.
2. Set `CREDENTIAL_ENCRYPTION_KEY` to 32 random bytes encoded as 64 hex characters.
   SetupBot refuses to save when the key is missing or invalid. Draft contents and complete
   handoff payloads are encrypted with AES-256-GCM, including identifiers, phone numbers,
   URLs and secrets. Individual `*_encrypted` handoff fields are also encrypted. Keep the
   key outside the database, back it up separately, and plan a re-encryption migration
   before rotating it. The existing database backup contains ciphertext, not the key.
3. Back up the SQLite database and apply the new additive Prisma schema using the project's
   non-destructive deployment procedure (`scripts/db-sync-schema.sh`). Generate the Prisma
   client with `bunx prisma generate`. Do not use `--accept-data-loss` for an existing database.
4. Set `META_GRAPH_API_VERSION` to a version supported by your Meta app. The default is
   `v19.0` as requested; Meta retires API versions and a retired version may fail. The server
   reports provider failures rather than inventing a successful connection. This sandbox
   cannot contact Meta, so live credentials must be tested in the deployed environment.

The existing sign-in endpoint now accepts `account_id` (email or an unambiguous E.164 phone
number) in addition to the legacy `email` field. `/api/v1/auth/login` is an alias for the
same sign-in handler. The first failed attempt plus three retries produces a 15-minute
account lock, recorded by a keyed hash of the account identity. Email and phone aliases for
one user share that lock. Admins in the affected user's companies receive an **in-app**
notification and an audit event; unknown accounts do not generate notifications. This is a
temporary lock, not a permanent disabling of the account. The existing per-IP/request rate
limiter is in-process, so configure an edge rate limit for multi-instance deployments.

## What is verified

- Facebook Page IDs must be 15–16 numeric digits. A Page token must return the same Page ID
  from a read-only Meta `/me` request. This tests token acceptance and identity, not all
  permissions or publishing functionality.
- WhatsApp **Phone Number ID** and **WABA ID** are numeric identifiers, not E.164 phone
  numbers. The optional actual phone number is validated separately as E.164. A WhatsApp
  token is checked against the supplied Phone Number ID and `quality_rating` field. Messenger
  tokens receive a read-only identity check.
- When an App ID and secret are supplied, Meta's `debug_token` endpoint is used to inspect
  token validity and expiry. A reported short-lived or near-expiry token is rejected with
  renewal guidance. If introspection is unavailable or lacks expiry information, the
  lifetime is explicitly **unknown**, not assumed to be long-lived. Meta's endpoint requires
  `input_token` in its query string; Meta-style webhook verification likewise sends
  `hub.verify_token` as a query parameter. MarketingOS does not log these URLs, but **all
  reverse proxies, egress proxies, provider-side logs and tracing must redact query strings**.
- The webhook URL must be public HTTPS, without userinfo, non-standard port, query or
  fragment. A server-side, DNS-pinned request rejects private/reserved addresses and
  redirects and requires HTTP 200 with the exact generated `hub.challenge` response.
- Instagram IDs, App secrets, CRM/payment keys and custom values are stored or format-checked
  only where there is no implemented live adapter. The review table distinguishes these
  from verified values. A failed or unavailable configured Meta/webhook check blocks
  confirmation until it is corrected or skipped. Skipped required connections yield a
  **partial** handoff and leave `ClientConfig.onboardingStatus` pending.

On confirmation, the app saves the structured payload encrypted in `SetupImport`. A
successfully checked Facebook Page is also made available in the existing Social Accounts
record; if the Facebook Pages catalog entry exists and its required fields are present, it
is marked **configured**, not a verified publishing adapter. WhatsApp, CRM and payment
credentials are retained for the project but their operational adapters are not implemented
by this wizard. A checked token is not a guarantee of ongoing access or all scopes. API
connections do not require the MarketingOS login password, but providers can revoke tokens
or invalidate sessions after security events or password changes.

## OTP / two-factor authentication

No generic provider OTP verification endpoint exists in this repository, and different
platforms use incompatible flows. SetupBot therefore never accepts, logs, saves, or submits
OTP values. If a platform requires 2FA, the client should use that provider's own trusted
screen, pause the wizard, and resume afterwards. A provider-specific OTP adapter (including
its expiry and retry policy) must be implemented and reviewed before in-app OTP handling can
be claimed; the wizard does not pretend to send or verify codes.

## Optional custom questions

`SETUP_CUSTOM_FIELDS` is a server-only JSON array with up to 12 entries, for example:

```json
[{"key":"shop_id","labelEn":"Shop ID","labelBn":"শপ আইডি","secret":false,"kind":"text"}]
```

Keys must start with a letter and contain only letters, numbers and underscores (maximum
40 characters). `labelEn` is required; `labelBn` defaults to it. `secret` is a boolean;
permitted non-secret kinds are `text`, `numeric_id`, `phone` and `url`. Custom secrets are
never returned to the browser. Definitions are frozen into each encrypted draft so changing
configuration does not reorder an in-progress session. To use updated definitions, delete
the draft and begin again. They are optional and are not live-verified.

## Handoff: local and optional remote

With no external settings, confirmation calls the shared import service **inside this same
MarketingOS application**, using the authenticated user's company as the project. There is
no need to send secrets through the browser or an extra HTTP hop for local import.

For a separate main project, configure server-side only:

```env
ADMIN_SERVICE_TOKEN="<independent-random-secret-at-least-32-characters>"
SETUP_HANDOFF_BASE_URL="https://main-project.example"
SETUP_HANDOFF_PROJECT_MAP='{"local-company-id":"receiving-company-id"}'
```

The base must be an HTTPS origin (no path, credentials or query); the mapping is
administrator-controlled and cannot be supplied by the browser. The confirmed payload is
POSTed to `/api/v1/projects/<receiving-company-id>/import-setup` with the bearer in the
`Authorization` header. The HTTP request is DNS-pinned, rejects private IPs and redirects,
has a size/time limit, and requires an explicit success acknowledgement before the wizard
reports completion. Local commit follows the remote acknowledgement. Requests include a
stable keyed idempotency key so a timeout can be retried safely against this project's
receiver. An interrupted export remains recoverable: retry after an error, or resume the
paused session after 30 minutes if the process crashed. External receivers should implement
compatible idempotency before relying on retries.

The included `POST /api/v1/projects/[projectId]/import-setup` is a server-to-server receiver;
`projectId` is a MarketingOS **company ID**. It requires a configured `ADMIN_SERVICE_TOKEN`
(32+ characters), an active project and an active `client_id` member of that project. It
strictly rejects unknown fields, including password or OTP fields. It stores the payload
with encryption and reports provider verification as **unverified** regardless of claims
from the sender. Do not reuse the service token for other purposes. For encrypted payload
fields, sender and receiver currently need the same `CREDENTIAL_ENCRYPTION_KEY`, delivered
through a secure secret manager; they must not share it through this API or chat. Separate
keys would require a key-wrapping/KMS integration not included here.

## Retention and erasure

A client can delete their own draft without deleting confirmed integrations. A company owner
or admin can explicitly erase local SetupBot imports, all company SetupBot drafts, and
unchanged SetupBot-managed Facebook records/connections. Records whose credentials were
subsequently replaced outside SetupBot are retained rather than deleting unrelated data.
Only minimal audit events (no secrets or OTPs) remain. The erasure action does **not** revoke
provider tokens, erase an external project, purge historical database backups, or remove
other independently configured integrations; administrators must handle those separately.
Paused drafts and imports otherwise remain until deleted. Define retention periods, access
controls, breach response, deletion from backups and legal bases with the deployment's data
controller; these controls alone do not establish GDPR or local-law compliance.
