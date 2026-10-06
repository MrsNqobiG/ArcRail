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

# EVM differences

> Arc's protocol-level differences from Ethereum: USDC as native gas, value transfer rules, SELFDESTRUCT semantics, EIP-7708 Transfer events, the fee market, and opcode behavior.

Arc is an EVM-compatible Layer-1 blockchain. Solidity, Foundry, Hardhat, Viem,
ethers.js, and standard Ethereum wallets work without modification, and you can
deploy existing contracts unchanged in most cases. Arc targets the **Osaka**
hard fork as its baseline, including features such as EIP-7702 (set-code
transactions). Arc also ships select features from Ethereum's upcoming
**Amsterdam** hard fork ahead of upstream, notably
[EIP-7708](https://eips.ethereum.org/EIPS/eip-7708) (standard `Transfer` logs
for native value movements).

All comparisons are against Ethereum at the **Osaka** hard fork, Arc's baseline.
Most differences are transparent to application code, but a few change execution
semantics in ways that matter when you port a contract. If you are porting an
existing contract, start with the
[Porting contracts to Arc checklist](/arc/tutorials/porting-contracts-to-arc).

<Note>
  Tools that locally simulate the EVM (such as Foundry's `anvil`) run a standard
  EVM, not Arc's, and can't reproduce Arc-specific behavior. Use [Arc
  Foundry](https://github.com/circlefin/arc-foundry)'s `arc-anvil --network arc`
  instead. See [Install Arc Foundry](/arc/tutorials/install-arc-foundry).
</Note>

## Integration guidance

The following guides translate Arc's protocol-level differences into practical
guidance for specific integration types:

<CardGroup cols={2}>
  <Card title="Wallets" icon="wallet" href="/integrate/wallets">
    Balance display, transaction history, and USDC fee handling.
  </Card>

  <Card title="Exchanges and CEXs" icon="building-columns" href="/integrate/exchanges">
    Deposit detection, withdrawal processing, and CCTP-based liquidity
    management.
  </Card>

  <Card title="On/off-ramp platforms" icon="money-bill-transfer" href="/integrate/on-off-ramps">
    Single-asset USDC configuration, deposit detection, and instant settlement
    for fiat ramp providers.
  </Card>

  <Card title="DeFi and protocol operators" icon="arrows-rotate" href="/integrate/defi">
    USDC pool implementation, decimal handling in pool math, and contract
    porting.
  </Card>

  <Card title="Indexers and block explorers" icon="database" href="/integrate/infrastructure/indexing-events">
    Indexing EIP-7708 Transfer events and avoiding double-counting from two
    emitter addresses.
  </Card>

  <Card title="Relayers and paymasters" icon="bolt" href="/integrate/relayers-and-paymasters">
    USDC-denominated gas infrastructure and decimal precision in fee
    calculation.
  </Card>
</CardGroup>

## USDC as the native gas token

Arc's native token is USDC, not ETH. USDC on Arc has two interfaces that share
one balance: a native interface (18 decimals) and an ERC-20 interface (6
decimals), so no WETH-style wrapper is needed. To display a native value as
USDC, divide by 10¹². Don't use the 6-decimal value when crediting or recording
balances; truncation at the 6-decimal boundary records less than was
transferred. A zero `balanceOf` doesn't mean the native balance is zero. The
ERC-20 view truncates sub-USDC fractional amounts, and the USDC remains onchain.

For the full model, including the two-interface table, truncation behavior,
EURC, and USYC support, see
[Stablecoin native model](/arc/concepts/stablecoin-native-model). For how
balance changes surface as events, see
[USDC system events](/arc/references/usdc-system-events).

## Execution and opcode differences

| Behavior | Ethereum (Osaka) | Arc | Developer impact |
| :- | :- | :- | :- |
| `PREVRANDAO` | Beacon chain RANDAO mix | Always returns `0` | No onchain randomness. Use an oracle or verifiable random function (VRF). |
| `SELFDESTRUCT` | EIP-6780 semantics | EIP-6780 plus native value rules; emits a `Transfer` log on success (see [SELFDESTRUCT](#selfdestruct)) | Several patterns that succeed on mainnet revert on Arc. |
| Non-zero-value `CALL` to a self-destructed account | Succeeds; value credited | **Reverts** (a transfer to a destructed account is a forbidden burn) | The largest semantic departure. See [SELFDESTRUCT](#selfdestruct). |
| `parentBeaconBlockRoot` / EIP-4788 | Beacon-roots contract returns the parent beacon root | Set to the parent execution block hash; the beacon-roots contract is omitted, so reads return empty (`0x`) | Don't treat the beacon-roots oracle as functional or as a randomness source. |
| Blob transactions (EIP-4844, type-3) | Supported | Not supported; the mempool rejects type-3 transactions | Don't submit blob transactions. `BLOBHASH` returns `0` and `BLOBBASEFEE` returns `1`. |
| Withdrawals (EIP-4895) | May be present | Always empty | `block.withdrawals` is always empty. |

[EIP-7702](https://eips.ethereum.org/EIPS/eip-7702) set-code transactions,
`CREATE2` (including EIP-7610 residual-storage behavior), and EIP-2935
historical block hashes all behave as on Ethereum. In particular, the EIP-2935
block-hash-history contract is deployed and functional, unlike the EIP-4788
beacon-roots contract noted in the table.

To check an existing contract before deploying it to Arc, see
[Porting contracts to Arc](/arc/tutorials/porting-contracts-to-arc).

## Value transfer rules

Because the native token is USDC, value transfers are subject to rules that
don't exist on a standard EVM chain. A native transfer can **revert even when
the sender has sufficient balance**.

* **Transfers to the zero address are forbidden.** A value-bearing transfer to
  `0x0` reverts with `"Zero address not allowed"`; a zero-value transfer to
  `0x0` succeeds. (Mint and burn, the only operations that involve `0x0`, go
  through the native-coin precompile.)
* **Burning is forbidden.** Self-destructing to yourself with a balance, or
  transferring value to an account that has already self-destructed, reverts.
* **The blocklist is enforced at runtime.** A value transfer to or from a
  blocklisted address reverts. An included transaction that reverts on a
  blocklist check still consumes gas.
* **Sending native value to a contract isn't guaranteed to succeed.** A call to
  a contract that forwards native value can revert for any of the reasons listed
  here, which breaks a common DeFi assumption.
* **Sending to an address with no code (`EXTCODESIZE == 0`) succeeds** and emits
  a `Transfer` log. Sending value to a precompile address reverts.

<Warning>
  A liquidity pool that pairs native USDC against the ERC-20 USDC interface (as
  if they were two assets) is meaningless on Arc, because they are one asset.
  Don't mix `msg.value` with `USDC.balanceOf()` in pool or LTV math: they use
  different decimals (18 vs 6) and raw values are off by 10¹².
</Warning>

## `SELFDESTRUCT`

`SELFDESTRUCT` is allowed on Arc, including during contract deployment, and
follows [EIP-6780](https://eips.ethereum.org/EIPS/eip-6780) (the account is
fully deleted only if it was created in the same transaction). A self-destruct
**reverts** when its value transfer would violate a native value rule:

| Condition | Result |
| :- | :- |
| Beneficiary is the contract itself, with a balance | Reverts |
| Beneficiary is the zero address, with a balance | Reverts |
| Source or beneficiary is blocklisted | Reverts |
| Beneficiary has already self-destructed, with a balance | Reverts |
| Balance is zero (any beneficiary) | Succeeds |

Three behaviors differ from every other EVM chain and deserve attention:

**1. Self-destructing a contract that holds USDC moves that USDC out.** On Arc a
contract's USDC is its native balance, held in the account, so `SELFDESTRUCT`
transfers it to the beneficiary. On other chains the contract's ERC-20 USDC
balance lives in the token contract and is unaffected by self-destruct.

**2. A non-zero-value call to a self-destructed account reverts.** On Ethereum,
sending value to an address that self-destructed earlier in the same transaction
succeeds. On Arc it is treated as a transfer to a destructed account, a
forbidden burn, and reverts.

```solidity theme={null}
// Within one transaction:
contractA.selfDestruct(payable(b)); // succeeds; emits Transfer(A, B)

// Later in the same transaction, any non-zero-value send to A:
(bool ok, ) = address(contractA).call{value: 1}(""); // reverts on Arc
```

**3. A successful self-destruct that moves a balance emits a `Transfer` log.**
Unlike Ethereum, the moved native value is recorded as an
[EIP-7708](https://eips.ethereum.org/EIPS/eip-7708) `Transfer` log from the
system emitter (18 decimals). Index it like any other native movement; see
[USDC system events](/arc/references/usdc-system-events).

To check an existing contract's `SELFDESTRUCT` usage before deploying to Arc,
see [Porting contracts to Arc](/arc/tutorials/porting-contracts-to-arc).

## Native USDC Transfer events (EIP-7708)

On a standard EVM chain, a plain native send emits no log. Arc's
[EIP-7708](https://eips.ethereum.org/EIPS/eip-7708) implementation emits a
standard ERC-20 `Transfer` log from a system address for native sends, contract
endowments, self-destruct transfers, and precompile-backed operations. Gas
deductions don't emit a log; derive gas cost from the transaction receipt. For
emitter addresses, the log format, and indexing guidance, see
[USDC system events](/arc/references/usdc-system-events).

## Fee market and block behavior

Arc's fee market and block behavior differ from Ethereum in ways that affect
cost estimation, event ordering, and confirmation logic:

* **The base fee is paid to the block beneficiary, not burned.** See
  [Stable fee design](/arc/concepts/stable-fee-design).
* **The next block's base fee is in the parent header's `extra_data`.** See
  [Gas and fees](/arc/references/gas-and-fees).
* **The minimum base fee is 20 Gwei.** Transactions with `maxFeePerGas` lower
  than 20 Gwei are silently dropped by the mempool. They produce no error
  receipt and never appear in a block. Set `maxFeePerGas` to at least 20 Gwei
  before submitting any transaction to Arc.
* **Block timestamps are non-decreasing, not strictly increasing.** Timestamps
  come from the proposer's wall clock at one-second granularity, so sub-second
  blocks may share a timestamp. Use the block number for ordering, and don't
  assume `block.timestamp` strictly increases between blocks.
* **Finality is deterministic and instant.** Transactions finalize on inclusion;
  offchain systems can act after a single confirmation. See
  [Deterministic finality](/arc/concepts/deterministic-finality).
