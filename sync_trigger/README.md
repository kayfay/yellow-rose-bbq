# yellow-rose-sync-trigger

Cloudflare Worker with a cron trigger (`5 * * * *`, UTC) that starts the
**Update Clover Data** GitHub Actions workflow every hour through
`workflow_dispatch`. GitHub's own `schedule:` trigger is best-effort and was
only firing every 3–7 hours, which left gaps in the prediction vs. actual
tracking. The workflow's `schedule:` stays as a fallback.

## Deploy

1. Create a fine-grained GitHub token: repository `kayfay/yellow-rose-bbq` only,
   permission **Actions: Read and write**, nothing else.
2. From this directory:
   ```bash
   npx wrangler deploy
   npx wrangler secret put GITHUB_TOKEN   # paste the token
   ```
   Or ask the Cloudflare MCP to deploy `src/index.js` as worker
   `yellow-rose-sync-trigger` with cron `5 * * * *`, the `[vars]` from
   `wrangler.toml`, and secret `GITHUB_TOKEN`.

## Verify

- Cloudflare dashboard → Workers → yellow-rose-sync-trigger → Settings → Triggers
  shows the cron, and the Logs tab shows the scheduled events.
- GitHub → Actions → Update Clover Data shows a `workflow_dispatch` run a minute
  or two after each :05.
- A failed dispatch throws, so it appears as an error in the Worker's logs
  (usually an expired token or missing Actions permission).
