import "server-only";
import { tryTakeToken as rpcTryTakeToken } from "./rpc";

export async function tryTakeToken(
  userId: string,
  bucket: string,
  capacity: number,
  refillPerMinute: number,
): Promise<boolean> {
  return rpcTryTakeToken(userId, bucket, capacity, refillPerMinute);
}
