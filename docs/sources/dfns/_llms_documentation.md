# DFNS documentation: Documentation

> DFNS documentation

## Documentation

- [FAQ](https://docs.dfns.co/faq.md): Frequently asked questions about DFNS, including MPC wallets, passkeys, deployment options, supported networks, pricing, and compliance.

### Introduction

- [DFNS documentation](https://docs.dfns.co/index.md): Welcome to the DFNS developer documentation: wallets-as-a-service, MPC custody, passkeys, policies, and APIs for building secure crypto applications.
- [Platform Overview](https://docs.dfns.co/platform-overview.md): Understand the core concepts, architecture, and benefits of the DFNS API-first wallets-as-a-service platform for custody, payments, and tokenization.
- [Architecture](https://docs.dfns.co/core-concepts/architecture.md): Walkthrough of the DFNS architecture and how the platform helps businesses securely manage digital assets across authentication, policies, and MPC signing.
- [Introduction to MPC](https://docs.dfns.co/core-concepts/how-mpc-wallets-work.md): How DFNS multi-party computation wallets distribute key shares across signer nodes so private keys are never reconstructed in one place.
- [Security Model](https://docs.dfns.co/core-concepts/dfns-security-model.md): The DFNS security model is built on the principle that the best way to protect a secret is to ensure no single person or system ever knows it.

#### Quickstart Guide

- [Quickstart Guide](https://docs.dfns.co/introduction/quickstart/index.md): **Welcome to DFNS!** This guide will help you get set up with our platform. If you have any questions, don't hesitate to reach out to us.
- [Create your organization and invite employees](https://docs.dfns.co/introduction/quickstart/1-create-your-organization-and-invite-employees.md): Create your DFNS organization with you as the first user, then invite coworkers, assign roles, and configure access for your custody operations.
- [Define and assign roles](https://docs.dfns.co/introduction/quickstart/2-define-and-assign-permissions.md): Give your users the right level of access to the DFNS features and secure your organization by defining a clear set of reusable roles.
- [Create your first policies](https://docs.dfns.co/introduction/quickstart/3-create-policies.md): Configure your first DFNS policies so internal approval and risk controls are replicated in the platform before you start moving funds.
- [Using the dashboard: create your first wallet](https://docs.dfns.co/introduction/quickstart/4-using-the-dashboard-create-your-first-wallet.md): Use the DFNS dashboard to create your first MPC wallet, fully managed and controlled by you, with multichain key support and policy controls.
- [Start building: login & create a wallet via API](https://docs.dfns.co/introduction/quickstart/5-start-building-login-and-create-a-wallet-via-api.md): Building your own app? Learn how to consume the DFNS APIs using an employee login to create wallets and execute transfers programmatically.
- [Delegated 1/2: DFNS API using a service account](https://docs.dfns.co/introduction/quickstart/6-non-custody-1-2-dfns-api-using-a-service-account.md): Building your own app? Learn how to consume the DFNS APIs using a service account for server-to-server access without a human user.
- [Delegated 2/2: customer login and delegated wallets](https://docs.dfns.co/introduction/quickstart/7-non-custody-2-2-customer-login-and-delegated-wallets.md): Give your end users ownership and control of their own non-custodial wallets with delegated registration, login, and signing flows.

### Core Concepts

- [Organizations](https://docs.dfns.co/core-concepts/organizations.md): Your DFNS organization is the container for all wallets, users, policies, and credentials, with isolation, billing, and role-based access controls. Segregate your customers with one organization per customer or delegated wallets.
- [Vaults, wallets & keys](https://docs.dfns.co/core-concepts/vaults-wallets-and-keys.md): How DFNS separates keys, wallets, and vaults: a key signs, a wallet is an address, and a vault groups wallets under one managed balance sheet with institutional accounting.
- [Address watches](https://docs.dfns.co/core-concepts/address-watches.md): Monitor any on-chain address DFNS does not control — balances, history, and webhooks — with no key, signing, or custody.
- [Roles and permissions](https://docs.dfns.co/core-concepts/roles-and-permissions.md): How DFNS roles, permissions, and assignments control which users and service accounts can perform which actions in your organization.
- [Policies](https://docs.dfns.co/core-concepts/policies.md): DFNS policies enable businesses to enforce rules and request approvals on top of actions like transfers, signing, permission changes, and policy edits.
- [Passkeys](https://docs.dfns.co/core-concepts/passkeys.md): How DFNS uses passkeys (WebAuthn) for phishing-resistant authentication and request signing across web, mobile, and machine clients.

### Platform Features

- [Discover DFNS Features ✨](https://docs.dfns.co/features/index.md): Explore the DFNS feature set: an API-first platform with wallets, policies, DeFi, compliance, and user experience tools for the full digital asset lifecycle.
- [Transactions](https://docs.dfns.co/features/transactions.md): DFNS offers three ways to create a transaction, each balancing convenience and control: transfers, sign-and-broadcast, and raw signing with custom broadcast.
- [Staking](https://docs.dfns.co/features/staking.md): Stake assets and earn rewards through DFNS staking integrations with leading providers, with delegated staking, validator selection, and reward tracking.
- [Swaps](https://docs.dfns.co/features/swaps.md): Exchange one token for another directly within DFNS through integrated DEX providers, with policy controls, slippage limits, and a unified swap interface.
- [Allocations](https://docs.dfns.co/features/allocations.md): Earn rewards on your crypto holdings directly within DFNS through Allocations, with no need to leave the dashboard or connect to external DeFi protocols.
- [Fee Sponsors](https://docs.dfns.co/features/fee-sponsors.md): Sponsor gas fees for your wallets so end users can transact without holding native tokens, with policy-controlled sponsor wallets and limits.
- [Exchanges](https://docs.dfns.co/features/exchanges.md): Seamless centralized exchange integrations on DFNS for efficient asset management, deposits, and withdrawals with Kraken, Binance, and Coinbase Prime.
- [AML / KYT](https://docs.dfns.co/features/aml-kyt.md): Anti-money laundering and Know Your Transaction compliance capabilities integrated into DFNS wallets through Chainalysis, Elliptic, Global Ledger, and other partners.
- [Travel Rule](https://docs.dfns.co/features/travel-rule.md): Meet FATF Travel Rule obligations on DFNS transfers using Notabene and other providers to exchange originator and beneficiary information.
- [Fiat on/off-ramps](https://docs.dfns.co/features/fiat-on-off-ramps.md): On-ramp and off-ramp fiat with DFNS: convert stablecoins to fiat bank deposits with Payouts (via Borderless or Circle Mint), deliver stablecoin to your wallets with Payins, or integrate third-party providers to settle global payments from your custody operations.

### Networks

- [Supported Networks](https://docs.dfns.co/networks/index.md): Browse all blockchains supported by DFNS, including signature kinds, supported assets, and network-specific features for each chain.
- [Supported assets](https://docs.dfns.co/networks/supported-assets.md): Transfer kinds and asset standards supported by the DFNS transfer API across every network, including native tokens, fungible tokens, and NFTs.
- [Supported key formats](https://docs.dfns.co/networks/supported-key-formats.md): Key schemes and elliptic curves supported by DFNS, listed by network, including secp256k1, ed25519, BLS, and Schnorr signature compatibility.

#### Networks specificities

- [Algorand](https://docs.dfns.co/networks/algorand.md): Network-specific features, signature kinds, supported assets, and integration requirements for Algorand wallets on the DFNS platform.
- [Aptos](https://docs.dfns.co/networks/aptos.md): Network-specific features, signature kinds, supported assets, and integration requirements for Aptos wallets on the DFNS platform.
- [Bitcoin](https://docs.dfns.co/networks/bitcoin.md): Network-specific features, PSBT signing, Taproot support, UTXO handling, and integration requirements for Bitcoin wallets on the DFNS platform.
- [Canton](https://docs.dfns.co/networks/canton.md): Network-specific features, supported assets, and integration requirements for Canton Network wallets and validator workflows on the DFNS platform.
- [Cardano](https://docs.dfns.co/networks/cardano.md): Network-specific features, signature kinds, supported assets, and integration requirements for Cardano wallets on the DFNS platform.
- [Cosmos](https://docs.dfns.co/networks/cosmos.md): Network-specific features, signature kinds, and integration requirements for Cosmos SDK-based chains on the DFNS platform, including IBC support.
- [EVM networks](https://docs.dfns.co/networks/evm.md): Network-specific features for Ethereum and EVM-compatible chains on DFNS, including EIP-1559, EIP-712 signing, smart contract reads, and tokens.
- [Hedera](https://docs.dfns.co/networks/hedera.md): Network-specific features, signature kinds, supported assets, and integration requirements for Hedera wallets on the DFNS platform.
- [IOTA](https://docs.dfns.co/networks/iota.md): Network-specific features, signature kinds, supported assets, and integration requirements for IOTA wallets on the DFNS custody platform.
- [Kaspa](https://docs.dfns.co/networks/kaspa.md): Network-specific features, signature kinds, supported assets, and integration requirements for Kaspa wallets on the DFNS platform.
- [Movement](https://docs.dfns.co/networks/movement.md): Network-specific features, signature kinds, supported assets, and integration requirements for Movement wallets on the DFNS platform.
- [NEAR](https://docs.dfns.co/networks/near.md): Network-specific features, signature kinds, supported assets, and integration requirements for NEAR Protocol wallets on the DFNS platform.
- [Polymesh](https://docs.dfns.co/networks/polymesh.md): Network-specific features, signature kinds, supported assets, and integration requirements for Polymesh wallets on the DFNS platform.
- [Solana](https://docs.dfns.co/networks/solana.md): Network-specific features, signature kinds, supported assets, and integration requirements for Solana wallets on the DFNS platform.
- [Starknet](https://docs.dfns.co/networks/starknet.md): Network-specific features, signature kinds, supported assets, and integration requirements for Starknet wallets on the DFNS platform.
- [Stellar](https://docs.dfns.co/networks/stellar.md): Network-specific features, signature kinds, supported assets, and integration requirements for Stellar wallets on the DFNS platform.
- [Sui](https://docs.dfns.co/networks/sui.md): Network-specific features, signature kinds, supported assets, and integration requirements for Sui wallets on the DFNS custody platform.
- [TON](https://docs.dfns.co/networks/ton.md): Network-specific features, signature kinds, supported assets, and integration requirements for TON (The Open Network) wallets on the DFNS platform.
- [TRON](https://docs.dfns.co/networks/tron.md): Network-specific features, signature kinds, supported assets, and integration requirements for TRON wallets on the DFNS custody platform.
- [XRP Ledger](https://docs.dfns.co/networks/xrpl.md): Network-specific features, signature kinds, supported assets, and integration requirements for XRP Ledger wallets on the DFNS platform.

### Solutions

#### Payments

- [Automate deposits](https://docs.dfns.co/solutions/automate-deposits.md): Detect end-user deposits, sweep funds to treasury, and process stablecoin payments programmatically with DFNS wallets, webhooks, and policies.
- [Automate payments](https://docs.dfns.co/solutions/automate-payments.md): Set up policy-gated automated transfers using DFNS service accounts for payments, payroll, and disbursements across multiple networks.
- [Process x402 agent payments](https://docs.dfns.co/solutions/process-x402-agent-payments.md): Sign ERC-3009 pull-payment authorizations for AI agents using a DFNS wallet, and settle gasless USDC payments from the merchant's DFNS wallet.
- [Issue stablecoins](https://docs.dfns.co/solutions/issue-stablecoins.md): Deploy and manage ERC-20 stablecoins using DFNS wallets, with role-gated mint, burn, blacklist, and pause controls enforced by policies.
- [Set up cross-border payments (Ethereum & EVM)](https://docs.dfns.co/solutions/cross-border-payments-evm.md): Process cross-border payments with FX conversion on EVM networks using DFNS wallets, stablecoins, and policy-controlled treasury operations.
- [Set up cross-border payments (Solana)](https://docs.dfns.co/solutions/cross-border-payments-solana.md): Process cross-border payments with atomic FX conversion on Solana using DFNS wallets, stablecoins, and policy-controlled signing workflows.

#### Custody

- [Accept cryptocurrencies](https://docs.dfns.co/solutions/accept-cryptocurrencies.md): Build a full-stack custody platform that combines crypto wallets and fiat accounts on DFNS, including merchant payments and treasury management.
- [Govern wallet access](https://docs.dfns.co/solutions/govern-wallet-access.md): Organize DFNS wallets with tags, roles, and permissions for operational security, including least-privilege access and audit-friendly assignments.
- [Embed user wallets](https://docs.dfns.co/solutions/embed-user-wallets.md): Implement non-custodial user-managed wallets with DFNS delegated signing, passkey authentication, registration, and end-user onboarding flows.

#### Trading

- [Managed investment accounts](https://docs.dfns.co/solutions/managed-investment-accounts.md): Architecture for a discretionary investment platform with per-client approved destinations, audit visibility, and automated order execution to an exchange.
- [Execute DeFi trades](https://docs.dfns.co/solutions/execute-defi-trades.md): Execute token swaps on decentralized exchanges from DFNS wallets, with policy controls for allowed pairs, slippage, and trade size.
- [Connect to exchanges](https://docs.dfns.co/solutions/connect-to-exchanges.md): Connect DFNS wallets with centralized exchanges to move assets in and out, with policy controls, audit trails, and counterparty whitelists.

#### Tokenization

- [Issue tokenized bonds](https://docs.dfns.co/solutions/issue-tokenized-bonds.md): Manage the tokenized corporate bond lifecycle on Ethereum: subscription, coupon payments, and redemption, all secured by DFNS wallets and policies.
- [Issue confidential tokens](https://docs.dfns.co/solutions/confidential-token.md): Deploy, mint, transfer, and reveal an ERC-7984 confidential token on Ethereum using DFNS wallets. Balances stay FHE-encrypted on-chain; only the holder can read them.
- [Swap confidential tokens](https://docs.dfns.co/solutions/confidential-swap.md): Atomic ERC-20 ↔ ERC-7984 swaps on Ethereum using DFNS wallets and Zama FHEVM. Three flows covering synchronous, async KMS-decrypted, and two-party encrypted exchange.

#### Compliance

- [Define treasury policies](https://docs.dfns.co/solutions/define-treasury-policies.md): Configure multi-signature approvals, spending limits, and risk controls to protect your treasury operations with DFNS policies and address books.
- [Build programmable approval policies](https://docs.dfns.co/solutions/build-programmable-approval-policies.md): Use a DFNS service account to decode pending smart-contract calls and approve or deny them programmatically with custom business logic.
- [Gate a service account with a policy](https://docs.dfns.co/solutions/gate-service-account-signing.md): Back a DFNS service account with an MPC key so every user action it signs is gated by the policy engine behind an approval quorum.
- [Apply compliance controls](https://docs.dfns.co/solutions/apply-compliance-controls.md): Apply KYT/AML screening, audit operations, and Travel Rule compliance for regulated entities using DFNS policies and integration partners.

### Guides

#### Wallets & assets

- [Manage wallets](https://docs.dfns.co/guides/manage-wallets.md): Create wallets, add networks, organize with tags, and manage balances from the DFNS dashboard with role-based access controls and audit trails.
- [Manage vaults](https://docs.dfns.co/guides/manage-vaults.md): Create a vault, add networks, receive and release quarantined funds, and send assets from the DFNS dashboard, including transfers that require policy approval.
- [Use multichain wallets](https://docs.dfns.co/guides/multichain-wallets.md): Use the same DFNS wallet address across multiple EVM networks to simplify asset management, accounting, and integrations with downstream tools.
- [Use the address book](https://docs.dfns.co/guides/address-book.md): Manage blockchain addresses your team interacts with by assigning human-readable names, tags, and policy whitelists in the DFNS dashboard.
- [Use network testnets](https://docs.dfns.co/guides/network-testnets.md): List of testnets supported by DFNS across each network, with notes on faucets, RPC endpoints, and feature parity with mainnet wallets.
- [Freeze a wallet](https://docs.dfns.co/guides/freeze-wallet.md): How to block all outgoing transactions from a DFNS wallet using policies and tags, including temporary freezes and granular allowlists.
- [Transfer assets](https://docs.dfns.co/guides/transfer-assets.md): Make a one-off transfer from the DFNS dashboard, or use the transfer API for automated, high-volume, or policy-gated payment flows.
- [Use Solana durable nonces](https://docs.dfns.co/guides/solana-durable-nonces.md): Create Solana nonce accounts and send durable-nonce transfers from the DFNS dashboard, so signed transactions stay valid past Solana's ~90-second expiry.
- [Interact with smart contracts](https://docs.dfns.co/guides/smart-contracts.md): Read from and write to smart contracts using the DFNS dashboard or API, including ABI decoding, contract reads, and policy-controlled writes.
- [Use WalletConnect](https://docs.dfns.co/guides/walletconnect.md): Connect your DFNS wallets to external dApps using WalletConnect from the dashboard, with policy controls and signature review workflows.

#### Approvals & policies

- [Create policies](https://docs.dfns.co/guides/create-policies.md): Replicate your internal approval and risk controls in DFNS by configuring policies for transfers, signing, permissions, and policy changes.
- [Approve transactions](https://docs.dfns.co/guides/approve-transactions.md): Review and approve pending transactions that require policy approval from the DFNS dashboard, with audit trails and multi-approver workflows.
- [Policies for signature requests](https://docs.dfns.co/guides/signing-policies.md): How the policy engine evaluates Sign & Broadcast and Generate Signature requests, and how to scope policies and payloads for them.
- [Notify approvers with Zapier](https://docs.dfns.co/guides/notify-approvers-with-zapier.md): Automate notifications to policy approvers using Zapier or other automation tools to send emails, Slack messages, or webhook events on approvals.

#### Access & credentials

- [Manage users and roles](https://docs.dfns.co/guides/users-and-roles.md): Manage team members and their roles within your DFNS organization, including inviting users, assigning permissions, and removing access.
- [Set up permission-based access](https://docs.dfns.co/guides/permission-based-access-control.md): Invite new users to your DFNS organization and configure roles, permissions, and assignments for fine-grained access management at scale.
- [Register a new passkey](https://docs.dfns.co/guides/register-passkey.md): Register passkey credentials so a user can log in to their DFNS organization across multiple devices, with cross-device sync and rotation.
- [Recover your account](https://docs.dfns.co/guides/recover-your-account.md): How to recover access to your DFNS account if you lose your passkey or device, using recovery codes, recovery credentials, and verified flows.
- [Set up Single Sign-On (SSO)](https://docs.dfns.co/guides/set-up-sso.md): Configure OIDC-based single sign-on so your team logs in to DFNS through your identity provider (Okta, Auth0, Azure AD, Google Workspace).

#### Reference & meta

- [Dashboard videos](https://docs.dfns.co/guides/dashboard-videos.md): Video walkthroughs to help you navigate the DFNS dashboard, including wallet creation, transfers, policy setup, and team administration.
- [Security best practices](https://docs.dfns.co/guides/security-best-practices.md): Protect your DFNS organization with roles, policies, address books, spam filtering, credential rotation, and secure deployment configuration.
- [Security checklist](https://docs.dfns.co/guides/security-checklist.md): Warning signs to check for in your DFNS organization: over-privileged users and service accounts, ineffective policies, blind spots, and lockout risks.
- [Export the audit log](https://docs.dfns.co/guides/export-audit-log.md): Export a CSV of every user-action-signed event in your DFNS organization — registrations, recoveries, and state-changing API calls — filtered by date range and user.
- [Find your organization ID](https://docs.dfns.co/guides/find-organization-id.md): The organization ID (orgId) is the unique identifier DFNS uses to segregate your data; it's shown at the top of the dashboard homepage.
- [Process payouts](https://docs.dfns.co/guides/payouts.md): Set up Borderless and initiate stablecoin-to-fiat payouts from the DFNS dashboard, including bank account verification and recipient management.
- [Process payins](https://docs.dfns.co/guides/payins.md): Connect Circle Mint and deliver stablecoin to your DFNS wallets from the dashboard, including recipient registration and balance tracking.
- [Connect AI tools to DFNS docs](https://docs.dfns.co/guides/developers/using-llms.md): Give your AI coding assistants direct access to the DFNS documentation and llms.txt for accurate, up-to-date code generation and answers.

#### 3ʳᵈ-party integrations

##### Exchanges

- [Kraken](https://docs.dfns.co/integrations/exchanges/kraken.md): Connect Kraken to DFNS to deposit and withdraw assets between your DFNS wallets and Kraken exchange accounts with policy controls.
- [Binance](https://docs.dfns.co/integrations/exchanges/binance.md): Connect Binance to DFNS to deposit and withdraw assets between your DFNS wallets and Binance exchange accounts with policy controls.
- [Coinbase Prime](https://docs.dfns.co/integrations/exchanges/coinbase-prime.md): Connect Coinbase Prime to DFNS to deposit and withdraw assets between your DFNS wallets and Coinbase Prime accounts with policy controls.

##### AML / KYT

- [Chainalysis](https://docs.dfns.co/integrations/aml-kyt/chainalysis.md): Screen inbound and outbound transactions with Chainalysis KYT for AML compliance, with automatic enforcement through DFNS policies and webhooks.
- [Elliptic](https://docs.dfns.co/integrations/aml-kyt/elliptic.md): Screen transactions with Elliptic KYT for AML compliance: automatic screening in both directions, plus policy-enforced prescreening of outbound transfers.
- [Global Ledger](https://docs.dfns.co/integrations/aml-kyt/global-ledger.md): Screen outbound transactions with Global Ledger's blockchain analytics and KYT services, enforced through DFNS policies before signing.

##### Travel Rule

- [Notabene](https://docs.dfns.co/integrations/travel-rule/notabene.md): Integrate Notabene with DFNS to meet FATF Travel Rule requirements by exchanging originator and beneficiary data with counterparty VASPs.

##### Staking

- [Figment](https://docs.dfns.co/integrations/staking/figment.md): Stake assets and earn rewards through the Figment integration on DFNS, with delegated staking flows and policy-controlled validator selection.

##### Swaps

- [Uniswap](https://docs.dfns.co/integrations/swaps/uniswap.md): Execute token swaps on Uniswap from DFNS wallets, with optional policy controls to gate allowed pairs, slippage limits, and per-trade size caps.

#### Developer Guides

- [Start building with DFNS](https://docs.dfns.co/guides/developers/index.md): Your first steps to integrating with the DFNS API, focused on our unique two-token authentication model, request signing, and core wallet flows.
- [Create a service account](https://docs.dfns.co/guides/developers/service-account.md): How to create a DFNS service account, assign it permissions, and use its signing key for server-to-server API access without a human user.
- [Create a Personal Access Token](https://docs.dfns.co/guides/developers/personal-access-token.md): How to create and use a Personal Access Token (PAT) to automate actions tied to a specific DFNS user from scripts or backend services.
- [Rotate credentials](https://docs.dfns.co/guides/developers/credential-rotation.md): Replace service account keys, webhook secrets, and user credentials without downtime using DFNS credential rotation patterns and best practices.
- [Set up environments](https://docs.dfns.co/guides/developers/environment-setup.md): Best practices for managing multiple DFNS organizations across development, staging, and production with service accounts, secrets, and CI/CD.
- [Create wallets via API](https://docs.dfns.co/guides/developers/create-wallets.md): Create and manage MPC wallets programmatically using the DFNS API, including delegation, tagging, multichain keys, and webhook notifications.
- [Create transfers via API](https://docs.dfns.co/guides/developers/create-transfers.md): Execute native asset, ERC-20, and NFT transfers programmatically using the DFNS transfer endpoint, with idempotency and policy support.
- [Manage policies via API](https://docs.dfns.co/guides/developers/manage-policies.md): Programmatically create, update, archive, and approve DFNS policies from your application using the policies and policy approvals API.
- [Implement delegated wallets](https://docs.dfns.co/guides/developers/delegated-wallets.md): Register end users, create non-custodial delegated wallets, and let users sign their own transactions using passkeys with the DFNS API.
- [Implement end-user recovery](https://docs.dfns.co/guides/developers/end-user-recovery.md): How to implement recovery flows for delegated wallet users so they can regain access if they lose their device or passkey credential.
- [Implement password-protected keys](https://docs.dfns.co/guides/developers/password-protected-keys.md): How to register and use PasswordProtectedKey credentials, where DFNS stores an encrypted signing key that only the user can decrypt with their password.
- [Configure WebAuthn](https://docs.dfns.co/guides/developers/webauthn-configuration.md): How to configure the WebAuthn relying party ID (rpId) and origin settings for DFNS passkey registration and signing on web and mobile.
- [Register passkeys on a new domain](https://docs.dfns.co/guides/developers/passkey-domain-migration.md): How to let users register new passkey credentials when your frontend moves to a different domain, while preserving access to existing wallets.
- [User Action Signing](https://docs.dfns.co/guides/developers/signing-requests.md): All mutating DFNS API requests require User Action Signing: get a challenge, sign it, exchange it for a User Action Token, and include the token in your request.
- [Monitor transactions](https://docs.dfns.co/guides/developers/transaction-monitoring.md): How to track DFNS transaction status using polling and webhooks, including event types, retries, and reconciling with on-chain confirmations.
- [Sweep deposits](https://docs.dfns.co/guides/developers/deposit-sweeping.md): Automatically sweep incoming deposits to a treasury wallet using DFNS webhooks, balances, and the transfer API for high-volume custody operations.
- [Display balances](https://docs.dfns.co/guides/developers/displaying-balances.md): How to fetch, convert, and display token balances from DFNS wallets, including decimal handling, USD price quotes, net-worth (portfolio value) valuation, and caching tips.
- [Set up webhooks](https://docs.dfns.co/guides/developers/webhooks.md): Listen for DFNS events, verify webhook signatures with HMAC-SHA256, and manage webhook subscriptions to react to wallet and transfer activity.
- [Generate a key pair](https://docs.dfns.co/guides/developers/generate-a-key-pair.md): Generate a cryptographic key pair for a DFNS service account or signing credential, including supported curves, formats, and tooling.
- [Integrate with viem](https://docs.dfns.co/guides/developers/viem-integration.md): Use viem with DFNS wallets to build, sign, and broadcast EVM transactions, including custom account adapters and DFNS signer integration.
- [Import keys from another provider](https://docs.dfns.co/guides/developers/import-keys.md): Migrate existing private keys from other custody providers into DFNS using a secure key import ceremony with end-to-end encryption.
- [Export keys from DFNS](https://docs.dfns.co/guides/developers/export-keys.md): Step-by-step procedure to export a wallet key from DFNS and use it independently, whether to migrate to another provider or to hold a backup, including an offline signing test.
- [Process payouts via API (Borderless and Circle Mint)](https://docs.dfns.co/guides/developers/payouts.md): Integrate stablecoin-to-fiat payouts through the DFNS API with two off-ramp providers, Borderless or Circle Mint. Quote, create, confirm, and track bank deposits from your custody operations, or choose an alternative to Borderless with provider CircleMint.
- [Process payins via API](https://docs.dfns.co/guides/developers/payins.md): Deliver stablecoin to a DFNS wallet via the API with Circle Mint or Borderless: register recipients, request quotes, create payins, and track on-chain delivery.

### Advanced

- [Governance architecture](https://docs.dfns.co/advanced/governance-architecture.md): How DFNS combines authentication, permissions, policies, and MPC signing into a layered governance model for secure wallet operations.
- [Delegated wallets](https://docs.dfns.co/advanced/delegated-wallets.md): Give end users full ownership of their non-custodial wallets while you provide the infrastructure, with passkey authentication and policy controls.
- [Account Abstraction on EVMs](https://docs.dfns.co/advanced/account-abstraction-on-evms.md): Use account abstraction (ERC-4337) with DFNS MPC wallets to enable smart contract wallet features like gas sponsorship and batched transactions on EVM chains.
- [Key import and export](https://docs.dfns.co/advanced/key-import-and-export.md): Import existing private keys into DFNS or export keys from DFNS using secure ceremonies that protect material in transit and at rest.

#### Deployment models

- [Deployment models](https://docs.dfns.co/advanced/deployment-models/index.md): Compare DFNS deployment models for signing infrastructure: SaaS, dedicated, co-signer, HSM, and validation gate, to match your security needs.
- [MPC signing infrastructure](https://docs.dfns.co/advanced/deployment-models/mpc.md): How DFNS uses Multi-Party Computation to secure wallet keys across cloud, hybrid, and self-hosted deployments without ever reconstructing the private key.
- [HSM signing infrastructure](https://docs.dfns.co/advanced/deployment-models/hsm.md): How DFNS integrates Hardware Security Modules as an alternative to MPC for securing wallet keys in regulated and enterprise environments.
- [Disaster recovery](https://docs.dfns.co/advanced/deployment-models/disaster-recovery.md): Backup and recovery options across all DFNS deployment models, including signer failover, Layer 4 independent recovery, and manual key backup via key export.
- [Validation gate](https://docs.dfns.co/advanced/deployment-models/validation-gate.md): Add a pre-signing authorization step where your HTTP handler approves or rejects every DFNS signing request before it reaches the signers.

###  

#### Deprecation notices

- [Passkey settings migration](https://docs.dfns.co/deprecation/passkey-settings-migration-guide.md): Migrate from application-bound rpId and origin configuration to the new separate Passkey Settings resource, with step-by-step instructions.
- [Keys & Multichain - Migration Guide](https://docs.dfns.co/deprecation/keys-and-multichain-migration-guide.md): Migrate from legacy single-network wallets to the multichain keys model so one cryptographic key can derive addresses across multiple networks.
- [Applications - Deprecation](https://docs.dfns.co/deprecation/applications-deprecation.md): Migration guide for the deprecated Applications resource, including how to move existing apps to service accounts and personal access tokens.
