# DFNS setup for the Arc rail: ArcTestnet only (for the DFNS admin)

**Who this is for:** the person who administers the company's existing DFNS organisation. The agent and the package never create or change DFNS users, policies, permissions, wallets or webhooks (kit-v3 CLAUDE.md rule 3). This page lists exactly what the admin configures for D1, with a citation for each DFNS fact. Mainnet is out of scope; see `docs/MAINNET_DFNS_CHECKLIST.md` and the G-M gates.

Citations point to archived DFNS pages under `docs/sources/dfns/` (rows in `docs/sources/MANIFEST.md`, fetched 2026-10-06). Values marked **Ops decides** are deliberately not chosen here. Items marked **confirm** are open questions (OPEN_QUESTIONS Q-N…), not facts.

**Never** paste a token, private key or webhook secret into chat, email, a ticket, a commit or a file in this repo. Every secret goes straight from the DFNS dashboard into the secret store.

---

## 1. Organisation and region

| Item | What to do | Source |
|---|---|---|
| 1.1 Region host | Tell engineering which host the org uses: `https://api.dfns.io` (Default, Europe) or `https://api.uae.dfns.io` (UAE). The host is non-secret config | `api-reference_regions.md` |
| 1.2 Testnet isolation | One DFNS environment serves both mainnet and testnet chains, so testnet-only is enforced per **wallet** and per **policy**, not per host. Create no wallet on network `Arc` (mainnet) for this rail | `api-reference_regions.md` ("Mainnet / Testnet" both ticked per region) |
| 1.3 Network name | DFNS calls Arc testnet `ArcTestnet` (mainnet: `Arc`). Arc is Tier 1, with a confirmation (indexing) delay of 10 blocks | `networks_index.md` ("\| Arc \| ArcTestnet \| 1 \| N/A \| 10 \| \| \|") |

## 2. Questions the admin should put to DFNS support first

These block D1's live testnet slice (everything else runs on fakes). Please send the answers back to engineering; they go into OPEN_QUESTIONS.

| ID | Question | Why |
|---|---|---|
| Q-N1 | On `ArcTestnet`, is an `Erc20` transfer (contract `0x3600000000000000000000000000000000000000`) supported, or must USDC be sent as `kind: "Native"`? The networks table lists "Standards: N/A" for Arc, and no Arc page exists | Decides the transfer body (`api-reference_wallets_transfer-asset.md`; `networks_supported-assets.md`) |
| Q-N2 | For Arc `Native`: what are `decimals` and `symbol` in Get Wallet Assets, and is a `Native` transfer `amount` in 18-dp wei? | Amount encoding (Arc native USDC is 18 dp, constants C-10) |
| Q-N18 | **Every** DFNS token identifier (`tid`) through which USDC can move on `ArcTestnet` for `TransactionAmountLimitNominal`: on Arc, USDC is one balance with a native interface (18 dp) and an ERC-20 interface at `0x3600000000000000000000000000000000000000` (6 dp), so there may be two (for example `native:…` and `erc20:0x3600…0000`). Please list all of them, or confirm that only one exists | POL-2 below: "A transfer of an asset that is not listed does not trigger the rule" (`api-reference_policies_create-policy.md`, `assets` description), so one missing `tid` is a way around the cap |
| Q-N3 | When an approval times out (`autoRejectTimeout`, approval status `Expired`), what status does the transfer show? | Distinguish EXPIRED from REJECTED |
| Q-N4 | Is the webhook HMAC computed over the exact raw request body? | Our verifier checks raw bytes only |
| Q-N15 | (1) Least-privilege permission set for a transfer-only service account: `Wallets:Transfers:Create` (roles-and-permissions page) or `Wallets:Read` + `Wallets:Sign` (service-account guide)? (2) `Wallets:Transfers:Read` also grants **Cancel transfer** and **Speed up transfer** (§4 below). So does `Wallets:Transactions:Create`, which also grants Sign and broadcast transaction, Cancel transaction and Speed up transaction, and `Wallets:Transactions:Read` grants **Cancel transaction** and **Speed up transaction**. `ManagedDefaultEndUserAccess` includes all three. Are cancels and speed-ups made under **any** of these permissions evaluated by `Wallets:Sign` policies (POL-1, POL-2, POL-3)? Can those powers be withheld from an identity that keeps Get/List transfers? | (1) The two pages disagree. (2) Decides whether "operator-initiated, two-person" cancel can be enforced in DFNS, and whether a stolen adapter credential can replace a broadcast transfer (`core-concepts_roles-and-permissions.md`, "Transfers: Read", "Transactions: Create", "Transactions: Read") |
| Q-N20 | After a transfer ends `Failed` with **no** `txHash` (an off-chain failure) on `ArcTestnet`, what happens to the nonce DFNS reserved for it? `api-reference_idempotency.md` says DFNS "automatically frees any nonce it reserved for the failed transfer"; `api-reference_wallets_cancel-transfer.md` says cancel exists to "Consume the nonce that was reserved but not used". Please answer: (1) is the nonce freed and reused, or kept until cancelled? (2) can such a transfer have had signed bytes reach a node? (3) is the nonce always present in the transfer's `details`? (4) does an aborted transfer reserve a nonce? If a specific transfer has no parseable nonce, engineering will also ask DFNS for a written answer about that transfer | Without (3), the design can close such a transfer only with DFNS's written answer (design §8.4 check 3 (c), F-3b step 1), and the sending wallet stays on a nonce hold, which stops outbound payments from it |
| Q-N21 | (1) Can a Transfer Asset POST that got no `200`/`202` back (a timeout, a `5xx`, or a `4xx` other than `409`) still have created a transfer? (2) Is List Transfers complete and immediately consistent for a just-accepted request, so that an `externalId` missing from a full listing proves no transfer exists? Is there any lookup by `externalId`? | After an unclear POST the design re-sends the identical request with the same `externalId` (`api-reference_idempotency.md`) and never treats "not in the listing" as proof (design §8.4 check 3, F-6) |

## 3. Wallet

| Item | What to do | Source |
|---|---|---|
| 3.1 Create | Create **one** organisation wallet on network `ArcTestnet` (dashboard: **Operations > Wallets > Create Wallet**, select the testnet network, sign with your passkey). Name: `arc-rail-testnet-hot` | `guides_network-testnets.md` |
| 3.2 Not delegated | It must be an organisation-managed wallet. **Delegated wallets bypass the policy engine entirely** | `core-concepts_policies.md` ("Delegated wallets bypass policies") |
| 3.3 Tag | Tag the wallet `arc-rail-testnet`. Every policy below filters on this tag | `core-concepts_policies.md` ("Using wallet tags", `walletTags` / `hasAny`) |
| 3.4 Fund | A human funds it with testnet USDC from a testnet faucet. Testnet tokens have no value; never reuse a testnet wallet for mainnet | `guides_network-testnets.md` ("Do not reuse Testnet wallets for Mainnet usage.") |
| 3.5 Hand back | Give engineering the wallet `id`, `address` and confirm `network` = `ArcTestnet`, `status` = `Active` (as shown by Get Wallet) | `api-reference_wallets_get-wallet.md` |

D2 (later) adds customer deposit wallets and needs `Wallets:Create` for a provisioning identity. Not now.

## 4. Service accounts (least privilege, separate identities)

A new service account has **no permissions**; its token lasts 2 years by default, which is also the maximum, and is shown only once. Key types: RSA 2048 minimum, ECDSA P-256 or Ed25519, uploaded as a **PEM SPKI public key**; the private key never leaves our secret store (`guides_developers_service-account.md`). Creating a service account is done in the dashboard, because the API rejects personal access tokens for it (`solutions_gate-service-account-signing.md`).

**Read this before assigning permissions.** In DFNS, `Wallets:Transfers:Read` is not read-only. Besides Get transfer and List transfers it also grants **Cancel transfer** (`POST /wallets/{walletId}/transfers/{transferId}/cancel`) and **Speed up transfer** (`POST /wallets/{walletId}/transfers/{transferId}/speed-up`) (`core-concepts_roles-and-permissions.md`, "Transfers: Read"). Cancel replaces a broadcast transfer with a 0-value transaction at the same nonce (`api-reference_wallets_cancel-transfer.md`); speed-up replaces it with the same transfer at a higher fee, "10% bump or current Fast fees, whichever is higher" (`networks_evm.md`, "Speed up and cancel"). Either way the transaction hash changes.

Two other permissions also grant these powers (`core-concepts_roles-and-permissions.md`):
- `Wallets:Transactions:Create` ("Transactions: Create") grants Cancel transfer and Speed up transfer as well, plus Sign and broadcast transaction, Cancel transaction and Speed up transaction.
- `Wallets:Transactions:Read` ("Transactions: Read") grants Cancel transaction and Speed up transaction.

DFNS's managed role `ManagedDefaultEndUserAccess` includes all three permissions in its initial set. It is assigned by default to new end users. Do not assign it, or any role containing these permissions, to SA-1 or SA-2. So:

- the monitor (SA-2) does **not** get `Wallets:Transfers:Read`;
- the adapter (SA-1) needs it to read transfer status, so SA-1 can technically cancel or speed up. That is a recorded residual risk until DFNS answers Q-N15 (2). Engineering's mitigations: the adapter's DFNS client refuses any cancel, speed-up or abort path; the design treats any replacement as QUARANTINE and pauses the rail on an unlinked transaction (design §8.2, F-18); a speed-up's fee is checked against our ceiling after confirmation and pages on a breach.

| Account | Purpose | Permissions to assign (role) | Must NOT have | Source |
|---|---|---|---|---|
| SA-1 `arc-rail-adapter` | Request transfers, read their status | `Wallets:Read`, `Wallets:Transfers:Create`, `Wallets:Transfers:Read` (needed for status; also grants cancel and speed-up, see above), `Policies:Evaluations:Read` (Get Approval, to tell EXPIRED from REJECTED). **Confirm** whether `Wallets:Sign` is also required (Q-N15 (1)) | `Wallets:Create`, `Wallets:Update`, `Wallets:Transfers:Abort`, **`Wallets:Transactions:Create`** and **`Wallets:Transactions:Read`** (both grant cancel and speed-up, see above), any `Policies:*` write, `Policies:Evaluations:Vote`, any `Permissions:*`, any `Webhooks:*` write, any `Auth:*` write | `core-concepts_roles-and-permissions.md` |
| SA-2 `arc-rail-monitor` | Independent cross-check that cannot move or replace anything | `Wallets:Read` (Get wallet, Get wallet assets, Get wallet history, List org wallet history), `Policies:Evaluations:Read`, `Webhooks:Events:Read` (Get/List webhook events). It cross-checks through wallet history and webhook events, not through the transfers API | **`Wallets:Transfers:Read`**, **`Wallets:Transactions:Create`** and **`Wallets:Transactions:Read`** (each grants cancel and speed-up), `Wallets:Transfers:Create`, `Wallets:Transfers:Abort`, and anything else that writes. Note: DFNS also lists "Proxy a request to the canton ledger api" (a POST) under `Wallets:Read`; it applies to Canton wallets only and this rail has none, but it is recorded so nobody calls SA-2 "strictly read-only" | `core-concepts_roles-and-permissions.md` |

Steps per account:

1. Engineering's runtime (not a person, not the agent) generates the key pair inside the secret store and exports only the PEM SPKI public key. **Our** preference is Ed25519 (a smaller, modern key). DFNS's guide uses RSA 2048 in its example and accepts ECDSA P-256 or Ed25519 "if you prefer a smaller, modern key" (`guides_developers_service-account.md`); this is our choice, not a DFNS recommendation.
2. The admin creates the service account in the dashboard with that public key, assigns the role above, and puts the token **directly** into the secret store under the agreed name.
3. Set a rotation reminder well before the token's expiry (2 years maximum).
4. Service accounts must **not** be members of any approval group. Leave `serviceAccountsCanApprove` off (`core-concepts_policies.md`, "Service account approvers").
5. `Wallets:Transfers:Abort` stays with named human operators only. Abort only works on a transfer that is `Executing` and not yet signed (`api-reference_wallets_abort-transfer.md`). Cancel and speed-up of a broadcast transfer are operator decisions too (two people, by Ops procedure), but DFNS permissions cannot restrict them to humans while SA-1 holds `Wallets:Transfers:Read` (see above).

Optional hardening (later, not needed for D1): back SA-1's credential with a DFNS MPC key gated by an `AlwaysTrigger` `Wallets:Sign` policy, so every user action it signs needs a human quorum (`solutions_gate-service-account-signing.md`).

## 5. Policies (all with `activityKind: "Wallets:Sign"` and `filters.walletTags.hasAny: ["arc-rail-testnet"]`)

DFNS evaluates **every** matching policy; `Block` always wins over `RequestApproval`; if any approver rejects, the transaction is cancelled (`core-concepts_policies.md`).

| ID | Rule | Action | Configuration | Source |
|---|---|---|---|---|
| POL-1 Human approval on every transfer | `AlwaysTrigger` | `RequestApproval` | `approvalGroups`: one group of **named** human approvers, `quorum` **Ops decides** (suggested ≥ 1 for testnet, 2 before any pilot); `initiatorCanApprove`: leave unset (false); `autoRejectTimeout`: **Ops decides**, in minutes (without it an approval never expires) | `api-reference_policies_create-policy.md`, `api-reference_policies.md` |
| POL-2 Per-transfer hard cap | `TransactionAmountLimitNominal` | `Block` | `assets`: **one entry per `tid` that can move Arc USDC** (Q-N18), for example `[{ network: "ArcTestnet", tid: <native tid>, limit: "<L × 10^12>" }, { network: "ArcTestnet", tid: <erc20 tid for 0x3600…0000>, limit: "<L>" }]`. Each `limit` is an integer string in that asset's own minimum denomination (18 dp native, 6 dp ERC-20), and all entries must express the **same** USDC cap `L` (6-dp units); `L` is **Ops decides**. The native factor `10^12` assumes that DFNS's minimum denomination for Arc native USDC is 18 dp. That is still open as **Q-N2**. If DFNS used 6 dp, the native limit would be 10^12 times too loose, so the native entry's value is final only once Q-N2 is answered. D1's live slice is blocked on Q-N2 anyway (design §8.5). A transfer of an asset that is not listed does not trigger the rule, so a missing `tid` would bypass the cap. The rule fails closed (triggers) when the amount or a listed asset cannot be determined. Until DFNS answers Q-N18, engineering's gateway also refuses every transfer `kind` other than the single one chosen by Q-N1. **Side effect:** this rule also fails closed on 0-value transactions (`core-concepts_policies.md`, warning on value-transfer rules). So if DFNS evaluates cancels against `Wallets:Sign` policies (Q-N15 (2)), POL-2 blocks a DFNS Cancel just as POL-3 does | `api-reference_policies_create-policy.md` (TransactionAmountLimitNominal, `assets` description) |
| POL-3 Recipient allow-list (testnet) | `TransactionRecipientWhitelist` | `Block` | `addresses`: the testnet recipient addresses engineering supplies. This also blocks contract calls and 0-value transactions (the rule fails closed when it cannot read a recipient), which is what D1 wants: plain transfers only. **Side effect:** a DFNS Cancel is a 0-value transaction to our own wallet address (`api-reference_wallets_cancel-transfer.md`). If DFNS evaluates cancels against `Wallets:Sign` policies (Q-N15 (2)), POL-3 blocks them, and so does POL-2. Then two things need a policy change by the admin, through the admin's own approval: cancelling a stuck transfer (design F-5), and burning a reserved nonce after an off-chain `Failed` (design F-3b). Do not add our own wallet to the allow-list to pre-empt this | `core-concepts_policies.md` (warning on value-transfer rules) |
| POL-4 Velocity (optional) | `TransactionAmountVelocity` and/or `TransactionCountVelocity` | `Block` or `RequestApproval` | Limit and timeframe **Ops decides**, fields per the create-policy reference | `core-concepts_policies.md`, `api-reference_policies_create-policy.md` |

Do not use `TransactionAmountLimit` (USD) as the cap: it depends on market prices (`api-reference_policies_create-policy.md`), and our money rules forbid float-priced limits on the money path.

## 6. Webhook

| Item | What to do | Source |
|---|---|---|
| 6.1 Create | One webhook, `url` = `https://<adapter-host>/webhooks/dfns` (engineering supplies the host), `status` enabled | `api-reference_webhooks_create-webhook.md` (`url`, `events` required) |
| 6.2 Events | `wallet.transfer.requested`, `wallet.transfer.failed`, `wallet.transfer.rejected`, `wallet.transfer.broadcasted`, `wallet.transfer.confirmed`, `policy.approval.pending`, `policy.approval.resolved`. (D2 later: `wallet.blockchainevent.detected`.) | `api-reference_webhook-events.md` |
| 6.3 Secret | The webhook secret is returned **only once**, in the Create Webhook response. Put it straight into the secret store; do not keep a copy anywhere else | `guides_developers_webhooks.md` |
| 6.4 Network allow-list | Our ingress allows DFNS's webhook origin IP for the org's region (Europe: `35.181.116.68`) | `api-reference_regions.md` |
| 6.5 Expectations | Delivery is not ordered and not unique; each retry is a new event id with `deliveryAttempt`/`retryOf`; DFNS treats any response other than **200** as a failure and makes up to 5 total attempts over 24 hours. Our handler answers 200 only after storing the event, dedupes by transfer id and status, and re-reads the transfer from the API, so nothing extra is needed on the DFNS side | `api-reference_webhook-events.md` |

## 7. Do not

- Create any wallet, policy or webhook on network `Arc` (mainnet) for this rail until every G-M gate in `docs/GATES.md` is signed.
- Give any service account policy, permission, webhook-write or approval-vote permissions.
- Make the rail wallet a delegated wallet.
- Share any token, key or secret with engineering in readable form, or with the agent at all.

## 8. Hand-back checklist (non-secret values only)

| Value | Filled in by admin |
|---|---|
| Region host (§1.1) | |
| Wallet id, address, tag (§3.5) | |
| Service account ids and the role/permission list actually assigned (§4) | |
| Secret-store names where the tokens and the webhook secret were placed (names only) | |
| Policy ids POL-1…POL-4, with quorum, `autoRejectTimeout`, every `tid` and cap listed in POL-2, and the allow-list as configured (§5) | |
| Webhook id and subscribed events (§6) | |
| DFNS support answers to Q-N1, Q-N2, Q-N3, Q-N4, Q-N15 (1) and (2) (including the `Wallets:Transactions:Create`/`:Read` part), Q-N18 (every `tid`), Q-N20 (1)–(4) and Q-N21 (1)–(2) (§2) | |
