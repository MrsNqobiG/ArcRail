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

# Custody Platform Integration

> Reference for adding Arc to a custody platform: register Arc as a custom EVM chain, configure signing policies, and handle the differences that matter—USDC as native gas, deterministic finality, and unified balance management.

Arc is fully EVM-compatible—same key derivation, same signing curve (secp256k1),
same transaction formats. If your custody platform supports custom EVM chains,
you can add Arc without code changes. This guide covers what's different and
what to configure.

<Info>
  Arc uses USDC as its native gas token. There is no separate ETH-like token to
  fund for gas. A single USDC balance covers both transfer value and transaction
  fees.
</Info>

## What custody engineers need to know

Arc behaves like any EVM chain with three key differences:

| Property | Ethereum | Arc |
| - | - | - |
| Gas token | ETH (18 decimals) | USDC (6 display decimals, 18 internal decimals) |
| Finality | Probabilistic (\~12 min for safety) | Deterministic, sub-second. 1 confirmation = final. |
| Gas funding | Requires separate ETH balance | No separate funding—USDC covers everything |

Everything else is standard:

* Address derivation: BIP-44 path `m/44'/60'/0'/0/x`
* Signing algorithm: secp256k1 (identical to Ethereum)
* Transaction types: Legacy (type 0) and EIP-1559 (type 2) both supported
* Smart contracts: Solidity, same EVM opcodes
* Multi-sig: Standard Ethereum multi-sig contracts (including SAFE) work without
  modification

## Network configuration

Use these parameters when registering Arc as a custom EVM chain:

| Parameter | Testnet value |
| - | - |
| Chain ID | `5042002` |
| RPC (HTTPS) | `https://rpc.testnet.arc.io` |
| RPC (WebSocket) | `wss://rpc.testnet.arc.io` |
| Block explorer | `https://explorer.testnet.arc.io` |
| Native currency symbol | `USDC` |
| Native currency decimals | `18` (internal representation) |
| Display decimals | `6` |
| EIP-1559 support | Yes (recommended) |
| Minimum base fee | 20 Gwei |

<Warning>
  The native currency uses 18 decimals internally (like ETH uses Wei) but
  represents USDC which has 6 display decimals. Configure your balance display
  to show 6 decimal places to users while using 18 decimals for transaction
  construction.
</Warning>

### USDC ERC-20 contract

For ERC-20 interactions (approvals, `transferFrom`, allowance checks), the USDC
contract is deployed at a precompile address:

```text theme={null}
0x3600000000000000000000000000000000000000
```

Native USDC transfers (simple sends) and ERC-20 `transfer()` calls both move the
same underlying balance. There is no wrapped/unwrapped distinction.

## Register Arc in your custody platform

Most custody platforms provide a "custom EVM chain" or "custom network"
configuration flow. The following sections provide platform-specific guidance
and a generic template.

### Provider configuration reference

| Provider | Integration method | Notes |
| - | - | - |
| Fireblocks | Workspace Settings → Add EVM Network | Use "EVM-based chain" template. Set native asset to USDC. |
| BitGo | Admin → Coin Management → Custom EVM | Register as custom ERC-20 chain. Configure 1-block finality. |
| Cactus | Network Management → Add Custom Chain | Standard EVM chain wizard. Set gas token symbol to USDC. |
| Zodia | Network Configuration → Custom EVM | Use provided chain ID and RPC. No special signing config needed. |
| SAFE | Add custom network in web interface | Works natively—same contract addresses and factory. |
| Taurus | TaurusProtect → Network Settings | Register RPC endpoint. Configure display decimals separately. |
| Copper | ClearLoop → Custom Networks | Standard EVM registration. Set confirmation threshold to 1. |
| CEFFU | Asset Management → Custom Chain | Follow EVM chain onboarding flow. Specify USDC as fee token. |

### Generic custom EVM chain template

Use this configuration when your platform has a general-purpose "add custom EVM
chain" form:

```typescript theme={null}
const arcNetworkConfig = {
  chainId: 5042002,
  name: "Arc Testnet",
  rpcUrl: "https://rpc.testnet.arc.io",
  wsUrl: "wss://rpc.testnet.arc.io",
  blockExplorer: "https://explorer.testnet.arc.io",
  nativeCurrency: {
    name: "USDC",
    symbol: "USDC",
    decimals: 18, // Internal representation (like Wei for ETH)
  },
  // Display configuration
  displayDecimals: 6, // Show balances with 6 decimal places
  // Finality configuration
  confirmationsRequired: 1, // Deterministic finality—1 block is final
  // Transaction type preference
  eip1559: true,
  // No separate gas token funding address needed
};
```

## Transaction signing

Arc uses standard Ethereum transaction signing. No custom signing schemes or
transaction types are required.

### Recommended: EIP-1559 (type 2)

```typescript theme={null}
import { createWalletClient, http, parseUnits } from "viem";

const arcTestnet = {
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.arc.io"] },
  },
};

const client = createWalletClient({
  chain: arcTestnet,
  transport: http(),
});

// Standard EIP-1559 transaction—identical to Ethereum
const txHash = await client.sendTransaction({
  account, // Your custody-managed account
  to: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD28",
  value: parseUnits("100", 18), // 100 USDC (18 decimals internally)
  maxFeePerGas: parseUnits("30", 9), // 30 Gwei
  maxPriorityFeePerGas: parseUnits("1", 9), // 1 Gwei tip
});

// With deterministic finality, 1 confirmation means the transaction is final
```

### Key signing details

* **Curve:** secp256k1 (same as Ethereum)
* **Address derivation:** Keccak-256 hash of public key, last 20 bytes
* **HD path:** `m/44'/60'/0'/0/x` (coin type 60, same as Ethereum)
* **Transaction serialization:** RLP encoding, identical to Ethereum
* **Chain ID in signature:** Required (EIP-155). Use `5042002` for testnet.

## MPC and multi-sig considerations

### MPC wallets

MPC (multi-party computation) signing works identically to Ethereum:

* Key shares are generated for the secp256k1 curve
* Threshold signing produces a standard ECDSA signature
* The resulting address is a standard Ethereum address
* No Arc-specific MPC protocol modifications are needed

### Multi-sig wallets (SAFE)

SAFE multi-sig contracts deploy and operate on Arc without modification:

* Same factory contract addresses
* Same proxy pattern
* Same signature verification logic
* Transaction confirmation follows the same flow—but only 1 onchain confirmation
  is needed due to deterministic finality

## Operational differences

### Balance management

Because USDC is both the transfer currency and the gas token, custody operations
are simpler:

* **No gas station network:** You don't need a separate process to fund
  addresses with gas tokens.
* **Unified balance:** A single `eth_getBalance` call returns the USDC balance
  available for both transfers and fees.
* **Threshold alerts:** Set a single low-balance threshold instead of monitoring
  separate gas and transfer balances.

```typescript theme={null}
import { createPublicClient, http, formatUnits } from "viem";

const client = createPublicClient({
  transport: http("https://rpc.testnet.arc.io"),
});

const balance = await client.getBalance({
  address: "0xYourCustodyAddress",
});

// Display with 6 decimals (USDC precision)
const displayBalance = formatUnits(balance, 18);
// For user-facing display, round to 6 decimal places
const usdcDisplay = parseFloat(displayBalance).toFixed(6);
```

### Finality and confirmation tracking

Arc provides deterministic finality. Once a transaction is included in a block,
it is final—no reorgs, no uncle blocks, no chain reorganizations.

This means:

* Set confirmation requirements to **1** in your custody platform
* Remove pending-state tracking logic (no need to wait for additional
  confirmations)
* Transaction receipts are immediately authoritative
* No need to handle "dropped and replaced" scenarios

<Tip>
  If your platform requires a minimum confirmation count greater than 1, setting
  it to 1 is still safe on Arc. There is no security benefit to waiting for
  additional blocks.
</Tip>

### Blocklist enforcement

Arc enforces a protocol-level blocklist. Transactions from blocklisted sender
addresses are rejected at the pre-mempool stage—they never appear onchain.

For custody operations:

* Check the blocklist before attempting to sign and broadcast
* If a send fails with a blocklist rejection, it was not broadcast—no gas is
  consumed
* Monitor compliance status of custody-managed addresses

### Fee estimation

Gas estimation works identically to Ethereum:

```typescript theme={null}
// Use standard eth_estimateGas and eth_gasPrice / eth_maxPriorityFeePerGas
const gasEstimate = await client.estimateGas({
  account: "0xYourCustodyAddress",
  to: "0xRecipientAddress",
  value: parseUnits("1000", 18), // 1000 USDC
});

const feeData = await client.estimateFeesPerGas();

// Total fee in USDC (18 decimals internal)
const maxFee = gasEstimate * feeData.maxFeePerGas;
```

The minimum base fee is 20 Gwei. Set your gas price floor accordingly to avoid
underpriced transaction rejections.

## Verification and testing

After configuring Arc in your custody platform:

1. **Generate a test address** using your standard HD derivation path and verify
   it matches what you'd get on Ethereum for the same seed.
2. **Fund the address** with testnet USDC through the Arc faucet.
3. **Send a transaction** and confirm it appears on the
   [block explorer](https://explorer.testnet.arc.io) within seconds.
4. **Verify the receipt** shows `status: 1` (success) with a single block
   confirmation.
5. **Test balance display** to ensure your platform shows the correct USDC
   amount (6 decimal places).

<Note>
  The same address and private key work on both Arc and Ethereum. If your
  platform already derives Ethereum addresses for a given seed, those same
  addresses are valid on Arc.
</Note>
