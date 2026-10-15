# ArcRail Explorer — public demo

A guided, self-running walkthrough of the Arc rail design for people who don't read code.

**Live link (share this one):** https://mrsnqobig.github.io/ArcRail/?tour=1

Opening the link starts a 16-step tour that plays by itself (under two minutes): a payment is created, approved and settled; a second one is denied and refunded; reconciliation drift pauses the rail; two people unpause it. Visitors can pause, step back and forward, change speed, or close the tour and click around. "Reset demo" in the header starts over.

## What it is, and isn't

- Everything runs in the visitor's browser. There is no server, no database, no wallet and no keys.
- Nothing is signed or sent to any blockchain. Transaction hashes in the demo are local rehearsal values.
- The engine (`src/lib/arcrail/engine.ts`) is a simplified simulation of the D1 design for illustration. It is **not** the adapter in `src/` at the repo root and is not on any money path.
- The live "Testnet settle" desk from the original Grok build (which signed real Arc testnet transfers with server-held keys) is deliberately left out of this public version. It held private keys in a file on the server, which this repo's rules don't allow.

## How it works

The views call `fetch('/api/...')`. `src/api-shim.ts` answers those calls in the page with the same handler the server version used (`src/lib/arcrail/api.ts`), so the build is plain static files that any static host can serve.

## Run or change it

```bash
cd desk
npm ci --ignore-scripts
npm run dev       # local preview
npm run build     # typecheck + static build into desk/dist
```

Merging a change under `desk/` to `main` rebuilds the live link automatically (`.github/workflows/desk-pages.yml`, which publishes `desk/dist` to the `gh-pages` branch). The workflow can also be run by hand from the Actions tab.

This folder is self-contained: it has its own `package.json` and lockfile, and the repo's own build, tests, lint and Semgrep scopes (`src`, `test`, `tools`, `scripts`) don't include it.
