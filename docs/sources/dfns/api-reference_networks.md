> ## Documentation Index
> Fetch the complete documentation index at: https://docs.dfns.co/llms.txt
> Use this file to discover all available pages before exploring further.

# Networks

> API endpoints for network utilities, including fee estimation, smart contract reads, Canton validator management, and other chain-specific helpers.

export const Get = props => {
  return <code style={{
    paddingLeft: 0,
    paddingTop: 0
  }}>
      <Badge color="green" size="sm">GET</Badge>
      <span style={{
    marginLeft: '0.5em'
  }}>{props.children}</span>
    </code>;
};

export const Post = props => {
  return <code style={{
    paddingLeft: 0,
    paddingTop: 0
  }}>
      <Badge color="blue" size="sm">POST</Badge>
      <span style={{
    marginLeft: '0.5em'
  }}>{props.children}</span>
    </code>;
};

See the full list of supported networks on the [networks](/networks) page.

## Endpoints overview

**Get current network fee estimates for transaction planning**

<Get>/networks/fees</Get> [Estimate Fees](/api-reference/networks/estimate-fees)

**Read data from smart contracts (EVM `view` functions) without broadcasting**

<Post>/networks/\{network}/call-function</Post> [Call Function](/api-reference/networks/call-function)

**Manage Canton network validators for Canton wallet operations**

<Get>/networks/\{network}/validators</Get> [List Canton Validators](/api-reference/networks/list-canton-validators)

<Note>
  Canton is a specialty network requiring activation. See [Canton network details](/networks/canton) for setup instructions.
</Note>

## Networks supported by the API:

See the full list of supported networks on the [networks](/networks) page.


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.