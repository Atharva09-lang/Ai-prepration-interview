# Deployment guide (free tiers)

This app has three deployable pieces, all of which fit on free tiers:

| Piece     | Host (free tier)   | Repo directory |
| --------- | ------------------ | -------------- |
| Database  | **MongoDB Atlas** (M0 cluster) | — |
| Backend   | **Render** Web Service          | `server/` |
| Frontend  | **Vercel**                      | `client/` |

The frontend and backend run on **different hosts**, so the session cookie is sent
cross-site. The server already handles this: in production (`NODE_ENV=production`)
the cookie is `SameSite=None; Secure`, and CORS is locked to your `CLIENT_ORIGIN`
with `credentials: true`. Both hosts serve HTTPS, which `SameSite=None` requires.

Deploy in this order: **Database → Backend → Frontend** (each step needs a URL from
the previous one).

---

## 1. MongoDB Atlas (database)

1. Create a free account at <https://www.mongodb.com/atlas> and deploy a **Free (M0)** cluster.
2. Under **Database Access**, create a user with a strong password.
3. Under **Network Access**, allow `0.0.0.0/0` (Render/Vercel IPs are dynamic) — or add
   the specific egress IPs if your plan lists them.
4. Click **Connect → Drivers** and copy the connection string. It looks like:

   ```
   mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/interview-prep-kit?retryWrites=true&w=majority
   ```

   This is your `MONGO_URI`. Keep the password out of source control.

---

## 2. Render (backend API)

Push this repo to GitHub, then on <https://render.com>:

1. **New → Web Service**, connect the repository.
2. **Root Directory:** `server`
3. **Runtime:** Node
4. **Build Command:** `npm install`
5. **Start Command:** `npm start`
6. **Instance Type:** Free
7. **Environment variables** (Render injects `PORT` automatically — do not set it):

   | Key | Value |
   | --- | --- |
   | `NODE_ENV` | `production` |
   | `MONGO_URI` | the Atlas connection string from step 1 |
   | `SESSION_SECRET` | a random string **≥ 32 characters** |
   | `CLIENT_ORIGIN` | your Vercel URL, e.g. `https://your-app.vercel.app` (set/confirm after step 3) |
   | `GEMINI_API_KEY` | your Gemini key |
   | `GEMINI_MODEL` | *(optional)* override, default `gemini-3-flash-preview` |

8. **Create Web Service.** When it's live, note its URL, e.g.
   `https://your-api.onrender.com`.

**Verify:** open `https://your-api.onrender.com/api/health` — it should return JSON.

> Because `CLIENT_ORIGIN` must equal the frontend URL, create the Vercel deploy first
> to learn its hostname, then come back and set `CLIENT_ORIGIN` here (or set a placeholder
> now and update it after step 3). The API rejects cross-origin cookies from any other host.

---

## 3. Vercel (frontend)

On <https://vercel.com>:

1. **Add New → Project**, import the same GitHub repository.
2. **Root Directory:** `client` (click *Edit* next to it and set this before deploying).
3. **Framework Preset:** Next.js (auto-detected).
4. **Build / Output settings:** leave defaults (`next build`, `next start`).
5. **Environment variables** — `API_PROXY_TARGET` is read at build time, so set it
   *before* the first deploy:

   | Key | Value |
   | --- | --- |
   | `API_PROXY_TARGET` | your Render URL, e.g. `https://your-api.onrender.com` (no trailing slash) |

   The frontend calls its own origin (`/api/...`) and Next.js rewrites proxy those
   requests to `API_PROXY_TARGET` (see `client/next.config.mjs`). Proxying keeps the
   session cookie **first-party** on the Vercel domain, so no browser blocks it —
   in production the client deliberately does not call the API host directly.
   (`NEXT_PUBLIC_API_URL` also works as the proxy target if it is already set.)

6. **Deploy.** Vercel gives you `https://your-app.vercel.app`.
7. Go back to Render and set `CLIENT_ORIGIN` to exactly that URL, then let it redeploy.

**Verify:** open the Vercel URL, register a user, and create a kit. The browser should
show live stage progress and then the full kit. Network tab should show requests going
to `https://your-app.vercel.app/api/...` (not to the Render host).

---

## Production checklist

- [ ] `NODE_ENV=production` on the backend (enables `Secure`/`SameSite=None` cookies and the SSRF guard that blocks private/loopback addresses).
- [ ] `SESSION_SECRET` ≥ 32 chars — the server refuses to boot otherwise in production.
- [ ] `CLIENT_ORIGIN` exactly matches the frontend origin (scheme + host, no trailing slash).
- [ ] `API_PROXY_TARGET` exactly matches the backend origin (no trailing slash) and the frontend was redeployed after setting it.
- [ ] `GEMINI_API_KEY` set — without it kits generate but come back thin/empty with `warnings`.
- [ ] Atlas Network Access allows the hosts' egress IPs.

---

## Free-tier caveats

- **Render free instances sleep** after ~15 minutes idle; the first request afterward
  has a cold start of ~30–60 s. Kit generation is a background job polled by the client,
  so a cold start just delays the first progress tick.
- **Gemini free tier is limited per day per model.** Back-to-back kit generations can
  return `429`; the client retries with exponential backoff and honours the provider's
  `retryDelay`. For demos, generate a kit ahead of time, or set `GEMINI_MODEL` to a
  different model with its own daily budget.
- **MongoDB Atlas M0** pauses after a week of inactivity — resume it from the Atlas UI.
- **Session store** lives in MongoDB (`connect-mongo`), so sessions survive backend
  restarts and redeployments.

---

## Batch evaluation is not part of the web deploy

`npm run evaluate -- --input <cases.json> --output <kits.json>` is a CLI entry point.
Run it locally (or in CI) with `MONGO_URI`/`GEMINI_API_KEY` in the environment; it does
not need the web services to be deployed.
