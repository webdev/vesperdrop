import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { clientEnv } from "@/lib/env.client";

export async function createSupabaseServerClient() {
  const store = await cookies();
  return createServerClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (entries) => {
          for (const { name, value, options } of entries) {
            store.set(name, value, options);
          }
        },
      },
    },
  );
}
