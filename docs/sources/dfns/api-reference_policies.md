> ## Documentation Index
> Fetch the complete documentation index at: https://docs.dfns.co/llms.txt
> Use this file to discover all available pages before exploring further.

# Policies API

> API endpoints to create, list, update, archive, and manage policies that enforce business rules and approval workflows on wallet activity.

A Policy is defined by:

* an [**Activity kind**](#activities): the type of activity that this policy should gate.
* a [**Rule**](#policy-rules): defines the rule being evaluated to know whether the policy should "activate" (aka "trigger") or not for a given activity happening in the system.
* an [**Action**](#policy-action): after rule was evaluated, if the policy is triggered, the action defines what action is taken as a consequence.
* optional [**Filters**](#policy-filters)**:** these can be used to reduce the scope upon which the policy applies.

Once evaluated for a given activity, a policy is either `Skipped` if the rule did not apply or is triggered executing the associated action. If the action is `RequestApproval`, an [**Approval**](/core-concepts/policies#approval-process) process is initiated.

<Note>
  **When policies are enforced:** Policies are evaluated before the requested action is executed. For `Wallets:Sign` policies, this means before the MPC signing ceremony begins. For other activity kinds (permission changes, policy modifications, address alias updates, etc.), the action is held until the policy resolves. A blocked or unapproved request never takes effect.
</Note>

<Note>
  **Default behavior:** If no policies are configured, all transactions are allowed. Policies add restrictions - they are not a whitelist. To block all transactions except specific ones, create a policy with `AlwaysTrigger` rule and `Block` action, then create separate policies for allowed cases.
</Note>

<Note>
  Policies do not apply to delegated wallets. Because the end user holds [signing authority](/advanced/delegated-wallets) over their wallet, all end user activities bypass the policy engine.
</Note>

## Activities

"Activity" is a generic term describing some activity in the DFNS system. Supported activity kinds are: [`Wallets:Sign`](#wallets-sign-activity), [`Wallets:IncomingTransaction`](#walletsincomtransaction-activity), [`Permissions:Assign`](#permissions-assign-activity), [`Permissions:Modify`](#permissions-modify-activity), [`Policies:Modify`](#policies-modify-activity), [`Registry:Addresses:Modify`](#registryaddressesmodify-activity), [`Registry:ContractSchemas:Modify`](#registrycontractschemasmodify-activity), [`Vaults:ReleaseQuarantine`](#vaultsreleasequarantine-activity), [`Vaults:CreateLock`](#vaultscreatelock-activity).

### `Wallets:Sign` activity

A "`Wallets:Sign`" activity represents any activity which involves signing with a wallet. Currently, in our API, these can be:

* a Transfer Request (created using the endpoint [Transfer Asset from Wallet](/api-reference/wallets/transfer-asset))
* a Transaction Request (created using the endpoint [Broadcast Transaction from Wallet](/api-reference/wallets/sign-and-broadcast-transaction))
* a Signature Request (created using the endpoint [Generate Signature from Keys](/api-reference/keys/generate-signature))

<Tip>
  **Raw signatures and EIP-712:** When using Generate Signature (including EIP-712 typed data), some policy rules may "fail closed" because they cannot extract values like recipients or amounts from the request. See [Policies for signing requests](/guides/signing-policies) for solutions.
</Tip>

### `Wallets:IncomingTransaction` activity

A "`Wallets:IncomingTransaction`" activity represents when our indexers detected an incoming transaction into a wallet. This activity kind has to be used with the rule kind "`ChainalysisTransactionScreening`" (see more on [Chainalysis](/features/aml-kyt) integration page), and the action kind "`NoAction`", meaning that no actual action will be taken as a result of the Chainalysis screening, other than notifying you through a webhook event if the policy is triggered. The reason for that, is that the incoming transaction is already on-chain, so the funds are already in the wallet, we cannot block that transfer on chain.

### `Permissions:Modify` activity

A "`Permissions:Modify`" activity represents any activity which involves updating or archiving a permission. These activities are Permission change requests, created as a result of calling either:

* the endpoint [Update Permission](/api-reference/permissions/update-permission)
* the endpoint [Archive Permission](/api-reference/permissions/archive-permission)

### `Permissions:Assign` activity

A "`Permissions:Assign`" activity represents any activity which involves assigning a permission (or revoking it, aka "deleting a permission assignment"). These activities are Assignment change requests, created as a result of calling either:

* the endpoint [Assign Permission](/api-reference/permissions/assign-permission)
* the endpoint [Revoke Permission](/api-reference/permissions/revoke-permission)

### `Policies:Modify` activity

A "`Policies:Modify`" activity represents any activity which involves updating or archiving a policy. These activities are Policy change requests, created as a result of calling either:

* the endpoint [Update Policy](/api-reference/policies/update-policy)
* the endpoint [Delete Policy](/api-reference/policies/delete-policy)

### `Registry:Addresses:Modify` activity

A "`Registry:Addresses:Modify`" activity represents any activity which updates or deletes an address alias in the Address Book. Address aliases are managed from the dashboard. This activity kind only supports the `AlwaysTrigger` rule and no filters.

### `Registry:ContractSchemas:Modify` activity

A "`Registry:ContractSchemas:Modify`" activity represents any activity which modifies a smart contract schema (ABI) registered in the dashboard. This includes updating or deleting an imported contract. See [Interacting with smart contracts](/guides/smart-contracts) for how contract schemas are managed. This activity kind only supports the `AlwaysTrigger` rule and no filters.

### `Vaults:ReleaseQuarantine` activity

A "`Vaults:ReleaseQuarantine`" activity represents a request to release quarantined [vault](/api-reference/vaults) funds into the available balance, created by calling [Release Quarantine](/api-reference/vaults/release-quarantine). The funds stay quarantined until the approval process completes. Supports the `AlwaysTrigger` and [`ChainalysisQuarantineScreening`](#chainalysisquarantinescreening-policy-rule) rules, and can be scoped by vault tags.

### `Vaults:CreateLock` activity

A "`Vaults:CreateLock`" activity represents a request to lock vault funds, created by calling [Create Vault Lock](/api-reference/vaults/create-vault-lock). The lock is not created until the approval process completes. Supports the `AlwaysTrigger` rule and can be scoped by vault tags.

Every policy requires a rule to be specified. Upon policy evaluation, the configuration specified in the rule will be used to determine whether the policy should trigger or not for a given activity.

By exposing controls on permissions and policies, DFNS enables the specification of an admin quorum to approve sensitive actions which could change system governance.   Note DFNS does not expose a separate "admin quorum" concept like some of our competitors - we simply enable this use case as another configuration of the policy engine itself.   This was chosen to promote flexibility as not every customer will have the same requirements around creating and managing admin quorums.

## Policy Rules

The policy rule is what gets evaluated to determine whether a given activity will "activate" (aka "trigger") the policy, therefore applying the policy "Action", or whether it will skip it.

Supported Policy Rule kinds are: [`AlwaysTrigger`](#alwaystrigger-policy-rule), [`TransactionAmountLimit`](#transactionamountlimit-policy-rule), [`TransactionAmountLimitNominal`](#transactionamountlimitnominal-policy-rule), [`TransactionAmountVelocity`](#transactionamountvelocity-policy-rule), [`TransactionCountVelocity`](#transactioncountvelocity-policy-rule), [`TransactionRecipientWhitelist`](#transactionrecipientwhitelist-policy-rule), [`ChainalysisTransactionPrescreening`](#chainalysistransactionprescreening-policy-rule), [`ChainalysisTransactionScreening`](#chainalysistransactionscreening-policy-rule), [`GlobalLedgerTransactionPrescreening`](#globalledgertransactionprescreening-policy-rule), [`TravelRuleTransactionPrescreening`](#travelruletransactionprescreening-policy-rule).&#x20;

### `AlwaysTrigger` policy rule

This rule can be used on a policy of any `activityKind`. It will always be triggered, meaning that if this rule is defined on a policy, the policy will always trigger the policy action, regardless of the activity details.

```json theme={null}
{
  "rule": {
    "kind": "AlwaysTrigger",
  }
}
```

### `TransactionAmountLimit` policy rule

This rule can be used on a policy of `activityKind` = `Wallets:Sign`. It triggers if the wallet activity transfers an amount greater than a given limit. The limit is expressed in a fiat `currency` and evaluated against the market value of the transfer. To set a threshold in the asset's own units instead, use [`TransactionAmountLimitNominal`](#transactionamountlimitnominal-policy-rule).

<Note>
  If the amount of the wallet activity cannot be evaluated for any reason (market prices unavailable, or the amount cannot be inferred from a wallet signature request, etc.), the rule fails closed and triggers the policy — a security best practice.
</Note>

```json theme={null}
{
  "rule": {
    "kind": "TransactionAmountLimit",
    "configuration": {
      "limit": 1000,
      "currency": "USD",
    },
  }
}
```

**Configuration**

| Property | Type | Description |
| - | - | - |
| limit\* | Number | Amount limit in `currency` |
| currency\* | String | Fiat currency, currently only `USD` |

### `TransactionAmountLimitNominal` policy rule

This rule can be used on a policy of `activityKind` = `Wallets:Sign`. It triggers if the wallet activity transfers more of a listed asset than that asset's limit.

Each limit is expressed in the minimum denomination of its own asset and compared against the transferred amount directly, so the verdict needs no market data and does not move with a price — for example, trigger on transfers over 5 ETH regardless of price. To set a threshold on the fiat value of a transfer instead, use [`TransactionAmountLimit`](#transactionamountlimit-policy-rule).

One rule can name up to 100 assets, each with its own limit. A transfer of an asset that is not listed does not trigger the rule, and each transfer is evaluated on its own (nothing is accumulated across transfers).

```json theme={null}
{
  "rule": {
    "kind": "TransactionAmountLimitNominal",
    "configuration": {
      "assets": [
        { "network": "Ethereum", "tid": "native:eth", "limit": "5000000000000000000" },
        { "network": "Ethereum", "tid": "erc20:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", "limit": "10000000000" },
      ],
    },
  }
}
```

**Configuration**

| Property | Type | Description |
| - | - | - |
| assets\* | Array | 1–100 entries, no duplicates. Each entry is one asset and its limit. |
| assets\[].network\* | String | The network the asset lives on. |
| assets\[].tid\* | String | The DFNS token identifier, e.g. `native:eth` or `erc20:<contract>`. Must be canonical — contract addresses on hex networks are lowercase. |
| assets\[].limit\* | String (integer) | Limit in the minimum denomination of the asset, matching how a transfer expresses its amount: for an 18-decimal token, `"5000000000000000000"` is 5 whole tokens. |

Nominal limits are asset-exact: a wrapped or staked derivative is a different asset from the thing it tracks. NFTs and non-transferable assets are rejected.

<Note>
  If the transferred amount or the asset cannot be determined, the rule fails closed and triggers the policy.
</Note>

<Note>
  Nominal limits are **API/SDK only** for now — the dashboard policy builder doesn't support them yet, and there is no asset picker, so you supply each asset's canonical `tid` directly.
</Note>

### `TransactionAmountVelocity` policy rule

This rule can be used on a policy of `activityKind` = `Wallets:Sign`. It will trigger if the cumulative amount transferred from a given wallet within a given timeframe is greater than a specified limit. The aggregate amount evaluated is based only on the wallet that triggered the policy.&#x20;

<Note>
  If the fiat amount of any wallet activity in the given timeframe cannot be evaluated for any reason (eg. market prices are not available, or eg. the amount cannot be inferred from a wallet signature request, etc.), by default the rule will trigger the policy (ie. will fail closed).
</Note>

```json theme={null}
{
  "rule": {
    "kind": "TransactionAmountVelocity",
    "configuration": {
      "limit": 1000,
      "currency": "USD",
      "timeframe": 60,
    },
  },
}
```

**Configuration**

| Property | Type | Description |
| - | - | - |
| limit\* | Positive Integer | Amount limit in currency |
| currency\* | String | Fiat currency, currently only USD |
| timeframe\* | Positive Integer | Time period in minutes. Minimum 1, Maximum 43,200. |

### `TransactionCountVelocity` policy rule

This rule can be used on a policy of `activityKind` = `Wallets:Sign`. It will trigger if the number of wallet activities for a given wallet within a given timeframe, is greater than a specified limit. The aggregate number of transactions evaluated is based only on the wallet that triggered the policy.&#x20;

```json theme={null}
{
  "rule": {
    "kind": "TransactionCountVelocity",
    "configuration": {
      "limit": 5,
      "timeframe": 60,
    },
  },
}
```

**Configuration**

| Property | Type | Description |
| - | - | - |
| limit\* | Positive Integer | Amount limit in currency |
| timeframe\* | Positive Integer | Time period in minutes. Minimum 1, Maximum 43,200. |

### `TransactionRecipientWhitelist` policy rule

This rule can be used on a policy of `activityKind` = `Wallets:Sign`. It will trigger if the wallet activity transfers some value to a recipient *and the destination address is NOT whitelisted*.

<Warning>
  For non-EVM chains (Solana, Tron, Bitcoin, and so on), address comparison is exact and case sensitive: the whitelist entry in your policy rule configuration must match the recipient address exactly as it is submitted in the transfer or transaction request. A casing mismatch on either side fails the match and triggers the policy.

  For EVM networks, comparison is case insensitive: a whitelisted address is matched regardless of its EIP-55 checksum casing, so mixed-case and all-lowercase forms are treated as equal.
</Warning>

<Note>
  If the wallet activity is not a value transfer, or the transaction recipient cannot be inferred from the wallet activity (eg if you use [Generate Signature](/api-reference/keys/generate-signature)), by default the rule will trigger the policy (ie. fail closed).
</Note>

If the specified whitelisted address list is empty, it basically means "no addresses are whitelisted", so the rule will trigger for any wallet activities.

```json theme={null}
{
  "rule": {
    "kind": "TransactionRecipientWhitelist",
    "configuration": {
      "addresses": ["0x...1", "0x...2"],
    },
  }
}
```

**Configuration**

| Property | Type | Description |
| - | - | - |
| addresses\* | List of Strings | Whitelisted recipient addresses |
| | | |

### `ChainalysisTransactionPrescreening`   policy rule

<Note>
  This rule can only be used once the Chainalysis integration is activated from the DFNS dashboard Integrations page. (see more on [Chainalysis](/features/aml-kyt) integration page)
</Note>

This rule can be used on a policy of `activityKind` = `Wallets:Sign`. It's a rule based on [Chainalysis](/features/aml-kyt) KYT integration (Know-Your-Transaction). Upon transfer attempt, we will first register the transfer with Chainalysis (as a "withdrawal attempt"), and fetch the screening results (alerts, exposures, addresses detected). Based on the results, and the configuration of this rule, the policy will be triggered.&#x20;

It's called "Pre"-screening, because the scanned transaction is not on chain yet, it's still a transaction attempt (before the transaction actually make it on chain).

```json theme={null}
{
  "rule": {
    "kind": "ChainalysisTransactionPrescreening",
    "configuration": {
      "alerts": {
        "alertLevel": "LOW",
        "categoryIds": []
      },
      "exposures": {
        "direct": {
          "categoryIds": []
        }
      },
      "addresses": {
        "categoryIds": []
      },
      "fallbackBehaviours": {
        "skipUnscreenableTransaction": false,
        "skipUnsupportedNetwork": false,
        "skipUnsupportedAsset": false,
        "skipChainalysisFailure": false
      }
    }
  }
}
```

**Configuration**

| Property | Type | Description |
| - | - | - |
| `alerts.alertLevel`\* | string | Minimum [alert level](https://developers.chainalysis.com/kyt/api-reference/v-1-endpoints/alerts/retrieve-alerts#request.query.level.level) above which the rule should trigger, if any alert is returned in Chainalysis results. Can be LOW, MEDIUM, HIGH, or SEVERE |
| `alerts.categoryIds`\* | list of integers | List of Chainalysis category IDs (see [here](https://developers.chainalysis.com/kyt/docs/resources/category-i-ds)). If you leave this list empty, alerts of any category will trigger the rule. Otherwise, if you only want the rule to trigger on specific categories, you can specify some in the list. |
| `exposures.direct.categoryIds`\* | list of integers | List of Chainalysis category IDs (see [here](https://developers.chainalysis.com/kyt/docs/resources/category-i-ds)). If you leave this list empty, a direct exposure of any category detected by chainalysis will trigger the rule. Otherwise, if you only want the rule to trigger on specific categories, you can specify some in the list. |
| `addresses.categoryIds`\* | list of integers | List of Chainalysis category IDs (see [here](https://developers.chainalysis.com/kyt/docs/resources/category-i-ds)). If you leave this list empty, an address of any category identified by chainalysis will trigger the rule. Otherwise, if you only want the rule to trigger on specific categories, you can specify some in the list. |
| `fallbackBehaviours.skipUnscreenableTransaction`\* | boolean | Behaviour if the wallet activity is not screenable (eg. if it's a signature request of a hash). If true, a transaction which is "unscreenable" will just be skipped, and policy will not trigger |
| `fallbackBehaviours.skipUnsupportedNetwork`\* | boolean | Behaviour if the wallet activity is on a network not supported by chainalysis, or not yet supported in the dfns-chainalysis integration. If true, an unsupported network will just be skipped, and policy will not trigger |
| `fallbackBehaviours.skipUnsupportedAsset`\* | boolean | Behaviour if the wallet activity is with a asset not supported by chainalysis, or not yet supported in the dfns-chainalysis integration. If true, an unsupported asset will just be skipped, and policy will not trigger |
| `fallbackBehaviours.skipChainalysisFailure`\* | boolean | Behaviour if any issue with Chainalysis calls (timeout, results took too long, rate limiting errors, any error). If true, will skip if any error happens |

### `ChainalysisTransactionScreening`   policy rule

<Note>
  This rule can only be used once the Chainalysis integration is activated from the DFNS dashboard Integrations page (see more on [Chainalysis](/features/aml-kyt) integration page)
</Note>

This rule can be used on a policy of `activityKind` = `Wallets:IncomingTransaction`, and with the action kind `NoAction`. It's a rule based on Chainalysis KYT integration (Know-Your-Transaction). Upon an incoming transaction detected by our indexers, we will [register the transfer with Chainalysis](https://docs.chainalysis.com/api/kyt/#registration-register-a-transfer), and fetch the results of the analysis (alerts & exposures detected). Based on the results, and the configuration of this rule, the policy will be triggered.

The shape of the rule is almost like the `ChainalysisTransactionPrescreening` rule, except the `address` property is not supported.

```json theme={null}
{
  "rule": {
    "kind": "ChainalysisTransactionPrescreening",
    "configuration": {
      "alerts": {
        "alertLevel": "LOW",
        "categoryIds": []
      },
      "exposures": {
        "direct": {
          "categoryIds": []
        }
      },
      "fallbackBehaviours": {
        "skipUnscreenableTransaction": false,
        "skipUnsupportedNetwork": false,
        "skipUnsupportedAsset": false,
        "skipChainalysisFailure": false
      }
    }
  }
}
```

**Configuration**

See the above configuration for rule `ChainalysisTransactionPrescreening`

### `ChainalysisQuarantineScreening` policy rule

<Note>
  This rule can only be used once the Chainalysis integration is activated from the DFNS dashboard Integrations page (see more on [Chainalysis](/features/aml-kyt) integration page)
</Note>

This rule can be used on a policy of `activityKind` = `Vaults:ReleaseQuarantine`. It gates the release of quarantined [vault](/api-reference/vaults) funds on the Chainalysis KYT result that was recorded when the funds were quarantined — it does not make a new Chainalysis call. If no screening result is stored, the rule fails closed and triggers the policy. The configuration accepts `alerts` and `exposures` (as in `ChainalysisTransactionScreening`); `addresses`, `userIdTemplate`, and `fallbackBehaviours` are not supported.

### `GlobalLedgerTransactionPrescreening` policy rule

<Note>
  This rule can only be used once the Global Ledger integration is activated from the DFNS dashboard Integrations page (see more on [Global Ledger](/integrations/aml-kyt/global-ledger) integration page)
</Note>

This rule can be used on a policy of `activityKind` = `Wallets:Sign`. It's a rule based on [Global Ledger](/integrations/aml-kyt/global-ledger) KYT integration (Know-Your-Transaction). Upon transfer attempt, we will send the transaction to Global Ledger for screening and fetch the risk score and any alerts. Based on the results, and the configuration of this rule, the policy will be triggered.

The policy triggers when either:

* The transaction's risk score meets or exceeds your configured `riskScoreThreshold`
* Global Ledger returns any alerts for the transaction

```json theme={null}
{
  "rule": {
    "kind": "GlobalLedgerTransactionPrescreening",
    "configuration": {
      "riskScoreThreshold": 70,
      "fallbackBehaviours": {
        "skipUnscreenableTransaction": false,
        "skipUnsupportedNetwork": false,
        "skipUnsupportedAsset": false,
        "skipGlobalLedgerFailure": false
      }
    }
  }
}
```

**Configuration**

| Property | Type | Description |
| - | - | - |
| `riskScoreThreshold`\* | integer (0-100) | Risk score threshold. If the transaction's risk score meets or exceeds this value, the policy triggers. 0 = lowest risk, 100 = highest risk. |
| `fallbackBehaviours.skipUnscreenableTransaction`\* | boolean | If true, skip wallet requests that cannot be screened (e.g., raw signature requests) instead of triggering the policy. |
| `fallbackBehaviours.skipUnsupportedNetwork`\* | boolean | If true, skip transfers to networks not supported by the Global Ledger integration instead of triggering the policy. |
| `fallbackBehaviours.skipUnsupportedAsset`\* | boolean | If true, skip transfers of assets not supported by the Global Ledger integration instead of triggering the policy. |
| `fallbackBehaviours.skipGlobalLedgerFailure`\* | boolean | If true, skip when the Global Ledger API request fails (timeout, rate limiting, errors) instead of triggering the policy. |

### `TravelRuleTransactionPrescreening` policy rule

<Note>
  This rule can only be used once the Notabene integration is activated from the DFNS dashboard Integrations page (see more on [Notabene](/features/travel-rule) integration page)
</Note>

This rule can be used on a policy of `activityKind` = `Wallets:Sign,`and with the action kind `Block`. It's a rule based on Notabene [TravelRule](/features/travel-rule) integration. It ***ONLY*** applies to DFNS [Transfer Asset](/api-reference/wallets/transfer-asset) Api Calls. It is NOT supported for Transfers initiated via the dashboard. Upon transfer attempt with an optional [TravelRule](/api-reference/wallets/transfer-asset) payload, we will call Notabene's APIs on your behalf to both confirm the validity of the travel rule message and submit it for processing. DFNS then waits for a response from the counterparty (for custodial transfers) or Notabene (for non-custodial transfers).

It's called "Pre"-screening, because the transaction is not on chain yet, it's still a transaction attempt (before the transaction actually make it on chain).

```json theme={null}
{
  "kind": "TravelRuleTransactionPrescreening",
  "configuration": {
    "vendor": "Notabene",
    "autoTriggerTimeoutSeconds": 300,
    "autoClearAfterDeliveredTimeoutSeconds": 200
  }
}
```

**Configuration**

| Property | Type | Description |
| - | - | - |
| vendor | string | TravelRule vendor to use for the prescreening policy. At the moment we only support Notabene. |
| autoTrigger<br />TimeoutSeconds<br /> | Positive Integer | If we do NOT receive any updates from Notabene regarding the status of the travel rule message we need to eventually time out and reject the transfer. This is the timeout, in seconds, we wait for a response from Notabene before rejecting the transfer. |
| autoClearAfterDelivered<br />TimeoutSeconds<br /> | Positive Integer(Optional) | This OPTIONAL setting allows you to proceed with a transfer that Notabene has delivered to a counterparty even if the recipient hasn't responded after delivery. |

## Policy Action

An action specifies what should happen if a policy rule is triggered. Supported action kinds are: [`Block`](#block-policy-action)`and`[`RequestApproval`](#requestapproval-policy-action).

### `Block` policy action

This action means that the activity will be blocked if the policy is triggered.

```json theme={null}
{
  "action": {
    "kind": "Block"
  }
}
```

### `RequestApproval` policy action

This action means that activity will first require an Approval process to be completed before it can be executed (or be aborted if someone rejects it during the approval process).

One or several groups of approvers need to be specified. These groups define who is allowed to approve / reject an activity.

The activity will only be executed if all approver groups reach their "quorum" of approvals. Otherwise, if any one user within any approver group rejects, then the activity is aborted and the call is not executed.

The example below shows a `RequestApproval` action, configured with one approval group requiring 2 approvals amongst three specific users.&#x20;

```json theme={null}
{
  "action": {
    "kind": "RequestApproval",
    "autoRejectTimeout": 60, // minutes
    "approvalGroups": [
      {
        "name": "Admins",
        "quorum": 2, // only 2 approvers required in that group
        "approvers": {
          "userId": {
            "in": ["us-...1", "us-...2", "us-...3"],
          }
        },
        "initiatorCanApprove": false,
        "serviceAccountsCanApprove": false,
      }
    ],

  }
}
```

| property | Type | Description |
| - | - | - |
| approvalGroups\* | List of Object | List of approval groups. If multiple groups are defined, the approval is complete only when all groups have approved |
| approvalGroups\[].name | (Optional) String | Optional name of this group. |
| approvalGroups\[].quorum\* | Positive Integer | The quorum is the number of approvals required in this group to reach group consensus. The activity is executed only if all groups reached their approval quorum. |
| approvalGroups\[].approvers\* | Object | Defines all users that are allowed to approve in the group. If set to an empty object `{}`, it means that anyone within your organisation can be an approver. Otherwise, you can specify an exact list of allowed approvers, by adding their user IDs in this object:  `{ userId: { in: [...] }}` |
| approvalGroups\[].initiatorCanApprove | (Optional) Boolean | Whether the initiator of the activity can participate in the approval (defaults to `false`) |
| approvalGroups\[].serviceAccountsCanApprove | (Optional) Boolean | Whether service accounts can participate in the approval for this group (defaults to `false`). When `true`, service accounts listed in `approvers` can vote. Requires activation by DFNS staff on your organization. |
| autoRejectTimeout | (Optional) Positive Integer | Number of minutes after which, if the approval has not reach global consensus (all groups reached their consensus), the activity is automatically rejected.If not specified, the activity will never be rejected automatically (the approval process doesn't "expire" / "times out"). |

<Warning>
  **Don't lock yourself up**

  By default, users cannot approve an activity they initiated themselves, even if they are in an approval group. To allow this, you must set `initiatorCanApprove: true`.

  *Example 1:* For any wallet transfer, a policy is setup to require approval from **1 specific admin user** (eg. the CEO). `initiatorCanApprove` was not set to `true`. If the CEO himself initiates a transfer, no-one can approve his transfer and it's stuck.

  *Example 2:* Company has only 3 users. A policy is setup to require approval from **any 3 users** (`quorum: 3`) for any modification of a policy. `initiatorCanApprove` was not set to `true`. In this case, they are locked, and the policy cannot be modified: whoever requests a modification cannot approve, and the policy is therefore always missing one approver. To unlock, they would need to invite a new user and give him the rights to approve as well.
</Warning>

### `NoAction` policy action

This action kind means that nothing will happen after policy rule evaluation. It's meant to be used with KYT policy rules like `ChainalysisTransactionPrescreening`, `ChainalysisTransactionScreening`, or `GlobalLedgerTransactionPrescreening`. This action is for when you just want the KYT analysis rule to be run, and then if triggered, those results returned in a `policy.triggered` [Webhook Event](/api-reference/webhook-events).

```json theme={null}
{
  "action": {
    "kind": "NoAction"
  }
}
```

***

## Policy Filters

Policy filters can reduce the scope on which the policy applies. If no filters are specified, the policy applies to all activities happening in your organisation (all activities of the kind defined by the policy `activityKind`).

For example, you can use filters to setup a policy for activities happening on specific wallets or on groups of wallets. Some examples include:

* "All activities from wallets tagged '`group:treasury`' must first be approved by the CEO
* "All transfers from wallet ID 1 larger than \$1k must first be approved by the CEO & the CFO"
* "All transfers from wallets tagged '`accounting:freeze`' must be blocked"

The filters that you can specify depend on the `activityKind` of your policy (`activityKind`)

### Filters for `"Wallets:Sign"` activity

| key | evaluator | Value |
| - | - | - |
| walletId | in | List of wallet IDs. If the activity is from a wallet within one of these IDs, the policy applies to this wallet. |
| walletTags | hasAny | List of tags. If the activity is from a wallet that <strong>has any of these tags</strong>, the policy will apply to this wallet. |
| walletTags | hasAll | List of tags. If the activity is from a wallet that <strong>has all of these tags</strong>, the policy will apply to this wallet. |

Some examples:

* The policy is scoped only to wallets with IDs `wa-1` or `wa-2`:

```json theme={null}
{
  "filters": {
    "walletId": {
      "in": ["wa-1", "wa-2"]
    }
  }
}
```

* The policy is scoped only to wallets tagged either "`domain:accounting`" or "`sensitive`":

```json theme={null}
{
  "filters": {
    "walletTags": {
      "hasAny": ["domain:accounting", "sensitive"]
    }
  }
}
```

* The policy is scoped only to wallets tagged with both "`domain:accounting`" and "`sensitive`":&#x20;

```json theme={null}
{
  "filters": {
    "walletTags": {
      "hasAll": ["domain:accounting", "sensitive"]
    }
  }
}
```

* The policy is scoped only to wallets containing all these tags ("`domain:accounting`", "`zone:asia`") **AND** at least one of these tags ("`security:high`", "`security:medium`"):&#x20;

```json theme={null}
{
  "filters": {
    "walletTags": {
      "hasAll": ["domain:accounting", "zone:asia"],
      "hasAny": ["security:high", "security:medium"]
    }
  }
}
```

Note the relationship between inclusion operators is always AND, not OR.&#x20;

### Filters for `"Policies:Modify"` activity

<table><thead><tr><th width="177">filter key</th><th width="111">evaluator</th><th>Value</th></tr></thead><tbody><tr><td><code>policyId</code></td><td><code>in</code></td><td>List of policy IDs. If the policy being modified is one of these IDs, the policy applies.</td></tr></tbody></table>

Some examples:

* The policy is scoped only to policies with IDs `plc-1` or `plc-2`

```json theme={null}
{
  "filters": {
    "policyId": {
      "in": ["plc-1", "plc-2"]
    }
  }
}
```

### Filters for `"Permissions:Modify"` activity

| filter key | evaluator | Value |
| - | - | - |
| permissionId | in | List of permission IDs. If the permission being modified is one of these IDs, the policy applies. |

Some examples:

* The policy is scoped only to permissions with IDs `pm-1` or `pm-2`

```json theme={null}
{
  "filters": {
    "permissionId": {
      "in": ["pm-1", "pm-2"]
    }
  }
}
```

### Filters for `"Permissions:Assign"` activity

| filter key | evaluator | Value |
| - | - | - |
| permissionId | in | List of permission IDs. If the permission being assigned/revoked is one of these IDs, the policy applies. |

Some examples:

* The policy is scoped only to permissions with IDs `pm-1` or `pm-2`

```json theme={null}
{
  "filters": {
    "permissionId": {
      "in": ["pm-1", "pm-2"]
    }
  }
}
```

## Policy object


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.