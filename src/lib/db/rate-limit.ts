import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function tryTakeToken(
  userId: string,
  bucket: string,
  capacity: number,
  refillPerMinute: number,
): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc("try_take_token", {
    p_user_id: userId,
    p_bucket: bucket,
    p_capacity: capacity,
    p_refill_per_minute: refillPerMinute,
  });
  if (error) throw error;
  return Boolean(data);
}
