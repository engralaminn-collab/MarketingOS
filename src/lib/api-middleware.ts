import { NextResponse } from "next/server";
import { getSessionUser, hasPermission, type SessionUser as AuthUser } from "@/lib/auth";

export type { AuthUser };

type AuthContext = {
  user: AuthUser;
  params?: Promise<Record<string, string>>;
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
): (request: Request, context: { params?: Promise<Record<string, string>> }) => Promise<Response> {
  return async (
    request: Request,
    rawContext: { params?: Promise<Record<string, string>> }
  ): Promise<Response> => {
    const user = await getSessionUser(request);

    if (!user || !user.userId) {
      if (options?.allowPublic) {
        return handler(request, {
          user: { userId: "", email: "", isSuperAdmin: false, companyId: "", role: "" },
          params: rawContext.params,
        });
      }
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Enforce minimum role if specified
    if (options?.minRole && !hasPermission(user.role, options.minRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return handler(request, { user, params: rawContext.params });
  };
}
