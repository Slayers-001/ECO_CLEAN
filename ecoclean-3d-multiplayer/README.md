# EcoClean 3D — Multiplayer

A fast, fun, real-time multiplayer 3D cleanup game.
**Created by Utkarsh Pandey and Nishant Amrit.**

- 6 maps: Park, Beach, City, Night City, Arctic, Jungle
- 3 game modes: Speedrun, 100% Clean, Power-Up Party
- Real WebSocket multiplayer (public matchmaking + private room codes)
- Combos, MVP crown, power-ups (Magnet / Speed / Bonus), emotes, mini-map
- Owner / admin panel (press `P`, password: `Slayers`)
- Pause menu, settings, sprint stamina, mouse-look

---

## Why not Vercel?

Vercel's free tier doesn't support **persistent WebSocket servers** —
real-time multiplayer needs a long-lived connection that Vercel functions
don't provide. This repo runs as one Node service that hosts both the
static client AND the WebSocket server on the same port, so it works
perfectly on **Render's free tier** (no credit card needed).

## Best free hosting → Render.com (no credit card)

Render has a free Web Service tier that:
- ✅ supports WebSockets
- ✅ requires **no credit card**
- ✅ gives you HTTPS + a public URL automatically
- ⚠️ sleeps after ~15 min idle (cold start ~30 s when someone visits, then it's fast)

### Deploy in 3 minutes

1. Push this folder to a public GitHub repo (or any Git provider).
2. Go to https://render.com → sign up free (GitHub or email).
3. Click **New → Web Service** → connect the repo.
4. Render will auto-detect `render.yaml` — leave every field as-is and click **Create Web Service**.
5. Wait for the first build (~3 min). Open the `*.onrender.com` URL.

That's it. Share the URL with your friends — they'll join the same public
rooms (e.g. Park + Speedrun) automatically, or create a private room and
share its 4-letter code.

---

## Other free hosts that work

If you'd rather use something else (all support WebSockets, no card needed):

- **Glitch.com** — drag this folder in. Sleeps after 5 min idle.
- **Koyeb** — free Nano instance, deploys from Git.
- **Adaptable.io** — free tier, deploys from Git.

For all of them: build = `npm install && npm run build`, start = `npm start`.

---

## Run locally

```bash
npm install
npm run build      # build the client once
npm start          # serves client + WebSocket on http://localhost:8080
```

Or run client + server separately for hot-reload:
```bash
npm run dev:server   # backend on :8080
npm run dev:client   # frontend on :5173 (proxies /api → :8080)
```

---

## Tech

- React 19 + Vite 7 + Three.js (frontend)
- Express 5 + ws (WebSocket server)
- Tailwind CSS v4
- Single Node process — no DB, no extra services

## Credits

Created by **Utkarsh Pandey** and **Nishant Amrit**.
