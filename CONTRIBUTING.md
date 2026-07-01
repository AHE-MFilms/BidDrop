# BidDrop — Contributing & Deployment Guide

## Branch Strategy

| Branch | Purpose | Deploys to |
|---|---|---|
| `main` | Production-ready code | biddrop.us (Vercel production) |
| `staging` | Pre-production testing | staging.biddrop.us (Vercel preview) |
| `feature/*` | Feature development | Vercel preview URL (auto) |

**Never push directly to `main`.** All changes go through `staging` first.

### Workflow

```
feature/my-change  →  staging  →  main
       ↓                ↓           ↓
  PR + CI pass    Test on staging  Deploy to prod
```

1. Create a feature branch from `main`:
   ```bash
   git checkout main && git pull
   git checkout -b feature/my-feature
   ```

2. Make changes, commit, push:
   ```bash
   git add -A && git commit -m "feat: describe the change"
   git push -u origin feature/my-feature
   ```

3. Open a PR targeting `staging`. GitHub Actions CI will run automatically:
   - Unit tests (`npm test`)
   - Full build + 9-check validator (`npm run build`)
   - Onclick linkage check (`node scripts/check-linkage.js`)

4. Once CI passes and you've tested on the Vercel preview URL, merge to `staging`.

5. Test on `staging.biddrop.us`. When ready, open a PR from `staging` → `main`.

---

## Setting Up Vercel Staging

In the Vercel dashboard for the BidDrop project:

1. Go to **Settings → Git**
2. Under **Production Branch**, confirm it is set to `main`
3. Under **Preview Branches**, the `staging` branch will automatically get a stable
   preview URL (e.g., `biddrop-staging.vercel.app` or a custom alias)
4. To set a custom alias: **Settings → Domains** → add `staging.biddrop.us` and
   assign it to the `staging` branch deployment

---

## Running Locally

```bash
npm install
npm run build      # builds dist/ and runs all 9 validator checks
npm test           # runs unit tests (36 tests)
node scripts/check-linkage.js  # verify all onclick functions are defined
```

---

## Validator Checks (run on every build)

1. `dist/index.html` exists
2. No unresolved `@@PARTIAL` markers
3. Balanced `<div>` tags
4. All 15 required tab IDs present
5. All 3 required modal IDs present
6. No unclosed template literals in 47 JS files
7. All 10 critical functions defined
8. All 221 event-handler functions defined in src/ ← **new in Priority 1**
9. File size within 400 KB–2,000 KB

If any check fails, the build exits with code 1 and Vercel will not deploy.
