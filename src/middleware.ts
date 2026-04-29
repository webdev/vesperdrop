import { NextResponse, type NextRequest } from "next/server";
import { refreshSession } from "@/lib/supabase/middleware";

// During private development, only these emails may access the site.
const ALLOWED_EMAILS = ["gblazer@gmail.com", "info@slavablazer.com"];

// Paths that bypass the gate entirely (auth UI + API routes handle their own auth).
const PUBLIC_PREFIXES = [
  "/sign-in",
  "/sign-up",
  "/unauthorized",
  "/mfa-verify",
  "/api/",
  ...(process.env.E2E_SCENEIFY_MOCK === "1" ? ["/try"] : []),
];

export async function middleware(request: NextRequest) {
  const { response, user, needsMfa } = await refreshSession(request);
  const path = request.nextUrl.pathname;

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
