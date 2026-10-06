> ## Documentation Index
> Fetch the complete documentation index at: https://docs.dfns.co/llms.txt
> Use this file to discover all available pages before exploring further.

# Policies for signature requests

> How the policy engine evaluates Sign & Broadcast and Generate Signature requests, and how to scope policies and payloads for them.

The DFNS Policy Engine evaluates every signing request before it executes. The outcome depends on the payload format and the rule being applied. This page covers both.

<Note>
  Dashboard transfers always send JSON payloads, so dashboard-only users don't need any of this. The options below can be configured from the dashboard or the API.
</Note>

## How the policy engine evaluates signing requests

Rules like `TransactionAmountLimit` and `TransactionRecipientWhitelist` evaluate values (amounts, recipients) read from the request payload. The engine extracts those values from structured fields in the request.

**DFNS policies don't introspect raw serialized signature payloads.** When the engine cannot extract the values a rule needs, it stays on the safe side and triggers the rule's action (`Block` or `RequestApproval`, depending on configuration). This fail-closed behavior is by design: rather than let a request through unevaluated, the engine treats the rule as triggered.

## Use JSON payloads for value-based rules

To let the engine evaluate rules like recipient whitelisting or amount limits, use **JSON payloads** with separate fields instead of serialized transaction data.

<CodeGroup>
  ```json JSON payload (policy engine CAN evaluate) theme={null}
  {
    "kind": "Transaction",
    "transaction": {
      "to": "0x00fb58432ef9d418bf6688bcf0a226d2fcaa18e2",
      "value": "1000000000000000000",
      "data": "0x..."
    }
  }
  ```

  ```json Serialized payload (policy engine CANNOT evaluate) theme={null}
  {
    "kind": "Transaction",
    "transaction": "0x02e783aa36a7..."
  }
  ```
</CodeGroup>

With the JSON format, you can use recipient whitelisting:

```json theme={null}
{
  "name": "Whitelist approved addresses",
  "activityKind": "Wallets:Sign",
  "rule": {
    "kind": "TransactionRecipientWhitelist",
    "configuration": {
      "addresses": [
        "0x00fb58432ef9d418bf6688bcf0a226d2fcaa18e2",
        "0xa238b6008bc2fbd9e386a5d4784511980ce504cd"
      ]
    }
  },
  "action": {
    "kind": "Block"
  }
}
```

<Warning>
  For non-EVM chains (Solana, Tron, Bitcoin, and so on), address comparison is exact and case sensitive: the whitelist entry must match the recipient address exactly as it is submitted in the request, on both sides. For EVM networks, comparison is case insensitive, so checksum (EIP-55) and all-lowercase forms are treated as equal.
</Warning>

## Scope policies for signatures without an extractable JSON form

Some signature types, like EIP-712 typed data or complex multi-chain formats, don't have a JSON equivalent with extractable fields. For those, scope your `Wallets:Sign` policy to apply only to wallets that need strict controls. Other wallets bypass the policy entirely.

### Tag the wallets

Add a tag like `policy:strict` to wallets that need the policy.

#### From the dashboard

<Steps>
  <Step title="Open the wallet">
    Go to **Wallets** and click the wallet to scope.
  </Step>

  <Step title="Edit the wallet">
    Open the actions menu (**⋯**) in the top-right and click **Edit**.
  </Step>

  <Step title="Add the tag">
    In the **Tags** field, type `policy:strict` and click **Add**, then **Update**.

    <Frame>
      <img src="https://mintcdn.com/dfns-6d8c7466/k4PlkpvHXsR9GGmT/images/auto/managing-wallets-1.png?fit=max&auto=format&n=k4PlkpvHXsR9GGmT&q=85&s=029b626fab8530b6309bf2753204fb71" alt="Wallet edit panel with the Tags field" width="2688" height="1672" data-path="images/auto/managing-wallets-1.png" />
    </Frame>
  </Step>
</Steps>

#### With the API

```bash theme={null}
curl -X PUT "https://api.dfns.io/wallets/{walletId}/tags" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"tags": ["policy:strict"]}'
```

### Create a signing policy scoped to the tag

#### From the dashboard

<Steps>
  <Step title="Create a new policy">
    Go to **Policies** and click **Create Policy**. Name it (for example, `Sign requests on strict wallets`).
  </Step>

  <Step title="Select the activity">
    Select **Wallet usage (transfer, transaction, signature)**.
  </Step>

  <Step title="Add a wallet tag filter">
    On the **Entity Filter** step, under **Any Tags**, click **Add Tags** and add `policy:strict`.

    <Frame>
      <img src="https://mintcdn.com/dfns-6d8c7466/k4PlkpvHXsR9GGmT/images/auto/scoping-signing-policies-1.png?fit=max&auto=format&n=k4PlkpvHXsR9GGmT&q=85&s=83e94e7e0a769aaa15f68cf26612d4df" alt="Policy wizard Entity Filter step with the policy:strict tag under Any Tags" width="2688" height="1672" data-path="images/auto/scoping-signing-policies-1.png" />
    </Frame>
  </Step>

  <Step title="Configure the rule and action">
    Pick the rule (for example, **Transaction recipient whitelist** or **Transaction amount limit**) and the action (**Block** or **Request approval**).
  </Step>

  <Step title="Save">
    Review the summary and click **Save**.
  </Step>
</Steps>

#### With the API

```json theme={null}
{
  "name": "Require approval for large transfers",
  "activityKind": "Wallets:Sign",
  "rule": {
    "kind": "TransactionAmountLimit",
    "configuration": {
      "limit": 10000,
      "currency": "USD"
    }
  },
  "action": {
    "kind": "RequestApproval",
    "approvalGroups": [{ "quorum": 1, "approvers": {} }]
  },
  "filters": {
    "walletTags": {
      "hasAny": ["policy:strict"]
    }
  }
}
```

Wallets without the `policy:strict` tag won't trigger this policy.

### Filter by wallet ID instead

For simpler setups, the API supports filtering by specific wallet IDs:

```json theme={null}
{
  "filters": {
    "walletId": {
      "in": ["wa-treasury-xxx", "wa-operations-xxx"]
    }
  }
}
```

The dashboard policy builder filters by tag rather than wallet ID, so use tags if you need this filter to be configurable from the dashboard.

## Security considerations

When excluding wallets from policies:

* **Fund with limited amounts**: only keep what's needed for operations.
* **Use separate wallets**: don't mix automated signing wallets with treasury.
* **Monitor with webhooks**: track signing activity.
* **Audit regularly**: review which wallets are excluded from policies.

## Related resources

<CardGroup cols={2}>
  <Card title="Policy Engine" icon="shield-halved" href="/core-concepts/policies">
    Learn how the Policy Engine works
  </Card>

  <Card title="Wallet tags" icon="tags" href="/api-reference/wallets/tags">
    Organize wallets with tags
  </Card>

  <Card title="Sign & Broadcast" icon="tower-broadcast" href="/api-reference/broadcast">
    Transaction broadcast API reference
  </Card>

  <Card title="Generate Signature" icon="signature" href="/api-reference/sign">
    Signature generation API reference
  </Card>
</CardGroup>


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.