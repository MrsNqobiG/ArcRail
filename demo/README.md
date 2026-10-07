# Payment-with-history demo

**DEMO ONLY - built on parts still in review; fakes only; testnet only; not the D1 payment unit; not evidence for any gate.**

## What it shows
A 2.5 USDC payment (6-decimal integer units, Arc testnet chain 5042002) walking through its stages:
CREATED, PENDING_APPROVAL, APPROVED, SUBMITTED, CONFIRMING, COMPLETED. For each step it prints the stage and
status, the ledger postings (debit/credit/amount; reserve, settlement, USDC gas) and the client-history entry key
`hist:<paymentId>:<eventId>`. It then checks that postings balance, history is in order, a repeated history append
replays, and a changed body is rejected as KEY_CONFLICT. A second case shows a rejected approval ending FAILED.

Real parts used: MapLedger, ListHistory, the status stage table and transition rules.
Simulated inside the demo (PAY unit pending): the payment record, the DFNS transfer, and the chain confirmation.

## Run
    cd /home/nqobi/arc-rail
    export PATH=/home/nqobi/arc-rail/.tools/node/bin:$PATH
    npx vitest run -c demo/vitest.demo.config.ts
