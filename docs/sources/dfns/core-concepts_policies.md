> ## Documentation Index
> Fetch the complete documentation index at: https://docs.dfns.co/llms.txt
> Use this file to discover all available pages before exploring further.

# Policies

> DFNS policies enable businesses to enforce rules and request approvals on top of actions like transfers, signing, permission changes, and policy edits.

export const SupportLink = ({children}) => {
  const url = "https://support.dfns.co";
  return <a href={url} target="_blank">{children || url}</a>;
};

A Policy acts as a "gate" for a given activity in DFNS system, which enforces a set of rules before the activity is executed. If triggered, a policy can either block the activity or launch an approval process before finalizing the activity.

<Note>
  **Default behavior:** If no policies are configured, all transactions are allowed. Policies add restrictions on top of the default "allow all" behavior - they are not a whitelist.
</Note>

<Warning>
  **Delegated wallets bypass policies.** Policies only apply to organization-managed wallets. [Delegated wallets](/advanced/delegated-wallets) bypass the policy engine entirely. The end user holds full signing authority and your organization cannot apply controls to their transactions.
</Warning>

<Info>
  **All policies are evaluated:** When an activity occurs, every matching policy is evaluated. Policies cannot bypass or override each other - if any policy triggers a `Block` action, the activity is blocked. If multiple policies trigger `RequestApproval`, approvals from all triggered policies are required before the activity proceeds.
</Info>

Policies are used as part of risk management, information security, or other compliance functions.

The policy Engine allows you to create a policy, specifying the conditions that will result in an approval being triggered, as well as the approval groups whose approval will be required.  For example:

As a compliance officer, you have to implement these new processes:

1. For payments over \$100,000, request approval from a Vice President.
2. For payments over \$250,000, request approval from both a Vice President and a Managing Director.

To do that you will have to create two Policies:

* **Large Payment**:
  * Rule: `TransactionAmountLimit` with amount value of \$100,000.
  * Approval scoped to VicePresidents.
* **Very Large Payment**:
  * Rule: `TransactionAmountLimit` with amount value of \$250,000.
  * Approval scoped to ManagingDirectors.

When a policy is triggered, it generates an approval request, which must be either approved or rejected by members of the corresponding approval group.  Here's a schematic of the Policy Engine entity model:

<img src="https://mintcdn.com/dfns-6d8c7466/aH8Z4RyoX4Vg4edY/images/spaces_2FtnSPOZGQ2hBmgoVWX5H6_2Fuploads_2FMokMaAtFeu19FcFPmZxX_2Fimage.png?fit=max&auto=format&n=aH8Z4RyoX4Vg4edY&q=85&s=55e97c28e585ff8d2568beaa33018040" alt="Policy Engine Schematic" width="5225" height="765" data-path="images/spaces_2FtnSPOZGQ2hBmgoVWX5H6_2Fuploads_2FMokMaAtFeu19FcFPmZxX_2Fimage.png" />

## Available rules

| Rule | When it triggers |
| - | - |
| `AlwaysTrigger` | Every signature request requires approval (or is blocked) |
| `TransactionAmountLimit` | Transactions above a USD threshold |
| `TransactionAmountLimitNominal` | Transactions above a per-asset limit set in the asset's own units |
| `TransactionAmountVelocity` | Total value transferred from a wallet exceeds a limit within a time window |
| `TransactionCountVelocity` | Number of transactions from a wallet exceeds a limit within a time window |
| `TransactionRecipientWhitelist` | Transactions to addresses not on your approved list |
| `ChainalysisTransactionPrescreening` | Outbound transactions flagged by Chainalysis KYT |
| `ChainalysisTransactionScreening` | Incoming transactions flagged by Chainalysis KYT |
| `GlobalLedgerTransactionPrescreening` | Outbound transactions flagged by Global Ledger KYT |
| `TravelRuleTransactionPrescreening` | Transfers requiring travel rule compliance (via Notabene) |

When triggered, policies can either **block** the transaction or **request approval** from designated users.

<Warning>
  **`TransactionAmountLimit`, `TransactionAmountLimitNominal`, and `TransactionRecipientWhitelist` only evaluate plain value transfers.** When the recipient or amount cannot be inferred from the activity (a raw [signature request](/api-reference/keys/generate-signature), a swap, a contract call, or a 0-value transaction), these rules **fail closed and trigger**. A recipient-whitelist rule with a `Block` action will therefore block swaps and contract calls. To permit those, scope the policy so it does not apply to the wallets performing them, or use `RequestApproval` instead of `Block`.
</Warning>

### Blocking by default (allowlist)

By default every activity is allowed, and policies add restrictions on top. There is no `Allow` action, and `Block` always wins over `RequestApproval`, so you cannot re-permit an activity by adding a second "allow" policy. To deny by default and permit only specific cases:

1. Create a catch-all policy with the `AlwaysTrigger` rule and the `Block` action.
2. Use the policy's filters to **scope it to the wallets it should restrict** (for example, by [wallet tags](#using-wallet-tags)). Wallets outside that scope keep the default allow-all behavior.

Carve out exceptions by narrowing the catch-all's scope, not by layering a competing policy on top of it.

## Approval process

When a policy triggers with the `RequestApproval` action, the transaction is held until enough approvers sign off. This is configured using **approval groups** and **quorums**:

* **Approval group**: A set of users who can approve. You can specify exact user IDs, or allow anyone in the organization.
* **Quorum**: The minimum number of approvals needed from that group. For example, "2 out of 5 admins must approve."

You can require multiple approval groups - for instance, requiring approval from both a compliance team (1 of 3) AND a finance team (2 of 4). The transaction only proceeds when all groups reach their quorum.

If any approver rejects, the transaction is cancelled. You can also set an auto-reject timeout so pending approvals don't hang indefinitely.

<Tip>
  By default, the person who initiated the transaction cannot approve it themselves. Set `initiatorCanApprove: true` if you need to allow this.
</Tip>

### Service account approvers

Service accounts can participate in approval groups when `serviceAccountsCanApprove` is set to `true` on the group. This enables automated approval workflows where a service account can vote alongside human approvers.

<Note>
  This feature requires activation by DFNS staff on your organization. Contact our <SupportLink>Support Team</SupportLink> to enable it.
</Note>

When enabled:

* Service accounts must be explicitly listed in the approval group's `approvers` (wildcards are not allowed)
* Service account votes count toward the group's quorum
* A service account rejection denies the entire approval
* Mixed groups with both human and service account approvers are supported

See the [API reference](/api-reference/policies#requestapproval-policy-action) for configuration details.

## Automating with Service Accounts

When automating transactions with Service Accounts, you may need certain wallets to bypass approval workflows (e.g., automated payouts, scheduled transfers).

### Using wallet tags

Use **wallet tags** to scope policies to specific wallets. Tag the wallets that need approval workflows, leaving automated wallets untagged:

1. **Tag wallets that need approval**: Add a tag like `requires-approval` to wallets managed by humans
2. **Create policies with filters**: Target policies only at tagged wallets

```json theme={null}
{
  "name": "Large Payment Approval",
  "activityKind": "Wallets:Sign",
  "rule": {
    "kind": "TransactionAmountLimit",
    "configuration": {
      "limit": 100000,
      "currency": "USD"
    }
  },
  "action": {
    "kind": "RequestApproval",
    "approvalGroups": [...]
  },
  "filters": {
    "walletTags": {
      "hasAny": ["requires-approval"]
    }
  }
}
```

This policy requires approval for large transactions but only applies to wallets tagged with `requires-approval`. Automated wallets without this tag won't trigger the policy.

<Tip>
  You can also use the `walletId` filter to target specific wallets, but wallet tags are more flexible for managing multiple wallets.
</Tip>

## Get started

<CardGroup cols={2}>
  <Card title="Create policies" icon="plus" href="/guides/create-policies">
    Step-by-step guide to create policies in the dashboard
  </Card>

  <Card title="Policies API reference" icon="code" href="/api-reference/policies">
    All rules, actions, and filters explained
  </Card>

  <Card title="Policies for signing" icon="signature" href="/guides/signing-policies">
    Configure policies for raw signatures and EIP-712
  </Card>

  <Card title="Approving requests" icon="check" href="/guides/dashboard-videos#policies--governance">
    How to approve policy-triggered requests
  </Card>
</CardGroup>


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.