import { NextResponse } from "next/server";
import { getSessionUser, hasPermission, type SessionUser as AuthUser } from "@/lib/auth";
import { rateLimiter } from "@/lib/security";

export type { AuthUser };

type RouteParams = Record<string, string>;

type AuthContext = {
  user: AuthUser;
  /**
   * Dynamic route segments. Always a promise — routes without segments get an
   * empty object rather than `undefined`, so handlers can `await params`
   * unconditionally without a null check.
   */
  params: Promise<RouteParams>;
};

type AuthHandler = (
  request: Request,
  context: AuthContext
) => Promise<Response>;

interface WithAuthOptions {
  minRole?: string;
  allowPublic?: boolean;
  /**
   * Requests allowed per authenticated user per minute. Set to 0 to disable
   * (only for endpoints that already carry their own limiter, e.g. login).
   */
  maxRequestsPerMinute?: number;
}

/**
 * Default per-user budget for every authenticated route. Chosen well above the
 * busiest dashboard view so normal use never sees a 429, while still stopping
 * a runaway script from pinning the single SQLite writer.
 */
const DEFAULT_REQUESTS_PER_MINUTE = 600;

export function withAuth(
  handler: AuthHandler,
  options?: WithAuthOptions
): (request: Request, context?: { params?: Promise<RouteParams> }) => Promise<Response> {
  return async (
    request: Request,
    rawContext?: { params?: Promise<RouteParams> }
  ): Promise<Response> => {
    const params: Promise<RouteParams> =
      rawContext?.params ?? Promise.resolve({} as RouteParams);

    const user = await getSessionUser(request);

    if (!user || !user.userId) {
      if (options?.allowPublic) {
        return handler(request, {
          user: { userId: "", email: "", isSuperAdmin: false, companyId: "", institutionId: "", sessionId: null, role: "" },
          params,
        });
      }
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Enforce minimum role if specified
    if (options?.minRole && !hasPermission(user.role, options.minRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Per-user request budget (in-process; see docs/DEPLOYMENT-REVERSE-PROXY.md
    // for the edge-level limiter used in front of multi-instance deployments).
    const budget = options?.maxRequestsPerMinute ?? DEFAULT_REQUESTS_PER_MINUTE;
    if (budget > 0) {
      const limit = rateLimiter(`user:${user.userId}`, {
        maxRequests: budget,
        windowMs: 60_000,
      });
      if (!limit.allowed) {
        return NextResponse.json(
          { error: "Too many requests. Please retry shortly." },
          {
            status: 429,
            headers: {
              "Retry-After": String(Math.max(1, Math.ceil(limit.retryAfterMs / 1000))),
            },
          }
        );
      }
    }

    return handler(request, { user, params });
  };
}
