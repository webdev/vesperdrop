"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin";

export async function deleteUserAction(userId: string) {
  if (!userId || typeof userId !== "string") {
    return { ok: false as const, error: "Missing user id" };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user: caller },
  } = await supabase.auth.getUser();
  if (!isAdminEmail(caller?.email)) {
    return { ok: false as const, error: "Forbidden" };
  }

  const { data: target } = await supabaseAdmin
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .maybeSingle();
  if (target && isAdminEmail(target.email)) {
    return { ok: false as const, error: "Refusing to delete an admin account" };
  }
  if (caller && caller.id === userId) {
    return { ok: false as const, error: "Refusing to delete your own account" };
  }

  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) {
    return { ok: false as const, error: error.message };
  }

  revalidatePath("/admin/users");
  return { ok: true as const };
}
