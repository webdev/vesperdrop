import { NextResponse, type NextRequest } from "next/server";
import { refreshSession } from "@/lib/supabase/middleware";
import { ADMIN_EMAILS } from "@/lib/admin";

// During private development, only the admin allowlist may access the site.
const ALLOWED_EMAILS = ADMIN_EMAILS;

// Paths that bypass the gate entirely (auth UI + API routes handle their own auth).
const PUBLIC_PREFIXES = [
  "/sign-in",
  "/sign-up",
  "/unauthorized",
  "/mfa-verify",
  "/api/",
  "/app/discover",
  ...(process.env.E2E_SCENEIFY_MOCK === "1" ? ["/try"] : []),
];

export async function middleware(request: NextRequest) {
  const { response, user, needsMfa } = await refreshSession(request);
  const path = request.nextUrl.pathname;

  // Local development: skip the allowlist gate entirely.
  if (process.env.NODE_ENV === "development") {
    return response;
  }

  // Always pass through public paths and API routes unchanged.
  if (PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(p))) {
    return response;
  }

  // Not signed in → sign-in page.
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  // Signed in but email not on the allowlist → access denied.
  if (!ALLOWED_EMAILS.includes((user.email ?? "").toLowerCase())) {
    const url = request.nextUrl.clone();
    url.pathname = "/unauthorized";
    return NextResponse.redirect(url);
  }

  // Signed in but MFA enrolled and not yet verified this session → MFA verify page.
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
