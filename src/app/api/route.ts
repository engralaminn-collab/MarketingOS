import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Public service index for the REST API.
 *
 * Deliberately exposes no data: it names the service, its version and the
 * endpoints a client can use to discover the rest of the surface. Everything
 * under /api is authenticated unless documented otherwise.
 */
export function GET() {
  return NextResponse.json(
    {
      service: "MarketingOS API",
      version: process.env.GIT_COMMIT?.slice(0, 7) || "dev",
      status: "ok",
      health: "/api/health",
      auth: {
        login: "/api/auth/login",
        register: "/api/auth/register",
        scheme: "Bearer <token from POST /api/auth/login>",
      },
      documentation: "/api/health",
      note: "All other endpoints require a Bearer token and enforce company-level tenant isolation.",
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
