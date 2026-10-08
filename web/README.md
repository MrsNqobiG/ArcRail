# ArcRail Control Plane

Interactive showcase for the ArcRail testnet rail skeleton.

## Run

cd web
npm install
npm run dev

Open http://localhost:3000.

The UI exercises inbound detection, payout lifecycle, policy decisions, compliance screening, reconciliation circuit breaker, two-person unpause and hash-chained audit verification.

## Deploy

Set the deployment root to `web` in Vercel (or any Next.js host), use Node 22+, and run `npm run build` / `npm start`.

This is a deterministic testnet/demo control plane. It does not claim production banking connectivity, and the original ArcRail mainnet fail-closed gates remain intact.
