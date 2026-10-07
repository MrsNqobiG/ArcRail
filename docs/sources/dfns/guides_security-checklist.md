> ## Documentation Index
> Fetch the complete documentation index at: https://docs.dfns.co/llms.txt
> Use this file to discover all available pages before exploring further.

# Security checklist

> Warning signs to check for in your DFNS organization: over-privileged users and service accounts, ineffective policies, blind spots, and lockout risks.

Review your organization against these warning signs. Each one is quick to spot and quick to fix. For the reasoning and detailed configurations behind the fixes, see [security best practices](/guides/security-best-practices).

## One compromised user should not be enough

A rogue or compromised user can only do what their role and your policies allow.

| What to check | What to do |
| - | - |
| - Several users are full admin.<br />- No [governance policies](/guides/security-best-practices#governance-policies) apply. | Give day-to-day users [fine-grained roles](/guides/security-best-practices#role-templates), and require approval on admin actions. Several admins are healthy — unchecked admins are not. |
| - You have mainnet wallets.<br />- Several users have access.<br />- There are no policies. | [Create policies](/guides/security-best-practices#policy-templates-by-use-case). Without them, any single compromised user can move funds. |

## One leaked key should not be enough

Service account credentials live on servers, in CI systems, and in secret managers. They leak more often than passkeys, so scope them for containment.

| What to check | What to do |
| - | - |
| A service account is full admin | Create a [dedicated role](/guides/security-best-practices#service-account-automation) per service account, with only the permissions it uses. |
| - You have mainnet wallets.<br />- A service account has access.<br />- There are no policies. | Create policies. They govern service account activity like any other, so a leaked key alone can't move funds. |
| A service account can manage users, permissions, or policies | Remove those permissions. Automation almost never needs them, and a leaked key could otherwise disable your other controls. |
| One service account shared across systems | Create one per integration. A leak stays contained, and revoking it doesn't break everything else. |
| Unused service accounts or tokens still active | Deactivate them. Forgotten keys are the ones that leak. |
| A service account's private key sits on the computer of whoever created it | Generate keys where they run — a server or secrets manager — and keep no copy on a workstation. A compromised laptop steals keys silently; [rotate](/guides/developers/credential-rotation) any key that may have been exposed. |

## Policies that don't protect you

A policy can exist and still not protect you.

| What to check | What to do |
| - | - |
| A policy has `initiatorCanApprove: true` | It's off by default, so re-justify it. With it on, an attacker who can initiate needs one fewer external approval; with a quorum of 1, they approve their own request. |
| No policies on `Permissions:Assign`, `Permissions:Modify`, `Policies:Modify` | Add the [three governance policies](/guides/security-best-practices#governance-policies). Otherwise every other policy is one API call away from deletion. |
| A policy's only approver is a service account | Add a human approval group. Automation shouldn't wave through an attacker's transfer. |
| Policy filters match no wallets | Fix the scope. The policy exists, but nothing is covered. |
| No amount limit or velocity cap on mainnet wallets | Add [`TransactionAmountLimit` and velocity rules](/guides/security-best-practices#policy-templates-by-use-case) so one compromise can't drain everything in a single transaction. |

## Blind spots

You can't react to what you don't see.

| What to check | What to do |
| - | - |
| No webhooks configured | [Subscribe](/guides/developers/webhooks) at least to transfer and policy events (`wallet.transfer.*`, `policy.approval.pending`) so you notice a drain while it's happening, not after. |
| Empty address book despite regular transfers | [Add your counterparties](/guides/address-book) so lookalike addresses stand out. |
| - Wallets always pay the same addresses.<br />- There is no whitelist policy. | Add a [`TransactionRecipientWhitelist` policy](/core-concepts/policies). Stolen credentials can then only send funds where they already go. |

## Lockout risks

Hardening cuts both ways: check that you can't lock yourself out.

| What to check | What to do |
| - | - |
| A user has a single credential on a single device | Register a [backup credential](/guides/register-passkey). Losing a phone shouldn't mean losing the account. |
| Only one admin in the organization | Add a second, protected by the [governance policies](/guides/security-best-practices#governance-policies). No single point of failure — in either direction. |

## Next steps

<CardGroup cols={2}>
  <Card title="Security best practices" icon="shield" href="/guides/security-best-practices">
    The reasoning and configurations behind each checklist item
  </Card>

  <Card title="Create policies" icon="scale-balanced" href="/guides/create-policies">
    Step-by-step policy creation in the dashboard
  </Card>
</CardGroup>


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.