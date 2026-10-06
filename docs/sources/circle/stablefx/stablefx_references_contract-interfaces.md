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

# StableFX contract interfaces

> User-facing methods of the StableFX contract

The StableFX smart contract (`FxEscrow`) has a set of interfaces you can use to
execute trades either as a maker or a taker. This page describes the user-facing
methods of the StableFX contract.

## Contract address

The `FxEscrow` contract is deployed at the following addresses:

| Network | Address |
| - | - |
| Arc mainnet | [`0xe2E5F173576B513d994073CCbDaCBE027d43DFe6`](https://explorer.arc.io/address/0xe2E5F173576B513d994073CCbDaCBE027d43DFe6) |
| Arc testnet | [`0xd68256f4D69C6BbEcB873D8588AE0Dc6B8E22E10`](https://explorer.testnet.arc.io/address/0xd68256f4D69C6BbEcB873D8588AE0Dc6B8E22E10) |

## Interfaces

### `recordTrade`

Records a trade agreement onchain. Returns the contract ID of the trade.

```solidity theme={null}
function recordTrade(
  address taker,
  TraderDetails calldata takerDetails,
  bytes calldata takerSignature,
  address maker,
  TraderDetails calldata makerDetails,
  bytes calldata makerSignature
) external returns (uint256);
```

**Parameters**

| Name | Type | Description |
| - | - | - |
| `taker` | `address` | The address of the taker |
| `takerDetails` | `TraderDetails` | The details of the taker |
| `takerSignature` | `bytes` | The signature of the taker |
| `maker` | `address` | The address of the maker |
| `makerDetails` | `TraderDetails` | The details of the maker |
| `makerSignature` | `bytes` | The signature of the maker |

**Returns**

| Name | Type | Description |
| - | - | - |
| `id` | `uint256` | The contract ID of the trade |

### `takerDeliver`

Delivers quote currency for a single trade using `Permit2` on the taker side.

```solidity theme={null}
function takerDeliver(uint256 id, IPermit2.PermitTransferFrom memory permit, bytes calldata signature) external;
```

**Parameters**

| Name | Type | Description |
| - | - | - |
| `id` | `uint256` | The ID of the trade |
| `permit` | [`IPermit2.PermitTransferFrom`][permit] | The `Permit2`-compliant transfer permit |
| `signature` | `bytes` | The signature for the transfer permit |

[permit]: https://github.com/Uniswap/permit2/blob/cc56ad0f3439c502c246fc5cfcc3db92bb8b7219/src/interfaces/ISignatureTransfer.sol#L30

### `takerBatchDeliver`

Delivers quote currency for multiple trades using `Permit2` on the taker side.

```solidity theme={null}
function takerBatchDeliver(uint256[] calldata ids, IPermit2.PermitBatchTransferFrom memory permit, bytes calldata signature) external;
```

**Parameters**

| Name | Type | Description |
| - | - | - |
| `ids` | `uint256[]` | An array of trade IDs |
| `permit` | [`IPermit2.PermitBatchTransferFrom`][permit_batch] | The `Permit2`-compliant batch transfer permit |
| `signature` | `bytes` | The signature for the batch permit |

[permit_batch]: https://github.com/Uniswap/permit2/blob/cc56ad0f3439c502c246fc5cfcc3db92bb8b7219/src/interfaces/ISignatureTransfer.sol#L51

### `makerDeliver`

Delivers base currency for a single trade using `Permit2` on the maker side.

```solidity theme={null}
function makerDeliver(uint256 id, IPermit2.PermitTransferFrom memory permit, bytes calldata signature) external
```

**Parameters**

| Name | Type | Description |
| - | - | - |
| `id` | `uint256` | The ID of the trade |
| `permit` | [`IPermit2.PermitTransferFrom`][permit] | The `Permit2`-compliant transfer permit |
| `signature` | `bytes` | The signature for the transfer permit |

### `makerBatchDeliver`

Delivers base currency for multiple trades using `Permit2` on the maker side.

```solidity theme={null}
function makerBatchDeliver(uint256[] calldata ids, IPermit2.PermitBatchTransferFrom memory permit, bytes calldata signature) external;
```

**Parameters**

| Name | Type | Description |
| - | - | - |
| `ids` | `uint256[]` | An array of trade IDs |
| `permit` | [`IPermit2.PermitBatchTransferFrom`][permit_batch] | The `Permit2`-compliant batch transfer permit |
| `signature` | `bytes` | The signature for the batch permit |

### `makerNetDeliver`

Net settlement for multiple trades on the maker side.

```solidity theme={null}
function makerNetDeliver(uint256[] calldata ids, IPermit2.PermitBatchTransferFrom memory permit, bytes calldata signature) external
```

**Parameters**

| Name | Type | Description |
| - | - | - |
| `ids` | `uint256[]` | An array of trade IDs |
| `permit` | [`IPermit2.PermitBatchTransferFrom`][permit_batch] | The `Permit2`-compliant batch transfer permit |
| `signature` | `bytes` | The signature for the batch permit |

### `breach`

Marks a trade as breached after maturity.

```solidity theme={null}
function breach(uint256 id) external;
```

**Parameters**

| Name | Type | Description |
| - | - | - |
| `id` | `uint256` | The ID of the trade |

### `breach` (batch)

Marks multiple trades as breached after maturity.

```solidity theme={null}
function breach(uint256[] ids) external;
```

**Parameters**

| Name | Type | Description |
| - | - | - |
| `ids` | `uint256[]` | An array of trade IDs |

### `calculateMakerNet`

Calculate maker net token positions for batch operations. Returns an array of
Balance structs representing net positions.

```solidity theme={null}
function calculateMakerNet(address maker, uint256[] calldata ids) public view returns (Balance[] memory balances);
```

**Parameters**

| Name | Type | Description |
| - | - | - |
| `maker` | `address` | The address of the maker |
| `ids` | `uint256[]` | An array of trade IDs |

**Returns**

| Name | Type | Description |
| - | - | - |
| `balances` | `Balance[]` | An array of Balance structs representing net positions |
