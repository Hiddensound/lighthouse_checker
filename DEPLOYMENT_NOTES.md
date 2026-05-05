# Deployment notes

This app has two distinct runtime requirements that constrain where it can be hosted:

1. **Chrome must run on the same machine as the API.** Lighthouse drives a real headless Chrome instance through the DevTools Protocol. Serverless platforms (Vercel, AWS Lambda, Cloudflare Workers, etc.) cannot host this — Chrome is too heavy and exceeds function timeouts on real-world pages.
2. **State is persisted to a local SQLite file.** Sessions, audit results, and history live in `data/lighthouse.db`. The host needs a writable, persistent filesystem.

That gives us two deployment lanes: the **demo Vercel UI** (read-only frontend, audits disabled) and **a real container host** (Fly.io / Railway / Render / VPS / Cloud Run, all with Chrome installed in the container).

---

## Lane 1 — Vercel demo (UI only, audits disabled)

The deployment at <https://lighthousechecker.vercel.app> is intentionally a UI showcase. The `/api/audit` handler detects `process.env.VERCEL` and returns 501 with a message asking the user to run locally — see `src/pages/api/audit/index.ts`. SQLite also won't persist meaningfully on Vercel (read-only filesystem outside `/tmp`), so the history page stays empty.

### Configuring auth env vars on Vercel

Even though audits don't work, the login gate still does, and the auth helper throws on first request if either env var is missing or `SESSION_PASSWORD` is shorter than 32 characters. Set both via the Vercel dashboard or CLI before sharing the URL:

**Required:**

| Variable | Notes |
|---|---|
| `OPERATOR_PASSWORD` | Whatever the team types at `/login`. Pick a passphrase or `openssl rand -base64 24`. |
| `SESSION_PASSWORD` | At least 32 chars. Used to seal the iron-session cookie. Generate with `openssl rand -hex 32`. |

**CLI:**

```bash
vercel env add OPERATOR_PASSWORD production
vercel env add SESSION_PASSWORD production    # paste output of: openssl rand -hex 32
vercel --prod                                 # redeploy to pick them up
```

**Web UI:** Project → Settings → Environment Variables → add both as Production-scoped.

**Optional:**

- `RATE_LIMIT_AUDITS_PER_HOUR` — defaults to 30 if unset.
- Do **not** set `OPENAI_API_KEY` on shared deployments — every operator pastes their own key in the UI per audit so they fund their own usage. The env var is a personal-default fallback that's fine for solo use only.

### Rotating credentials

- **Revoke a team member / leaked operator password:** change `OPERATOR_PASSWORD` and redeploy. Everyone re-logs in.
- **Suspect cookie compromise:** change `SESSION_PASSWORD` and redeploy. Every active session is invalidated.

---

## Lane 2 — Real deployment (recommended for actual use)

The repo ships with a `Dockerfile` and `.dockerignore` that build a Node 20 + Chromium image suitable for any container host. Pick whichever target fits your team.

### Compatibility matrix

| Platform | Persistent volume? | Custom Dockerfile? | Sleeps on idle? | Best for |
|---|---|---|---|---|
| **Fly.io** | Yes (first-class) | Yes | No | Recommended — best fit for SQLite + small team |
| **Railway** | Yes (Volumes) | Yes | No | Easiest deploy if you prefer web UI over CLI |
| **Render** | Yes (Persistent Disk) | Yes | Free tier yes; paid no | OK; avoid the free tier |
| **VPS** (Hetzner / DO / EC2) | Yes (just a disk) | Yes | No | Most control, most ops work |
| **Cloud Run** | Awkward — needs Cloud SQL or GCS-Fuse | Yes | Yes (cold starts) | Only if you're already in GCP |

### Recommended path: Fly.io

Cleanest fit because it has first-class persistent volumes (perfect for SQLite) and zero idle sleeping. The plan below assumes you've installed `flyctl` and run `fly auth login`.

```bash
# 1. From the repo root, generate fly.toml. flyctl detects the Dockerfile.
fly launch --name lighthouse-checker --no-deploy
#   - Pick a region close to your team (e.g. "iad", "lhr", "sin")
#   - Decline the Postgres / Redis offers; we use SQLite

# 2. Create a 1 GB volume for SQLite + reports. Match the region you picked.
fly volume create lighthouse_data --size 1 --region iad

# 3. Mount it in fly.toml. Add the [mounts] block:
#
#   [mounts]
#   source = "lighthouse_data"
#   destination = "/data"
#
# Also set [[services]] internal_port = 3000 (next.js default).

# 4. Set secrets — these end up as env vars in the container.
fly secrets set \
  OPERATOR_PASSWORD="your-team-password-here" \
  SESSION_PASSWORD="$(openssl rand -hex 32)"

# 5. Deploy.
fly deploy

# 6. Open it.
fly open
```

Reports under `public/reports/` will be ephemeral (rebuilt on each deploy) unless you also mount a volume there. If you want them persistent, add a second volume or mount `/data/reports` and symlink. For most usage that's overkill — the HTML reports are a convenience and the data lives in SQLite.

### Same plan, Railway-flavored

1. Create a project, "Deploy from GitHub repo", point at the repo. Railway detects the Dockerfile.
2. **Settings → Volumes → Add Volume**, mount path `/data`, size 1 GB.
3. **Variables**: add `OPERATOR_PASSWORD` and `SESSION_PASSWORD` (≥ 32 chars). Optionally `RATE_LIMIT_AUDITS_PER_HOUR`.
4. **Settings → Networking → Generate Domain** to expose port 3000.
5. Push to your default branch — Railway auto-redeploys.

### Same plan, Render

1. **New → Web Service → Connect repo**. Pick "Docker" runtime.
2. **Disks → Add disk**, mount path `/data`, size 1 GB. *(Disks are paid-tier; the free tier doesn't support them.)*
3. **Environment**: add the two required vars.
4. Deploy. Render handles HTTPS.

### VPS recipe (Hetzner / DO / Lightsail / EC2)

Anywhere with Docker installed:

```bash
# On the host
git clone <your repo> && cd lighthouse_checker
docker build -t lighthouse-checker .

# Persist DB + reports outside the container
mkdir -p /var/lib/lighthouse/data /var/lib/lighthouse/reports

docker run -d \
  --name lighthouse \
  --restart unless-stopped \
  -p 3000:3000 \
  -v /var/lib/lighthouse/data:/data \
  -v /var/lib/lighthouse/reports:/app/public/reports \
  -e OPERATOR_PASSWORD="your-team-password-here" \
  -e SESSION_PASSWORD="$(openssl rand -hex 32)" \
  lighthouse-checker
```

Put Caddy or Nginx in front for HTTPS + a real hostname.

---

## Operational notes that apply regardless of host

- **Backups.** A single SQLite file under `/data/lighthouse.db`. Snapshot it daily. For point-in-time recovery, [Litestream](https://litestream.io) replicates SQLite to S3/R2 and is a one-liner to add.
- **Memory.** Lighthouse + Chrome on a heavy ecommerce page peaks around ~700 MB resident. Provision the host with 1–2 GB RAM minimum.
- **Concurrency.** The app currently serializes audits per session. Don't over-provision CPU expecting parallelism without code changes.
- **Resetting state.** To wipe history, stop the container and delete `data/lighthouse.db*`. Migrations re-run on next start.
