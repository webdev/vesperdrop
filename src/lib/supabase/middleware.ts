import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { clientEnv } from "@/lib/env.client";

export async function refreshSession(request: NextRequest) {
  const response = NextResponse.next({ request });
  const supabase = createServerClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (entries) => {
          for (const { name, value, options } of entries) {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If the user is authenticated, check whether MFA is required but not yet
  // satisfied for this session (aal1 when aal2 is needed).
  let needsMfa = false;
  if (user) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    needsMfa = aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2";
  }

  return { response, user, needsMfa };
}
