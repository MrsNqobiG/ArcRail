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

# How-to: Grant USDC allowance to Permit2

> Grant a USDC token allowance to the Permit2 contract using a Circle Wallets developer-controlled wallet, a headless BYOW wallet, or an EIP-1193 Ethereum wallet

For Transactions V2 on EVM blockchains, there is a dependency on the `Permit2`
contract to enable allowance management. To get the benefits of Transactions V2,
you must grant a USDC token allowance to the `Permit2` contract.

This guide shows three examples of how to grant a USDC token allowance to the
`Permit2` contract. The
[`Permit2` documentation](https://docs.uniswap.org/contracts/permit2/overview)
provides additional examples of how to grant this allowance.

## Prerequisites

The examples on this page show how to grant a USDC token allowance to the
`Permit2` contract using a
[Circle Wallets developer-controlled wallet](/wallets/dev-controlled) or a
generic EIP-1193 Ethereum wallet. The headless example is for a bring-your-own-
wallet (BYOW) OFI that signs transactions in its backend. Before you begin,
ensure you have:

* If you are following the Circle Wallets example:
  * A Circle Developer Account
  * A
    [developer-controlled wallet](/wallets/dev-controlled/create-your-first-wallet)

* **Node.js** and **npm** installed on your development machine

* A project set up as described in the following section

### Set up your project

1. Initialize a new Node.js project and install dependencies:

   ```shell theme={null}
   npm init -y
   npm pkg set type=module
   npm install viem dotenv
   npm install --save-dev typescript @types/node tsx
   ```

2. In the project root, create a `.env` file and add the following variables:

   ```shell theme={null}
   USDC_CONTRACT_ADDRESS=<USDC_CONTRACT_ADDRESS>
   PERMIT2_CONTRACT_ADDRESS=<PERMIT2_CONTRACT_ADDRESS>
   APPROVAL_AMOUNT=<APPROVAL_AMOUNT>
   WALLET_ADDRESS=<WALLET_ADDRESS>
   ```

   The `PERMIT2_CONTRACT_ADDRESS` is the same across all EVM blockchains
   (`0x000000000022D473030F116dDEE9F6B43aC78BA3`), but you should verify it with
   the blockchain explorer on the chain you are using. You can find the
   `USDC_CONTRACT_ADDRESS` on the
   [USDC contract address page](/stablecoins/usdc-contract-addresses).

   <Note>
     The USDC token has 6 decimals. Set the allowance to cover the expected
     payment amount plus any associated fees. For a \$100 payment, set
     `APPROVAL_AMOUNT` to at least `100000000` (100 \* 10<sup>6</sup>) plus the
     fees converted to raw USDC units.
   </Note>

   If you are following the Circle Wallets example, you will also need to add
   the following variables:

   ```shell theme={null}
   CIRCLE_WALLET_ID=<CIRCLE_WALLET_ID>
   CIRCLE_WALLETS_API_KEY=<CIRCLE_WALLETS_API_KEY>
   ENTITY_SECRET=<ENTITY_SECRET>
   ```

   If you are following the EIP-1193 Ethereum wallet example, or your Circle
   Wallet is on the generic `EVM` / `EVM-TESTNET` chain, you will also need to
   add the following variable:

   ```shell theme={null}
   RPC_URL=<RPC_URL>
   ```

3. Create an `index.ts` file. You'll add code step by step in the following
   sections. Run it with `npx tsx index.ts`.

### Grant a USDC token allowance to the `Permit2` contract

The following example code shows the process for granting a USDC token allowance
to the
[`Permit2` contract](https://etherscan.io/address/0x000000000022D473030F116dDEE9F6B43aC78BA3)
using a Circle Wallets developer-controlled wallet or an EIP-1193 Ethereum
wallet.

<Tabs>
  <Tab title="Circle Wallets">
    <Note>
      This example is for a Circle Wallets developer-controlled wallet on specific EVM
      blockchains (for example, `ETH`, `ETH-SEPOLIA`, `MATIC`, `MATIC-AMOY`, `ARC`,
      `ARC-TESTNET`, etc.). If your Circle Wallet is on the generic `EVM` /
      `EVM-TESTNET` chain, use the example in the "Circle Wallets (generic EVM)" tab.
    </Note>

    ```typescript theme={null}
    import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
    import { randomUUID } from "crypto";
    import dotenv from "dotenv";

    dotenv.config();

    export async function approveUSDCWithCircleWallets() {
      const client = initiateDeveloperControlledWalletsClient({
        apiKey: process.env.CIRCLE_WALLETS_API_KEY!,
        entitySecret: process.env.ENTITY_SECRET!,
      });

      const response = await client.createContractExecutionTransaction({
        walletId: process.env.CIRCLE_WALLET_ID!,
        contractAddress: process.env.USDC_CONTRACT_ADDRESS!,
        abiFunctionSignature: "approve(address,uint256)",
        abiParameters: [
          process.env.PERMIT2_CONTRACT_ADDRESS!,
          process.env.APPROVAL_AMOUNT!,
        ],
        idempotencyKey: randomUUID(),
        fee: { type: "level", config: { feeLevel: "MEDIUM" } },
      });

      return response.data;
    }

    /* -------- Example usage with Circle ---------

    // For auth and wallet creation, see: https://developers.circle.com/interactive-quickstarts/dev-controlled-wallets
    const response = await approveUSDCWithCircleWallets();
    console.log('Response:', response);

    ---------------------------------- */
    ```
  </Tab>

  <Tab title="Circle Wallets (generic EVM)">
    <Note>
      This example is for a Circle Wallets developer-controlled wallet on generic EVM
      blockchains (for example, `EVM`, `EVM-TESTNET`). You should create
      chain-specific Circle Wallets (for example, `ETH`, `ETH-SEPOLIA`, `MATIC`,
      `MATIC-AMOY`, `ARC`, `ARC-TESTNET`) instead of a generic EVM wallet and follow
      the example in the "Circle Wallets" tab instead. If you're migrating an existing
      integration, see
      [How-to: Migrate from transactions V1 to V2](/cpn/guides/transactions/migrate-from-txn-v1-to-v2).
    </Note>

    ```typescript theme={null}
    import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
    import {
      createPublicClient,
      http,
      encodeFunctionData,
      erc20Abi,
      type Address,
      type Hex,
    } from "viem";
    import { sepolia } from "viem/chains";
    import dotenv from "dotenv";

    dotenv.config();

    export async function signTransaction(transaction: Record<string, unknown>) {
      const client = initiateDeveloperControlledWalletsClient({
        apiKey: process.env.CIRCLE_WALLETS_API_KEY!,
        entitySecret: process.env.ENTITY_SECRET!,
      });

      const transactionJson = JSON.stringify(
        transaction,
        (_, value) => (typeof value === "bigint" ? value.toString() : value),
        2,
      );

      const response = await client.signTransaction({
        walletId: process.env.CIRCLE_WALLET_ID!,
        transaction: transactionJson,
      });

      return response.data;
    }

    export async function composeUSDCApprovalTransaction() {
      const publicClient = createPublicClient({
        chain: sepolia,
        transport: http(process.env.RPC_URL),
      });

      const data = encodeFunctionData({
        abi: erc20Abi,
        functionName: "approve",
        args: [
          process.env.PERMIT2_CONTRACT_ADDRESS as Address,
          BigInt(process.env.APPROVAL_AMOUNT!),
        ],
      });

      const fees = await publicClient.estimateFeesPerGas();

      const transaction = await publicClient.prepareTransactionRequest({
        account: process.env.SENDER_WALLET_ADDRESS as Address,
        to: process.env.USDC_CONTRACT_ADDRESS as Address,
        value: 0n,
        data,
        ...fees,
      });

      return transaction;
    }

    export async function broadcastSignedTransaction(signedTransaction: Hex) {
      const publicClient = createPublicClient({
        chain: sepolia, // use the correct chain for your wallet
        transport: http(process.env.RPC_URL),
      });

      const txHash = await publicClient.sendRawTransaction({
        serializedTransaction: signedTransaction,
      });

      return txHash;
    }

    /* -------- Example usage with Circle ---------

    // For auth and wallet creation, see: https://developers.circle.com/interactive-quickstarts/dev-controlled-wallets
    const tx = await composeUSDCApprovalTransaction();
    const signature = await signTransaction(tx);
    // Circle's API returns signedTransaction as a hex string
    const txHash = await broadcastSignedTransaction(signature.signedTransaction as Hex);

    ---------------------------------- */
    ```
  </Tab>

  <Tab title="Headless BYOW wallet">
    <Note>
      This example is for an OFI that holds its own EVM private key and signs from a
      server or other headless process. Keep the private key in a secret manager and
      never commit it to your project or expose it to a client.
    </Note>

    Add these variables to your `.env` file:

    ```shell theme={null}
    WALLET_PRIVATE_KEY=<WALLET_PRIVATE_KEY>
    RPC_URL=<RPC_URL>
    ```

    The wallet must hold enough native currency to pay for this one-time ERC-20
    approval transaction. The later CPN settlement transaction charges its gas fee
    in USDC as described in
    [Create an onchain transaction](/cpn/guides/transactions/create-an-onchain-txn).

    ```typescript theme={null}
    import {
      createPublicClient,
      createWalletClient,
      http,
      erc20Abi,
      type Address,
    } from "viem";
    import { privateKeyToAccount } from "viem/accounts";
    import { sepolia } from "viem/chains";
    import dotenv from "dotenv";

    dotenv.config();

    export async function approveUSDCWithHeadlessWallet() {
      const account = privateKeyToAccount(
        process.env.WALLET_PRIVATE_KEY as `0x${string}`,
      );
      const walletClient = createWalletClient({
        account,
        chain: sepolia,
        transport: http(process.env.RPC_URL),
      });
      const publicClient = createPublicClient({
        chain: sepolia,
        transport: http(process.env.RPC_URL),
      });

      const hash = await walletClient.writeContract({
        address: process.env.USDC_CONTRACT_ADDRESS as Address,
        abi: erc20Abi,
        functionName: "approve",
        args: [
          process.env.PERMIT2_CONTRACT_ADDRESS as Address,
          BigInt(process.env.APPROVAL_AMOUNT!),
        ],
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      return { hash, receipt };
    }

    const result = await approveUSDCWithHeadlessWallet();
    console.log("Approval transaction:", result.hash);
    ```
  </Tab>

  <Tab title="EIP-1193 Ethereum Wallet">
    ```typescript theme={null}
    import {
      createWalletClient,
      createPublicClient,
      http,
      custom,
      erc20Abi,
      type Address,
      type EIP1193Provider,
    } from "viem";
    import { sepolia } from "viem/chains";
    import dotenv from "dotenv";

    dotenv.config();

    export async function approveUSDCWithEIP1193Wallet(provider: EIP1193Provider) {
      const publicClient = createPublicClient({
        chain: sepolia,
        transport: http(process.env.RPC_URL),
      });

      const walletClient = createWalletClient({
        account: process.env.WALLET_ADDRESS as Address,
        chain: sepolia,
        transport: custom(provider),
      });

      const hash = await walletClient.writeContract({
        address: process.env.USDC_CONTRACT_ADDRESS as Address,
        abi: erc20Abi,
        functionName: "approve",
        args: [
          process.env.PERMIT2_CONTRACT_ADDRESS as Address,
          BigInt(process.env.APPROVAL_AMOUNT!),
        ],
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      return { hash, receipt };
    }

    /* -------- Example usage with EIP-1193 wallet ---------

    // Refer to https://viem.sh/docs/clients/transports/custom and your wallet provider's documentation for the provider object.
    const { hash, receipt } = await approveUSDCWithEIP1193Wallet(window.ethereum as EIP1193Provider);
    console.log('Hash:', hash);
    console.log('Receipt:', receipt);

    ---------------------------------- */
    ```
  </Tab>
</Tabs>

For a BYOW OFI, the preceding approval is a one-time ERC-20 transaction. After
it confirms, use the same wallet to sign the EIP-712 `messageToBeSigned`
returned by the
[create transaction V2 endpoint](/api-reference/cpn/cpn-platform/create-transaction-v2).
Submit the resulting signature in the `signedTransaction` field of the
[submit transaction V2 endpoint](/api-reference/cpn/cpn-platform/submit-transaction-v2).
