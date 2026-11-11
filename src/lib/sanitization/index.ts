/**
 * Response Sanitization Layer.
 *
 * Strips internal infrastructure metadata from every public API response.
 * Per directive TASK 3: prevent leakage of agent identities, counts,
 * system prompts, model configs, provider credentials, tool definitions,
 * worker IDs, private URLs, DB details, stack traces.
 *
 * Usage: wrap any public-facing response with sanitizeResponse() before
 * returning to the client. The function recursively walks the object
 * and removes any key matching the blocklist.
 */
const BLOCKED_KEYS = new Set([
  'agentId', 'agentName', 'agentCount', 'agent_id', 'agent_name',
  'systemPrompt', 'system_prompt', 'prompt', 'internalPrompt',
  'modelConfig', 'model_config', 'modelId', 'model_id',
  'providerConfig', 'provider_config', 'apiKey', 'api_key', 'secret',
  'accessToken', 'access_token', 'refreshToken', 'refresh_token',
  'toolDefinitions', 'tool_definitions', 'internalTools',
  'workerId', 'worker_id', 'workerType',
  'databaseUrl', 'database_url', 'connectionString',
  'stackTrace', 'stack_trace', 'stack',
  'internalRouting', 'internal_routing',
  'orchestrationMetadata', 'orchestration_metadata',
  'ciphertext', 'secretCipher', 'keyVersion',
  'passwordHash', 'password_hash',
  'employeeId', 'employee_id', // internal workforce ID
  'departmentId', 'department_id', // internal org structure
  'reportsToId', 'reports_to_id',
  'collaborationRules', 'escalationRules',
  'constitution', 'authority', // internal agent config
  'preferredModel', 'modelTier', // internal model routing
]);

const SENSITIVE_PATTERNS = [
  /sk-[a-zA-Z0-9]{20,}/g, // OpenAI-style keys
  /ghp_[a-zA-Z0-9]{36}/g, // GitHub tokens
  /AKIA[A-Z0-9]{16}/g, // AWS keys
  /password\s*[:=]\s*\S+/gi,
  /token\s*[:=]\s*\S+/gi,
];

export function sanitizeResponse<T>(data: T): T {
  if (data === null || data === undefined) return data;
  if (typeof data === 'string') return sanitizeString(data) as unknown as T;
  if (typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(sanitizeResponse) as unknown as T;

  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(data as Record<string, any>)) {
    if (BLOCKED_KEYS.has(key)) continue;
    cleaned[key] = sanitizeResponse(value);
  }
  return cleaned as T;
}

function sanitizeString(s: string): string {
  let cleaned = s;
  for (const pattern of SENSITIVE_PATTERNS) {
    cleaned = cleaned.replace(pattern, '[REDACTED]');
  }
  return cleaned;
}

/**
 * Middleware helper: wraps a NextResponse.json() call with sanitization.
 */
export function sanitizedJson(data: any, status: number = 200): Response {
  return Response.json(sanitizeResponse(data), { status });
}
