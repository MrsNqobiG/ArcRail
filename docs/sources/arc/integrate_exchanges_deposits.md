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

# How-to: Detect and process deposits

> Implement deposit detection on Arc by monitoring native USDC Transfer events from the system emitter, confirming with deterministic finality, and sweeping funds.

Detect USDC deposits on Arc by generating addresses, monitoring the native USDC
`Transfer` event from the system emitter `0xffff…fffe` (Arc's
[EIP-7708](https://eips.ethereum.org/EIPS/eip-7708) implementation), crediting
after a single block confirmation (deterministic finality guarantees no reorgs),
and sweeping funds into a hot wallet.

## Prerequisites

Before you begin, ensure that you've:

* Obtained access to an Arc RPC endpoint (`https://rpc.testnet.arc.io`) or
  WebSocket (`wss://rpc.testnet.arc.io`)
* Installed an HD wallet library for generating deposit addresses (for example,
  `ethers` or `viem`)
* Familiarized yourself with Ethereum JSON-RPC methods and event log filtering
* Set up a database to track processed deposits and prevent double-crediting

## Steps

### Step 1. Generate deposit addresses

Arc uses standard Ethereum addresses (0x-prefixed, 20 bytes, EIP-55 checksum).
Derive deposit addresses using the same HD wallet approach as Ethereum—one
unique address per user.

```typescript theme={null}
import { HDNodeWallet, Mnemonic } from "ethers";

// Derive a deposit address for a given user index
function getDepositAddress(mnemonic: string, userIndex: number): string {
  const hdNode = HDNodeWallet.fromMnemonic(
    Mnemonic.fromPhrase(mnemonic),
    `m/44'/60'/0'/0/${userIndex}`,
  );
  return hdNode.address;
}
```

Store the mapping between user IDs and their derived address index. Never expose
the mnemonic or private keys in client-side code.

### Step 2. Subscribe to new blocks

Use `eth_subscribe("newHeads")` over WebSocket for real-time block
notifications, or poll `eth_blockNumber` over HTTP as a fallback.

```typescript theme={null}
import { WebSocketProvider, JsonRpcProvider } from "ethers";

// Option A: WebSocket subscription (recommended)
const wsProvider = new WebSocketProvider("wss://rpc.testnet.arc.io");

wsProvider.on("block", async (blockNumber: number) => {
  console.log(`New block: ${blockNumber}`);
  await processBlock(blockNumber);
});

// Option B: HTTP polling fallback
const httpProvider = new JsonRpcProvider("https://rpc.testnet.arc.io");

let lastProcessedBlock = await httpProvider.getBlockNumber();

setInterval(async () => {
  const currentBlock = await httpProvider.getBlockNumber();
  for (let block = lastProcessedBlock + 1; block <= currentBlock; block++) {
    await processBlock(block);
  }
  lastProcessedBlock = currentBlock;
}, 2000);
```

### Step 3. Detect incoming transfers with the native USDC Transfer event

Every native USDC movement emits a standard ERC-20 `Transfer` log from the
system address `0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE` (Arc's
[EIP-7708](https://eips.ethereum.org/EIPS/eip-7708) implementation). This single
stream covers plain native sends and the native leg of ERC-20 transfers, with
values in **18 decimals**. Filter it to catch every deposit, including native
sends that emit no event on the ERC-20 contract.

<Warning>
  Do not filter the ERC-20 USDC contract (`0x3600…0000`) for deposit detection.
  Its `Transfer` events cover only ERC-20-interface activity, so a plain native
  send produces no log there and the deposit is missed. Filter the system
  emitter (`0xffff…fffe`) instead. See [USDC system
  events](/arc/references/usdc-system-events) for the full event matrix.
</Warning>

**Event signature:**

```solidity theme={null}
Transfer(address indexed from, address indexed to, uint256 value)
```

**Topic0:** `0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef`

**Native USDC system emitter:** `0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE`

Use `eth_getLogs` to filter for transfers to your deposit addresses:

```typescript theme={null}
import { Interface, Log, JsonRpcProvider } from "ethers";

// Native USDC system emitter (EIP-7708 Transfer logs, 18 decimals)
const NATIVE_USDC_EMITTER = "0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE";
const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

const provider = new JsonRpcProvider("https://rpc.testnet.arc.io");
const erc20Interface = new Interface([
  "event Transfer(address indexed from, address indexed to, uint256 value)",
]);

async function processBlock(blockNumber: number): Promise<void> {
  const logs = await provider.getLogs({
    address: NATIVE_USDC_EMITTER,
    topics: [
      TRANSFER_TOPIC,
      null, // any sender
      null, // any recipient—filter client-side for your addresses
    ],
    fromBlock: blockNumber,
    toBlock: blockNumber,
  });

  for (const log of logs) {
    const parsed = erc20Interface.parseLog({
      topics: log.topics as string[],
      data: log.data,
    });

    if (!parsed) continue;

    const to = parsed.args.to as string;
    const value = parsed.args.value as bigint; // 18 decimals (native)

    // Check if the recipient is one of your deposit addresses
    if (isDepositAddress(to)) {
      await creditDeposit({
        txHash: log.transactionHash,
        logIndex: log.index,
        to,
        amount: value, // 18-decimal native USDC
        blockNumber,
      });
    }
  }
}
```

<Warning>
  Do not credit the same deposit twice. An ERC-20 `transfer()` emits a log from
  both the system emitter (`0xffff…fffe`, 18 decimals) and the ERC-20 contract
  (`0x3600…0000`, 6 decimals); filter only the system emitter. Likewise, do not
  reconcile `eth_getBalance` against Transfer events—they represent the same
  balance.
</Warning>

### Step 4. Confirm the deposit

Arc provides deterministic finality—once a transaction is included in a block,
it is final with no possibility of reorg. You can safely credit deposits after 1
confirmation.

```typescript theme={null}
import { JsonRpcProvider } from "ethers";

const provider = new JsonRpcProvider("https://rpc.testnet.arc.io");

async function isConfirmed(txHash: string): Promise<boolean> {
  const receipt = await provider.getTransactionReceipt(txHash);

  if (!receipt || receipt.status === 0) {
    return false; // Transaction failed or not yet mined
  }

  // On Arc, 1 confirmation = final. No reorgs possible.
  const currentBlock = await provider.getBlockNumber();
  return currentBlock >= receipt.blockNumber;
}
```

Since Arc has deterministic finality, you do not need to wait for multiple
confirmations. Credit the user once the block containing their transaction is
produced.

### Step 5. Credit deposits at full precision

The native system `Transfer` event emits values in 18-decimal native USDC. Store
and credit the raw 18-decimal value. Don't truncate to 6-decimal ERC-20 units:
amounts smaller than 1×10⁻⁶ USDC are valid and spendable as gas. Truncating them
to 6-decimal ERC-20 units under-credits the user's balance.

```typescript theme={null}
// Credit the raw 18-decimal value — no conversion needed
async function creditDeposit(deposit: {
  txHash: string;
  logIndex: number;
  to: string;
  amount: bigint; // 18-decimal native USDC
  blockNumber: bigint;
}): Promise<void> {
  // Store amount as 18-decimal native USDC
  await db.insert({ ...deposit });
}
```

<Warning>
  The native system `Transfer` event and `eth_getBalance` use 18 decimals. The
  ERC-20 contract's `Transfer` and `balanceOf` use 6. Don't convert 18-decimal
  deposit amounts to 6-decimal before crediting. Amounts smaller than 1×10⁻⁶
  USDC are under-credited if truncated.
</Warning>

### Step 6. Sweep deposits to a hot wallet

Consolidate deposited funds from individual user addresses into your hot wallet.
Use EIP-1559 transactions with Arc's minimum base fee of 20 Gwei.

```typescript theme={null}
import { Wallet, JsonRpcProvider, parseUnits } from "ethers";

const provider = new JsonRpcProvider("https://rpc.testnet.arc.io");

async function sweepDeposit(
  depositPrivateKey: string,
  hotWalletAddress: string,
  amount: bigint,
): Promise<string> {
  const wallet = new Wallet(depositPrivateKey, provider);

  const feeData = await provider.getFeeData();
  const maxFeePerGas = feeData.maxFeePerGas ?? parseUnits("30", "gwei");
  const maxPriorityFeePerGas =
    feeData.maxPriorityFeePerGas ?? parseUnits("1", "gwei");

  // Approximately 21,000 gas units for a native USDC send
  const gasLimit = 65_000n;

  const tx = await wallet.sendTransaction({
    to: hotWalletAddress,
    value: amount, // 18-decimal native USDC
    type: 2, // EIP-1559
    maxFeePerGas,
    maxPriorityFeePerGas,
    gasLimit,
  });

  const receipt = await tx.wait();
  return receipt!.hash;
}
```

## Common mistakes

* **Filtering the wrong emitter:** Plain native USDC sends emit no `Transfer` on
  the ERC-20 contract (`0x3600…0000`). Filter the system emitter (`0xffff…fffe`)
  so you do not miss native deposits.
* **Double-counting:** An ERC-20 `transfer()` logs from both emitters. Filter
  only the system emitter, and do not reconcile `eth_getBalance` against
  Transfer events for the same address.
* **Decimal mismatch:** The system emitter's values use 18 decimals. Store and
  credit them as 18-decimal native USDC. Converting to 6-decimal before
  crediting truncates sub-6-decimal amounts, resulting in under-crediting.
* **Waiting for multiple confirmations:** Arc has deterministic finality.
  Waiting for 6+ confirmations adds unnecessary latency with no security
  benefit.
* **Hardcoded keys:** Never embed private keys in source code. Use environment
  variables or a secrets manager for sweep wallet credentials.
* **Using `tx.from` for attribution:** For EIP-3009 relayer-submitted deposits,
  `tx.from` is the relayer's address. Crediting from it assigns the deposit to
  the relayer, not the depositor. Read the `from` field from the system
  emitter's `Transfer` event instead.

<Warning>
  Check `receipt.status === 0` in any send or sweep flow. A transfer to or from
  a blocklisted address reverts at runtime: the transaction is included in the
  block and gas is consumed, but state changes roll back.
</Warning>

* **Fee floor:** Transactions with `maxFeePerGas` lower than 20 Gwei are
  rejected with no error receipt and never appear in a block. Set `maxFeePerGas`
  to at least 20 Gwei when building sweep transactions.
