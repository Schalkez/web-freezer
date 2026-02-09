---
description: Deploy Web Freezer to Cloudflare. Builds and deploys both the SvelteKit frontend (Workers) and the Crawl Worker.
---

# /deploy - Web Freezer Production Deployment

// turbo-all

## Architecture

| Service | Platform | URL |
|---------|----------|-----|
| **Frontend + API** | Cloudflare Workers | `https://web-freezer.mynameishieenf.workers.dev` |
| **Crawl Worker** | Cloudflare Workers | `https://web-freezer-crawl-worker.mynameishieenf.workers.dev` |

### Bindings (configured in `wrangler.jsonc`)

| Binding | Type | Resource |
|---------|------|----------|
| `KV` | KV Namespace | `4ff9491c90734dac93663322cc6fc6f3` |
| `R2` | R2 Bucket | `web-freezer-archives` |
| `CRAWL_QUEUE` | Queue | `web-freezer-crawl-jobs` |
| `ASSETS` | Static Assets | `.svelte-kit/cloudflare` |
| `TURNSTILE_SITE_KEY` | Env Variable | `0x4AAAAAACZh6penZBTNI3h1` |

---

## Steps

### 1. Build the SvelteKit app

```bash
pnpm run build
```

### 2. Deploy the frontend + API to Cloudflare Workers

> **IMPORTANT**: Use `npx wrangler deploy` (Workers), NOT `npx wrangler pages deploy` (Pages).
> The config file `wrangler.jsonc` contains all bindings (KV, R2, Queue).

```bash
npx wrangler deploy
```

### 3. Deploy the Crawl Worker

```bash
cd crawl-worker && npx wrangler deploy
```

### 4. Verify deployment

Open `https://web-freezer.mynameishieenf.workers.dev` in browser and check:
- [ ] Page loads with WEB_FREEZER header
- [ ] Turnstile captcha renders
- [ ] Boot sequence logs appear in terminal

---

## Secrets

If deploying for the first time, set the Turnstile secret:

```bash
npx wrangler secret put TURNSTILE_SECRET_KEY
```

---

## Rollback

```bash
npx wrangler rollback
```

---

## Common Mistakes

| ❌ Wrong | ✅ Correct | Why |
|----------|-----------|-----|
| `npx wrangler pages deploy` | `npx wrangler deploy` | Project uses Workers, not Pages |
| `wrangler deploy` (global) | `npx wrangler deploy` | wrangler not installed globally |
| Deploy without `pnpm run build` | Build first, then deploy | Workers reads `.svelte-kit/cloudflare` output |
