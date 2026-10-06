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

# How to: Index Arc Events

> Configure your data indexer or block explorer to process Arc events, including unified USDC transfers, Memo events, blocklist changes, and CCTP messages.

Monitor the native USDC `Transfer` event from the system address `0xffff…fffe`
to capture every USDC transfer in one stream (Arc's EIP-7708 implementation).
Gas deductions don't emit Transfer events. Index the ERC-20 USDC contract, Memo,
blocklist, and CCTP events from their respective contracts for full transaction
coverage. Skip reorg-handling logic entirely; Arc's deterministic finality means
every block is permanent. Use block number (not timestamp) as your ordering key
because sub-second blocks can share the same `block.timestamp`.

## Prerequisites

Before you begin:

* Access to an Arc RPC endpoint (`https://rpc.testnet.arc.io`) or WebSocket
  (`wss://rpc.testnet.arc.io`)
* Familiarity with Ethereum JSON-RPC methods (`eth_getLogs`, `eth_subscribe`)
* A database or indexing pipeline that supports high-throughput block ingestion
* TypeScript environment with `ethers` or `viem` installed

## Steps

### Step 1. Connect to the block stream

Use `eth_subscribe("newHeads")` over WebSocket for real-time block
notifications. For historical back-fills, use `eth_getLogs` with
`fromBlock`/`toBlock` ranges.

```typescript theme={null}
import { WebSocketProvider, JsonRpcProvider } from "ethers";

// Real-time streaming
const wsProvider = new WebSocketProvider("wss://rpc.testnet.arc.io");

wsProvider.on("block", async (blockNumber: number) => {
  await indexBlock(blockNumber);
});

// Historical backfill
const httpProvider = new JsonRpcProvider("https://rpc.testnet.arc.io");

async function backfill(startBlock: number, endBlock: number): Promise<void> {
  const BATCH_SIZE = 1000;
  for (let from = startBlock; from <= endBlock; from += BATCH_SIZE) {
    const to = Math.min(from + BATCH_SIZE - 1, endBlock);
    const logs = await httpProvider.getLogs({ fromBlock: from, toBlock: to });
    await processLogs(logs);
  }
}
```

<Warning>
  Arc produces sub-second blocks. Your ingestion pipeline must handle bursts of
  many blocks per second without falling behind.
</Warning>

### Step 2. Index native USDC Transfer events (EIP-7708)

Every explicit USDC transfer emits a standard ERC-20 `Transfer` log from the
system address `0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE` (Arc's
[EIP-7708](https://eips.ethereum.org/EIPS/eip-7708) implementation). This stream
covers native sends, the native leg of ERC-20 transfers, and mint and burn, with
values in **18 decimals**. Gas deductions don't emit events. The `from` field in
this log is the actual token sender. For EIP-3009 relayer transactions,
`tx.from` is the relayer's address. Indexing it instead of the Transfer event's
`from` records the wrong sender.

The ERC-20 USDC contract at `0x3600…0000` also emits its own `Transfer` (6
decimals) for ERC-20-interface activity, so an ERC-20 `transfer()` produces a
log from both emitters. Distinguish them by emitter address and never count the
same movement twice. For the complete event matrix, the mint and burn mapping,
and the historical pre-Zero5 events, see
[USDC system events](/arc/references/usdc-system-events).

| Property | Value |
| - | - |
| Emitter | `0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE` |
| Event | `Transfer(address indexed from, address indexed to, uint256 value)` |
| topic0 | `0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef` |
| Decimals | 18 |

```typescript theme={null}
import { Interface, JsonRpcProvider, Log } from "ethers";

// Native USDC system emitter (EIP-7708 Transfer logs, 18 decimals)
const NATIVE_USDC_EMITTER = "0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE";
// ERC-20 USDC contract (emits its own 6-decimal Transfer and blocklist events)
const USDC_ADDRESS = "0x3600000000000000000000000000000000000000";
const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

const erc20Interface = new Interface([
  "event Transfer(address indexed from, address indexed to, uint256 value)",
]);

const provider = new JsonRpcProvider("https://rpc.testnet.arc.io");

async function indexUsdcTransfers(
  fromBlock: number,
  toBlock: number,
): Promise<void> {
  const logs = await provider.getLogs({
    address: NATIVE_USDC_EMITTER,
    topics: [TRANSFER_TOPIC],
    fromBlock,
    toBlock,
  });

  for (const log of logs) {
    const parsed = erc20Interface.parseLog({
      topics: log.topics as string[],
      data: log.data,
    });
    if (!parsed) continue;

    const from = parsed.args.from as string;
    const to = parsed.args.to as string;
    const value = parsed.args.value as bigint; // 18 decimals (native)

    await saveTransfer({
      blockNumber: log.blockNumber,
      txHash: log.transactionHash,
      logIndex: log.index,
      from,
      to,
      value,
    });
  }
}
```

<Note>
  Filtering the native system emitter (`0xffff…fffe`) captures all explicit USDC
  transfers in one stream: native sends, the native leg of ERC-20 transfers, and
  mint and burn. Gas deductions don't emit events. If you also index the ERC-20
  USDC contract (`0x3600…0000`) for its 6-decimal `Transfer` events, match on
  the emitter address so you do not count ERC-20 transfers twice.
</Note>

<Note>
  To backfill history across the Zero5 hard fork, read the historical
  `NativeCoin*` events from `0x1800…0000` for blocks before activation and
  `Transfer` from `0xffff…fffe` at and after it. See [USDC system
  events](/arc/references/usdc-system-events#historical-events-before-zero5) for
  signatures and the activation reference.
</Note>

### Step 3. Index EURC and other ERC-20 token transfers

EURC and other ERC-20 tokens emit standard `Transfer` events from their own
contract addresses. Index these separately from USDC.

| Token | Contract | Decimals |
| - | - | - |
| EURC | `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a` | 6 |

```typescript theme={null}
const EURC_ADDRESS = "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a";

async function indexEurcTransfers(
  fromBlock: number,
  toBlock: number,
): Promise<void> {
  const logs = await provider.getLogs({
    address: EURC_ADDRESS,
    topics: [TRANSFER_TOPIC],
    fromBlock,
    toBlock,
  });

  for (const log of logs) {
    const parsed = erc20Interface.parseLog({
      topics: log.topics as string[],
      data: log.data,
    });
    if (!parsed) continue;

    await saveTransfer({
      blockNumber: log.blockNumber,
      txHash: log.transactionHash,
      logIndex: log.index,
      from: parsed.args.from as string,
      to: parsed.args.to as string,
      value: parsed.args.value as bigint,
    });
  }
}
```

### Step 4. Index Memo contract events

The Memo contract lets an account attach an arbitrary memo to a forwarded call
(for example, a USDC transfer) for correlation and reconciliation. It executes
the call through the CallFrom precompile, preserving the original `msg.sender`,
and emits a `Memo` event with the metadata. Index `Memo` events to store memo
payloads alongside the calls they annotate.

<Note>The Memo contract is available on Arc testnet as of June 18, 2026.</Note>

| Property | Value |
| - | - |
| Contract | `0x5294E9927c3306DcBaDb03fe70b92e01cCede505` |
| Event | `Memo(address indexed sender, address indexed target, bytes32 callDataHash, bytes32 indexed memoId, bytes memo, uint256 memoIndex)` |

```typescript theme={null}
const MEMO_CONTRACT = "0x5294E9927c3306DcBaDb03fe70b92e01cCede505";

const memoInterface = new Interface([
  "event Memo(address indexed sender, address indexed target, bytes32 callDataHash, bytes32 indexed memoId, bytes memo, uint256 memoIndex)",
]);

async function indexMemoEvents(
  fromBlock: number,
  toBlock: number,
): Promise<void> {
  const logs = await provider.getLogs({
    address: MEMO_CONTRACT,
    fromBlock,
    toBlock,
  });

  for (const log of logs) {
    const parsed = memoInterface.parseLog({
      topics: log.topics as string[],
      data: log.data,
    });
    if (!parsed) continue; // skips the contract's BeforeMemo events

    const sender = parsed.args.sender as string; // original caller (msg.sender)
    const target = parsed.args.target as string; // contract the call was forwarded to
    const callDataHash = parsed.args.callDataHash as string; // hash of the forwarded calldata
    const memoId = parsed.args.memoId as string; // caller-supplied identifier (bytes32)
    const memoBytes = parsed.args.memo as string; // hex-encoded bytes
    const memoIndex = parsed.args.memoIndex as bigint; // sequential memo index

    // Decode the memo payload as UTF-8 text if applicable
    const memoText = Buffer.from(memoBytes.slice(2), "hex").toString("utf-8");

    await saveMemo({
      blockNumber: log.blockNumber,
      txHash: log.transactionHash,
      logIndex: log.index,
      sender,
      target,
      callDataHash,
      memoId,
      memo: memoText,
      memoIndex,
    });
  }
}
```

<Tip>
  Correlate `Memo` events with the `Transfer` (or other target-contract) events
  they annotate by matching on `transactionHash`, or use the caller-supplied
  `memoId`. To match a specific target call, compare `callDataHash` with the
  hash of the calldata your application submitted. The memo provides context
  (such as an invoice ID or payment reference) for the forwarded call.
</Tip>

### Step 5. Index blocklist events

The USDC contract emits `Blocklisted` and `UnBlocklisted` events when addresses
are added to or removed from the blocklist. Track these to maintain an accurate
set of restricted addresses.

| Event | Signature |
| - | - |
| Address blocked | `Blocklisted(address indexed account)` |
| Address unblocked | `UnBlocklisted(address indexed account)` |

```typescript theme={null}
const blocklistInterface = new Interface([
  "event Blocklisted(address indexed account)",
  "event UnBlocklisted(address indexed account)",
]);

const BLOCKLISTED_TOPIC = blocklistInterface.getEvent("Blocklisted")!.topicHash;
const UNBLOCKLISTED_TOPIC =
  blocklistInterface.getEvent("UnBlocklisted")!.topicHash;

async function indexBlocklistEvents(
  fromBlock: number,
  toBlock: number,
): Promise<void> {
  const logs = await provider.getLogs({
    address: USDC_ADDRESS,
    topics: [[BLOCKLISTED_TOPIC, UNBLOCKLISTED_TOPIC]],
    fromBlock,
    toBlock,
  });

  for (const log of logs) {
    const parsed = blocklistInterface.parseLog({
      topics: log.topics as string[],
      data: log.data,
    });
    if (!parsed) continue;

    const account = parsed.args.account as string;
    const isBlocked = parsed.name === "Blocklisted";

    await updateBlocklist({
      blockNumber: log.blockNumber,
      txHash: log.transactionHash,
      account,
      isBlocked,
    });
  }
}
```

### Step 6. Index CCTP crosschain events

The Cross-Chain Transfer Protocol (CCTP) uses two contracts on Arc:
`TokenMessengerV2` for outbound burns and `MessageTransmitterV2` for inbound
mints.

| Direction | Contract | Address | Event |
| - | - | - | - |
| Outbound (burn) | TokenMessengerV2 | `0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA` | `DepositForBurn` |
| Inbound (mint) | MessageTransmitterV2 | `0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275` | `MessageReceived` |

```typescript theme={null}
const TOKEN_MESSENGER = "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA";
const MESSAGE_TRANSMITTER = "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275";

const cctpInterface = new Interface([
  "event DepositForBurn(uint64 indexed nonce, address indexed burnToken, uint256 amount, address indexed depositor, bytes32 mintRecipient, uint32 destinationDomain, bytes32 destinationTokenMessenger, bytes32 destinationCaller)",
  "event MessageReceived(address indexed caller, uint32 sourceDomain, uint64 indexed nonce, bytes32 sender, bytes messageBody)",
]);

async function indexCctpEvents(
  fromBlock: number,
  toBlock: number,
): Promise<void> {
  // Index outbound burns
  const burnLogs = await provider.getLogs({
    address: TOKEN_MESSENGER,
    topics: [cctpInterface.getEvent("DepositForBurn")!.topicHash],
    fromBlock,
    toBlock,
  });

  for (const log of burnLogs) {
    const parsed = cctpInterface.parseLog({
      topics: log.topics as string[],
      data: log.data,
    });
    if (!parsed) continue;

    await saveCctpBurn({
      blockNumber: log.blockNumber,
      txHash: log.transactionHash,
      nonce: parsed.args.nonce,
      amount: parsed.args.amount,
      depositor: parsed.args.depositor,
      destinationDomain: parsed.args.destinationDomain,
    });
  }

  // Index inbound mints
  const mintLogs = await provider.getLogs({
    address: MESSAGE_TRANSMITTER,
    topics: [cctpInterface.getEvent("MessageReceived")!.topicHash],
    fromBlock,
    toBlock,
  });

  for (const log of mintLogs) {
    const parsed = cctpInterface.parseLog({
      topics: log.topics as string[],
      data: log.data,
    });
    if (!parsed) continue;

    await saveCctpMint({
      blockNumber: log.blockNumber,
      txHash: log.transactionHash,
      nonce: parsed.args.nonce,
      sourceDomain: parsed.args.sourceDomain,
    });
  }
}
```

### Step 7. Use block number as your ordering key

Multiple blocks can share the same `block.timestamp` because Arc produces
sub-second blocks that fall in the same wall-clock second. Always use
`blockNumber` (and `logIndex` in a block) as your canonical ordering key.

```typescript theme={null}
interface IndexedEvent {
  blockNumber: number; // Primary ordering key
  logIndex: number; // Secondary ordering key in a block
  txHash: string;
  // ... event-specific fields
}

// Correct: order by block number
function compareEvents(a: IndexedEvent, b: IndexedEvent): number {
  if (a.blockNumber !== b.blockNumber) {
    return a.blockNumber - b.blockNumber;
  }
  return a.logIndex - b.logIndex;
}
```

<Warning>
  Do not use `block.timestamp` for ordering. Two consecutive blocks (for
  example, block 100 and block 101) may both have `timestamp = 1700000000`.
  Sorting by timestamp produces ambiguous ordering.
</Warning>

### Step 8. Simplify your pipeline—no reorg handling required

Arc provides [deterministic finality](/arc/concepts/deterministic-finality).
Once a block appears, it is permanent. You can remove the following from your
indexing pipeline:

* Reorg detection and rollback logic
* Confirmation-depth delays (no need to wait for N confirmations)
* Uncle/ommer block handling
* Chain reorganization event listeners

```typescript theme={null}
// No need for confirmation buffers or reorg watchers.
// Process each block exactly once as it arrives.
async function indexBlock(blockNumber: number): Promise<void> {
  // This block is final—it will never be reverted.
  await indexUsdcTransfers(blockNumber, blockNumber);
  await indexEurcTransfers(blockNumber, blockNumber);
  await indexMemoEvents(blockNumber, blockNumber);
  await indexBlocklistEvents(blockNumber, blockNumber);
  await indexCctpEvents(blockNumber, blockNumber);

  await markBlockProcessed(blockNumber);
}
```

<Note>
  If your indexer restarts, resume from the last processed block number. You do
  not need to re-validate previously indexed blocks because they cannot be
  reverted.
</Note>

## Event reference

| Contract | Address | Events |
| - | - | - |
| Native USDC (system) | `0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE` | `Transfer` (18 decimals, EIP-7708) |
| USDC (ERC-20) | `0x3600000000000000000000000000000000000000` | `Transfer` (6 decimals), `Blocklisted`, `UnBlocklisted` |
| EURC | `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a` | `Transfer` |
| Memo | `0x5294E9927c3306DcBaDb03fe70b92e01cCede505` | `Memo` |
| TokenMessengerV2 | `0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA` | `DepositForBurn` |
| MessageTransmitterV2 | `0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275` | `MessageReceived` |

## See also

* [USDC system events](/arc/references/usdc-system-events)—full event matrix,
  emitter addresses, decimals, and historical pre-Zero5 events
* [Infrastructure overview](/integrate/infrastructure)—key differences from
  Ethereum and chain metadata
* [Deterministic finality](/arc/concepts/deterministic-finality)—why reorgs
  never occur on Arc
* [Detect and process deposits](/integrate/exchanges/deposits)—exchange-specific
  deposit workflow
