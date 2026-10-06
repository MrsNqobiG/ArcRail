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

# How to: Monitor Blocklist Compliance

> Handle Arc's USDC blocklist enforcement in your compliance monitoring, including Memo and Multicall3From contract attribution.

The USDC contract enforces blocklist restrictions at runtime. The Memo and
Multicall3From contracts route transactions while preserving the original
`msg.sender` through the CallFrom precompile; your monitoring must attribute
these to the original sender. Subscribe to `Blocklisted` and `UnBlocklisted`
events to maintain a local copy of the blocklist.

## Prerequisites

Before you begin:

* Access to an Arc RPC endpoint (`https://rpc.testnet.arc.io`) or WebSocket
  (`wss://rpc.testnet.arc.io`)
* Familiarity with Ethereum event log filtering and transaction tracing
* A local database or cache for storing blocklisted addresses
* Understanding of your regulatory obligations (AML/CFT screening requirements)

## Contracts and addresses

| Contract | Address | Purpose |
| - | - | - |
| USDC | `0x3600000000000000000000000000000000000000` | Native stablecoin with built-in blocklist |
| Memo | `0x5294E9927c3306DcBaDb03fe70b92e01cCede505` | Attaches metadata to transfers; preserves `msg.sender` |
| Multicall3From | `0x522fAf9A91c41c443c66765030741e4AaCe147D0` | Batches multiple calls; preserves `msg.sender` |

## Steps

### Step 1. Understand blocklist enforcement

Arc enforces the USDC blocklist across multiple stages of the transaction
lifecycle:

| Stage | When it applies | Behavior |
| - | - | - |
| Pre-mempool | Transaction submitted to RPC node | If the sender is blocklisted, the RPC node rejects the transaction. No gas is consumed and no receipt is returned. |
| Pre-execution | Transaction executes after entering mempool | If the sender became blocklisted between submission and execution, the transaction is rejected. No gas is consumed and no receipt is returned. |
| Runtime transfer check | `transfer` or `transferFrom` is called | If either the `from` or `to` address is blocklisted, the call reverts. |

### Step 2. Monitor blocklist events

Subscribe to the `Blocklisted` and `UnBlocklisted` events on the USDC contract
to maintain a real-time view of restricted addresses.

```typescript theme={null}
import { Contract, JsonRpcProvider } from "ethers";

const USDC_ADDRESS = "0x3600000000000000000000000000000000000000";
const provider = new JsonRpcProvider("https://rpc.testnet.arc.io");

const usdc = new Contract(
  USDC_ADDRESS,
  [
    "event Blocklisted(address indexed account)",
    "event UnBlocklisted(address indexed account)",
  ],
  provider,
);

// Subscribe to blocklist changes
usdc.on("Blocklisted", (account: string) => {
  console.log(`Address blocklisted: ${account}`);
  addToLocalBlocklist(account);
});

usdc.on("UnBlocklisted", (account: string) => {
  console.log(`Address unblocklisted: ${account}`);
  removeFromLocalBlocklist(account);
});
```

<Warning>
  Build transfer history from the system emitter
  (`0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE`), not the ERC-20 contract
  (`0x3600000000000000000000000000000000000000`). Native USDC transfers emit no
  log at the ERC-20 address, so filtering on the ERC-20 address alone misses
  them. An ERC-20 `transfer()` emits from both addresses, so filtering on both
  double-counts every ERC-20 transfer.
</Warning>

### Step 3. Include Memo and Multicall3From in your monitoring scope

The Memo and Multicall3From contracts use the CallFrom precompile to execute
calls on behalf of the original sender. The blocklist is still enforced (the
CallFrom precompile checks the original sender's blocklist status), but
compliance monitors must attribute activity correctly.

<Warning>
  If you only monitor direct `from` addresses in transaction receipts, you will
  miss the true sender for transactions routed through Memo or Multicall3From.
  You must inspect calls to these contracts and attribute them to the original
  `msg.sender`.
</Warning>

```typescript theme={null}
import { Interface, JsonRpcProvider, Log } from "ethers";

const MEMO_ADDRESS = "0x5294E9927c3306DcBaDb03fe70b92e01cCede505";
const MULTICALL3FROM_ADDRESS = "0x522fAf9A91c41c443c66765030741e4AaCe147D0";
const USDC_ADDRESS = "0x3600000000000000000000000000000000000000";
const SYSTEM_EMITTER = "0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE";
const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

const provider = new JsonRpcProvider("https://rpc.testnet.arc.io");
const erc20Interface = new Interface([
  "event Transfer(address indexed from, address indexed to, uint256 value)",
]);

async function checkTransactionCompliance(txHash: string): Promise<void> {
  const tx = await provider.getTransaction(txHash);
  if (!tx) return;

  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt) return;

  const originalSender = tx.from;

  // Flag if the transaction is routed through Memo or Multicall3From
  const isRoutedTransaction =
    tx.to?.toLowerCase() === MEMO_ADDRESS.toLowerCase() ||
    tx.to?.toLowerCase() === MULTICALL3FROM_ADDRESS.toLowerCase();

  if (isRoutedTransaction) {
    // Attribute all Transfer events in this transaction to the original sender
    const transfers = receipt.logs.filter(
      (log: Log) =>
        log.address.toLowerCase() === SYSTEM_EMITTER.toLowerCase() &&
        log.topics[0] === TRANSFER_TOPIC,
    );

    for (const log of transfers) {
      const parsed = erc20Interface.parseLog({
        topics: log.topics as string[],
        data: log.data,
      });
      if (!parsed) continue;

      // Screen the original sender, not the contract address
      await screenAddress(originalSender, txHash);
      await screenAddress(parsed.args.to as string, txHash);
    }
  }
}
```

### Step 4. Build a transaction decision tree

Use the following logic to determine whether a transaction involves a
blocklisted address:

| Check | Condition | Action |
| - | - | - |
| 1. Direct sender | `tx.from` is in blocklist | No action needed: rejected at pre-mempool and pre-execution stages before mining. |
| 2. Transfer recipient | `Transfer` event `to` is in blocklist | Flag: `transfer`/`transferFrom` will revert |
| 3. Routed transfer recipient | `tx.to` is Memo or Multicall3From AND any Transfer `to` is in blocklist | Flag: runtime transfer check will revert |

```typescript theme={null}
interface ComplianceResult {
  flagged: boolean;
  reason?: string;
}

async function evaluateTransaction(txHash: string): Promise<ComplianceResult> {
  const tx = await provider.getTransaction(txHash);
  if (!tx) return { flagged: false };

  // Check 1: Direct sender
  if (await isBlocklisted(tx.from)) {
    return { flagged: true, reason: "Sender is blocklisted" };
  }

  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt) return { flagged: false };

  // Check 2-5: Inspect Transfer events for blocklisted recipients
  const transfers = receipt.logs.filter(
    (log: Log) =>
      log.address.toLowerCase() === SYSTEM_EMITTER.toLowerCase() &&
      log.topics[0] === TRANSFER_TOPIC,
  );

  for (const log of transfers) {
    const parsed = erc20Interface.parseLog({
      topics: log.topics as string[],
      data: log.data,
    });
    if (!parsed) continue;

    const to = parsed.args.to as string;
    if (await isBlocklisted(to)) {
      return { flagged: true, reason: `Recipient ${to} is blocklisted` };
    }
  }

  return { flagged: false };
}
```

### Step 5. Integrate compliance vendor APIs

Connect your monitoring pipeline to Elliptic or TRM Labs for automated risk
scoring and sanctions screening. These vendors provide Arc-compatible APIs for
real-time transaction analysis.

```typescript theme={null}
// Example: screen an address against a compliance vendor API
async function screenAddress(
  address: string,
  txHash: string,
): Promise<boolean> {
  const response = await fetch(
    "https://api.your-compliance-vendor.com/screen",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.COMPLIANCE_API_KEY}`,
      },
      body: JSON.stringify({
        address,
        chain: "arc",
        transactionHash: txHash,
      }),
    },
  );

  const result = await response.json();
  return result.risk_level === "high";
}
```

For vendor-specific integration details, see
[Compliance vendors](/arc/tools/compliance-vendors).

When your own system submits a USDC transfer, also check `receipt.status` after
it confirms. A blocklist revert is onchain: the transaction is included and gas
is consumed, but state rolls back. Monitoring `Blocklisted` events won't catch
reverts that already occurred; `receipt.status === 0` is the authoritative
signal.

## See also

* [Compliance vendors](/arc/tools/compliance-vendors): Elliptic and TRM Labs
  integration details
* [Infrastructure overview](/integrate/infrastructure): Arc architectural
  differences relevant to compliance monitoring
