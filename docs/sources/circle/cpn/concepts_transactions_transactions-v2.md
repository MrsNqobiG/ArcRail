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

# Transactions V2

Transactions V2 is CPN's onchain transaction path. It enables secure and
compliant stablecoin settlement across all blockchains that
[CPN supports](/cpn/references/blockchains/supported-blockchains), managing gas
fees, signing, and orchestration on your behalf.

## Gas abstraction

Transactions V2 provides gas abstraction which removes the requirement for you
to pay native tokens for gas fees during transaction broadcast. This provides a
lower-complexity operational model for you by eliminating the need to acquire
and maintain a native token balance in your wallet.

When a Transaction V2 quote is created, the `fees` field includes a fixed gas
fee denoted in USDC. This gas fee is valid as long as the payment remains
active. During transaction settlement, the payment settlement smart contract
withdraws the fee amount from your wallet and distributes it to the beneficiary.

The transaction fee you pay is fixed regardless of fluctuations of the native
blockchain gas fee levels. CPN ensures that the transaction gets broadcast
accurately and on time. This removes the need for manual acceleration and
monitoring by delegating it to CPN.

## EVM payment settlement contract and `Permit2`

In EVM blockchains, Transactions V2 uses a payment settlement smart contract
that allows you to send verified payments to the BFI that are authorized by you,
an attester (CPN), and (optionally) the BFI. The contract ensures that the
transaction is accurate and correct, and can serve as proof of payment after the
transaction has settled.

The payment settlement contract uses the `Permit2` contract, Uniswap's universal
token approval system, for token approvals. `Permit2` makes integrations more
straightforward by using gasless, offchain signatures for token transfers.
`Permit2` permits are signature-based, time-bound, and single-use.

The payment settlement smart contract uses `Permit2` to execute funds transfer
from your wallet to the recipient wallet in a single contract execution. In
practice, this means that you sign an EIP-712 typed-data message of the
`PermitWitnessTransferFrom` method call to allow the payment settlement smart
contract to transfer USDC out of your wallet and into the recipient wallet.

```json JSON theme={null}
{
  "types": {
    "EIP712Domain": [
      {
        "name": "name",
        "type": "string"
      },
      {
        "name": "chainId",
        "type": "uint256"
      },
      {
        "name": "verifyingContract",
        "type": "address"
      }
    ],
    "PermitWitnessTransferFrom": [
      { "name": "permitted", "type": "TokenPermissions" },
      { "name": "spender", "type": "address" },
      { "name": "nonce", "type": "uint256" },
      { "name": "deadline", "type": "uint256" },
      { "name": "witness", "type": "PaymentIntent" }
    ],
    "TokenPermissions": [
      { "name": "token", "type": "address" },
      { "name": "amount", "type": "uint256" }
    ],
    "PaymentIntent": [
      { "name": "from", "type": "address" },
      { "name": "to", "type": "address" },
      { "name": "value", "type": "uint256" },
      { "name": "validAfter", "type": "uint256" },
      { "name": "validBefore", "type": "uint256" },
      { "name": "nonce", "type": "bytes32" },
      { "name": "beneficiary", "type": "address" },
      { "name": "maxFee", "type": "uint256" },
      { "name": "requirePayeeSign", "type": "bool" },
      { "name": "attester", "type": "address" }
    ]
  },
  "domain": {
    "name": "Permit2",
    "chainId": 11155111,
    "verifyingContract": "PERMIT2_ADDRESS"
  },
  "message": {
    "permitted": {
      "token": "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
      "amount": "100050000"
    },
    "spender": "CPN_SMART_CONTRACT_ADDRESS",
    "nonce": "0",
    "deadline": "1234567890",
    "witness": {
      "from": "OFI_PAYER_ADDRESS",
      "to": "BFI_PAYEE_ADDRESS",
      "value": "100000000",
      "validAfter": "0",
      "validBefore": "1234567890",
      "nonce": "ONCHAIN_PAYMENT_REF",
      "beneficiary": "CIRCLE_BENEFICIARY_ADDRESS",
      "maxFee": "50000",
      "requirePayeeSign": false,
      "attester": "CPN_WALLET_ADDRESS"
    }
  },
  "primaryType": "PermitWitnessTransferFrom"
}
```

### `Permit2` allowance

The use of `Permit2` requires you to grant an allowance of USDC to the `Permit2`
contract ahead of the payment. This allowance grants the `Permit2` contract
permission to transfer USDC from your wallet in a CPN settlement. When you sign
a CPN transaction, that transaction allows the payment settlement contract to
consume the USDC allowance previously granted to `Permit2`.

The allowance amount must cover the payment amount and associated fees. It can
be set to a specific value based on the expected payment volume or to the
maximum `uint256` value for unlimited transfers. The allowance is the
foundational authorization that makes the entire CPN payment settlement system
possible through `Permit2`'s signature-based transfer mechanism.
