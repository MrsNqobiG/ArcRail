> ## Documentation Index
> Fetch the complete documentation index at: https://docs.dfns.co/llms.txt
> Use this file to discover all available pages before exploring further.

# Manage policies via API

> Programmatically create, update, archive, and approve DFNS policies from your application using the policies and policy approvals API.

export const SupportLink = ({children}) => {
  const url = "https://support.dfns.co";
  return <a href={url} target="_blank">{children || url}</a>;
};

This guide covers how to manage policies and handle approval workflows using the DFNS API and SDK.

## Prerequisites

* Service account or authenticated user with policy management permissions
* DFNS SDK installed and configured
* Understanding of [policies](/core-concepts/policies)

## Creating a policy

Create a policy that requires approval for large transactions:

```typescript theme={null}
import { DfnsApiClient } from '@dfns/sdk'

const dfns = new DfnsApiClient({
  baseUrl: 'https://api.dfns.io',
  // Your signer configuration
})

const policy = await dfns.policies.createPolicy({
  body: {
    name: 'Large Transaction Approval',
    activityKind: 'Wallets:Sign',
    rule: {
      kind: 'TransactionAmountLimit',
      configuration: {
        limit: 100000, // number, not string
        currency: 'USD' // only USD is supported
      }
    },
    action: {
      kind: 'RequestApproval',
      approvalGroups: [
        {
          name: 'Treasury',
          quorum: 2,
          approvers: {
            userId: {
              in: ['us-xxx-1', 'us-xxx-2', 'us-xxx-3']
            }
          },
          serviceAccountsCanApprove: false, // set to true to allow service accounts to vote (requires staff activation)
        }
      ],
      autoRejectTimeout: 1440 // in minutes (1440 = 24 hours)
    },
    status: 'Active'
  }
})

console.log('Policy ID:', policy.id)
```

## Policy rule types

### Transaction amount limit

Trigger when a single transaction exceeds a threshold, as a fiat value (`TransactionAmountLimit`) or per-asset in the asset's own units (`TransactionAmountLimitNominal`).

```typescript theme={null}
// Fiat: compared against the transfer's USD market value
rule: {
  kind: 'TransactionAmountLimit',
  configuration: {
    limit: 100000,
    currency: 'USD'
  }
}
```

<Note>
  `limit` is a number, not a string. `currency` currently only accepts `USD`.
</Note>

```typescript theme={null}
// Nominal: per-asset limit in the asset's minimum denomination, no price lookup.
// Up to 100 assets; a transfer of an unlisted asset doesn't trigger the rule.
rule: {
  kind: 'TransactionAmountLimitNominal',
  configuration: {
    assets: [
      { network: 'Ethereum', tid: 'native:eth', limit: '5000000000000000000' },      // 5 ETH
      { network: 'Ethereum', tid: 'erc20:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', limit: '10000000000' } // 10,000 USDC
    ]
  }
}
```

<Note>
  Nominal limits are API/SDK only for now — the dashboard policy builder supports the fiat rule.
</Note>

### Transaction amount velocity

Trigger when total transaction value exceeds a limit within a time window:

```typescript theme={null}
rule: {
  kind: 'TransactionAmountVelocity',
  configuration: {
    limit: 500000,
    currency: 'USD',
    timeframe: 1440 // in minutes (1440 = 24 hours), max 43200
  }
}
```

### Transaction count velocity

Trigger when transaction count exceeds a limit within a time window:

```typescript theme={null}
rule: {
  kind: 'TransactionCountVelocity',
  configuration: {
    limit: 100,
    timeframe: 1440 // in minutes (1440 = 24 hours), max 43200
  }
}
```

### Recipient whitelist

Trigger when recipient is NOT in the whitelist:

```typescript theme={null}
rule: {
  kind: 'TransactionRecipientWhitelist',
  configuration: {
    addresses: [
      '0x...address1',
      '0x...address2'
    ]
  }
}
```

### Always trigger

Trigger on all matching activities:

```typescript theme={null}
rule: {
  kind: 'AlwaysTrigger',
  configuration: {}
}
```

## Policy actions

### Request approval

Require human approval before proceeding:

```typescript theme={null}
action: {
  kind: 'RequestApproval',
  approvalGroups: [
    {
      name: 'Finance',
      quorum: 1,
      approvers: {
        userId: { in: ['us-xxx-1', 'us-xxx-2'] }
      }
    }
  ],
  autoRejectTimeout: 1440 // in minutes (1440 = 24 hours)
}
```

### Block

Block the activity entirely:

```typescript theme={null}
action: {
  kind: 'Block'
}
```

## Policy filters

Apply policies to specific wallets using tags:

```typescript theme={null}
const policy = await dfns.policies.createPolicy({
  body: {
    name: 'Treasury Policy',
    activityKind: 'Wallets:Sign',
    rule: {
      kind: 'TransactionAmountLimit',
      configuration: { limit: 50000, currency: 'USD' }
    },
    action: {
      kind: 'RequestApproval',
      approvalGroups: [/* ... */]
    },
    filters: {
      walletTags: {
        hasAny: ['treasury']
      }
    },
    status: 'Active'
  }
})
```

## Listing policies

Get all policies:

```typescript theme={null}
const policies = await dfns.policies.listPolicies()

for (const policy of policies.items) {
  console.log(`${policy.name}: ${policy.status}`)
}
```

## Updating a policy

An update replaces the whole policy — it is not a partial patch. The body must include `name`, `activityKind`, `rule`, and `action`, even for fields you are not changing. Omitting `activityKind` returns a `400`.

```typescript theme={null}
await dfns.policies.updatePolicy({
  policyId: 'pl-xxx-xxx',
  body: {
    name: 'Updated Policy Name',
    activityKind: 'Wallets:Sign', // required
    rule: {
      kind: 'TransactionAmountLimit',
      configuration: { limit: 100000, currency: 'USD' }
    },
    action: { kind: 'Block' },
    status: 'Active'
  }
})
```

## Deleting a policy

Delete a policy:

```typescript theme={null}
await dfns.policies.deletePolicy({
  policyId: 'pl-xxx-xxx'
})
```

## Working with approvals

### Listing pending approvals

Get approvals awaiting action. This calls `GET /v2/policy-approvals` and requires the `Policies:Evaluations:Read` permission:

```typescript theme={null}
const approvals = await dfns.policyApprovals.listApprovals({
  query: {
    status: 'Pending'
  }
})

for (const approval of approvals.items) {
  console.log(`Approval ${approval.id}: ${approval.activity.kind}`)
}
```

### Getting approval details

Get details for a specific approval:

```typescript theme={null}
const approval = await dfns.policyApprovals.getApproval({
  approvalId: 'pa-xxx-xxx'
})

console.log('Activity:', approval.activity)
console.log('Triggered policies:', approval.triggeredPolicies)
console.log('Decisions so far:', approval.decisions)
```

### Submitting an approval decision

Approve or deny a pending approval. This calls `POST /v2/policy-approvals/{approvalId}/decisions`, whose body `value` is either `Approved` or `Denied`. The caller needs the `Policies:Evaluations:Vote` permission.

```typescript theme={null}
// Approve
await dfns.policyApprovals.createApprovalDecision({
  approvalId: 'pa-xxx-xxx',
  body: {
    value: 'Approved',
    reason: 'Verified transaction details with finance team'
  }
})

// Deny
await dfns.policyApprovals.createApprovalDecision({
  approvalId: 'pa-xxx-xxx',
  body: {
    value: 'Denied',
    reason: 'Recipient address not verified'
  }
})
```

<Note>
  The user or service account submitting the decision must be listed in one of the approval groups defined in the policy. The initiator cannot approve their own transactions by default. Service accounts can submit decisions when [`serviceAccountsCanApprove`](/core-concepts/policies#service-account-approvers) is enabled on the group.
</Note>

## Webhook notifications

Subscribe to policy events:

```typescript theme={null}
await dfns.webhooks.createWebhook({
  body: {
    url: 'https://your-app.com/webhooks/dfns',
    events: [
      'policy.approval.pending',
      'policy.approval.resolved',
      'policy.triggered'
    ],
    status: 'Enabled'
  }
})
```

Handle approval events:

```typescript theme={null}
app.post('/webhooks/dfns', async (req, res) => {
  const event = req.body

  switch (event.kind) {
    case 'policy.approval.pending':
      // Notify approvers
      await notifyApprovers(event.data)
      break
    case 'policy.approval.resolved':
      // Approval completed (approved or rejected)
      await handleApprovalResolved(event.data)
      break
  }

  res.status(200).send('OK')
})
```

## Example: Multi-tier approval

Create a policy with multiple approval tiers:

```typescript theme={null}
// Tier 1: Operations approval for $10k+
await dfns.policies.createPolicy({
  body: {
    name: 'Operations Approval',
    activityKind: 'Wallets:Sign',
    rule: {
      kind: 'TransactionAmountLimit',
      configuration: { limit: 10000, currency: 'USD' }
    },
    action: {
      kind: 'RequestApproval',
      approvalGroups: [{
        name: 'Operations',
        quorum: 1,
        approvers: { userId: { in: ['ops-user-1', 'ops-user-2'] } }
      }]
    },
    status: 'Active'
  }
})

// Tier 2: Finance approval for $100k+
await dfns.policies.createPolicy({
  body: {
    name: 'Finance Approval',
    activityKind: 'Wallets:Sign',
    rule: {
      kind: 'TransactionAmountLimit',
      configuration: { limit: 100000, currency: 'USD' }
    },
    action: {
      kind: 'RequestApproval',
      approvalGroups: [{
        name: 'Finance',
        quorum: 2,
        approvers: { userId: { in: ['finance-1', 'finance-2', 'finance-3'] } }
      }]
    },
    status: 'Active'
  }
})
```

## Automated approvals with service accounts

Service accounts can participate in approval groups, enabling automated approval workflows. For example, a compliance service that checks transactions against internal rules before approving.

<Note>
  This feature requires activation by DFNS staff on your organization. Contact our <SupportLink>Support Team</SupportLink> to enable it.
</Note>

### Setting up the policy

Create a policy with a service account in an approval group. The service account must be explicitly listed in `approvers`:

```typescript theme={null}
const policy = await dfns.policies.createPolicy({
  body: {
    name: 'Automated Compliance Check',
    activityKind: 'Wallets:Sign',
    rule: {
      kind: 'TransactionAmountLimit',
      configuration: {
        limit: 10000,
        currency: 'USD'
      }
    },
    action: {
      kind: 'RequestApproval',
      approvalGroups: [
        {
          name: 'Compliance',
          quorum: 1,
          approvers: {
            userId: {
              in: ['us-sa-xxx', 'us-xxx-1', 'us-xxx-2'] // service account + human fallbacks
            }
          },
          serviceAccountsCanApprove: true,
        }
      ],
      autoRejectTimeout: 1440 // in minutes (1440 = 24 hours)
    },
    status: 'Active'
  }
})
```

The group has a quorum of 1 and includes both the service account and human approvers. The service account evaluates the transaction first. If it approves, the quorum is met and the transaction proceeds. If the service account can't approve, it notifies a human to review and approve instead. Either way, every approval decision is recorded with full accountability.

<Tip>
  A service account rejection denies the entire approval. Design your automation to **abstain rather than reject** when unsure. Notify a human approver and let them make the call within DFNS. This preserves the audit trail and non-repudiation.
</Tip>

### Processing approvals as a service account

Use webhooks to react to pending approvals in real time. When a `policy.approval.pending` event arrives, the service account evaluates the transaction. If it passes, the service account approves. Otherwise, it notifies a human to review:

```typescript theme={null}
app.post('/webhooks/dfns', async (req, res) => {
  const event = req.body

  if (event.kind !== 'policy.approval.pending') {
    return res.status(200).send('OK')
  }

  const approval = await dfns.policyApprovals.getApproval({
    approvalId: event.data.approvalId,
  })

  // Run your approval logic (e.g. sanctions screening, internal limits)
  const decision = await evaluateTransaction(approval.activity)

  if (decision.approved) {
    await dfns.policyApprovals.createApprovalDecision({
      approvalId: approval.id,
      body: {
        value: 'Approved',
        reason: decision.reason,
      },
    })
  } else {
    // Don't reject: let a human approver review instead
    await notifyHumanApprover(approval, decision.reason)
  }

  res.status(200).send('OK')
})
```

## Related documentation

<CardGroup cols={2}>
  <Card title="Policies API" icon="book" href="/api-reference/policies">
    Complete API reference
  </Card>

  <Card title="Approvals API" icon="check" href="/api-reference/policy-approvals">
    Approval management API
  </Card>

  <Card title="Policies concept" icon="shield" href="/core-concepts/policies">
    Understanding policies
  </Card>

  <Card title="Set up webhooks" icon="webhook" href="/guides/developers/webhooks">
    Event notifications
  </Card>
</CardGroup>


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.