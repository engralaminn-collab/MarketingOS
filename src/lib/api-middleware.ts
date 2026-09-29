import { NextResponse } from "next/server";
import { getSessionUser, hasPermission, type SessionUser as AuthUser } from "@/lib/auth";

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
}

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
          user: { userId: "", email: "", isSuperAdmin: false, companyId: "", role: "" },
          params,
        });
      }
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Enforce minimum role if specified
    if (options?.minRole && !hasPermission(user.role, options.minRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return handler(request, { user, params });
  };
}
