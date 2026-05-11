import "server-only";
import { eq, and, gte, sum } from "drizzle-orm";
import { db } from "@/lib/db";
import { overageLedger } from "@/lib/db/schema";

export interface RecordOverageInput {
  userId: string;
  runId: string;
  generationId: string;
  cents: number;
  stripeInvoiceItemId: string | null;
  cycleAnchor: Date;
}

export async function recordOverage(input: RecordOverageInput): Promise<void> {
  await db
    .insert(overageLedger)
    .values({
      userId: input.userId,
      runId: input.runId,
      generationId: input.generationId,
      cents: input.cents,
      // schema column is `stripe_usage_record_id` — repurposed for the
      // invoice item id since runtime no longer creates usage records.
      stripeUsageRecordId: input.stripeInvoiceItemId,
      cycleAnchor: input.cycleAnchor,
    })
    .onConflictDoNothing();
}

export async function getAccruedOverageCents(
  userId: string,
  cycleAnchor: Date,
): Promise<number> {
  const [row] = await db
    .select({ total: sum(overageLedger.cents) })
    .from(overageLedger)
    .where(
      and(
        eq(overageLedger.userId, userId),
        gte(overageLedger.cycleAnchor, cycleAnchor),
      ),
    );
  return Number(row?.total ?? 0);
}
