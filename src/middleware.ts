import { NextResponse, type NextRequest } from "next/server";
import { refreshSession } from "@/lib/supabase/middleware";

/**
 * Middleware no longer gates access by authentication. It only:
 *   1. Refreshes the Supabase session cookie on every request.
 *   2. Redirects users with MFA enrolled (but not yet verified this
 *      session) to /mfa-verify when they hit a non-auth path.
 *
 * Pages that genuinely require sign-in (e.g. /app/library, /account)
 * still call `supabase.auth.getUser()` server-side and redirect
 * anonymous visitors to /sign-in?next=... themselves. This keeps the
 * marketing surfaces (and any future public routes) reachable without
 * a global gate.
 */
const MFA_BYPASS_PREFIXES = ["/sign-in", "/sign-up", "/mfa-verify", "/api/"];

export async function middleware(request: NextRequest) {
  const { response, user, needsMfa } = await refreshSession(request);
  const path = request.nextUrl.pathname;

  // MFA gate — only fires for signed-in users with MFA enrolled who
  // haven't verified this session, and never on the auth flow itself.
  if (
    user &&
    needsMfa &&
    !MFA_BYPASS_PREFIXES.some((p) => path === p || path.startsWith(p))
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/mfa-verify";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.well-known/workflow/|.*\\.(?:png|jpg|jpeg|svg|gif|webp)).*)"],
};
