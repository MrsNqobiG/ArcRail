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

# JSON Schema

CPN uses [JSON Schema](https://json-schema.org/) to define and validate the
structure of JSON data used to pass RFI data. A JSON Schema is a blueprint for
the compliance data that OFIs must provide. CPN uses the
[Draft 2020-12](https://json-schema.org/draft/2020-12) version of the JSON
Schema standard.

Using JSON Schema to define the structure of this data has the following
benefits:

* **Clarity:** the schema defines every requirement programmatically, including
  required fields, data types, formats, and structures. This eliminates
  guesswork.
* **Client-side validation:** OFIs can validate their response against the
  schema before making the API call, providing instant feedback for developers
  and preventing common integration errors.
* **Rich data structures:** schemas support complex requirements like nested
  address objects and conditional logic.

## Interpreting JSON Schema

When you call the
[get details for an RFI endpoint](/api-reference/cpn/cpn-platform/get-rfi), the
API returns the JSON Schema for the required response data. The following are
key parts of the schemas to understand when reading them:

* `properties`: defines the fields you can provide in your JSON response
* `required`: contains a list of field names that must be present in the
  response
* `$defs` and `$ref`: usable complex objects (defined in `$defs` and referenced
  using the `$ref` directive)

## Client-side validation

JSON Schema allows you to validate your response before sending it to the API.
CPN expects that OFIs perform client-side validation against the provided schema
before submitting a response to CPN. Doing so provides a first line of defense
to reduce API errors and failed payments.

Common libraries for JSON Schema validation are:

* **Java:**
  [`networknt/json-schema-validator`](https://github.com/networknt/json-schema-validator)
* **Python:**
  [`jsonschema`](https://python-jsonschema.readthedocs.io/en/stable/)
* **Node.js:** [`ajv`](https://ajv.js.org/)

### Additional validation

JSON Schema validates structure and format only. You are still responsible for
ensuring the data is contextually correct. The schema ensures that you send the
data in the correct shape; you ensure the data is accurate. For example, you can
[validate CNPJ and CPF numbers using their check digits](/cpn/references/compliance/validating-brazil-tax-account-id)
or [validate IBAN account numbers](/cpn/references/compliance/validating-iban).
