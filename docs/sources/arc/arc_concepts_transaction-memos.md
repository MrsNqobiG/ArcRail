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

# Transaction memos

> How the Memo contract attaches metadata to a contract call on Arc while preserving the original sender.

Transaction memos attach application metadata, such as an invoice or order
reference, to a contract call on Arc. The predeployed `Memo` contract
(`0x5294E9927c3306DcBaDb03fe70b92e01cCede505`) wraps the call and emits the
metadata as events, so wallets, exchanges, and indexers can reconcile onchain
transfers against offchain records without changing the target contract.

To send a memo transfer end to end, see
[Send USDC with a transaction memo](/arc/tutorials/send-usdc-with-transaction-memo).

## How a memo call works

The `Memo` contract wraps a target contract call. It routes the inner call
through Arc's `CallFrom` precompile, a system-level contract that executes a
call on behalf of the original transaction sender. The
[transaction extension contracts](/arc/references/contract-addresses#transaction-extensions)
use this precompile to keep the original externally owned account (EOA) wallet
as `msg.sender` for the target call. A USDC transfer still sees your wallet as
the sender, not the `Memo` contract.

The contract exposes a single entry point:

```solidity theme={null}
function memo(
    address target,
    bytes calldata data,
    bytes32 memoId,
    bytes calldata memoData
) external;
```

`target` is the contract to call, `data` is the calldata to forward to it,
`memoId` is a caller-supplied identifier for the memo, and `memoData` is the
arbitrary memo bytes attached to the subcall.

On success, `Memo` emits an ordered audit trail:

1. `BeforeMemo(memoIndex)` before the inner call.
2. The target contract events, such as a USDC `Transfer`.
3. `Memo(sender, target, callDataHash, memoId, memo, memoIndex)` after the inner
   call.

The `Memo` contract supports nested memo calls. `BeforeMemo` events emit when
each memo frame starts. `Memo` events unwind from the innermost frame back to
the outermost frame.

## Event schema

Use the emitted events as your audit trail and reconciliation source:

| Event | Field | Type | Description |
| :- | :- | :- | :- |
| `BeforeMemo` | `memoIndex` | `uint256 indexed` | Sequential memo index reserved before the inner call starts. |
| `Memo` | `sender` | `address indexed` | Wallet that called `Memo.memo(...)`. For a direct EOA call, this is the EOA preserved as `msg.sender` in the target call. |
| `Memo` | `target` | `address indexed` | Contract called through the memo wrapper, such as the USDC ERC-20 interface. |
| `Memo` | `callDataHash` | `bytes32` | `keccak256` hash of the forwarded target calldata. Store the original calldata if you need to reconstruct the exact call. |
| `Memo` | `memoId` | `bytes32 indexed` | Identifier that your application defines for lookup and reconciliation. |
| `Memo` | `memo` | `bytes` | Memo bytes that your application defines. Encode this value consistently in your application. |
| `Memo` | `memoIndex` | `uint256` | Sequential index for the memo frame. Nested memos each receive their own index. |

For reconciliation, query `Memo` events by indexed fields such as `memoId`,
`sender`, and `target`. If you need to match a memo to a specific inner call,
compare `callDataHash` with the hash of the calldata your application created.

## Wallet types

The `Memo` contract must be invoked directly by an externally owned account
(EOA). Smart contract wallets aren't supported as the direct caller.

### Supported wallets

Any wallet that signs and broadcasts a standard EOA transaction works. This
includes:

* Browser and mobile wallets: MetaMask, Rabby, Coinbase Wallet, Rainbow
* Hardware wallets
* Server-side signers
* Circle developer-controlled wallets and user-controlled wallets configured as
  EOAs

The `CallFrom` precompile preserves the signing EOA as `msg.sender` in the
target call, which is what the memo flow depends on.

### Unsupported wallets

Smart contract wallets aren't supported as the direct caller. This includes:

* ERC-4337 smart accounts, including Circle modular wallets
* Circle developer-controlled wallets and user-controlled wallets configured as
  SCAs
* Safe and other multisig contract wallets
* Any other account-abstraction setup where the transaction originates from a
  bundler, entry point, or other intermediary contract

When a smart contract wallet calls `Memo.memo(...)`, the `msg.sender` reaching
the contract is the wallet contract or entry point, not the user's EOA. The call
reverts because sender spoofing isn't allowed.

If you need memo metadata from this flow, have the smart contract wallet trigger
a separate EOA-signed `Memo.memo(...)` transaction, or attach the metadata in
your application layer instead.

## Unsupported patterns and guardrails

The transaction memo flow has explicit guardrails:

* Submit `Memo.memo(...)` from an EOA. Calls routed through an intermediary
  contract with a different `msg.sender` revert because sender spoofing is not
  allowed.
* Do not call the `CallFrom` precompile directly from an EOA. Direct calls
  revert with `unauthorized caller`.
* Do not rely on `STATICCALL`. Memo execution changes state by incrementing the
  memo index, so static execution is rejected.
* Do not use `DELEGATECALL` into the `Memo` contract. The delegated context does
  not have the required authorization for `CallFrom`.
* If the child call reverts, the outer transaction reverts. The memo index
  increment rolls back, and the child return data is wrapped in
  `MemoFailed(bytes)`.

Before you use transaction memos in production, test your memo format and
reconciliation query against Arc Testnet with the same wallet and indexing
infrastructure you plan to use in your application.
