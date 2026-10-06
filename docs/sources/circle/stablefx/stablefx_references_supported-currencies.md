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

# StableFX supported currencies

> The currencies supported by StableFX for FX swaps

StableFX supports the following currencies for FX swaps:

| Token | Currency | Issuer | Arc mainnet address |
| - | - | - | - |
| USDC | United States dollar | Circle | [`0x3600000000000000000000000000000000000000`](https://explorer.arc.io/token/0x3600000000000000000000000000000000000000) |
| EURC | Euro | Circle | [`0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1`](https://explorer.arc.io/token/0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1) |
| AUDD | Australian dollar | Novatti | [`0xdeC15d98D8C16d9cA2F8Cc94bA4B88FE4f259393`](https://explorer.arc.io/token/0xdeC15d98D8C16d9cA2F8Cc94bA4B88FE4f259393) |
| AUDF | Australian dollar | Forte Securities Australia | [`0xd2a530170D71a9Cfe1651Fb468E2B98F7Ed7456b`](https://explorer.arc.io/token/0xd2a530170D71a9Cfe1651Fb468E2B98F7Ed7456b) |
| BRLA | Brazilian real | Avenia | [`0x75700e137c05B2beb2b3A436cCB551652E3D8B11`](https://explorer.arc.io/token/0x75700e137c05B2beb2b3A436cCB551652E3D8B11) |
| CADD | Canadian dollar | CAD Digital | [`0x24Bf8ae7B8E073d766A3509C25b45a6Ad30e9046`](https://explorer.arc.io/token/0x24Bf8ae7B8E073d766A3509C25b45a6Ad30e9046) |
| CHFAU | Swiss franc | AllUnity | [`0xc6df1B92a6ae61a27059C41e541A91CE8DCb1605`](https://explorer.arc.io/token/0xc6df1B92a6ae61a27059C41e541A91CE8DCb1605) |
| EURAU | Euro | AllUnity | [`0x4933A85b5b5466Fbaf179F72D3DE273c287EC2c2`](https://explorer.arc.io/token/0x4933A85b5b5466Fbaf179F72D3DE273c287EC2c2) |
| GBPA | British pound | Agant | [`0xbBe6aAB0Ed76e90AeA0d1cd978EC231c8AdCDF8b`](https://explorer.arc.io/token/0xbBe6aAB0Ed76e90AeA0d1cd978EC231c8AdCDF8b) |
| JPYC | Japanese yen | JPYC | [`0xE7C3D8C9a439feDe00D2600032D5dB0Be71C3c29`](https://explorer.arc.io/token/0xE7C3D8C9a439feDe00D2600032D5dB0Be71C3c29) |
| KRW1 | South Korean won | BDACS | [`0x303dBB88BA14626c7a927E983b73267C575315f7`](https://explorer.arc.io/token/0x303dBB88BA14626c7a927E983b73267C575315f7) |
| MXNB | Mexican peso | Bitso | [`0xF197FFC28c23E0309B5559e7a166f2c6164C80aA`](https://explorer.arc.io/token/0xF197FFC28c23E0309B5559e7a166f2c6164C80aA) |
| QCAD | Canadian dollar | Canada Stablecorp | [`0xd70C2FA4232e054B373eFAEa98E4138511c2a309`](https://explorer.arc.io/token/0xd70C2FA4232e054B373eFAEa98E4138511c2a309) |
| SEKAU | Swedish krona | AllUnity | [`0xf8524b5AB17d5eca2F78abE8377ceFfD323b1dc1`](https://explorer.arc.io/token/0xf8524b5AB17d5eca2F78abE8377ceFfD323b1dc1) |
| TRYB | Turkish lira | Bilira | [`0xFb0705023603dc86325b83D9ff6b0DA7921fEc17`](https://explorer.arc.io/token/0xFb0705023603dc86325b83D9ff6b0DA7921fEc17) |
| ZARU | South African rand | Luno | [`0xE205b4e7Ac03E3f7b2060C3EDf2171AA7126C0d5`](https://explorer.arc.io/token/0xE205b4e7Ac03E3f7b2060C3EDf2171AA7126C0d5) |
