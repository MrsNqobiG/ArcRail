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

# How-to: Bridge USDC and EURC with CCTP

> Move USDC and EURC to and from Arc using Cross-Chain Transfer Protocol for exchange hot wallet funding and liquidity rebalancing.

[Circle's Cross-Chain Transfer Protocol (CCTP)](https://developers.circle.com/cctp)
uses a burn-and-mint model to natively transfer USDC and EURC between
blockchains without wrapped or bridged token variants. Arc's CCTP domain is
`26`. Transfers into Arc mint tokens directly to your recipient address;
transfers out burn tokens on Arc and mint on the destination blockchain. Because
Arc has [deterministic finality](/arc/concepts/deterministic-finality), outbound
transfers reach attestation faster than transfers from blockchains that require
multiple confirmations.

## Prerequisites

Before you begin, ensure that you've:

* Obtained an RPC endpoint for Arc Testnet (`https://rpc.testnet.arc.io`)
* Obtained an RPC endpoint for the source or destination blockchain (for
  example, Ethereum Sepolia)
* Acquired a USDC or EURC balance on the sending blockchain
* Reviewed the
  [CCTP developer docs](https://developers.circle.com/stablecoins/cctp-getting-started)
* Installed `viem` in your TypeScript environment

<Warning>
  Test against Arc Testnet only. Local EVM simulators run a standard EVM. They
  don't replicate EIP-7708 Transfer events, the USDC precompile, or blocklist
  enforcement.
</Warning>

## Contract addresses

| Contract | Address | Domain |
| :- | :- | :- |
| **TokenMessengerV2** (Arc) | [`0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA`](https://explorer.testnet.arc.io/address/0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA) | 26 |
| **MessageTransmitterV2** (Arc) | [`0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275`](https://explorer.testnet.arc.io/address/0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275) | 26 |
| **USDC ERC-20** (Arc) | [`0x3600000000000000000000000000000000000000`](https://explorer.testnet.arc.io/address/0x3600000000000000000000000000000000000000) | — |
| **EURC ERC-20** (Arc) | [`0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a`](https://explorer.testnet.arc.io/address/0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a) | — |

<Info>
  For CCTP contract addresses on other blockchains, see the [CCTP contract
  addresses](https://developers.circle.com/stablecoins/evm-smart-contracts)
  reference.
</Info>

## Bridge USDC and EURC between Arc and other blockchains

Use the inbound workflow to fund your exchange hot wallet on Arc from another
blockchain, and the outbound workflow to rebalance liquidity from Arc to another
blockchain.

<Tabs>
  <Tab title="Inbound (into Arc)">
    ### Step 1. Format the recipient address

    CCTP requires the recipient as a `bytes32` value. Left-pad the 20-byte Ethereum
    address with zeros:

    ```typescript theme={null}
    import { pad, type Address } from "viem";

    const recipientAddress: Address = "0xYourArcHotWalletAddress";
    const mintRecipient = pad(recipientAddress, { size: 32 });
    ```

    ### Step 2. Approve USDC on the source blockchain

    Approve the source blockchain's TokenMessengerV2 contract to spend your USDC:

    ```typescript theme={null}
    import { parseUnits } from "viem";

    const amount = parseUnits("10000", 6); // 10,000 USDC

    const approvalTx = await sourceWalletClient.writeContract({
      address: SOURCE_USDC_ADDRESS,
      abi: [
        {
          name: "approve",
          type: "function",
          inputs: [
            { name: "spender", type: "address" },
            { name: "amount", type: "uint256" },
          ],
          outputs: [{ type: "bool" }],
          stateMutability: "nonpayable",
        },
      ],
      functionName: "approve",
      args: [SOURCE_TOKEN_MESSENGER_ADDRESS, amount],
    });
    ```

    ### Step 3. Call `depositForBurn` on the source blockchain

    Burn USDC on the source blockchain, targeting Arc (domain `26`):

    ```typescript theme={null}
    const ARC_DOMAIN = 26;

    const burnTx = await sourceWalletClient.writeContract({
      address: SOURCE_TOKEN_MESSENGER_ADDRESS,
      abi: [
        {
          name: "depositForBurn",
          type: "function",
          inputs: [
            { name: "amount", type: "uint256" },
            { name: "destinationDomain", type: "uint32" },
            { name: "mintRecipient", type: "bytes32" },
            { name: "burnToken", type: "address" },
          ],
          outputs: [{ type: "uint64" }],
          stateMutability: "nonpayable",
        },
      ],
      functionName: "depositForBurn",
      args: [amount, ARC_DOMAIN, mintRecipient, SOURCE_USDC_ADDRESS],
    });
    ```

    ### Step 4. Retrieve the message hash

    After the burn transaction confirms, extract the `MessageSent` event to get the
    message hash:

    ```typescript theme={null}
    const burnReceipt = await sourcePublicClient.waitForTransactionReceipt({
      hash: burnTx,
    });

    const messageSentEvent = burnReceipt.logs.find(
      (log) =>
        log.topics[0] ===
        "0x2fa9ca894982930190727e75500a97d8dc500233a5065e0f3126c48fbe0343c0",
    );

    const messageBytes = messageSentEvent?.data;
    const messageHash = keccak256(messageBytes!);
    ```

    ### Step 5. Wait for attestation

    Poll Circle's attestation service until the attestation is available:

    ```typescript theme={null}
    async function getAttestation(messageHash: string): Promise<string> {
      const url = `https://iris-api.circle.com/v2/attestations/${messageHash}`;

      while (true) {
        const response = await fetch(url);
        const data = await response.json();

        if (data.status === "complete") {
          return data.attestation;
        }

        // Poll every 10 seconds
        await new Promise((resolve) => setTimeout(resolve, 10_000));
      }
    }

    const attestation = await getAttestation(messageHash);
    ```

    <Note>
      Attestation typically takes approximately 60 seconds but varies based on the
      source blockchain's finality time. Transfers from blockchains with longer
      finality (such as Ethereum) take longer than those from blockchains with fast
      finality.
    </Note>

    ### Step 6. Call `receiveMessage` on Arc

    Submit the message and attestation to Arc's MessageTransmitterV2 to mint USDC:

    ```typescript theme={null}
    const ARC_MESSAGE_TRANSMITTER = "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275";

    const receiveTx = await arcWalletClient.writeContract({
      address: ARC_MESSAGE_TRANSMITTER,
      abi: [
        {
          name: "receiveMessage",
          type: "function",
          inputs: [
            { name: "message", type: "bytes" },
            { name: "attestation", type: "bytes" },
          ],
          outputs: [{ type: "bool" }],
          stateMutability: "nonpayable",
        },
      ],
      functionName: "receiveMessage",
      args: [messageBytes, attestation],
    });
    ```

    Once the transaction confirms, USDC is minted to the recipient address on Arc.
  </Tab>

  <Tab title="Outbound (out of Arc)">
    ### Step 1. Format the recipient address

    Pad the destination address to `bytes32`:

    ```typescript theme={null}
    import { pad, type Address } from "viem";

    const destinationAddress: Address = "0xYourDestinationAddress";
    const mintRecipient = pad(destinationAddress, { size: 32 });
    ```

    ### Step 2. Approve USDC on Arc

    Approve Arc's TokenMessengerV2 to spend your USDC:

    ```typescript theme={null}
    import { parseUnits } from "viem";

    const ARC_USDC = "0x3600000000000000000000000000000000000000";
    const ARC_TOKEN_MESSENGER = "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA";
    const amount = parseUnits("10000", 6); // 10,000 USDC

    const approvalTx = await arcWalletClient.writeContract({
      address: ARC_USDC,
      abi: [
        {
          name: "approve",
          type: "function",
          inputs: [
            { name: "spender", type: "address" },
            { name: "amount", type: "uint256" },
          ],
          outputs: [{ type: "bool" }],
          stateMutability: "nonpayable",
        },
      ],
      functionName: "approve",
      args: [ARC_TOKEN_MESSENGER, amount],
    });
    ```

    ### Step 3. Call `depositForBurn` on Arc

    Burn USDC on Arc, targeting the destination domain:

    ```typescript theme={null}
    // Example: Ethereum = 0, Avalanche = 1, Arbitrum = 3
    const DESTINATION_DOMAIN = 0; // Replace with your target domain

    const burnTx = await arcWalletClient.writeContract({
      address: ARC_TOKEN_MESSENGER,
      abi: [
        {
          name: "depositForBurn",
          type: "function",
          inputs: [
            { name: "amount", type: "uint256" },
            { name: "destinationDomain", type: "uint32" },
            { name: "mintRecipient", type: "bytes32" },
            { name: "burnToken", type: "address" },
          ],
          outputs: [{ type: "uint64" }],
          stateMutability: "nonpayable",
        },
      ],
      functionName: "depositForBurn",
      args: [amount, DESTINATION_DOMAIN, mintRecipient, ARC_USDC],
    });
    ```

    ### Step 4. Retrieve the message hash

    Extract the message from the burn transaction receipt:

    ```typescript theme={null}
    const burnReceipt = await arcPublicClient.waitForTransactionReceipt({
      hash: burnTx,
    });

    const messageSentEvent = burnReceipt.logs.find(
      (log) =>
        log.topics[0] ===
        "0x2fa9ca894982930190727e75500a97d8dc500233a5065e0f3126c48fbe0343c0",
    );

    const messageBytes = messageSentEvent?.data;
    const messageHash = keccak256(messageBytes!);
    ```

    ### Step 5. Wait for attestation

    Poll for the attestation. Because Arc has deterministic finality, attestation
    for outbound transfers is typically faster:

    ```typescript theme={null}
    const attestation = await getAttestation(messageHash);
    ```

    <Check>
      Outbound transfers from Arc benefit from deterministic finality. The
      attestation service can process the message once the block is produced,
      without waiting for additional confirmations.
    </Check>

    ### Step 6. Call `receiveMessage` on the destination blockchain

    Submit the message and attestation to the destination blockchain's
    MessageTransmitterV2:

    ```typescript theme={null}
    const receiveTx = await destinationWalletClient.writeContract({
      address: DESTINATION_MESSAGE_TRANSMITTER,
      abi: [
        {
          name: "receiveMessage",
          type: "function",
          inputs: [
            { name: "message", type: "bytes" },
            { name: "attestation", type: "bytes" },
          ],
          outputs: [{ type: "bool" }],
          stateMutability: "nonpayable",
        },
      ],
      functionName: "receiveMessage",
      args: [messageBytes, attestation],
    });
    ```

    Once confirmed, USDC is minted to the recipient on the destination blockchain.
  </Tab>
</Tabs>

## Monitor transfer status

Track a CCTP transfer by polling the attestation API:

```typescript theme={null}
import { keccak256 } from "viem";

async function checkTransferStatus(messageHash: string) {
  const response = await fetch(
    `https://iris-api.circle.com/v2/attestations/${messageHash}`,
  );
  const data = await response.json();

  // Possible statuses: "pending", "complete"
  return data.status;
}
```

<Warning>
  Each CCTP message can only be received once. If `receiveMessage` reverts,
  verify that the message has not already been processed by checking the
  `usedNonces` mapping on the destination MessageTransmitterV2 contract.
</Warning>

## CCTP V2 `depositForBurnWithHook`

CCTP V2 introduces `depositForBurnWithHook`, which allows you to specify a
destination caller and attach a hook for post-mint actions. This is useful for
triggering automated workflows (such as depositing into a vault) immediately
after USDC is minted:

```typescript theme={null}
const burnWithHookTx = await arcWalletClient.writeContract({
  address: ARC_TOKEN_MESSENGER,
  abi: [
    {
      name: "depositForBurnWithHook",
      type: "function",
      inputs: [
        { name: "amount", type: "uint256" },
        { name: "destinationDomain", type: "uint32" },
        { name: "mintRecipient", type: "bytes32" },
        { name: "burnToken", type: "address" },
        { name: "destinationCaller", type: "bytes32" },
        { name: "hookData", type: "bytes" },
      ],
      outputs: [{ type: "uint64" }],
      stateMutability: "nonpayable",
    },
  ],
  functionName: "depositForBurnWithHook",
  args: [
    amount,
    DESTINATION_DOMAIN,
    mintRecipient,
    ARC_USDC,
    destinationCaller, // bytes32-padded address authorized to call receiveMessage
    hookData, // Encoded calldata for post-mint execution
  ],
});
```

<Note>
  When `destinationCaller` is set to a non-zero value, only that address can
  call `receiveMessage` for this transfer on the destination blockchain. Set it
  to `0x000000` to allow any address to complete the transfer.
</Note>
