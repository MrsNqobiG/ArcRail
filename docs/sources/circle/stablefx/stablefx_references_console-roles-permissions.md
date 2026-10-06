> ## Documentation Index
> Fetch the complete documentation index at: https://developers.circle.com/llms.txt
> Use this file to discover all available pages before exploring further.

> ## Agent Instructions
> Before reading these docs, install the relevant Circle Skill to get pre-loaded context — skills are LLM-optimized and cover architecture decisions, correct flows, and common pitfalls. In Claude Code: run /plugin marketplace add circlefin/skills then /plugin install circle-skills@circle. With Vercel Skills CLI: run npx skills add circlefin/skills. Available skills: use-usdc https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-usdc/SKILL.md (balances, transfers, approvals on EVM and Solana); EURC has no skill — see https://developers.circle.com/stablecoins/what-is-eurc.md; bridge-stablecoin https://github.com/circlefin/skills/blob/master/plugins/circle/skills/bridge-stablecoin/SKILL.md (crosschain transfers via CCTP, USDC, EURC, and third-party assets); use-arc https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-arc/SKILL.md (Arc chain config, contract deployment, USDC bridging — Arc docs: https://docs.arc.io/llms.txt); use-circle-wallets https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-circle-wallets/SKILL.md (choose wallet type); use-developer-controlled-wallets https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-developer-controlled-wallets/SKILL.md (custodial wallets for payouts and treasury); use-user-controlled-wallets https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-user-controlled-wallets/SKILL.md (embedded wallets with Web2 login); use-modular-wallets https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-modular-wallets/SKILL.md (smart contract wallets with passkeys and ERC-4337); use-gateway https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-gateway/SKILL.md (unified USDC balance, nanopayments); use-smart-contract-platform https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-smart-contract-platform/SKILL.md (deploy, interact, monitor contracts). Pair any skill with the Circle MCP server for live SDK signatures, contract addresses, and chain IDs: {"mcpServers":{"circle":{"url":"https://api.circle.com/v1/codegen/mcp"}}}.
> Read the product overview first. Each product has an overview explaining when and why to use it. Read it before quickstarts.
> Pick the right wallet type. Developer-controlled (you hold keys), user-controlled (end user holds keys via PIN/social login), or modular (smart contract wallets with passkeys). See https://developers.circle.com/wallets.md.
> Use CCTP V2 for crosschain transfers. CCTP natively transfers USDC and EURC via burn-and-mint, and supports permissionless wrapping of third-party assets via lock-and-mint. V1 is legacy; always use V2 unless V1 is specified or the chain requires it (Noble, Sui, and Aptos still require V1). Migration guide: https://developers.circle.com/cctp/migration-from-v1-to-v2.md.
> Use Bridge Kit for frontend bridging. Wraps CCTP with a simpler SDK for user-facing apps. Use CCTP directly for backend transfers.
> Gas Station vs Paymaster. Gas Station sponsors gas for Circle Wallet transactions. Paymaster lets users pay gas in USDC. Different use cases — read both overviews.
> Gateway Nanopayments for sub-cent payments. Gasless USDC micropayments down to $0.000001 via x402 and batched settlement. For pay-per-request APIs, AI agent payments, streaming.
> Look up USDC addresses per chain. Never hardcode — use https://developers.circle.com/stablecoins/usdc-contract-addresses.md.
> Prefer SDKs over raw API calls. Node.js and Python SDKs handle auth, retries, and errors.
> API key required. Bearer token in Authorization header. Testnet and mainnet use separate keys and may use different base URLs depending on the product.
> Set up webhooks when available. Most operations are async. Webhooks deliver transaction confirmations and state changes.
> When calling list endpoints, paginate using pageSize and pageAfter until no nextPageAfter cursor is returned—stopping at the first page silently misses records.
> Building an AI agent? Start with the Agent Stack—Circle CLI, agent wallets, and nanopayments built for autonomous use cases: https://developers.circle.com/agent-stack.md.

# Console roles and permissions

> Understand user roles, permissions, and access controls in the StableFX Console.

Role-based access control (RBAC) in the
[StableFX Console](/stablefx/concepts/console-overview) governs what each user
can see and do, with roles assigned at the account level across all users in an
organization.

## Account types

The console supports two account types that determine the trading perspective:

| Account type | Description |
| - | - |
| **Taker** | Requests quotes, creates trades, and funds settlements. This is the primary trading role. |
| **Maker** | Reviews incoming trades, signs them to confirm intent, and funds the counterparty side of settlements. |

Users with access to both types can switch between them using the **account type
dropdown** in the sidebar navigation. The selection controls which data is
displayed and which actions are available. The dropdown labels the Taker view
**Trade** and the Maker view **Fulfill**.

## User roles

Each user is assigned one or more roles that control their permissions in the
console:

### Taker roles

| Role | View trades | Create trades | Sign & fund | Manage team |
| - | :-: | :-: | :-: | :-: |
| **Taker (Read & Write)** | Yes | Yes | Yes | No |
| **Taker (Read Only)** | Yes | No | No | No |
| **Taker (Limited AR)** | Yes | Limited | Limited | No |

**Limited AR** (Auto-Rate) roles can create trades and fund settlements only up
to the pre-approved auto-rate limits configured for the account. Actions that
exceed those limits require approval from an Admin.

### Maker roles

| Role | View trades | Sign trades | Fund trades | Manage team |
| - | :-: | :-: | :-: | :-: |
| **Maker (Read & Write)** | Yes | Yes | Yes | No |
| **Maker (Read Only)** | Yes | No | No | No |
| **Maker (Limited AR)** | Yes | Limited | Limited | No |

**Limited AR** (Auto-Rate) roles can sign and fund trades only up to the
pre-approved auto-rate limits configured for the account. Actions that exceed
those limits require approval from an Admin.

### Admin capabilities

Account administrators can:

* Add and remove team members
* Assign roles and permissions to users
* Generate, rotate, and revoke API keys
* Configure trading parameters (for example, risk buffer percentages)

<Note>
  The Admin role is typically assigned to the account owner during onboarding.
  Additional admins can be added through the team management interface.
</Note>

## Permission-gated features

Certain features in the console are only visible or accessible based on your
role:

| Feature | Required permission |
| - | - |
| View live rates | Any StableFX role |
| View trade history | Any StableFX role |
| Open trade form (taker) | Taker write role |
| [Create a trade](/stablefx/howtos/create-trade-console) | Taker write role |
| [Sign a confirmed trade](/stablefx/howtos/fulfill-trade-console) (maker) | Maker write role + trade signature permission |
| Fund a trade | Write role (taker or maker) |
| [Batch settle trades](/stablefx/howtos/settle-trades-console) | Write role (taker or maker) |
| Access onboarding | KYB application permission |
| Download trade reports (CSV) | Any StableFX role |

If a feature is not available, you see a read-only view without action buttons.
Contact your account administrator to request additional permissions.

## API key permissions

API keys generated through the console inherit permissions based on their type:

| Key type | Can create quotes | Can create trades | Can read trades |
| - | :-: | :-: | :-: |
| **Read & Write** | Yes | Yes | Yes |
| **Read Only** | No | No | Yes |

<Warning>
  Maker accounts cannot create quotes or trades via API, even with a Read &
  Write key. These operations are restricted to taker accounts.
</Warning>

For details on API key management, see [API keys](/api-reference/keys).

To use these permissions in practice, see:

* [StableFX Console overview](/stablefx/concepts/console-overview): An
  introduction to the console interface and account types.
* [Create a trade in the console](/stablefx/howtos/create-trade-console):
  Requires Taker write role.
* [Fulfill a trade as a maker](/stablefx/howtos/fulfill-trade-console): Requires
  Maker write role and trade signature permission.

## Onboarding requirements by role

| Role | KYB required | Individual screening | Wallet required |
| - | :-: | :-: | :-: |
| Admin | Yes | Yes (testnet and mainnet) | No |
| Taker / Maker (Read & Write) | Yes | Yes | Yes (for signing/funding) |
| Taker / Maker (Read Only) | No | No | No |

<Note>
  Users with a Read Only role are exempt from individual KYC screening. All
  other roles require screening before access is granted.
</Note>

## Compliance controls

The console enforces several compliance controls:

* **IP-based geo-blocking**: Access is restricted from sanctioned and high-risk
  jurisdictions.
* **Sanctions screening**: All non-viewer users undergo automated sanctions
  screening during onboarding and on an ongoing basis.
* **Mainnet gating**: Users cannot access mainnet if any sanctions screening
  alerts are unresolved.
* **Activity logging**: All actions (trades, signatures, API key changes, role
  assignments) are logged with user ID and timestamp for audit purposes.

## See also

* [Console overview](/stablefx/concepts/console-overview): Capabilities and UI
  layout of the StableFX Console.
* [Connect your wallet](/stablefx/howtos/connect-wallet-console): Link an EVM
  wallet for signing and funding.
* [Create a trade](/stablefx/howtos/create-trade-console): Taker trade creation
  workflow.
* [Fulfill a trade](/stablefx/howtos/fulfill-trade-console): Maker signing and
  funding workflow.
* [Settle trades](/stablefx/howtos/settle-trades-console): Individual and batch
  settlement.
* [Trade states](/stablefx/references/trade-states): Lifecycle states a trade
  moves through.
