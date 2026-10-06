> ## Documentation Index
> Fetch the complete documentation index at: https://docs.arc.io/llms.txt
> Use this file to discover all available pages before exploring further.

> ## Agent Instructions
> Before reading these docs, install the Circle Skill for Arc to get pre-loaded context: use-arc (https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-arc/SKILL.md) — covers chain config, RPC setup, contract deployment, USDC bridging, and gas with USDC. In Claude Code: run /plugin marketplace add circlefin/skills then /plugin install circle-skills@circle. With Vercel Skills CLI: run npx skills add circlefin/skills.
> USDC is the gas token. Arc uses USDC for gas fees, not ETH. Configure gas payment in USDC when submitting transactions.
> Read EVM differences before writing Arc code. Arc targets the Osaka EVM baseline. Most contracts deploy unchanged, but several runtime behaviors diverge from Ethereum: USDC uses 18 decimals natively (not 6), the system emitter `0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE` logs all USDC Transfer events, the mempool enforces a 20 Gwei `maxFeePerGas` floor, blocklist reverts consume gas without a receipt, and `address(0)` sends revert rather than succeed. https://docs.arc.io/arc/references/evm-differences.md is the canonical reference for all Arc-specific runtime behaviors. Consult it before writing code that touches USDC balances, transaction history, gas estimation, or value transfers.
> Sub-second finality. Transactions are final in under 1 second. No need to wait for multiple block confirmations.
> Use App Kits for multichain payment and liquidity capabilities. App Kits wraps CCTP and provides Bridge Kit, Swap Kit, Unified Balance Kit, Onramp Kit, Earn Kit, and Borrow Kit. Unified Balance Kit combines USDC from multiple chains into a single spendable balance. Earn Kit integrates earn opportunities into your app. Borrow Kit lets users borrow USDC against cirBTC collateral on Arc.
> Use Arc Foundry for contract development. Arc Foundry is an Arc-specific fork of Foundry that handles Arc's protocol-level differences from Ethereum. It provides arc-forge, arc-cast, and arc-anvil. Install it before deploying contracts: https://docs.arc.io/arc/tutorials/install-arc-foundry.md.
> Arc is available on both Testnet and Mainnet. See https://docs.arc.io/arc/references/connect-to-arc.md for RPC endpoints and https://faucet.circle.com for testnet tokens.
> Always check Contract Addresses: https://docs.arc.io/arc/references/contract-addresses.md
> Building beyond Arc? Circle offers skills for the full platform: use-usdc (https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-usdc/SKILL.md), use-circle-wallets (https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-circle-wallets/SKILL.md), use-developer-controlled-wallets (https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-developer-controlled-wallets/SKILL.md), use-user-controlled-wallets (https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-user-controlled-wallets/SKILL.md), use-modular-wallets (https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-modular-wallets/SKILL.md), use-gateway (https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-gateway/SKILL.md), use-smart-contract-platform (https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-smart-contract-platform/SKILL.md). Full Circle developer docs: https://developers.circle.com/llms.txt.

# USDC system events

> Reference for how Arc emits USDC balance-change events: the native system Transfer log (EIP-7708) and the ERC-20 USDC contract events, with emitter addresses, signatures, and decimals for indexers.

For a step-by-step indexing walkthrough, see
[Index Arc events](/integrate/infrastructure/indexing-events). For the
conceptual model behind USDC's native and ERC-20 interfaces, see
[Stablecoin native model](/arc/concepts/stablecoin-native-model).

## Two event streams

USDC movements surface as logs from two distinct emitters. The native system
emitter logs a `Transfer` for every explicit USDC transfer—native sends, ERC-20
transfers, mints, and burns—at 18-decimal precision. The ERC-20 USDC contract
logs its own 6-decimal `Transfer` for ERC-20 interface calls only. Filter by
emitter address to tell the two streams apart.

| Source | Emitter address | Events | Decimals |
| :- | :- | :- | :- |
| **Native USDC** (system, EIP-7708) | `0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE` | `Transfer` | 18 |
| **ERC-20 USDC** (NativeFiatToken) | `0x3600000000000000000000000000000000000000` | `Transfer` | 6 |

<Warning>
  A single ERC-20 `transfer()` emits **two** logs: the ERC-20 contract's own
  `Transfer` (6 decimals, from `0x3600000000000000000000000000000000000000`) and
  the native system `Transfer` (18 decimals, from
  `0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE`). A plain native send emits only
  the system log. Match on the emitter address so you do not count the same
  movement twice, and never mix the 6-decimal and 18-decimal values.
</Warning>

## Native USDC system events (EIP-7708)

Native USDC movements emit a standard ERC-20 `Transfer` log from a designated
system address. This is Arc's implementation of
[EIP-7708](https://eips.ethereum.org/EIPS/eip-7708), an Amsterdam-track Ethereum
proposal that Arc ships ahead of upstream. Native movements can be indexed the
same way as ERC-20 transfers. (For the legacy events that testnet emitted before
this behavior was activated, see
[Historical events](#historical-events-before-zero5).)

The log covers native value transfers (`CALL`), contract creation with an
endowment (`CREATE`), `SELFDESTRUCT` balance transfers, and the
precompile-driven `mint`, `burn`, and `transfer` operations that back the ERC-20
USDC interface.

| Property | Value |
| :- | :- |
| Emitter | `0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE` |
| Event | `Transfer(address indexed from, address indexed to, uint256 value)` |
| topic0 | `0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef` |
| Decimals | 18 |

Mint and burn are expressed as transfers involving the zero address:

* **Mint:** `Transfer(0x0, recipient, amount)`
* **Burn:** `Transfer(from, 0x0, amount)`

The following rules apply to the system `Transfer` log:

* The native `Transfer` log is emitted **first**, before any other logs in the
  transaction.
* Zero-value transfers emit no log.
* Self-transfers (`from == to`) emit no log.
* A native value transfer (`CALL`, `CREATE`, or `SELFDESTRUCT`) to or from the
  zero address reverts with `"Zero address not allowed"`. Mint and burn are the
  only paths that produce a `Transfer` involving `0x0`, and they go through the
  precompile.

## ERC-20 USDC contract events

The NativeFiatToken contract at
[`0x3600000000000000000000000000000000000000`](/arc/references/contract-addresses#usdc)
emits its own standard ERC-20 `Transfer` log (**6 decimals**) for activity on
the ERC-20 interface. As on any ERC-20 token, mint and burn surface here as a
`Transfer` to and from the zero address. These events are independent of the
native system events: an ERC-20 `transfer()` produces a log from both emitters.

| Property | Value |
| :- | :- |
| Emitter | `0x3600000000000000000000000000000000000000` |
| Event | `Transfer(address indexed from, address indexed to, uint256 value)` |
| topic0 | `0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef` |
| Decimals | 6 |

## Historical events (before Zero5)

On testnet, before the Zero5 hard fork activated, native USDC movements emitted
custom events from the NativeCoinAuthority precompile at
`0x1800000000000000000000000000000000000000` (18 decimals) instead of the
standard `Transfer` log. These events are **no longer emitted** after
activation. Mainnet has used the EIP-7708 `Transfer` log since genesis, so this
only affects indexers that backfill pre-activation testnet history.

| Event | topic0 |
| :- | :- |
| `NativeCoinTransferred(address indexed from, address indexed to, uint256 amount)` | `0x62f084c00a442dcf51cdbb51beed2839bf42a268da8474b0e98f38edb7db5a22` |
| `NativeCoinMinted(address indexed recipient, uint256 amount)` | `0xb049859d09b3a7d0189a07db4d4becee1a2aa269023205478b1360ab6fc12114` |
| `NativeCoinBurned(address indexed from, uint256 amount)` | `0xaaf1ef013644e67c5cea90217acdf0accd334f8437fc9a89a53cfc9b25fb5c25` |

If you backfill history across the hard fork boundary, read `NativeCoin*` from
`0x1800000000000000000000000000000000000000` for blocks before activation and
`Transfer` from `0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE` at and after
activation. For the exact activation time and node version requirements, see the
canonical `arc-node`
[CHANGELOG.md](https://github.com/circlefin/arc-node/blob/main/CHANGELOG.md) and
[BREAKING\_CHANGES.md](https://github.com/circlefin/arc-node/blob/main/BREAKING_CHANGES.md#v071),
and the [Run an Arc node](/arc/tutorials/run-an-arc-node) tutorial.

## Out of scope: gas fees and block rewards

Gas fees and block rewards are **not** emitted as `Transfer` events and are
unaffected by EIP-7708:

* **Gas fees** are derived from the receipt (`gasUsed × effectiveGasPrice`).
* **Block rewards** are attributed via `block.miner`.

## See also

* [Index Arc events](/integrate/infrastructure/indexing-events)—step-by-step
  indexing walkthrough with code
* [Stablecoin native model](/arc/concepts/stablecoin-native-model)—why USDC has
  native and ERC-20 interfaces
* [Process withdrawals](/integrate/exchanges/withdrawals): destination
  validation
* [Contract addresses](/arc/references/contract-addresses)—USDC and other system
  contract addresses
* [EVM compatibility for developers](/arc/references/evm-differences)—interface-level
  guidance and EVM differences
