-- Lets the $9.99 Stripe unlock flow promote the watermarked
-- `output_url` to the un-watermarked HD by simply swapping the
-- column. After the webhook fires, /app/library and any other
-- consumer that reads `output_url` automatically shows the HD —
-- no JOIN against unlock_batches required.
--
-- finalize-batch populates `raw_url` at insert. The webhook
-- handler runs `UPDATE generations SET output_url = raw_url,
-- watermarked = false WHERE run_id = $batch.run_id` to flip the
-- entitlement.
ALTER TABLE generations
  ADD COLUMN IF NOT EXISTS raw_url text;
