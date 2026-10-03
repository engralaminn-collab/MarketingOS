import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Deployment and liveness probe.
 *
 * A bare 200 proves only that Node is listening. That is not enough to call a
 * deployment successful, so this also reports:
 *
 *   commit   — which build is actually running, so the deploy workflow can
 *              confirm the server is serving the commit it just shipped
 *              rather than a stale container that never restarted
 *   database — a real round-trip query, not just "the client was constructed"
 *   config   — whether required environment variables are present
 *
 * Status codes:
 *   200 ok       everything healthy
 *   503 degraded the process is up but a dependency is not usable
 *
 * Deliberately leaks nothing: no connection strings, no secret values, no
 * stack traces — only booleans, names and a millisecond timing.
 */

const REQUIRED_ENV = ["DATABASE_URL", "JWT_SECRET"] as const;

type Check = {
  ok: boolean;
  detail?: string;
};

async function checkDatabase(): Promise<Check & { latencyMs?: number }> {
  const started = Date.now();
  try {
    // A trivial round-trip proves the file is reachable, readable and that the
    // query engine loaded — all of which a constructed client does not.
    await db.$queryRaw`SELECT 1`;
    return { ok: true, latencyMs: Date.now() - started };
  } catch (error) {
    // Report the error CLASS only. Prisma error text can contain the database
    // path and connection details.
    const name = error instanceof Error ? error.name : "UnknownError";
    return { ok: false, detail: name, latencyMs: Date.now() - started };
  }
}

function checkConfig(): Check & { missing: string[] } {
  const missing = REQUIRED_ENV.filter((key) => {
    const value = process.env[key];
    return !value || value.trim() === "";
  });
  return { ok: missing.length === 0, missing };
}

export async function GET() {
  const [database, config] = [await checkDatabase(), checkConfig()];

  const healthy = database.ok && config.ok;

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      timestamp: new Date().toISOString(),

      // Injected at image build time (see Dockerfile ARG GIT_COMMIT).
      // "unknown" means the image was built without it, not that it is stale.
      commit: process.env.GIT_COMMIT || "unknown",

      uptimeSeconds: Math.round(process.uptime()),
      node: process.version,

      checks: {
        database: {
          ok: database.ok,
          latencyMs: database.latencyMs,
          ...(database.detail ? { error: database.detail } : {}),
        },
        config: {
          ok: config.ok,
          // Names only — never values.
          ...(config.missing.length > 0 ? { missing: config.missing } : {}),
        },
      },
    },
    {
      status: healthy ? 200 : 503,
      headers: { "Cache-Control": "no-store, max-age=0" },
    }
  );
}
