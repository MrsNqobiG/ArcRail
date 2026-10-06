> ## Documentation Index
> Fetch the complete documentation index at: https://docs.dfns.co/llms.txt
> Use this file to discover all available pages before exploring further.

# Supported Networks

> Browse all blockchains supported by DFNS, including signature kinds, supported assets, and network-specific features for each chain.

export const SupportLink = ({children}) => {
  const url = "https://support.dfns.co";
  return <a href={url} target="_blank">{children || url}</a>;
};

export const Deprecated = props => {
  return <>
    {!props.nopill && <span class="px-1 py-0.5 rounded-md text-[0.65rem] border border-amber-500/20 text-amber-900 bg-amber-50/50 dark:border-amber-500/30 dark:bg-amber-500/10">
      Deprecated
    </span>} 
    <span class="deprecated text-gray-400">
      {props.children}
    </span>
    </>;
};

Please find below a summary of the blockchains currently supported by the DFNS API. We plan to add support for more blockchain networks over time. The supported features will vary depending on popularity and market demand.

Need a network that isn't listed, including private or permissioned chains? Contact our <SupportLink>Support Team</SupportLink> to request it.

| Mainnet | Testnet | <Tooltip tip="See below for more details">Tier</Tooltip> | Standards | <Tooltip tip="Confirmation Delay refers to the number of blocks that must be validated or mined after a transaction has been included in a block for that transaction to be indexed by DFNS. Tier-2 chains are not indexed so finality doesn't apply.">Confirmation Delay</Tooltip> | <Tooltip tip="Early detection surfaces incoming transactions from unconfirmed (unfinalized) blocks — before the confirmation delay elapses. Available on select networks.">Early detection</Tooltip> | Testnet faucet example |
| :- | :- | :-: | :- | :-: | :-: | :- |
| Algorand | AlgorandTestnet | 1 | ASA | 7 | | [https://bank.testnet.algorand.network/](https://bank.testnet.algorand.network/) |
| Aptos | AptosTestnet | 1 | AIP-21 | 30 | | [https://www.aptosfaucet.com/](https://www.aptosfaucet.com/) |
| Arbitrum One | ArbitrumSepolia | 1 | ERC-20, ERC-721 | 10 | | [https://cloud.google.com/application/web3/faucet](https://cloud.google.com/application/web3/faucet) |
| Arc | ArcTestnet | 1 | N/A | 10 | | |
| Areum <Badge color="blue" size="xs">Upon request</Badge>[^1] | No testnet support | 1 | N/A | 5 | | |
| Avalanche C-Chain | AvalancheCFuji | 1 | ERC-20, ERC-721 | 10 | | [https://faucets.chain.link/fuji](https://faucets.chain.link/fuji) |
| Base | BaseSepolia | 1 | ERC-20, ERC-721 | 10 | | [https://docs.base.org/base-chain/tools/network-faucets](https://docs.base.org/base-chain/tools/network-faucets) |
| Berachain | BerachainBepolia | 1 | ERC-20, ERC-721 | 5 | | [https://bepolia.faucet.berachain.com/](https://bepolia.faucet.berachain.com/) |
| Binance Smart Chain | BscTestnet | 1 | ERC-20, ERC-721 | 5 | | [https://www.bnbchain.org/en/testnet-faucet](https://www.bnbchain.org/en/testnet-faucet) |
| Bitcoin | BitcoinSignet<br />BitcoinTestnet4 | 1 | N/A | 2 | Yes | [https://signetfaucet.com/](https://signetfaucet.com/) |
| Bitcoin Cash | No testnet support | 1 | N/A | 15 | Yes | |
| BOB | BobSepolia | 1 | ERC-20, ERC-721 | 50 | | [https://faucets.chain.link/bob-testnet](https://faucets.chain.link/bob-testnet) |
| Canton | CantonTestnet | 1 | CIP-56 | 1 | | |
| Cardano | CardanoPreprod | 1 | Asset | 5 | | [https://docs.cardano.org/cardano-testnets/tools/faucet](https://docs.cardano.org/cardano-testnets/tools/faucet) |
| Celo[^2] | CeloSepolia | 1 | ERC-20, ERC-721 | 10 | | [https://faucet.celo.org/celo-sepolia](https://faucet.celo.org/celo-sepolia) |
| Codex | CodexSepolia | 1 | ERC-20, ERC-721 | 50 | | |
| Concordium | ConcordiumTestnet | 1 | CIS-2, CIS-7 | 5 | | [https://github.com/Concordium/concordium-dapp-examples/tree/main/testnet-faucet](https://github.com/Concordium/concordium-dapp-examples/tree/main/testnet-faucet) |
| Cosmos Hub 4 | CosmosIcsTestnet | 1 | N/A | 5 | | |
| Dogecoin | DogecoinTestnet | 1 | N/A | 40 | Yes | |
| Ethereum | EthereumHoodi<br />EthereumSepolia | 1 | ERC-20, ERC-721, ERC-7984 | 12 | | [https://cloud.google.com/application/web3/faucet/ethereum/sepolia](https://cloud.google.com/application/web3/faucet/ethereum/sepolia) |
| Ethereum Classic | EthereumClassicMordor | 1 | ERC-20, ERC-721 | 3000 | Yes | |
| Flare C-Chain <Badge color="blue" size="xs">Upon request</Badge>[^1] | FlareCCoston2 | 1 | ERC-20, ERC-721 | 50 | | [https://faucet.flare.network/coston2](https://faucet.flare.network/coston2) |
| Flow EVM <Badge color="blue" size="xs">Upon request</Badge>[^1] | FlowEvmTestnet | 1 | ERC-20, ERC-721 | 10 | | [https://faucet.flow.com/fund-account](https://faucet.flow.com/fund-account) |
| Hedera | HederaTestnet | 1 | HTS, HIP-17, ERC-20, ERC-721 | 5 | | [https://portal.hedera.com/faucet](https://portal.hedera.com/faucet) |
| ICP (aka Dfinity) <Badge color="blue" size="xs">Upon request</Badge>[^1] | No testnet support | 1 | N/A | 2 | | |
| Ink | InkSepolia | 1 | ERC-20, ERC-721 | 10 | | [https://inkonchain.com/faucet](https://inkonchain.com/faucet) |
| ION | IonTestnet | 1 | TEP-74 | 15 | | |
| Iota <Badge color="blue" size="xs">Upon request</Badge>[^1] | IotaTestnet | 1 | N/A | 5 | | [https://docs.iota.org/developer/getting-started/get-coins](https://docs.iota.org/developer/getting-started/get-coins) |
| <Deprecated nopill>Kusama</Deprecated> <Deprecated />[^2] | <Deprecated nopill>Westend</Deprecated> | <Deprecated nopill>2</Deprecated> | <Deprecated nopill>N/A</Deprecated> | <Deprecated nopill>N/A</Deprecated> | | <Deprecated nopill>[https://faucet.polkadot.io/westend](https://faucet.polkadot.io/westend)</Deprecated> |
| Kusama Asset Hub | WestendAssetHub | 2 | N/A | N/A | | |
| Litecoin | LitecoinTestnet | 1 | N/A | 12 | Yes | |
| Movement | MovementTestnet | 1 | AIP-21 | 30 | | |
| NEAR | NearTestnet | 2 | N/A | N/A | | [https://near-faucet.io/](https://near-faucet.io/) |
| Optimism | OptimismSepolia | 1 | ERC-20, ERC-721 | 10 | | |
| ORIGYN <Badge color="blue" size="xs">Upon request</Badge>[^1] | No testnet support | 1 | N/A | 0 | | |
| Plasma | PlasmaTestnet | 1 | ERC-20, ERC-721 | 5 | | [https://www.plasma.to/docs/plasma-chain/tools/faucets](https://www.plasma.to/docs/plasma-chain/tools/faucets) |
| Plume | PlumeSepolia | 1 | ERC-20, ERC-721 | 10 | | [https://faucet.plume.org/](https://faucet.plume.org/) |
| <Deprecated nopill>Polkadot</Deprecated> <Deprecated />[^2] | <Deprecated nopill>Paseo</Deprecated> | <Deprecated nopill>2</Deprecated> | <Deprecated nopill>N/A</Deprecated> | <Deprecated nopill>N/A</Deprecated> | | |
| Polkadot Asset Hub | PaseoAssetHub | 2 | N/A | N/A | | |
| Polygon | PolygonAmoy | 1 | ERC-20, ERC-721 | 10 | | [https://faucet.polygon.technology/](https://faucet.polygon.technology/) |
| Polymesh <Badge color="blue" size="xs">Upon request</Badge>[^1] | PolymeshTestnet | 1 | N/A | 4 | | |
| Rayls | RaylsTestnet | 1 | N/A | 5 | | [https://devnet-dapp.rayls.com/](https://devnet-dapp.rayls.com/) |
| Robinhood Chain | RobinhoodSepolia | 1 | ERC-20, ERC-721 | 10 | | |
| Sei Pacific | SeiAtlantic2 | 1 | ERC-20, ERC-721 | 5 | | [https://docs.sei.io/learn/faucet](https://docs.sei.io/learn/faucet) |
| Solana | SolanaDevnet | 1 | SPL, SPL2022 | 8 | | [https://faucet.solana.com/](https://faucet.solana.com/) |
| Sonic | SonicTestnet | 1 | ERC-20, ERC-721 | 5 | | |
| Starknet | StarknetSepolia | 1 | SNIP-2, SNIP-3 | 5 | | [https://starknet-faucet.vercel.app](https://starknet-faucet.vercel.app) |
| Stellar | StellarTestnet | 1 | SEP-41 | 2 | | [https://lab.stellar.org/account/fund](https://lab.stellar.org/account/fund) |
| Sui | SuiTestnet | 1 | Coin | 5 | | [https://faucet.sui.io/](https://faucet.sui.io/) |
| Tempo <Badge color="blue" size="xs">Upon request</Badge>[^1] | TempoModerato | 1 | ERC-20, ERC-721 | 5 | | |
| Tezos | TezosShadownet | 2 | N/A | N/A | | [https://faucet.shadownet.teztnets.com/](https://faucet.shadownet.teztnets.com/) |
| TON | TonTestnet | 1 | TEP-74 | 15 | | [https://faucet.chainstack.com/ton-testnet-faucet](https://faucet.chainstack.com/ton-testnet-faucet) |
| TRON | TronNile | 1 | TRC-10, TRC-20, TRC-721 | 19 | | [https://nileex.io/join/getJoinPage](https://nileex.io/join/getJoinPage) |
| Trusted Smart Chain | TscTestnet1 | 1 | ERC-20, ERC-721 | 2 | | |
| X Layer Network | XLayerSepolia | 1 | ERC-20, ERC-721 | 10 | | [https://web3.okx.com/xlayer/faucet/xlayerfaucet/](https://web3.okx.com/xlayer/faucet/xlayerfaucet/) |
| XDC Network | XdcApothem | 1 | ERC-20, ERC-721 | 5 | | [https://faucet.apothem.network/](https://faucet.apothem.network/) |
| XrpLedger (aka Ripple) | XrpLedgerTestnet | 1 | IOU, XLS-33 | 5 | | [https://xrpl.org/resources/dev-tools/xrp-faucets](https://xrpl.org/resources/dev-tools/xrp-faucets) |

[^1]: These are **Specialty Networks** that are not available by default. Please contact our <SupportLink>Support Team</SupportLink> for additional information.

[^2]: Assets have been moved to Asset Hub. Refer to [multichain wallets](https://docs.dfns.co/guides/multichain-wallets) to recover your funds.

## Support Tiers

### Tier-1 blockchain networks

Tier-1 blockchain networks support all wallet features, including automatic detection of wallet [asset](/api-reference/wallets/get-wallet-assets) and [NFT](/api-reference/wallets/get-wallet-nfts) balances if applicable, and on-chain asset transfer [history](/api-reference/wallets/get-wallet-history). Tier-1 support also include [transfer asset](/api-reference/wallets/transfer-asset), [broadcast transaction](/api-reference/wallets/sign-and-broadcast-transaction) and [generate signature](/api-reference/keys/generate-signature). Tier-1 chains also support [Webhooks](/guides/developers/webhooks) driven by chain indexing.

### Tier-2 blockchain networks

Tier-2 blockchain networks do not track tokens or on-chain history. Only the [balance](/api-reference/wallets/get-wallet-assets) of the native token, which is used to pay transaction fees, is returned. Tier-2 support includes [Broadcast Transaction](/api-reference/wallets/sign-and-broadcast-transaction), [Generate Signature](/api-reference/keys/generate-signature), and Transfer Asset for native chain cryptocurrency only. Webhooks are not available for Tier-2 chains.

## Footnotes


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.