# Pricing v2 — Stripe object changelog

Account: `acct_1TR1smRtaaCGg2Ga` (Vesperdrop, live mode).

## 2026-05-11

### Created — 4 products, 8 flat prices

| Product | Product ID | Monthly | Annual |
|---|---|---|---|
| VesperDrop Starter | `prod_UUyEEQfggs2t5X` | `price_1TVyHmRtaaCGg2GaUhClwzlJ` ($19) | `price_1TVyHpRtaaCGg2Ga8Zc7IL2A` ($182.40) |
| VesperDrop Pro | `prod_UUzvkpEdXAqG53` | `price_1TVzw1RtaaCGg2Ga2TCq6ww6` ($39) | `price_1TVzw4RtaaCGg2Ga2p2FP9bC` ($374.40) |
| VesperDrop Studio | `prod_UUzv7ieL8VUNlk` | `price_1TVzw7RtaaCGg2GaXaIm2FBV` ($99) | `price_1TVzwARtaaCGg2GaGjep4Few` ($950.40) |
| VesperDrop Agency | `prod_UUzv9Ji9HfbLYH` | `price_1TVzwERtaaCGg2GamcTiGp8p` ($499) | `price_1TVzwHRtaaCGg2GaA1xsbbka` ($4,790.40) |

### Archived — 4 legacy products

- `prod_USLrTK2YuWBNxc` (Starter, 50 credits)
- `prod_USLrxJqb7X3z1c` (Pro, 200 credits)
- `prod_USLrT92zhPHcYV` (Studio, 1,000 credits)
- `prod_USLrdN8j5raxo6` (Agency, 5,000 credits)

The unlock funnel product `prod_UUzYSd7bJXeqej` was intentionally left active.

### No metered overage prices

Overage was originally planned as Stripe metered subscription items. Modern Stripe metered prices require a Meter object that the claude.ai Stripe MCP cannot create. We pivoted to runtime invoice items (`stripe.invoiceItems.create` per overage photo). Customer experience is unchanged; engineering surface is smaller.

### Pending — Vercel env vars

`STRIPE_*_PRICE_ID_MONTHLY` / `_ANNUAL` (8 vars) are set in local `.env.local`. They are NOT yet set on Vercel preview / development / production. Phase 3 task P3.6 adds them via `vercel env add`.
