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
  return { response, user };
}
