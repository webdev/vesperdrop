import { NextResponse, type NextRequest } from "next/server";
import { refreshSession } from "@/lib/supabase/middleware";

// Paths that don't require auth — marketing, anonymous /try, auth flow,
// and API routes (which handle their own auth). The middleware now lets
// ANY signed-in user through; the previous email allowlist (admin-only
// dev gate) has been removed.
const PUBLIC_PATHS = [
  "/",
  "/discover",
  "/pricing",
  "/sign-in",
  "/sign-up",
  "/unauthorized",
  "/mfa-verify",
  "/try",
  "/api",
];

function isPublicPath(path: string): boolean {
  for (const p of PUBLIC_PATHS) {
    if (p === "/") {
      if (path === "/") return true;
      continue;
    }
    if (path === p || path.startsWith(`${p}/`)) return true;
  }
  return false;
}

export async function middleware(request: NextRequest) {
  const { response, user, needsMfa } = await refreshSession(request);
  const path = request.nextUrl.pathname;

  // Local development: pass through unchanged.
  if (process.env.NODE_ENV === "development") {
    return response;
  }

  // Public paths bypass auth entirely.
  if (isPublicPath(path)) {
    return response;
  }

  // Anonymous user hitting a protected path → sign-in.
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  // Signed in with MFA enrolled but not yet verified → MFA verify page.
  if (needsMfa) {
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
