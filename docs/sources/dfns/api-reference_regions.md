> ## Documentation Index
> Fetch the complete documentation index at: https://docs.dfns.co/llms.txt
> Use this file to discover all available pages before exploring further.

# Regions

> Cloud platform regions where DFNS hosts API endpoints and signer infrastructure, including how to choose a region for compliance and latency.

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

### Environments overview

| Region | API base URL | Dashboard URL | Chains | SLA | Webhook origin IP |
| :- | :- | :- | :- | :- | :- |
| Default - Europe | `api.dfns.io` | [app.dfns.io](https://app.dfns.io/) | <Icon icon="check" /> Mainnet<br /><Icon icon="check" /> Testnet | Yes | `35.181.116.68` |
| UAE | `api.uae.dfns.io` | [app.uae.dfns.io](https://app.uae.dfns.io/) | <Icon icon="check" /> Mainnet<br /><Icon icon="check" /> Testnet | Yes | `40.172.249.100`<br />`Temporary 51.45.23.79` |
| <Deprecated> Staging</Deprecated> | <Deprecated nopill>`api.dfns.ninja`</Deprecated> | <Deprecated nopill>[app.dfns.ninja](https://app.dfns.ninja/)</Deprecated> | <Deprecated nopill><Icon icon="xmark-large" /> Mainnet<br /><Icon icon="check" /> Testnet</Deprecated> | <Deprecated nopill>No</Deprecated> | <Deprecated nopill>`52.47.197.63` </Deprecated> |

<Warning>
  ***The staging environment is to use only with test funds***

  This constraint exists to prevent customers from accidentally moving real funds into the staging environment. DFNS cannot prevent customers from using the staging environment to send funds to a mainnet chain. This is however against our terms of use, so please don't do it - thanks!
</Warning>

### Regional hosting - Data residency

DFNS regions are segregated environments enabling you to choose where your data is processed.

<Note>
  An organization and its wallets, keys, users, etc. live in a specific region. They cannot be accessed from another region or transferred to another region.
</Note>

The original and default DFNS environment (`dfns.io`) is hosted across multiple European AWS regions. When you use this region, your data are processed in Europe.

An alternative environment hosted in the UAE is available (`uae.dfns.io`). When you use this region, your data are processed exclusively in the UAE.

<Note>
  On-chain activity cannot be tied to a region as blockchains are decentralized by definition. When transactions data are broadcasted to a network they may be processed anywhere in the world, this is totally out of DFNS control.
</Note>

### Building API endpoint URLs

Throughout our documentation, assume that you should prepend the environment base URL in front of the API paths given.

For example:\
`GET /wallets/` should be interpreted as: `GET https://api.dfns.io/wallets/`

### Whitelisting webhooks origin IPs

Our webhooks will always be originated from the same IP address (see table above). You can therefore use these if you want to whitelist DFNS IPs for filtering webhook delivery.

Make sure you also verify that webhooks are properly signed by checking the `X-DFNS-WEBHOOK-SIGNATURE` header as explained in the [webhooks documentation](/guides/developers/webhooks#verify-events-are-sent-from-dfns).


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.