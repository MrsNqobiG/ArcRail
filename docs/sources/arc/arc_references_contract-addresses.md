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

# Contract addresses

> Arc mainnet and testnet contract addresses for USDC, EURC, USYC, cirBTC, WETH, CCTP, CrossChainTokenService, Gateway, StableFX, transaction extensions, ERC-8004, and common Ethereum contracts.

## Stablecoins

Stablecoins are the foundation of the Arc ecosystem, supporting a growing set of
fiat-backed and yield-bearing tokens. These assets provide price stability,
onchain yield, and multi-currency support for payments, FX, and financial
applications. The ERC-20 functions affect native balance movements.

### USDC

USDC is the native EVM asset on Arc and is used for gas fees. An optional ERC-20
interface is also available for developers who need features such as
`transferFrom`, `approve`, and allowance management. On other EVM blockchains,
protocols typically deploy a WETH-style wrapper to give the native asset an
ERC-20 interface; on Arc that step is unnecessary because the native USDC token
already satisfies `IERC20` directly. There is no wrapped USDC address on Arc.
See [Stablecoin native model](/arc/concepts/stablecoin-native-model) for details
on how the native and ERC-20 interfaces share the same underlying balance.

<Tabs>
  <Tab title="Mainnet">
    | Contract | Address | Notes |
    | :- | :- | :- |
    | **USDC** | [`0x3600000000000000000000000000000000000000`](https://explorer.arc.io/address/0x3600000000000000000000000000000000000000) | Optional ERC-20 interface for interacting with the native USDC balance. Uses 6 decimals. |
  </Tab>

  <Tab title="Testnet">
    | Contract | Address | Notes |
    | :- | :- | :- |
    | **USDC** | [`0x3600000000000000000000000000000000000000`](https://explorer.testnet.arc.io/address/0x3600000000000000000000000000000000000000) | Optional ERC-20 interface for interacting with the native USDC balance. Uses 6 decimals. |

    <Info>
      **Getting testnet USDC:** You can request USDC on Arc Testnet from the
      [Circle Faucet](https://faucet.circle.com/). USDC is required to pay for gas and
      interact with contracts on Arc.

      **Note:** As with any ERC-20 token, always use the `decimals()` function to
      interpret balances and transfer amounts accurately. On Arc, the **native USDC
      gas token** uses 18 decimals of precision, while the **USDC ERC-20 interface**
      uses 6 decimals. Avoid mixing these values directly, as doing so may result in
      incorrect balance handling. For applications integrating USDC, it's recommended
      to rely solely on the standard ERC-20 interface for reading balances and sending
      transfers.
    </Info>
  </Tab>
</Tabs>

### EURC

EURC is the euro-denominated stablecoin issued by Circle and supported natively
on Arc for use in payments, FX, and other financial applications.

<Tabs>
  <Tab title="Mainnet">
    | Contract | Address | Notes |
    | :- | :- | :- |
    | **EURC** | [`0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1`](https://explorer.arc.io/address/0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1) | Main EURC token contract. Uses 6 decimals. |
  </Tab>

  <Tab title="Testnet">
    | Contract | Address | Notes |
    | :- | :- | :- |
    | **EURC** | [`0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a`](https://explorer.testnet.arc.io/address/0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a) | Main EURC token contract. Uses 6 decimals. |

    <Info>
      **Getting testnet EURC:** Testnet EURC can be requested from the [Circle
      Faucet](https://faucet.circle.com/). Select **Arc Testnet** as the network and
      **EURC** as the token to receive a small test allocation.
    </Info>
  </Tab>
</Tabs>

### USYC

[USYC](https://developers.circle.com/tokenized/usyc/overview) is a yield-bearing
token issued by Circle International Bermuda Ltd. and supported on Arc for
institutional and DeFi use cases. It represents shares of a tokenized money
market fund backed by short-duration U.S. Treasury securities, offering onchain
access to regulated, low-risk yield.

<Note>
  USYC is only accessible to institutions outside the United States, subject to
  eligibility restrictions and a \$100,000 USD minimum investment. See
  [USYC Document Certification Requirements](https://help.circle.com/s/article/Document-certification-requirements-for-USYC-onboarding?language=en_US\&category=USYC)
  for more information.
</Note>

<Tabs>
  <Tab title="Mainnet">
    | Contract | Address | Notes |
    | :- | :- | :- |
    | **USYC** | [`0x8a5D989Bbb96929F689B0200f435f53dA42bF490`](https://explorer.arc.io/address/0x8a5D989Bbb96929F689B0200f435f53dA42bF490) | The main USYC token contract representing tokenized money market fund shares. Uses 6 decimals. |
    | **Entitlements** | [`0xb69ecb156Dc0028198028c501340d5367845ca72`](https://explorer.arc.io/address/0xb69ecb156Dc0028198028c501340d5367845ca72) | Manages allowlisted access and entitlement controls for permissioned addresses on Arc. |
    | **Teller** | [`0x51A8CE47dC08ba5CD19c7aa84EA6fD6664f60f9b`](https://explorer.arc.io/address/0x51A8CE47dC08ba5CD19c7aa84EA6fD6664f60f9b) | Contract used to mint and redeem USYC from USDC once your wallet is allowlisted. |
  </Tab>

  <Tab title="Testnet">
    | Contract | Address | Notes |
    | :- | :- | :- |
    | **USYC** | [`0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C`](https://explorer.testnet.arc.io/address/0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C) | The main USYC token contract representing tokenized money market fund shares. Uses 6 decimals. |
    | **Entitlements** | [`0xcc205224862c7641930c87679e98999d23c26113`](https://explorer.testnet.arc.io/address/0xcc205224862c7641930c87679e98999d23c26113) | Manages allowlisted access and entitlement controls for permissioned addresses on Arc Testnet. |
    | **Teller** | [`0x9fdF14c5B14173D74C08Af27AebFf39240dC105A`](https://explorer.testnet.arc.io/address/0x9fdF14c5B14173D74C08Af27AebFf39240dC105A) | Contract used to mint and redeem testnet USYC from testnet USDC once your wallet is allowlisted. |

    <Info>
      **Getting testnet USYC:**

      1. Obtain testnet USDC from the [Circle Faucet](https://faucet.circle.com/).
      2. Request allowlisting by opening a ticket with
         [Circle Support](https://support.circle.com/) and include your Arc Testnet
         wallet address. Requests are typically processed in 24–48 hours.
      3. Once approved, call the USYC Teller contract or interact with the
         [USYC Portal](https://usyc.dev.hashnote.com/) to deposit testnet USDC and
         receive testnet USYC.

      For more information on issuance, redemption, and eligibility, see
      [USYC Overview](https://developers.circle.com/tokenized/usyc/overview).
    </Info>
  </Tab>
</Tabs>

## Wrapped assets

Wrapped assets are ERC-20 tokens that represent non-native assets bridged onto
Arc. Each token is backed one-to-one by the corresponding asset held on its
origin blockchain.

### cirBTC

cirBTC is Circle's wrapped Bitcoin token on Arc. It uses the same
`FiatTokenProxy` architecture as USDC and EURC and uses 8 decimals to match
Bitcoin's native precision.

<Tabs>
  <Tab title="Mainnet">
    | Contract | Address | Notes |
    | :- | :- | :- |
    | **cirBTC** | [`0x171A4217b86A807A64eB94757Db6849fb4bDbAA0`](https://explorer.arc.io/address/0x171A4217b86A807A64eB94757Db6849fb4bDbAA0) | Circle wrapped Bitcoin. Uses 8 decimals. |
  </Tab>

  <Tab title="Testnet">
    | Contract | Address | Notes |
    | :- | :- | :- |
    | **cirBTC** | [`0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF`](https://explorer.testnet.arc.io/address/0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF) | Circle wrapped Bitcoin. Uses 8 decimals. |
  </Tab>
</Tabs>

### WETH

WETH on Arc is a bridged ERC-20 token. It is minted on Arc when ETH or WETH is
locked on Ethereum, and uses 18 decimals.

<Tabs>
  <Tab title="Mainnet">
    | Contract | Address | Notes |
    | :- | :- | :- |
    | **WETH** | [`0x128cC466B61f542da60c70e3aA11c10e19B84EDB`](https://explorer.arc.io/address/0x128cC466B61f542da60c70e3aA11c10e19B84EDB) | Bridged WETH (lock on Ethereum, mint on Arc). Uses 18 decimals. |
  </Tab>

  <Tab title="Testnet">
    | Contract | Address | Notes |
    | :- | :- | :- |
    | **WETH** | [`0x2c4047028a72803939b6fb674D01bC059B5C4961`](https://explorer.testnet.arc.io/address/0x2c4047028a72803939b6fb674D01bC059B5C4961) | Bridged WETH (lock on Ethereum, mint on Arc). Uses 18 decimals. |
  </Tab>
</Tabs>

## Crosschain

The following contracts enable crosschain interoperability between Arc and other
blockchains through Circle's
[Cross-Chain Transfer Protocol](https://developers.circle.com/cctp) (CCTP) and
[Gateway](https://developers.circle.com/gateway). CCTP handles crosschain
message passing and stablecoin transfers, while Gateway provides
chain-abstracted USDC balances for seamless liquidity movement.

### CCTP

<Tabs>
  <Tab title="Mainnet">
    | Contract | Domain | Address |
    | :- | :- | :- |
    | **TokenMessengerV2** | 26 | [`0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d`](https://explorer.arc.io/address/0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d) |
    | **TokenMessengerWithFees** | 26 | [`0x71f54F818671cD0D7ea140Da213e5C8b5C92a408`](https://explorer.arc.io/address/0x71f54F818671cD0D7ea140Da213e5C8b5C92a408) |
    | **MessageTransmitterV2** | 26 | [`0x81D40F21F12A8F0E3252Bccb954D722d4c464B64`](https://explorer.arc.io/address/0x81D40F21F12A8F0E3252Bccb954D722d4c464B64) |
    | **TokenMinterV2** | 26 | [`0xfd78EE919681417d192449715b2594ab58f5D002`](https://explorer.arc.io/address/0xfd78EE919681417d192449715b2594ab58f5D002) |
    | **MessageV2** | 26 | [`0xec546b6B005471ECf012e5aF77FBeC07e0FD8f78`](https://explorer.arc.io/address/0xec546b6B005471ECf012e5aF77FBeC07e0FD8f78) |
    | **CrossChainTokenService** | 26 | [`0x431871229103b780868f8C6BB820cd16ECf942BC`](https://explorer.arc.io/address/0x431871229103b780868f8C6BB820cd16ECf942BC) |
  </Tab>

  <Tab title="Testnet">
    | Contract | Domain | Address |
    | :- | :- | :- |
    | **TokenMessengerV2** | 26 | [`0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA`](https://explorer.testnet.arc.io/address/0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA) |
    | **TokenMessengerWithFees** | 26 | [`0x8745D906D67C346E5eb1aEEED38Eb87F34DF0C0A`](https://explorer.testnet.arc.io/address/0x8745D906D67C346E5eb1aEEED38Eb87F34DF0C0A) |
    | **MessageTransmitterV2** | 26 | [`0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275`](https://explorer.testnet.arc.io/address/0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275) |
    | **TokenMinterV2** | 26 | [`0xb43db544E2c27092c107639Ad201b3dEfAbcF192`](https://explorer.testnet.arc.io/address/0xb43db544E2c27092c107639Ad201b3dEfAbcF192) |
    | **MessageV2** | 26 | [`0xbaC0179bB358A8936169a63408C8481D582390C4`](https://explorer.testnet.arc.io/address/0xbaC0179bB358A8936169a63408C8481D582390C4) |
    | **CrossChainTokenService** | 26 | [`0x63753E722bd2C2A5DF6EE19C5106662208B81077`](https://explorer.testnet.arc.io/address/0x63753E722bd2C2A5DF6EE19C5106662208B81077) |
  </Tab>
</Tabs>

### Gateway

<Tabs>
  <Tab title="Mainnet">
    | Contract | Domain | Address |
    | :- | :- | :- |
    | **GatewayWallet** | 26 | [`0x77777777Dcc4d5A8B6E418Fd04D8997ef11000eE`](https://explorer.arc.io/address/0x77777777Dcc4d5A8B6E418Fd04D8997ef11000eE) |
    | **GatewayMinter** | 26 | [`0x2222222d7164433c4C09B0b0D809a9b52C04C205`](https://explorer.arc.io/address/0x2222222d7164433c4C09B0b0D809a9b52C04C205) |
  </Tab>

  <Tab title="Testnet">
    | Contract | Domain | Address |
    | :- | :- | :- |
    | **GatewayWallet** | 26 | [`0x0077777d7EBA4688BDeF3E311b846F25870A19B9`](https://explorer.testnet.arc.io/address/0x0077777d7EBA4688BDeF3E311b846F25870A19B9) |
    | **GatewayMinter** | 26 | [`0x0022222ABE238Cc2C7Bb1f21003F0a260052475B`](https://explorer.testnet.arc.io/address/0x0022222ABE238Cc2C7Bb1f21003F0a260052475B) |
  </Tab>
</Tabs>

## Payments and settlement

Arc provides payment and settlement contracts that enable foreign exchange and
onchain settlement workflows using stablecoins. These components support
application-level use cases such as FX execution and escrow-based settlement.

### StableFX

[StableFX](https://developers.circle.com/stablefx) is an enterprise-grade
stablecoin FX engine that combines Request-for-Quote (RFQ) execution with
onchain settlement on Arc. The following is the address for the escrow contract
used to settle stablecoin swaps.

<Tabs>
  <Tab title="Mainnet">
    | Contract | Address | Notes |
    | :- | :- | :- |
    | **FxEscrow** | [`0xe2E5F173576B513d994073CCbDaCBE027d43DFe6`](https://explorer.arc.io/address/0xe2E5F173576B513d994073CCbDaCBE027d43DFe6) | The escrow contract used by both makers and takers to settle stablecoin swaps. |
  </Tab>

  <Tab title="Testnet">
    | Contract | Address | Notes |
    | :- | :- | :- |
    | **FxEscrow** | [`0xd68256f4D69C6BbEcB873D8588AE0Dc6B8E22E10`](https://explorer.testnet.arc.io/address/0xd68256f4D69C6BbEcB873D8588AE0Dc6B8E22E10) | The escrow contract used by both makers and takers to settle stablecoin swaps. |
  </Tab>
</Tabs>

<Info>
  Before executing FX trades, StableFX must be able to transfer USDC from your
  wallet. To enable this, you need to grant a USDC allowance to the Permit2
  contract. See the Common Ethereum contracts section for the Permit2 address.
</Info>

## Transaction extensions

Arc provides predeployed contracts for attaching memos to transactions and
batching calls with sender preservation. Both contracts route subcalls through
the CallFrom precompile, which preserves the original `msg.sender` in each
subcall.

<Tabs>
  <Tab title="Mainnet">
    | Contract | Address | Notes |
    | :- | :- | :- |
    | **Memo** | [`0x5294E9927c3306DcBaDb03fe70b92e01cCede505`](https://explorer.arc.io/address/0x5294E9927c3306DcBaDb03fe70b92e01cCede505) | Attaches memo metadata to contract calls. Emits `Memo` events with a sequential index. |
    | **Multicall3From** | [`0x522fAf9A91c41c443c66765030741e4AaCe147D0`](https://explorer.arc.io/address/0x522fAf9A91c41c443c66765030741e4AaCe147D0) | Batches multiple calls like Multicall3, but preserves the original `msg.sender` in each subcall. |
  </Tab>

  <Tab title="Testnet">
    | Contract | Address | Notes |
    | :- | :- | :- |
    | **Memo** | [`0x5294E9927c3306DcBaDb03fe70b92e01cCede505`](https://explorer.testnet.arc.io/address/0x5294E9927c3306DcBaDb03fe70b92e01cCede505) | Attaches memo metadata to contract calls. Emits `Memo` events with a sequential index. |
    | **Multicall3From** | [`0x522fAf9A91c41c443c66765030741e4AaCe147D0`](https://explorer.testnet.arc.io/address/0x522fAf9A91c41c443c66765030741e4AaCe147D0) | Batches multiple calls like Multicall3, but preserves the original `msg.sender` in each subcall. |
  </Tab>
</Tabs>

<Warning>
  **Offchain blocklist operators:** If you maintain an offchain blocklist or
  compliance screening system, you must include the Memo and Multicall3From
  contract addresses. These contracts preserve `msg.sender` through the CallFrom
  precompile, meaning the original caller's address appears as the sender in
  subcalls. Your monitoring should account for transactions routed through these
  contracts to ensure blocklist enforcement is not bypassed.
</Warning>

## AI agents

Arc supports onchain identity, reputation, and validation for AI agents through
the [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) standard. To get
started, see
[Register your first AI agent](/arc/tutorials/register-your-first-ai-agent).

### ERC-8004

<Tabs>
  <Tab title="Mainnet">
    | Contract | Address | Notes |
    | :- | :- | :- |
    | **IdentityRegistry** | [`0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`](https://explorer.arc.io/address/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432) | Registers agent identities and stores agent metadata URIs. |
    | **ReputationRegistry** | [`0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`](https://explorer.arc.io/address/0x8004BAa17C55a88189AE136b182e5fdA19dE9b63) | Records feedback and reputation events for registered agents. |
    | **ValidationRegistry** | [`0x8004Cc8439f36fd5F9F049D9fF86523Df6dAAB58`](https://explorer.arc.io/address/0x8004Cc8439f36fd5F9F049D9fF86523Df6dAAB58) | Handles validation requests and responses for agent work. |
  </Tab>

  <Tab title="Testnet">
    | Contract | Address | Notes |
    | :- | :- | :- |
    | **IdentityRegistry** | [`0x8004A818BFB912233c491871b3d84c89A494BD9e`](https://explorer.testnet.arc.io/address/0x8004A818BFB912233c491871b3d84c89A494BD9e) | Registers agent identities and stores agent metadata URIs. |
    | **ReputationRegistry** | [`0x8004B663056A597Dffe9eCcC1965A193B7388713`](https://explorer.testnet.arc.io/address/0x8004B663056A597Dffe9eCcC1965A193B7388713) | Records feedback and reputation events for registered agents. |
    | **ValidationRegistry** | [`0x8004Cb1BF31DAf7788923b405b754f57acEB4272`](https://explorer.testnet.arc.io/address/0x8004Cb1BF31DAf7788923b405b754f57acEB4272) | Handles validation requests and responses for agent work. |
  </Tab>
</Tabs>

## Common Ethereum contracts

Arc includes a set of widely used Ethereum ecosystem contracts for deterministic
deployment, batched reads, and standardized token approvals. Although not
Circle-managed, these contracts are deployed on Arc to ensure compatibility with
common EVM tooling and workflows.

<Tabs>
  <Tab title="Mainnet">
    | Contract | Address | Notes |
    | :- | :- | :- |
    | **CREATE2 Factory (Arachnid)** | [`0x4e59b44847b379578588920cA78FbF26c0B4956C`](https://explorer.arc.io/address/0x4e59b44847b379578588920cA78FbF26c0B4956C) | Minimal proxy for deterministic contract deployment using the `CREATE2` opcode. |
    | **Multicall3** | [`0xcA11bde05977b3631167028862bE2a173976CA11`](https://explorer.arc.io/address/0xcA11bde05977b3631167028862bE2a173976CA11) | Aggregates multiple read calls into a single call for efficient data retrieval. |
    | **Permit2** | [`0x000000000022D473030F116dDEE9F6B43aC78BA3`](https://explorer.arc.io/address/0x000000000022D473030F116dDEE9F6B43aC78BA3) | Universal contract for signature-based token approvals. Required for StableFX. |
  </Tab>

  <Tab title="Testnet">
    | Contract | Address | Notes |
    | :- | :- | :- |
    | **CREATE2 Factory (Arachnid)** | [`0x4e59b44847b379578588920cA78FbF26c0B4956C`](https://explorer.testnet.arc.io/address/0x4e59b44847b379578588920cA78FbF26c0B4956C) | Minimal proxy for deterministic contract deployment using the `CREATE2` opcode. |
    | **Multicall3** | [`0xcA11bde05977b3631167028862bE2a173976CA11`](https://explorer.testnet.arc.io/address/0xcA11bde05977b3631167028862bE2a173976CA11) | Aggregates multiple read calls into a single call for efficient data retrieval. |
    | **Permit2** | [`0x000000000022D473030F116dDEE9F6B43aC78BA3`](https://explorer.testnet.arc.io/address/0x000000000022D473030F116dDEE9F6B43aC78BA3) | Universal contract for signature-based token approvals. Required for StableFX. |
  </Tab>
</Tabs>

## Test addresses for restricted transfer behavior

To help you exercise the value transfer revert paths described in
[EVM differences](/arc/references/evm-differences#value-transfer-rules), Arc
Testnet seeds a well-known blocklisted address derived from the standard test
mnemonic `test test test test test test test test test test test junk`. Because
the mnemonic is public, you can derive its private key locally and sign as the
address, for example with Foundry:

```bash theme={null}
cast wallet private-key --mnemonic "test test test test test test test test test test test junk" --mnemonic-index 1
```

| Purpose | Mnemonic index | Address | Behavior |
| :- | :- | :- | :- |
| **Blocklisted** | 1 | [`0x70997970C51812dc3A010C7d01b50e0d17dc79C8`](https://explorer.testnet.arc.io/address/0x70997970C51812dc3A010C7d01b50e0d17dc79C8) | A value transfer to or from this address reverts at runtime, including when the address is the beneficiary of a `SELFDESTRUCT`. |

Use this address to confirm your contract handles a runtime revert on a value
transfer (including as a `SELFDESTRUCT` beneficiary). See
[EVM differences](/arc/references/evm-differences#value-transfer-rules) for the
full set of rules.
