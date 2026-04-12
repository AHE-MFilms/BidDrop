# BidDrop Drip Scheduler — Supabase Edge Function

This Edge Function runs on a cron schedule to automatically fire drip postcard
steps that are past their `scheduled_send_at` date, without requiring anyone
to have the BidDrop app open.

## What It Does

1. Fetches all accounts with `dripEnabled: true` in their config
2. For each account, finds queue items where `status = 'scheduled' or 'pending'`, `drip_step IS NOT NULL`, and `scheduled_send_at <= now()`
3. Sends the postcard via Lob API (4×6, front = uploaded design, back = auto-generated USPS address side)
4. Updates the queue item to `status = 'sent'` and logs to `mailer_log`

## Deployment

```bash
# Login to Supabase CLI
supabase login

# Link to the project
supabase link --project-ref gtwbhxnrmfmdenogzuea

# Set the Lob master key as a secret
supabase secrets set LOB_MASTER_KEY=your_lob_key_here

# Deploy the function
supabase functions deploy drip-scheduler --no-verify-jwt
```

## Scheduling (Cron)

After deploying, set up the cron schedule in the Supabase Dashboard:

1. Go to **Edge Functions** → **drip-scheduler** → **Schedules**
2. Add a new schedule with cron expression: `0 * * * *` (every hour)
3. Or use `0 8 * * *` for once daily at 8am UTC

## Environment Variables

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Auto-set by Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-set by Supabase |
| `LOB_MASTER_KEY` | Your agency master Lob API key (set via `supabase secrets set`) |

## Testing

```bash
# Invoke manually to test
supabase functions invoke drip-scheduler --no-verify-jwt
```
