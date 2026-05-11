import "server-only";
import { stripe } from "@/lib/stripe/server";

export interface ReportOverageInput {
  customerId: string;
  generationId: string;
  cents: number;
  description: string;
}

export async function reportOverage(
  input: ReportOverageInput,
): Promise<string | null> {
  try {
    const r = await stripe.invoiceItems.create(
      {
        customer: input.customerId,
        amount: input.cents,
        currency: "usd",
        description: input.description,
      },
      { idempotencyKey: `overage:${input.generationId}` },
    );
    return r.id ?? null;
  } catch (err) {
    console.error("[overage] stripe invoice item failed", {
      generationId: input.generationId,
      err,
    });
    return null;
  }
}
