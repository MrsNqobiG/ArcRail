> ## Documentation Index
> Fetch the complete documentation index at: https://docs.dfns.co/llms.txt
> Use this file to discover all available pages before exploring further.

# Wallets

> API endpoints to create, list, update, archive, and manage MPC wallets, including imports, exports, balances, history, and tagging.

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

The DFNS Wallets API enables you to create wallets across a wide variety of chains. See the full list [here](/networks).
Simplified, high level transactions are enabled using our Transfer API to view and transfer native cryptocurrencies, fungible tokens and NFTs. Additionally we've exposed low-level transaction broadcast APIs enabling integrations with all available features of the supported chains.

All the Tier-1 chains are fully indexed to provide accurate asset reporting and transaction history.

Wallets also support [delegated wallets](/advanced/delegated-wallets), where end users hold signing authority over their wallet via WebAuthn/Passkeys. If you have feedback on the Wallets API, please reach out to our <SupportLink>Support Team</SupportLink>.

### <Deprecated>Pseudo Networks</Deprecated>

<Deprecated nopill>
  Pseudo-network based unbounded wallet creation is deprecated. For raw key signing, please use the [Signature API](/api-reference/keys/generate-signature) instead.
</Deprecated>

## Wallet object


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.