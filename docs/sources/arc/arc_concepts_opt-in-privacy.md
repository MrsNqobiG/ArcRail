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

# Opt-in privacy

> Arc Privacy Sector (APS) is Arc's confidential execution environment for Solidity contracts, running alongside the public EVM with synchronous composability and default-deny contract isolation.

Arc provides opt-in privacy through **Arc Privacy Sector (APS)**, a confidential
execution environment for Solidity contracts that runs alongside Arc's public
EVM. Deploy existing Solidity contracts into APS with minimal modifications to
keep contract state and transaction data confidential while preserving atomicity
and consensus consistency with the public ledger.

Privacy is opt-in: applications choose when business or regulatory requirements
warrant keeping data off the public ledger.

<Info>Privacy features are on the roadmap and not yet available on Arc.</Info>

## How Arc Privacy Sector (APS) works

Arc runs one blockchain with two execution environments: **Arc** for public
state and **APS** for private state. Both environments produce state roots that
are committed together in each block, advancing in lockstep within the same
consensus rounds.

To submit a private transaction, encrypt a standard EVM transaction using the
APS network public key and send the ciphertext as calldata to an Arc precompile.
From the public ledger's perspective, this looks like an ordinary precompile
call—the encrypted payload is opaque. Validators running APS inside hardware
enclaves decrypt, verify, and execute the transaction against private state
using standard EVM rules.

The privacy precompile returns only an acknowledgement and a predefined gas
cost. No execution results, return values, or event logs are exposed to the
public ledger.

After consensus finalizes the block, a light client inside each enclave verifies
the block's commit certificate before making private state queryable. Retrieve
transaction results from an RPC node by providing the transaction hash and
proving authorization.

## Synchronous composability

APS finalizes private and public state in the same block by the same validator
set. Private and public contracts compose atomically without cross-chain bridges
or asynchronous messaging.

Bridge assets between public and private contracts through controlled precompile
operations that execute within a single block. Both sides of the bridge see
consistent state at each block height.

## Contract isolation by default

APS enforces a **default-deny** isolation model. When you deploy a contract,
every function and storage slot is inaccessible to external callers and other
contracts by default. Privacy holds even if you forget to add explicit
protections.

Exposure is opt-in through three mechanisms:

* **Function-level access policies.** Each function selector carries an access
  policy: `Open`, `Restricted`, or `Locked`. Restricted functions require the
  caller to have an explicit grant. Locked functions revert unconditionally.
* **Trust domains.** A contract's admin can grant trust to specific contracts
  via `addTrustee`. Without an active trust relationship, introspection opcodes
  like `EXTCODESIZE`, `EXTCODEHASH`, and `BALANCE` return zero. Trust is
  unidirectional and revocable.
* **Runtime visibility enforcement.** Solidity visibility modifiers (`public`,
  `external`, `internal`, `private`) are enforced at runtime on every `CALL` and
  `DELEGATECALL`, preventing crafted calldata from reaching unintended
  entrypoints.

Additional isolation behavior: event logging is disabled by default (events
require an explicit precompile), cross-boundary probes are masked, revert
reasons are sanitized, and gas reporting to external observers is constant-time.

## Deploying existing Solidity contracts

APS reuses standard EVM bytecode and tooling. Core business rules, state
management, and function implementations carry over unchanged. The primary
adaptation is how contracts expose their interfaces to external callers, through
access policy and trust domain configuration.

For example, deploy a standard OpenZeppelin ERC-20 token into APS without
modifying the bytecode, then use the trust domain API to make `transfer` open to
any caller while restricting `balanceOf` to explicitly trusted contracts—without
redeploying.

## Post-quantum encryption

APS uses hybrid post-quantum cryptography to protect against harvest-now,
decrypt-later attacks:

* Public-key encryption uses X-Wing KEM (combining X25519 and ML-KEM-768) with
  HKDF-SHA256 and AES-256-GCM.
* Symmetric encryption uses AES-256-GCM-SIV for contract state and AES-256-GCM
  for state roots.
* Node-to-node communication uses TLS 1.3 with the X25519MLKEM768 hybrid key
  agreement.

See [Post-quantum security](/arc/concepts/post-quantum-security) for Arc's
broader quantum-resilience roadmap.

## Key management

APS uses a single master secret key (MSK) distributed across validators through
Shamir threshold secret sharing. The MSK can only be reconstructed inside
attested enclaves and is never exposed to validator hosts. All derived keys for
transaction decryption, per-contract state encryption, and state root encryption
come from the MSK.

Each validator organization runs an independent KMS with an attestation policy
that governs which enclave profiles may access key material. Seed nodes provide
fast MSK recovery if a validator restarts. Key rotation is supported when the
validator set changes.
