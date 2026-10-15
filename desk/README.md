# ArcRail Explorer — public demo

A guided, self-running walkthrough of the Arc rail design, plus a desk that sends **real Arc testnet transfers** from the visitor's own browser.

**Live link (share this one):** https://mrsnqobig.github.io/ArcRail/?tour=1

- **Guided tour.** Opening the link starts a 16-step tour that plays by itself in under two minutes. It shows a payment created, approved and settled; a second one denied and refunded; reconciliation drift pausing the rail; and two people unpausing it. The tour rehearses the ledger and sends nothing.
- **Testnet settle.** This page signs a real native USDC transfer on Arc testnet (chain 5042002):
  1. The page creates two testnet wallets in the visitor's browser.
  2. The visitor funds the first one once at Circle's free faucet (https://faucet.circle.com, Arc Testnet, USDC; the faucet asks for a human check).
  3. The visitor sends up to 1 testnet USDC per transfer to the second wallet, or to any address.
  4. The page shows every check before and after signing.
  5. A transfer counts as settled only after a second, independent provider (or the public explorer) returns the same receipt.

## Safety model

- **Keys never leave the browser.** Both private keys are made in the visitor's browser and stored there (localStorage). Transactions are signed there, and only the signed bytes go to a public Arc testnet RPC. There is no server, no shared wallet, and no key held by the project. Clearing the site's data deletes the keys.
- **Testnet only.** Chain 5042002 is pinned into every signature. Arc mainnet (5042) is refused by name, and the build guard fails on any Arc mainnet host.
- **Limits before signing.** Each transfer is capped at 1 USDC, with 5 per rolling hour per browser, and gas is held back. The destination can't be zero, self, a precompile, an Arc system contract, or an address on a static OFAC SDN subset. The transfer must be a plain value transfer with empty calldata. Repeat clicks reuse the same request and never sign twice.
- **No personal information.** None is collected. Addresses and transaction hashes are public chain data.
- **Not a financial service.** Testnet USDC has no monetary value. The on-page notice sets out the South African position (FAIS, FIC Act, POPIA, National Payment System Act). That notice is not legal advice, and a real-value service would need its own licensing.
- **Not the money path.** The payments, ledger, reconciliation and ops views (`src/lib/arcrail/engine.ts`) are a simplified rehearsal of the D1 design. They are not the adapter in `src/` at the repo root.

## How it works

The views call `fetch('/api/...')`, and `src/api-shim.ts` answers those calls in the page. `src/lib/arcrail/api.ts` holds the routes. `treasury.ts` signs and proves transfers with viem against Arc testnet RPCs (Circle, dRPC, Blockdaemon, QuickNode, all browser-accessible) and the public explorer, and `chain.ts` looks up any hash. The build is plain static files.

## Run or change it

```bash
cd desk
npm ci --ignore-scripts
npm run dev       # local preview
npm run build     # typecheck + static build into desk/dist
npm run check     # guard: no custody/wallet SDKs, no external loads, Arc testnet hosts only
```

Merging a change under `desk/` to `main` rebuilds the live link (`.github/workflows/desk-pages.yml`):

- The build job has a read-only token and runs `npm audit`, the build and the guard.
- A separate publish job pushes the built files to the `gh-pages` branch and runs no npm code.

You can also run it by hand from the Actions tab, on `main` only.

This folder is self-contained, with its own `package.json` and lockfile. The repo's own build, tests, lint and Semgrep (`src`, `test`, `tools`, `scripts`) don't include it.
