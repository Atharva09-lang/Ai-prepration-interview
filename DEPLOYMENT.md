# Deployment Guide (Free Tiers)

Deploy the AI Interview Prep Kit entirely on free tiers: **MongoDB Atlas** for the database, **Render** for the API, and **Vercel** for the web app.

## Table of contents

1. [Overview](#overview)
2. [Step 1: MongoDB Atlas (database)](#step-1-mongodb-atlas-database)
3. [Step 2: Render (backend API)](#step-2-render-backend-api)
4. [Step 3: Vercel (frontend)](#step-3-vercel-frontend)
5. [Step 4: Connect the two hosts](#step-4-connect-the-two-hosts)
6. [Production checklist](#production-checklist)
7. [Free-tier caveats](#free-tier-caveats)
8. [Batch evaluation](#batch-evaluation)

---

## Overview

| Piece | Host (free tier) | Repo directory |
| --- | --- | --- |
| Database | **MongoDB Atlas** (M0 cluster) | n/a |
| Backend | **Render** Web Service | `server/` |
| Frontend | **Vercel** | `client/` |

```
Browser ──► Vercel (Next.js) ──/api/* rewrite──► Render (Express) ──► MongoDB Atlas
            your-app.vercel.app                  your-api.onrender.com
```

**Deploy in this order: Database → Backend → Frontend.** Each step needs a URL from the previous one. After the frontend is live, go back to the backend once to set `CLIENT_ORIGIN` (see [Step 4](#step-4-connect-the-two-hosts)).

### How cross-host cookies work

The frontend and backend live on **different hosts**, so the session cookie has to travel cross-site. The server already handles this:

- In production (`NODE_ENV=production`) the cookie is `SameSite=None; Secure`.
- CORS is locked to your `CLIENT_ORIGIN` with `credentials: true`.
- Both hosts serve HTTPS, which `SameSite=None` requires.

On top of that, the frontend proxies `/api/*` through its own domain (Step 3), which keeps the cookie **first-party** so browsers never block it.

---

## Step 1: MongoDB Atlas (database)

1. Create a free account at <https://www.mongodb.com/atlas> and deploy a **Free (M0)** cluster.
2. Under **Database Access**, create a user with a strong password.
3. Under **Network Access**, allow `0.0.0.0/0`, because Render and Vercel IPs are dynamic. If your plan lists specific egress IPs, you can add those instead.
4. Click **Connect → Drivers** and copy the connection string:

   ```
   mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/interview-prep-kit?retryWrites=true&w=majority
   ```

This is your **`MONGO_URI`**. Keep the password out of source control.

---

## Step 2: Render (backend API)

Push the repo to GitHub, then on <https://render.com>:

1. **New → Web Service** and connect the repository.
2. Configure the service:

   | Setting | Value |
   | --- | --- |
   | Root Directory | `server` |
   | Runtime | Node |
   | Build Command | `npm install` |
   | Start Command | `npm start` |
   | Instance Type | Free |

3. Add **environment variables**. Render injects `PORT` automatically, so do **not** set it.

   | Key | Value |
   | --- | --- |
   | `NODE_ENV` | `production` |
   | `MONGO_URI` | The Atlas connection string from Step 1 |
   | `SESSION_SECRET` | A random string, **≥ 32 characters** |
   | `CLIENT_ORIGIN` | Your Vercel URL, e.g. `https://your-app.vercel.app` (a placeholder is fine for now; finalise in Step 4) |
   | `GEMINI_API_KEY` | Your Gemini key |
   | `GEMINI_MODEL` | *(optional)* model override, default `gemini-3-flash-preview` |

4. Click **Create Web Service**. When it's live, note the URL, e.g. `https://your-api.onrender.com`.

**Verify:** open `https://your-api.onrender.com/api/health`. It should return JSON.

---

## Step 3: Vercel (frontend)

On <https://vercel.com>:

1. **Add New → Project** and import the same GitHub repository.
2. Set **Root Directory** to `client` (click *Edit* next to it **before** deploying).
3. **Framework Preset:** Next.js (auto-detected). Leave build and output settings at their defaults (`next build`, `next start`).
4. Add the environment variable **before the first deploy**, because it is read at build time:

   | Key | Value |
   | --- | --- |
   | `API_PROXY_TARGET` | Your Render URL, e.g. `https://your-api.onrender.com` (**no trailing slash**) |

5. Click **Deploy**. Vercel gives you a URL like `https://your-app.vercel.app`.

**How the proxy works:** the frontend calls its own origin (`/api/...`), and Next.js rewrites those requests to `API_PROXY_TARGET` (see `client/next.config.mjs`). In production the client deliberately does not call the API host directly. `NEXT_PUBLIC_API_URL` also works as the proxy target if it is already set.

---

## Step 4: Connect the two hosts

1. Go back to Render and set **`CLIENT_ORIGIN`** to exactly your Vercel URL (scheme + host, no trailing slash).
2. Let Render redeploy.

The API rejects cross-origin cookies from any other host, so this value must match exactly.

**Verify end to end:**

1. Open the Vercel URL, register a user, and create a kit.
2. You should see live stage progress, then the full kit.
3. In the browser Network tab, requests should go to `https://your-app.vercel.app/api/...`, **not** to the Render host.

---

## Production checklist

- [ ] `NODE_ENV=production` on the backend. This enables `Secure`/`SameSite=None` cookies and the SSRF guard that blocks private and loopback addresses.
- [ ] `SESSION_SECRET` is ≥ 32 characters. In production the server refuses to boot otherwise.
- [ ] `CLIENT_ORIGIN` exactly matches the frontend origin (scheme + host, no trailing slash).
- [ ] `API_PROXY_TARGET` exactly matches the backend origin (no trailing slash), and the frontend was **redeployed after setting it**.
- [ ] `GEMINI_API_KEY` is set. Without it, kits generate but come back thin or empty with `warnings`.
- [ ] Atlas Network Access allows the hosts' egress IPs.

---

## Free-tier caveats

| Service | Behaviour | What to do |
| --- | --- | --- |
| **Render** | Free instances sleep after ~15 min idle. The first request afterward has a cold start of ~30–60 s. Kit generation is a background job polled by the client, so a cold start just delays the first progress tick. | Open the app a minute before a demo. |
| **Gemini** | Free tier is limited per day per model. Back-to-back generations can return `429`. The client retries with exponential backoff and honours the provider's `retryDelay`. | Generate a kit ahead of a demo, or set `GEMINI_MODEL` to another model with its own daily budget. |
| **MongoDB Atlas M0** | Pauses after a week of inactivity. | Resume it from the Atlas UI. |
| **Sessions** | Stored in MongoDB (`connect-mongo`), so they survive backend restarts and redeployments. | Nothing to do. |

---

## Batch evaluation

The batch evaluator is a CLI entry point and is **not part of the web deploy**:

```bash
npm run evaluate -- --input <cases.json> --output <kits.json>
```

Run it locally (or in CI) with `MONGO_URI` and `GEMINI_API_KEY` in the environment. It does not need the web services to be deployed.