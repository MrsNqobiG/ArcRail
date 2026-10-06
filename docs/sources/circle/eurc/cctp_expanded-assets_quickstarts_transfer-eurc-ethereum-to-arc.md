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

# Transfer EURC from Ethereum to Arc

> Send EURC from Ethereum Sepolia to Arc Testnet end to end with CCTP for non-USDC.

Approve the source `TokenManager`, fetch a fee quote from Iris, and initiate a
fast transfer of EURC from Ethereum Sepolia to Arc Testnet. This route uses the
sandbox EURC token ID that Iris lists on domains 0 and 26. The same pattern
applies to any configured token—swap in another `tokenId` and destination domain
as needed.

<Warning>
  This quickstart uses fast transfer (`minFinalityThreshold = 1000`). Fast
  transfers require Iris FX pricing to be configured for the token. If Iris
  returns `FX_SYMBOL_NOT_CONFIGURED`, use standard transfer instead
  (`minFinalityThreshold = 2000`, omit `PRE_FINALITY` from the quote `requests`
  array). See step 7 for details.
</Warning>

## Prerequisites

Before you begin, ensure that you've:

* Installed [Node.js v22+](https://nodejs.org/)
* Prepared an EVM testnet wallet with the private key available
  * Added Arc Testnet to your wallet
    ([network details](https://docs.arc.io/arc/references/connect-to-arc#wallet-setup))
* Funded your wallet with the following testnet tokens:
  * Sepolia ETH (native token) from a
    [public faucet](https://cloud.google.com/application/web3/faucet/ethereum/sepolia)
  * Sepolia EURC from the [Circle Faucet](https://faucet.circle.com)
  * Arc Testnet ETH if you plan to submit the destination mint yourself

## Step 1: Set up the project

### 1.1. Create the project and install dependencies

```bash theme={null}
# Set up your directory and initialize a Node.js project
mkdir cctpx-quickstart
cd cctpx-quickstart
npm init -y

# Set up module type and start command
npm pkg set type=module
npm pkg set scripts.start="tsx --env-file=.env index.ts"

# Install runtime dependencies
npm install viem

# Install dev dependencies
npm install --save-dev @types/node tsx typescript
```

### 1.2. Configure TypeScript (optional)

<Tip>
  This step is optional. It helps prevent missing types in your IDE or editor.
</Tip>

Create a `tsconfig.json` file:

```shell theme={null}
npx tsc --init
```

Then, update the `tsconfig.json` file:

```shell theme={null}
cat <<'EOF' > tsconfig.json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "types": ["node"]
  }
}
EOF
```

### 1.3. Set environment variables

Open `.env` in your editor and add:

```text theme={null}
PRIVATE_KEY=YOUR_ETHEREUM_SEPOLIA_PRIVATE_KEY
```

* `PRIVATE_KEY` is the private key for the Ethereum Sepolia EOA that signs the
  source chain approval and transfer transactions. The direct-mint path also
  uses the same key to submit the destination mint on Arc Testnet.

<Tip>
  Open `.env` in your editor rather than writing values with shell commands, and
  add `.env` to your `.gitignore`. This prevents credentials from leaking into
  your shell history or version control.
</Tip>

The `npm run start` command loads variables from `.env` using Node.js native
env-file support.

<Warning>
  This example uses one or more private keys for local testing. In production,
  use a secure key management solution and never expose or share private keys.
</Warning>

## Step 2: Configure clients and addresses

Create `index.ts` and configure clients for Ethereum Sepolia and Arc Testnet.

```typescript TypeScript theme={null}
import {
  createPublicClient,
  createWalletClient,
  encodePacked,
  http,
  zeroAddress,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet, sepolia } from "viem/chains";

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);

const sepoliaPublic = createPublicClient({
  chain: sepolia,
  transport: http(),
});

const sepoliaWallet = createWalletClient({
  account,
  chain: sepolia,
  transport: http(),
});

const arcPublic = createPublicClient({
  chain: arcTestnet,
  transport: http(),
});

const arcWallet = createWalletClient({
  account,
  chain: arcTestnet,
  transport: http(),
});

const SEPOLIA_CCTS = "0x63753E722bd2C2A5DF6EE19C5106662208B81077" as const;
const ARC_CCTS = "0x63753E722bd2C2A5DF6EE19C5106662208B81077" as const;
const ARC_MESSAGE_TRANSMITTER =
  "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275" as const;
const ETHEREUM_DOMAIN = 0;
const ARC_DOMAIN = 26;
const IRIS_BASE = "https://iris-api-sandbox.circle.com";

// Sandbox EURC — Iris deployments on domains 0 (Sepolia) and 26 (Arc)
const tokenId =
  "0x2587821a0ee7daa174b95436b5dab1731cfa1844775b010217d3c0dd02a4eecd" as `0x${string}`;
const recipientOnArc = account.address;
```

The Arc wallet is only required for the direct mint path. For forwarded mint,
`arcPublic` is enough to confirm the destination balance.

## Step 3: Fetch token metadata

Query the Iris API to retrieve the token's decimal precision. Use the returned
`decimals` value to express the transfer amount in the token's smallest unit.
EURC uses 6 decimals.

```typescript TypeScript theme={null}
type CctpxTokenInfo = {
  tokenId: string;
  name: string;
  symbol: string;
  decimals: number;
};

const tokenInfoRes = await fetch(
  `${IRIS_BASE}/v2/cctpx/tokens?tokenid=${tokenId}`,
);
if (!tokenInfoRes.ok) {
  throw new Error(await tokenInfoRes.text());
}

const { data: tokenList } = (await tokenInfoRes.json()) as {
  data: CctpxTokenInfo[];
};
const tokenInfo = tokenList[0];
if (!tokenInfo) {
  throw new Error(`Token ${tokenId} not found`);
}

const tokenDecimals = tokenInfo.decimals;
const transferAmount = 10n ** BigInt(tokenDecimals) / 10n; // 0.1 EURC
```

## Step 4: Approve the source `TokenManager`

Approval goes to the per-token `TokenManager`, not to `CrossChainTokenService`.
Read the local `TokenManager` address from the service, then call `approve` on
the token.

```typescript TypeScript theme={null}
const serviceAbi = [
  {
    name: "resolveTokenManager",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "bytes32" }],
    outputs: [{ name: "tokenManager", type: "address" }],
  },
  {
    name: "resolveTokenAddress",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "bytes32" }],
    outputs: [{ name: "token", type: "address" }],
  },
] as const;

const tokenManager = await sepoliaPublic.readContract({
  address: SEPOLIA_CCTS,
  abi: serviceAbi,
  functionName: "resolveTokenManager",
  args: [tokenId],
});

const tokenAddress = await sepoliaPublic.readContract({
  address: SEPOLIA_CCTS,
  abi: serviceAbi,
  functionName: "resolveTokenAddress",
  args: [tokenId],
});

const erc20Abi = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "ok", type: "bool" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "balance", type: "uint256" }],
  },
] as const;

const approveHash = await sepoliaWallet.writeContract({
  address: tokenAddress,
  abi: erc20Abi,
  functionName: "approve",
  args: [tokenManager, transferAmount],
});

await sepoliaPublic.waitForTransactionReceipt({ hash: approveHash });
```

## Step 5: Check the fast transfer allowance

This quickstart uses a
[fast transfer](/cctp/expanded-assets/concepts/architecture#transfer-finality-and-fast-burn-allowance)
(`minFinalityThreshold = 1000`), which consumes per-token fast burn allowance.
Confirm remaining capacity before you quote fees.

```typescript TypeScript theme={null}
type CctpxAllowance = {
  tokenId: string;
  allowance: number;
};

const allowanceRes = await fetch(`${IRIS_BASE}/v2/cctpx/allowances`);
if (!allowanceRes.ok) {
  throw new Error(await allowanceRes.text());
}

const allowanceBody = (await allowanceRes.json()) as {
  allowances: CctpxAllowance[];
};
const allowance = allowanceBody.allowances.find(
  (item) => item.tokenId.toLowerCase() === tokenId.toLowerCase(),
)?.allowance;

if (
  allowance === undefined ||
  allowance < Number(transferAmount / 10n ** BigInt(tokenDecimals))
) {
  throw new Error("Insufficient CCTPx allowance for a fast transfer");
}
```

## Step 6: Get a fee quote

Both paths call the same Iris fee-quote endpoint. Forwarding is selected in the
quote `requests` array—not by a different source chain function. Use **Forwarded
mint** to have Circle complete the destination mint, or **Direct mint** to
submit `receiveMessage` yourself.

<Tabs>
  <Tab title="Forwarded mint">
    Include a `FORWARD` request so the quote covers destination mint gas. Pass the
    Arc Testnet recipient as `destinationAddress` in the forward params.

    ```typescript TypeScript theme={null}
    type FeeQuote = {
      signedQuote: `0x${string}`;
      feeTotalAmount: string;
    };

    async function fetchFeeQuote(): Promise<FeeQuote> {
      const response = await fetch(
        `${IRIS_BASE}/v2/quote/cctpx/${tokenId}/${ETHEREUM_DOMAIN}/${ARC_DOMAIN}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: transferAmount.toString(),
            feeToken: zeroAddress,
            requests: [
              { type: "PRE_FINALITY" },
              {
                type: "FORWARD",
                params: {
                  msgType: "TransferMessage",
                  destinationAddress: recipientOnArc,
                },
              },
            ],
          }),
        },
      );

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    }

    const quote = await fetchFeeQuote();
    ```
  </Tab>

  <Tab title="Direct mint">
    Request pre-finality fees only. You will poll Iris and mint on Arc Testnet in a
    later step.

    ```typescript TypeScript theme={null}
    type FeeQuote = {
      signedQuote: `0x${string}`;
      feeTotalAmount: string;
    };

    async function fetchFeeQuote(): Promise<FeeQuote> {
      const response = await fetch(
        `${IRIS_BASE}/v2/quote/cctpx/${tokenId}/${ETHEREUM_DOMAIN}/${ARC_DOMAIN}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: transferAmount.toString(),
            feeToken: zeroAddress,
            requests: [{ type: "PRE_FINALITY" }],
          }),
        },
      );

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    }

    const quote = await fetchFeeQuote();
    ```
  </Tab>
</Tabs>

## Step 7: Initiate the transfer

Call `crossChainTransfer` on the source service. The onchain call is the same
for both completion paths. The example uses `bytes32(0)` for `destinationCaller`
to allow permissionless relay, and `1000` for `minFinalityThreshold` to use a
fast transfer. For standard finality, use `2000` instead and omit `PRE_FINALITY`
from the quote—see
[Transfer finality and fast burn allowance](/cctp/expanded-assets/concepts/architecture#transfer-finality-and-fast-burn-allowance).

On EVM, `destinationAddress` must be the raw packed 20-byte address. Do not
ABI-encode it to 32 bytes.

```typescript TypeScript theme={null}
const transferAbi = [
  {
    name: "crossChainTransfer",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "tokenId", type: "bytes32" },
      { name: "amount", type: "uint256" },
      { name: "destinationDomain", type: "uint32" },
      { name: "destinationAddress", type: "bytes" },
      { name: "destinationCaller", type: "bytes32" },
      { name: "minFinalityThreshold", type: "uint32" },
      {
        name: "claim",
        type: "tuple",
        components: [
          { name: "signedQuote", type: "bytes" },
          { name: "refundAddress", type: "address" },
        ],
      },
      { name: "autoExecuteHookData", type: "bool" },
      { name: "hookData", type: "bytes" },
    ],
    outputs: [],
  },
] as const;

const destinationAddress = encodePacked(["address"], [recipientOnArc]);
const ZERO_BYTES32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as const;

const claim = {
  signedQuote: quote.signedQuote,
  refundAddress: zeroAddress,
};
const feeTotalAmount = BigInt(quote.feeTotalAmount);

const transferHash = await sepoliaWallet.writeContract({
  address: SEPOLIA_CCTS,
  abi: transferAbi,
  functionName: "crossChainTransfer",
  args: [
    tokenId,
    transferAmount,
    ARC_DOMAIN,
    destinationAddress,
    ZERO_BYTES32,
    1000,
    claim,
    false,
    "0x",
  ],
  value: feeTotalAmount,
});

console.log(`Source transaction: ${transferHash}`);
```

## Step 8: Complete the transfer on Arc Testnet

Choose the completion path that matches the fee quote you requested in Step 6.

<Tabs>
  <Tab title="Forwarded mint">
    When the quote includes `FORWARD`, Circle submits the destination mint. Resolve
    the token on Arc Testnet and wait until the recipient balance increases.

    ```typescript TypeScript theme={null}
    const destinationTokenAddress = await arcPublic.readContract({
      address: ARC_CCTS,
      abi: serviceAbi,
      functionName: "resolveTokenAddress",
      args: [tokenId],
    });

    const startingBalance = await arcPublic.readContract({
      address: destinationTokenAddress,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [recipientOnArc],
    });

    async function waitForDestinationBalance(
      maxAttempts: number = 60,
    ): Promise<void> {
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const balance = await arcPublic.readContract({
          address: destinationTokenAddress,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [recipientOnArc],
        });

        if (balance >= startingBalance + transferAmount) {
          console.log(
            `Mint complete on Arc Testnet. Destination balance: ${balance}`,
          );
          return;
        }

        await new Promise((r) => setTimeout(r, 5000));
      }

      throw new Error("Forwarded mint did not complete in time");
    }

    await waitForDestinationBalance();
    ```
  </Tab>

  <Tab title="Direct mint">
    Poll the Iris API until the attestation is ready, then submit `receiveMessage`
    to the Arc Testnet `MessageTransmitterV2`. For the contract address and ABI, see
    [Contract Addresses](/cctp/expanded-assets/references/contract-addresses) and
    the [CCTP Contract Interfaces](/cctp/references/contract-interfaces).

    ```typescript TypeScript theme={null}
    type IrisMessage = {
      status: "pending_confirmations" | "complete";
      attestation: `0x${string}`;
      message: `0x${string}`;
    };

    type IrisResponse = { messages: IrisMessage[] };

    async function pollAttestation(
      sourceDomain: number,
      txHash: `0x${string}`,
      maxAttempts: number = 60,
    ): Promise<IrisMessage> {
      const url = `${IRIS_BASE}/v2/messages/${sourceDomain}?transactionHash=${txHash}`;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const res = await fetch(url);
        if (res.ok) {
          const body = (await res.json()) as IrisResponse;
          const msg = body.messages?.[0];
          if (msg && msg.status === "complete") {
            return msg;
          }
        }
        await new Promise((r) => setTimeout(r, 5000));
      }
      throw new Error(`Attestation for ${txHash} did not complete in time`);
    }

    const attestation = await pollAttestation(ETHEREUM_DOMAIN, transferHash);

    const messageTransmitterAbi = [
      {
        name: "receiveMessage",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
          { name: "message", type: "bytes" },
          { name: "attestation", type: "bytes" },
        ],
        outputs: [{ name: "success", type: "bool" }],
      },
    ] as const;

    const receiveHash = await arcWallet.writeContract({
      address: ARC_MESSAGE_TRANSMITTER,
      abi: messageTransmitterAbi,
      functionName: "receiveMessage",
      args: [attestation.message, attestation.attestation],
    });

    await arcPublic.waitForTransactionReceipt({ hash: receiveHash });
    console.log(`Mint complete on Arc Testnet: ${receiveHash}`);
    ```
  </Tab>
</Tabs>

After the transfer completes, the recipient holds the transferred EURC on Arc
Testnet. Verify by reading the recipient's balance on the Arc Testnet deployment
(`0x89b50855Aa3bE2f677Cd6303CeC089b5f319D72A`).
