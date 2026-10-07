> ## Documentation Index
> Fetch the complete documentation index at: https://docs.dfns.co/llms.txt
> Use this file to discover all available pages before exploring further.

# Roles and permissions

> How DFNS roles, permissions, and assignments control which users and service accounts can perform which actions in your organization.

export const Delete = props => {
  return <code style={{
    paddingLeft: 0,
    paddingTop: 0
  }}>
      <Badge color="red" size="sm">DEL</Badge>
      <span style={{
    marginLeft: '0.5em'
  }}>{props.children}</span>
    </code>;
};

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

export const Put = props => {
  return <code style={{
    paddingLeft: 0,
    paddingTop: 0
  }}>
      <span class="px-1 py-0.5 rounded-md text-[0.875em] leading-tight bg-yellow-400/20 dark:bg-yellow-400/20 text-yellow-700 dark:text-yellow-400">
        PUT
      </span>
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

Roles enable you to control access to the platform on a granular basis (following the [principle of least privilege](https://en.wikipedia.org/wiki/Principle_of_least_privilege)). As an example, if you have an employee who needs to initiate payments, but shouldn't be able to manipulate policies, you can create a role for that.

Start by [creating a role](/api-reference/permissions/create-permission), selecting which permissions to include, and [assigning it](/api-reference/permissions/assign-permission) to a user.

## Terminology

* **Role**: a role is a named collection of permissions that can be assigned to users or service accounts. When assigned, a role allows the user to perform those actions in the platform. Each role has a unique name and ID. A role can be assigned to one or multiple users, depending on what you need.
* **Permission**: a permission grants access to one action in the API (e.g. `Wallets:Create`). There is a fixed list of permissions ([see below](#list-of-permissions)) that you can include in roles. Every API endpoint requires one or more permissions to use it.
* **Assignment**: the act of granting a role to a user or service account. A role can be assigned (aka "granted") or unassigned (aka "revoked").

<Tip>
  In the API, roles are called "permissions" and permissions are called "operations". When you see `POST /permissions` in the API reference, it means "create a role". The dashboard uses the more intuitive terminology.
</Tip>

## DFNS-managed roles

When your DFNS organization is created, some roles already exist in it. They are special: some of them are automatically assigned, and some of them are immutable (cannot be updated or archived).

### **`ManagedFullAdminAccess`**

This role is automatically assigned to the first user of the organization. It includes all existing (and future) permissions available in the DFNS API. It's immutable, so you cannot update it or archive it. You can only assign it or revoke it.

### **`ManagedDefaultEndUserAccess`**

This role **is assigned by default to any new EndUser** in your organization, and comes with an initial set of permissions (which you can update at any time) allowing any `EndUser` to use the wallet delegated to them by default.

<Note>
  Regardless of roles, an `EndUser` can only access wallets delegated to them. This role does not allow end-users to access your organization's wallets. See [Wallet Visibility](#wallet-visibility) below.
</Note>

This role is meant to facilitate end-user access management. Since all your end users have this role assigned by default, you don't necessarily need to explicitly grant them other roles to allow them to use their wallets, and you only need to modify this one role to affect all your end users at once.

Its initial permission set:

`Keys:Read` · `Keys:Signatures:Create` · `Keys:Signatures:Read` · `Wallets:Read` · `Wallets:Transactions:Create` · `Wallets:Transactions:Read` · `Wallets:Transfers:Create` · `Wallets:Transfers:Read`

This role is not immutable: you can change its permissions and revoke it, but you cannot rename or archive it.

## Role templates

When creating a role in the dashboard (Org → Permissions → New role), five templates are offered as starting points. Selecting one pre-selects a curated permission set, which you can adjust freely before saving the role under your own name — templates are suggestions, not fixed roles.

| Template | Purpose | Grants |
| - | - | - |
| User Admin | Onboards and offboards employees and decides who holds which role | User, service account, and personal access token lifecycle, role management and assignment, auth audit logs |
| Policy Admin | Owns the policy framework and writes the policy's rules | All policy permissions (create, update, delete, view and vote on approvals), read-only context on the objects policies govern |
| Wallet Manager | Provisions wallets and keys — cannot sign transactions or move funds | Wallet, key, and vault creation and configuration, with read-only access to transactions and transfers |
| Auditor | Read-only access across the org — no mutation surface | Every read permission, nothing else (the "Select Read-Only" preset) |
| Developer | Backend service account that manages wallets, signs transactions, and runs delegated auth | Full wallet and key lifecycle including signing, delegated authentication, webhooks |

<Tip>
  Combine templates with [policies](/core-concepts/policies) for separation of duties: a Developer service account initiates transfers, a policy requires approval from named approvers, and an Auditor role gives your security team standing visibility.
</Tip>

## User types

DFNS supports several types of identities, each designed for different use cases:

| Type | Kind | Description | Typical use |
| - | - | - | - |
| Employee | `CustomerEmployee` | Your team members | Dashboard access, wallet management |
| Tenant User | `TenantUser` | An existing user in your tenant granted access to this organization | Multi-org membership: has permissions and can log into the dashboard |
| End User | `EndUser` | Your delegated end customers, created via [Delegated Registration](/api-reference/auth/create-delegated-registration-challenge) | Delegated wallets (user holds signing authority) |
| Service Account | — | Machine identity | Automation, server-to-server API calls |

<Note>
  A `TenantUser` is a distinct kind from `EndUser`. In the dashboard, the "Tenant User" option maps to the `TenantUser` kind — it grants an existing user in your tenant access to this organization (so the same person can belong to multiple orgs), with permissions and dashboard access. It does **not** create an `EndUser`. `EndUser` identities are created only through [Delegated Registration](/api-reference/auth/create-delegated-registration-challenge) and hold signing authority over their own delegated wallets.
</Note>

### Comparison matrix

| Capability | CustomerEmployee | EndUser | Service Account |
| - | - | - | - |
| Wallet visibility | All org wallets | Only delegated wallets | All org wallets |
| Dashboard access | Yes | No | No |
| Policy coverage | Yes | No (bypassed) | Yes |
| Can hold credentials | Yes (passkeys, keys) | Yes (passkeys, keys) | Yes (keys only) |
| Created via | Dashboard or API | [Delegated registration](/api-reference/auth/create-delegated-registration-challenge) | [Service Account API](/api-reference/auth/create-service-account) |

## Wallet visibility

The wallets a user can see depends on their user type:

| User Type | Wallet Visibility |
| - | - |
| `CustomerEmployee` | All wallets in the organization |
| `EndUser` | Only wallets delegated to them |
| Service Account | All wallets in the organization |

**CustomerEmployee** users are your team members who access the DFNS dashboard and manage wallets on behalf of your organization. When granted `Wallets:Read`, they can see all org-managed wallets. This enables shared visibility across your team for operational purposes.

**EndUser** accounts are for your end customers using [delegated wallets](/advanced/delegated-wallets). Each EndUser can only access wallets that have been delegated to them - they cannot see other users' wallets or your organization's wallets. This isolation is enforced at the platform level, regardless of permissions.

**Service Accounts** are machine identities for server-to-server API calls. They can access all organization wallets (when granted appropriate permissions) and are commonly used for automation workflows.

<Note>
  Delegated wallets strictly belong to the EndUser they are delegated to. No one else in the organization can access or manage them - this includes policies, which do not apply to delegated wallets. Only the EndUser can sign transactions for their wallets.
</Note>

<Tip>
  **Need per-user wallet isolation?** `CustomerEmployee` users always see all organization wallets. This cannot be restricted with permissions. Two approaches:

  * **Delegated wallets:** Use `EndUser` accounts with [delegated wallets](/guides/developers/delegated-wallets). Each user can only access wallets delegated to them. Isolation is enforced at the platform level.
  * **Proxy through your backend:** Manage all DFNS wallets via a [service account](/guides/developers/service-account), and handle user-to-wallet mapping in your own backend. Your app controls which wallets each user sees, without registering users in DFNS.
</Tip>

## Role scope

A role applies **organization-wide**: it defines which actions its holder can perform across the organization, and it is created from a name and a list of permissions only. Roles cannot be restricted to specific wallets or wallet groups.

To restrict *which resources or amounts* an action can touch, use [policies](/core-concepts/policies): approval policies can be scoped to specific wallets or wallet tags, require quorum approval, and enforce initiator/approver separation. Roles answer "who can perform which kind of action"; policies answer "on which assets, under whose approval". [Wallet visibility](#wallet-visibility) rules apply independently of both: an `EndUser` only ever sees wallets delegated to them.

## Role assignment

To assign roles to users, you need the `Permissions:Assign` permission. You can also create [policies](/core-concepts/policies) on `Permissions:Assign` activity to require approval for role changes.

## List of permissions

### Activities

<AccordionGroup>
  <Accordion title="Read: Allows reading system and product activities">
    *Dashboard only — no public API endpoint.*
  </Accordion>
</AccordionGroup>

### Address Watches

<AccordionGroup>
  <Accordion title="Create: Allows creating address watches to monitor on-chain activity">
    API permission: `AddressWatches:Create`

    * Create address watch (<small><Post>/address-watches</Post></small> – [doc](/api-reference/address-watches/create-address-watch))
  </Accordion>

  <Accordion title="Delete: Allows deleting address watches">
    API permission: `AddressWatches:Delete`

    * Delete address watch (<small><Delete>/address-watches/\{addressWatchId}</Delete></small> – [doc](/api-reference/address-watches/delete-address-watch))
  </Accordion>

  <Accordion title="Read: Allows viewing address watches">
    API permission: `AddressWatches:Read`

    * List address watches (<small><Get>/address-watches</Get></small> – [doc](/api-reference/address-watches/list-address-watches))
    * Get address watch (<small><Get>/address-watches/\{addressWatchId}</Get></small> – [doc](/api-reference/address-watches/get-address-watch))
    * Get address watch assets (<small><Get>/address-watches/\{addressWatchId}/assets</Get></small> – [doc](/api-reference/address-watches/get-address-watch-assets))
    * Get address watch blockchain events (<small><Get>/address-watches/\{addressWatchId}/blockchain-events</Get></small> – [doc](/api-reference/address-watches/get-address-watch-blockchain-events))
    * Get address watch history (<small><Get>/address-watches/\{addressWatchId}/history</Get></small> – [doc](/api-reference/address-watches/get-address-watch-history))
  </Accordion>
</AccordionGroup>

### Agreements

<AccordionGroup>
  <Accordion title="Accept: Allows accepting legal agreements on behalf of the organization">
    API permission: `Agreements:Accept`

    * Record agreement acceptance (<small><Post>/agreements/\{agreementId}/accept</Post></small> – [doc](/api-reference/agreements/record-agreement-acceptance))
  </Accordion>

  <Accordion title="Read: Allows viewing legal agreements and acceptance records">
    API permission: `Agreements:Read`

    * Get latest unaccepted agreement (<small><Get>/agreements/latest-unaccepted</Get></small> – [doc](/api-reference/agreements/get-latest-unaccepted-agreement))
  </Accordion>
</AccordionGroup>

### Allocations

<AccordionGroup>
  <Accordion title="Create: Allows creating allocations">
    API permission: `Allocations:Create`

    * Create allocation (<small><Post>/allocations</Post></small> – [doc](/api-reference/allocations/create-allocation))
  </Accordion>

  <Accordion title="Read: Allows viewing allocations">
    API permission: `Allocations:Read`

    * List allocations (<small><Get>/allocations</Get></small> – [doc](/api-reference/allocations/list-allocations))
    * List allocation actions (<small><Get>/allocations/\{allocationId}/actions</Get></small> – [doc](/api-reference/allocations/list-allocation-actions))
    * Get allocation (<small><Get>/allocations/\{allocationId}</Get></small> – [doc](/api-reference/allocations/get-allocation))
    * Get allocations info (<small><Get>/allocations/info</Get></small> – [doc](/api-reference/allocations/get-allocations-info))
  </Accordion>

  <Accordion title="Update: Allows updating allocations">
    API permission: `Allocations:Update`

    * Create allocation action (<small><Post>/allocations/\{allocationId}/actions</Post></small> – [doc](/api-reference/allocations/create-allocation-action))
    * Cancel an unfilled 0fns order placement (<small><Post>/allocations/cancel-0fns-order-placement</Post></small> – [doc](/api-reference/allocations/cancel-an-unfilled-0fns-order-placement))
  </Accordion>
</AccordionGroup>

### Analytics

<AccordionGroup>
  <Accordion title="Read: Allows viewing analytics and usage metrics">
    *Dashboard only — no public API endpoint.*
  </Accordion>
</AccordionGroup>

### Authentication

<AccordionGroup>
  <Accordion title="Delegated: Login: Allows logging in users via delegated authentication">
    API permission: `Auth:Delegated:Login`

    * Delegated login (<small><Post>/auth/login/delegated</Post></small> – [doc](/api-reference/auth/delegated-login))
  </Accordion>

  <Accordion title="Delegated: Recover: Allows initiating account recovery via delegated authentication">
    API permission: `Auth:Delegated:Recover`

    * Create delegated recovery challenge (<small><Post>/auth/recover/user/delegated</Post></small> – [doc](/api-reference/auth/create-delegated-recovery-challenge))
  </Accordion>

  <Accordion title="Delegated: Register: Allows registering users via delegated authentication">
    API permission: `Auth:Delegated:Register`

    * Create delegated registration challenge (<small><Post>/auth/registration/delegated</Post></small> – [doc](/api-reference/auth/create-delegated-registration-challenge))
  </Accordion>

  <Accordion title="Logs: Read: Allows reading authentication and access audit logs">
    API permission: `Auth:Logs:Read`

    * List audit logs (<small><Get>/auth/action/logs</Get></small> – [doc](/api-reference/auth/list-audit-logs))
    * Get audit log (<small><Get>/auth/action/logs/\{id}</Get></small> – [doc](/api-reference/auth/get-audit-log))
  </Accordion>

  <Accordion title="Pats: Create: Allows creating Personal Access Tokens (PATs)">
    API permission: `Auth:Pats:Create`

    * Create personal access token (<small><Post>/auth/pats</Post></small> – [doc](/api-reference/auth/create-personal-access-token))
  </Accordion>

  <Accordion title="Service Accounts: Activate: Allows activating a service account">
    API permission: `Auth:ServiceAccounts:Activate`

    * Activate service account (<small><Put>/auth/service-accounts/\{serviceAccountId}/activate</Put></small> – [doc](/api-reference/auth/activate-service-account))
  </Accordion>

  <Accordion title="Service Accounts: Create: Allows creating service accounts for programmatic access">
    API permission: `Auth:ServiceAccounts:Create`

    * Create service account (<small><Post>/auth/service-accounts</Post></small> – [doc](/api-reference/auth/create-service-account))
  </Accordion>

  <Accordion title="Service Accounts: Deactivate: Allows deactivating a service account">
    API permission: `Auth:ServiceAccounts:Deactivate`

    * Deactivate service account (<small><Put>/auth/service-accounts/\{serviceAccountId}/deactivate</Put></small> – [doc](/api-reference/auth/deactivate-service-account))
  </Accordion>

  <Accordion title="Service Accounts: Delete: Allows deleting a service account">
    API permission: `Auth:ServiceAccounts:Delete`

    * Delete service account (<small><Delete>/auth/service-accounts/\{serviceAccountId}</Delete></small> – [doc](/api-reference/auth/delete-service-account))
  </Accordion>

  <Accordion title="Service Accounts: Read: Allows viewing service accounts and their configuration">
    API permission: `Auth:ServiceAccounts:Read`

    * List service accounts (<small><Get>/auth/service-accounts</Get></small> – [doc](/api-reference/auth/list-service-accounts))
    * Get service account (<small><Get>/auth/service-accounts/\{serviceAccountId}</Get></small> – [doc](/api-reference/auth/get-service-account))
  </Accordion>

  <Accordion title="Service Accounts: Update: Allows updating service account details">
    API permission: `Auth:ServiceAccounts:Update`

    * Update service account (<small><Put>/auth/service-accounts/\{serviceAccountId}</Put></small> – [doc](/api-reference/auth/update-service-account))
  </Accordion>

  <Accordion title="Users: Activate: Allows activating a user account">
    API permission: `Auth:Users:Activate`

    * Activate user (<small><Put>/auth/users/\{userId}/activate</Put></small> – [doc](/api-reference/auth/activate-user))
  </Accordion>

  <Accordion title="Users: Create: Allows creating new user accounts within the organization">
    API permission: `Auth:Users:Create`

    * Create user (<small><Post>/auth/users</Post></small> – [doc](/api-reference/auth/create-user))
  </Accordion>

  <Accordion title="Users: Deactivate: Allows deactivating a user account">
    API permission: `Auth:Users:Deactivate`

    * Deactivate user (<small><Put>/auth/users/\{userId}/deactivate</Put></small> – [doc](/api-reference/auth/deactivate-user))
  </Accordion>

  <Accordion title="Users: Delete: Allows permanently deleting a user account">
    API permission: `Auth:Users:Delete`

    * Delete user (<small><Delete>/auth/users/\{userId}</Delete></small> – [doc](/api-reference/auth/delete-user))
  </Accordion>

  <Accordion title="Users: Read: Allows viewing user profiles and user-related metadata">
    API permission: `Auth:Users:Read`

    * Get user (<small><Get>/auth/users/\{userId}</Get></small> – [doc](/api-reference/auth/get-user))
    * List users (<small><Get>/auth/users</Get></small> – [doc](/api-reference/auth/list-users))
  </Accordion>

  <Accordion title="Users: Update: Allows updating user information and settings">
    API permission: `Auth:Users:Update`

    * Update user (<small><Put>/auth/users/\{userId}</Put></small> – [doc](/api-reference/auth/update-user))
  </Accordion>
</AccordionGroup>

### Billing

<AccordionGroup>
  <Accordion title="Manage: Allows managing billing configuration">
    *Dashboard only — no public API endpoint.*
  </Accordion>

  <Accordion title="Read: Allows viewing billing and usage information">
    *Dashboard only — no public API endpoint.*
  </Accordion>
</AccordionGroup>

### Exchanges

<AccordionGroup>
  <Accordion title="Create: Allows creating exchange integrations">
    API permission: `Exchanges:Create`

    * Create exchange (<small><Post>/exchanges</Post></small> – [doc](/api-reference/exchanges/create-exchange))
  </Accordion>

  <Accordion title="Delete: Allows removing exchange integrations">
    API permission: `Exchanges:Delete`

    * Delete exchange (<small><Delete>/exchanges/\{exchangeId}</Delete></small> – [doc](/api-reference/exchanges/delete-exchange))
  </Accordion>

  <Accordion title="Deposits: Create: Allows initiating deposits from exchanges">
    API permission: `Exchanges:Deposits:Create`

    * Create exchange deposit (<small><Post>/exchanges/\{exchangeId}/accounts/\{accountId}/deposits</Post></small> – [doc](/api-reference/exchanges/create-exchange-deposit))
  </Accordion>

  <Accordion title="Read: Allows viewing configured exchanges">
    API permission: `Exchanges:Read`

    * Get exchange (<small><Get>/exchanges/\{exchangeId}</Get></small> – [doc](/api-reference/exchanges/get-exchange))
    * List exchanges (<small><Get>/exchanges</Get></small> – [doc](/api-reference/exchanges/list-exchanges))
    * List accounts (<small><Get>/exchanges/\{exchangeId}/accounts</Get></small> – [doc](/api-reference/exchanges/list-accounts))
    * List account assets (<small><Get>/exchanges/\{exchangeId}/accounts/\{accountId}/assets</Get></small> – [doc](/api-reference/exchanges/list-account-assets))
    * List asset withdrawal networks (<small><Get>/exchanges/\{exchangeId}/accounts/\{accountId}/assets/\{asset}/withdrawal-networks</Get></small> – [doc](/api-reference/exchanges/list-asset-withdrawal-networks))
  </Accordion>

  <Accordion title="Withdrawals: Create: Allows initiating withdrawals to exchanges">
    API permission: `Exchanges:Withdrawals:Create`

    * Create exchange withdrawal (<small><Post>/exchanges/\{exchangeId}/accounts/\{accountId}/withdrawals</Post></small> – [doc](/api-reference/exchanges/create-exchange-withdrawal))
  </Accordion>
</AccordionGroup>

### Fee Sponsors

<AccordionGroup>
  <Accordion title="Create: Allows creating fee sponsor configurations">
    API permission: `FeeSponsors:Create`

    * Create fee sponsor (<small><Post>/fee-sponsors</Post></small> – [doc](/api-reference/fee-sponsors/create-fee-sponsor))
  </Accordion>

  <Accordion title="Delete: Allows deleting fee sponsors">
    API permission: `FeeSponsors:Delete`

    * Delete fee sponsor (<small><Delete>/fee-sponsors/\{feeSponsorId}</Delete></small> – [doc](/api-reference/fee-sponsors/delete-fee-sponsor))
  </Accordion>

  <Accordion title="Read: Allows viewing fee sponsor configurations">
    API permission: `FeeSponsors:Read`

    * List fee sponsors (<small><Get>/fee-sponsors</Get></small> – [doc](/api-reference/fee-sponsors/list-fee-sponsors))
    * Get fee sponsor (<small><Get>/fee-sponsors/\{feeSponsorId}</Get></small> – [doc](/api-reference/fee-sponsors/get-fee-sponsor))
    * List sponsored fees (<small><Get>/fee-sponsors/\{feeSponsorId}/fees</Get></small> – [doc](/api-reference/fee-sponsors/list-sponsored-fees))
  </Accordion>

  <Accordion title="Update: Allows updating fee sponsor settings">
    API permission: `FeeSponsors:Update`

    * Deactivate fee sponsor (<small><Put>/fee-sponsors/\{feeSponsorId}/deactivate</Put></small> – [doc](/api-reference/fee-sponsors/deactivate-fee-sponsor))
    * Activate fee sponsor (<small><Put>/fee-sponsors/\{feeSponsorId}/activate</Put></small> – [doc](/api-reference/fee-sponsors/activate-fee-sponsor))
  </Accordion>

  <Accordion title="Use: Allows using a fee sponsor to pay transaction fees">
    API permission: `FeeSponsors:Use`

    * Create allocation (<small><Post>/allocations</Post></small> – [doc](/api-reference/allocations/create-allocation)) Required if **`feeSponsorId`** is specified and the sponsoree wallet belongs to an **`EndUser`** user kind
    * Create allocation action (<small><Post>/allocations/\{allocationId}/actions</Post></small> – [doc](/api-reference/allocations/create-allocation-action)) Required if **`feeSponsorId`** is specified and the sponsoree wallet belongs to an **`EndUser`** user kind
    * Cancel an unfilled 0fns order placement (<small><Post>/allocations/cancel-0fns-order-placement</Post></small> – [doc](/api-reference/allocations/cancel-an-unfilled-0fns-order-placement)) Required if **`feeSponsorId`** is specified and the sponsoree wallet belongs to an **`EndUser`** user kind
    * Create swap (<small><Post>/swaps</Post></small> – [doc](/api-reference/swaps/create-swap)) Required if **`feeSponsorId`** is specified and the sponsoree wallet belongs to an **`EndUser`** user kind
    * Sign and broadcast transaction (<small><Post>/wallets/\{walletId}/transactions</Post></small> – [doc](/api-reference/wallets/sign-and-broadcast-transaction)) Required if **`feeSponsorId`** is specified
    * Transfer asset (<small><Post>/wallets/\{walletId}/transfers</Post></small> – [doc](/api-reference/wallets/transfer-asset)) Required if **`feeSponsorId`** is specified
  </Accordion>
</AccordionGroup>

### Key Stores

<AccordionGroup>
  <Accordion title="Instructions: Cancel: Allows canceling an offline signer fleet operation">
    API permission: `KeyStores:Instructions:Cancel`

    * Cancel fleet operation (<small><Post>/key-stores/\{storeId}/fleet-operations/cancel</Post></small> – [doc](/api-reference/signers/cancel-fleet-operation))
  </Accordion>

  <Accordion title="Instructions: Fleets: Clone: Allows cloning an offline signer fleet">
    API permission: `KeyStores:Instructions:Fleets:Clone`

    * Create clone input (<small><Post>/key-stores/\{storeId}/clone/input</Post></small> – [doc](/api-reference/signers/create-clone-input))
    * Submit clone output (<small><Post>/key-stores/\{storeId}/clone/output</Post></small> – [doc](/api-reference/signers/submit-clone-output))
  </Accordion>

  <Accordion title="Instructions: Fleets: Create: Allows setting up a genesis for an offline signer fleet">
    API permission: `KeyStores:Instructions:Fleets:Create`

    * Create genesis input (<small><Post>/key-stores/\{storeId}/genesis/input</Post></small> – [doc](/api-reference/signers/create-genesis-input))
    * Submit genesis output (<small><Post>/key-stores/\{storeId}/genesis/output</Post></small> – [doc](/api-reference/signers/submit-genesis-output))
  </Accordion>

  <Accordion title="Instructions: Fleets: Keys: Harvest: Allows harvesting additional keys onto an offline signer fleet">
    API permission: `KeyStores:Instructions:Fleets:Keys:Harvest`

    * Create key harvest input (<small><Post>/key-stores/\{storeId}/key-harvest/input</Post></small> – [doc](/api-reference/signers/create-key-harvest-input))
    * Submit key harvest output (<small><Post>/key-stores/\{storeId}/key-harvest/output</Post></small> – [doc](/api-reference/signers/submit-key-harvest-output))
  </Accordion>

  <Accordion title="Instructions: Fleets: Provisioners: Add: Allows adding a provisioner to an offline signer fleet">
    API permission: `KeyStores:Instructions:Fleets:Provisioners:Add`

    * Create add provisioner input (<small><Post>/key-stores/\{storeId}/add-provisioner/input</Post></small> – [doc](/api-reference/signers/create-add-provisioner-input))
    * Submit add provisioner output (<small><Post>/key-stores/\{storeId}/add-provisioner/output</Post></small> – [doc](/api-reference/signers/submit-add-provisioner-output))
  </Accordion>

  <Accordion title="Instructions: Fleets: Users: Add: Allows adding a user to an offline signer fleet">
    API permission: `KeyStores:Instructions:Fleets:Users:Add`

    * Create add mac user input (<small><Post>/key-stores/\{storeId}/add-mac-user/input</Post></small> – [doc](/api-reference/signers/create-add-mac-user-input))
    * Submit add mac user output (<small><Post>/key-stores/\{storeId}/add-mac-user/output</Post></small> – [doc](/api-reference/signers/submit-add-mac-user-output))
  </Accordion>

  <Accordion title="Instructions: Keys: Prove Control: Allows generating a proof of control for a key store">
    API permission: `KeyStores:Instructions:Keys:ProveControl`

    * Create proof of control input (<small><Post>/key-stores/\{storeId}/proof-of-control/input</Post></small> – [doc](/api-reference/signers/create-proof-of-control-input))
    * Submit proof of control output (<small><Post>/key-stores/\{storeId}/proof-of-control/output</Post></small> – [doc](/api-reference/signers/submit-proof-of-control-output))
  </Accordion>

  <Accordion title="Instructions: Keys: Sign: Allows downloading and signing offline signer transfers">
    API permission: `KeyStores:Instructions:Keys:Sign`

    * Create onchain sign input (<small><Post>/key-stores/\{storeId}/onchain-sign/input</Post></small> – [doc](/api-reference/signers/create-onchain-sign-input))
    * Submit onchain sign output (<small><Post>/key-stores/\{storeId}/onchain-sign/output</Post></small> – [doc](/api-reference/signers/submit-onchain-sign-output))
  </Accordion>

  <Accordion title="Read: Allows viewing key store configurations">
    API permission: `KeyStores:Read`

    * List key stores (<small><Get>/key-stores</Get></small> – [doc](/api-reference/signers/list-key-stores))
    * List signers (<small><Get>/signers</Get></small> – [doc](/api-reference/signers/list-signers))
  </Accordion>
</AccordionGroup>

### Keys

<AccordionGroup>
  <Accordion title="Child Keys: Create: Allows creating child keys with hierarchical derivation">
    API permission: `Keys:ChildKeys:Create`

    * Create key (<small><Post>/keys</Post></small> – [doc](/api-reference/keys/create-key)) Required if **`deriveFrom`** is specified
  </Accordion>

  <Accordion title="Create: Allows creating cryptographic keys">
    API permission: `Keys:Create`

    * Create key (<small><Post>/keys</Post></small> – [doc](/api-reference/keys/create-key))
    * Create wallet (<small><Post>/wallets</Post></small> – [doc](/api-reference/wallets/create-wallet)) Required if wallet creation also creates a new [Key entity](https://docs.dfns.co/api-reference/keys). This is the default behavior
  </Accordion>

  <Accordion title="Delegate: Allows delegating keys to end users (not reversible)">
    API permission: `Keys:Delegate`

    * Create key (<small><Post>/keys</Post></small> – [doc](/api-reference/keys/create-key)) Required if **`delegateTo`** is specified
    * Delegate key (<small><Post>/keys/\{keyId}/delegate</Post></small> – [doc](/api-reference/keys/delegate-key))
    * Create wallet (<small><Post>/wallets</Post></small> – [doc](/api-reference/wallets/create-wallet)) Required if **`delegateTo`** is specified
  </Accordion>

  <Accordion title="Delete: Allows deleting keys">
    API permission: `Keys:Delete`

    * Delete key (<small><Delete>/keys/\{keyId}</Delete></small> – [doc](/api-reference/keys/delete-key))
  </Accordion>

  <Accordion title="Export: Allows exporting keys (if permitted by policy)">
    API permission: `Keys:Export`

    * Export key (<small><Post>/keys/\{keyId}/export</Post></small> – [doc](/api-reference/keys/export-key))
  </Accordion>

  <Accordion title="Import: Allows importing externally generated keys">
    API permission: `Keys:Import`

    * Import key (<small><Post>/keys/import</Post></small> – [doc](/api-reference/keys/import-key))
    * Import wallet (<small><Post>/wallets/import</Post></small> – [doc](/api-reference/wallets/import-wallet))
  </Accordion>

  <Accordion title="Read: Allows viewing key metadata">
    API permission: `Keys:Read`

    * List keys (<small><Get>/keys</Get></small> – [doc](/api-reference/keys/list-keys))
    * Get key (<small><Get>/keys/\{keyId}</Get></small> – [doc](/api-reference/keys/get-key))
  </Accordion>

  <Accordion title="Reuse: Allows reusing existing keys for multi-chain wallets">
    API permission: `Keys:Reuse`

    * Create wallet (<small><Post>/wallets</Post></small> – [doc](/api-reference/wallets/create-wallet)) Required if **`signingKey.id`** is specified. Wallet will reuse an existing key instead of creating a new one
  </Accordion>

  <Accordion title="Signatures: Create: Allows generating digital signatures">
    API permission: `Keys:Signatures:Create`

    * Generate signature (<small><Post>/keys/\{keyId}/signatures</Post></small> – [doc](/api-reference/keys/generate-signature))
  </Accordion>

  <Accordion title="Signatures: Read: Allows viewing signature requests and results">
    API permission: `Keys:Signatures:Read`

    * List signatures (<small><Get>/keys/\{keyId}/signatures</Get></small> – [doc](/api-reference/keys/list-signatures))
    * Get signature (<small><Get>/keys/\{keyId}/signatures/\{signatureId}</Get></small> – [doc](/api-reference/keys/get-signature))
  </Accordion>

  <Accordion title="Update: Allows updating key settings">
    API permission: `Keys:Update`

    * Update key (<small><Put>/keys/\{keyId}</Put></small> – [doc](/api-reference/keys/update-key))
  </Accordion>

  <Accordion title="Vrf: Derive: Allows deriving VRF outputs from a key">
    API permission: `Keys:Vrf:Derive`

    * Derive key (<small><Post>/keys/\{keyId}/derive</Post></small> – [doc](/api-reference/keys/derive-key))
  </Accordion>
</AccordionGroup>

### Networks

<AccordionGroup>
  <Accordion title="Canton: Validators: Create: Allows creating Canton validator configurations">
    API permission: `Networks:Canton:Validators:Create`

    * Create canton validator (<small><Post>/networks/\{network}/validators</Post></small> – [doc](/api-reference/networks/create-canton-validator))
  </Accordion>

  <Accordion title="Canton: Validators: Delete: Allows deleting Canton validator configurations">
    API permission: `Networks:Canton:Validators:Delete`

    * Delete canton validator (<small><Delete>/networks/\{network}/validators/\{validatorId}</Delete></small> – [doc](/api-reference/networks/delete-canton-validator))
  </Accordion>

  <Accordion title="Canton: Validators: Read: Allows viewing Canton validator configurations">
    API permission: `Networks:Canton:Validators:Read`

    * Get canton validator (<small><Get>/networks/\{network}/validators/\{validatorId}</Get></small> – [doc](/api-reference/networks/get-canton-validator))
    * List canton validators (<small><Get>/networks/\{network}/validators</Get></small> – [doc](/api-reference/networks/list-canton-validators))
  </Accordion>

  <Accordion title="Canton: Validators: Update: Allows updating Canton validator configurations">
    API permission: `Networks:Canton:Validators:Update`

    * Update canton validator (<small><Put>/networks/\{network}/validators/\{validatorId}</Put></small> – [doc](/api-reference/networks/update-canton-validator))
  </Accordion>
</AccordionGroup>

### Organization

<AccordionGroup>
  <Accordion title="Read: Allows viewing organization details">
    *Dashboard only — no public API endpoint.*
  </Accordion>

  <Accordion title="Settings: Read: Allows viewing organization settings">
    *Dashboard only — no public API endpoint.*
  </Accordion>

  <Accordion title="Settings: Update: Allows updating organization settings">
    *Dashboard only — no public API endpoint.*
  </Accordion>

  <Accordion title="Update: Allows updating organization information">
    *Dashboard only — no public API endpoint.*
  </Accordion>
</AccordionGroup>

### Payins

<AccordionGroup>
  <Accordion title="Create: Allows creating payins and registering payin recipients">
    API permission: `Payins:Create`

    * Create payin (<small><Post>/payins</Post></small> – [doc](/api-reference/payins/create-payin))
    * Request payin quote (<small><Post>/payins/quote</Post></small> – [doc](/api-reference/payins/request-payin-quote))
    * Register payin recipient (<small><Post>/payins/recipients</Post></small> – [doc](/api-reference/payins/register-payin-recipient))
    * Register payin account asset (<small><Post>/payins/accounts/assets</Post></small> – [doc](/api-reference/payins/register-payin-account-asset))
  </Accordion>

  <Accordion title="Read: Allows viewing payins, treasury balances, and payin recipients">
    API permission: `Payins:Read`

    * List payins (<small><Get>/payins</Get></small> – [doc](/api-reference/payins/list-payins))
    * Get payin recipient (<small><Get>/payins/recipients</Get></small> – [doc](/api-reference/payins/get-payin-recipient))
    * Get payin status (<small><Get>/payins/\{payinId}</Get></small> – [doc](/api-reference/payins/get-payin-status))
    * List payin accounts (<small><Get>/payins/accounts</Get></small> – [doc](/api-reference/payins/list-payin-accounts))
    * List payin balances (<small><Get>/payins/balances</Get></small> – [doc](/api-reference/payins/list-payin-balances))
    * List payin options (<small><Get>/payins/options</Get></small> – [doc](/api-reference/payins/list-payin-options))
  </Accordion>
</AccordionGroup>

### Payouts

<AccordionGroup>
  <Accordion title="Create: Allows creating payouts and requesting payout quotes">
    API permission: `Payouts:Create`

    * Create payout (<small><Post>/payouts</Post></small> – [doc](/api-reference/payouts/create-payout))
    * Request payout quote (<small><Post>/payouts/quote</Post></small> – [doc](/api-reference/payouts/request-payout-quote))
  </Accordion>

  <Accordion title="Read: Allows viewing payouts and their status">
    API permission: `Payouts:Read`

    * List payouts (<small><Get>/payouts</Get></small> – [doc](/api-reference/payouts/list-payouts))
    * Get payout status (<small><Get>/payouts/\{payoutId}</Get></small> – [doc](/api-reference/payouts/get-payout-status))
  </Accordion>

  <Accordion title="Update: Allows confirming or canceling a pending payout">
    API permission: `Payouts:Update`

    * Create payout action (<small><Post>/payouts/\{payoutId}/action</Post></small> – [doc](/api-reference/payouts/create-payout-action))
  </Accordion>
</AccordionGroup>

### Permissions

<AccordionGroup>
  <Accordion title="Assign: Allows assigning permissions to users or service accounts">
    API permission: `Permissions:Assign`

    * Assign permission (<small><Post>/permissions/\{permissionId}/assignments</Post></small> – [doc](/api-reference/permissions/assign-permission))
  </Accordion>

  <Accordion title="Assignments: Read: Allows viewing permission assignments">
    API permission: `Permissions:Assignments:Read`

    * List permission assignments (<small><Get>/permissions/\{permissionId}/assignments</Get></small> – [doc](/api-reference/permissions/list-permission-assignments))
  </Accordion>

  <Accordion title="Create: Allows creating new permissions or roles">
    API permission: `Permissions:Create`

    * Create permission (<small><Post>/permissions</Post></small> – [doc](/api-reference/permissions/create-permission))
  </Accordion>

  <Accordion title="Delete: Allows deleting permissions or roles">
    API permission: `Permissions:Delete`

    * Archive permission (<small><Put>/permissions/\{permissionId}/archive</Put></small> – [doc](/api-reference/permissions/archive-permission))
  </Accordion>

  <Accordion title="Read: Allows viewing permissions and roles">
    API permission: `Permissions:Read`

    * List permissions (<small><Get>/permissions</Get></small> – [doc](/api-reference/permissions/list-permissions))
    * Get permission (<small><Get>/permissions/\{permissionId}</Get></small> – [doc](/api-reference/permissions/get-permission))
  </Accordion>

  <Accordion title="Revoke: Allows revoking assigned permissions">
    API permission: `Permissions:Revoke`

    * Revoke permission (<small><Delete>/permissions/\{permissionId}/assignments/\{assignmentId}</Delete></small> – [doc](/api-reference/permissions/revoke-permission))
  </Accordion>

  <Accordion title="Update: Allows updating permissions or roles">
    API permission: `Permissions:Update`

    * Update permission (<small><Put>/permissions/\{permissionId}</Put></small> – [doc](/api-reference/permissions/update-permission))
  </Accordion>
</AccordionGroup>

### Policies

<AccordionGroup>
  <Accordion title="Create: Allows creating policies">
    API permission: `Policies:Create`

    * Create policy (<small><Post>/v2/policies</Post></small> – [doc](/api-reference/policies/create-policy))
  </Accordion>

  <Accordion title="Delete: Allows deleting policies">
    API permission: `Policies:Delete`

    * Delete policy (<small><Delete>/v2/policies/\{policyId}</Delete></small> – [doc](/api-reference/policies/delete-policy))
  </Accordion>

  <Accordion title="Evaluations: Read: Allows viewing pending and historical policy evaluations">
    API permission: `Policies:Evaluations:Read`

    * Get approval (<small><Get>/v2/policy-approvals/\{approvalId}</Get></small> – [doc](/api-reference/policies/get-approval))
    * List approvals (<small><Get>/v2/policy-approvals</Get></small> – [doc](/api-reference/policies/list-approvals))
  </Accordion>

  <Accordion title="Evaluations: Vote: Allows approving or rejecting policy evaluations">
    API permission: `Policies:Evaluations:Vote`

    * Create approval decision (<small><Post>/v2/policy-approvals/\{approvalId}/decisions</Post></small> – [doc](/api-reference/policies/create-approval-decision))
  </Accordion>

  <Accordion title="Read: Allows viewing policies">
    API permission: `Policies:Read`

    * Get policy (<small><Get>/v2/policies/\{policyId}</Get></small> – [doc](/api-reference/policies/get-policy))
    * List policies (<small><Get>/v2/policies</Get></small> – [doc](/api-reference/policies/list-policies))
  </Accordion>

  <Accordion title="Update: Allows updating policies">
    API permission: `Policies:Update`

    * Update policy (<small><Put>/v2/policies/\{policyId}</Put></small> – [doc](/api-reference/policies/update-policy))
  </Accordion>
</AccordionGroup>

### Registry

<AccordionGroup>
  <Accordion title="Addresses: Create: Allows creating new addresses in the address registry">
    *Dashboard only — no public API endpoint.*
  </Accordion>

  <Accordion title="Addresses: Delete: Allows removing addresses from the registry">
    *Dashboard only — no public API endpoint.*
  </Accordion>

  <Accordion title="Addresses: Read: Allows viewing registered addresses and their metadata">
    *Dashboard only — no public API endpoint.*
  </Accordion>

  <Accordion title="Addresses: Update: Allows updating metadata or aliases for registered addresses">
    *Dashboard only — no public API endpoint.*
  </Accordion>

  <Accordion title="Contract Schemas: Create: Allows registering new smart contract schemas (ABIs)">
    *Dashboard only — no public API endpoint.*
  </Accordion>

  <Accordion title="Contract Schemas: Delete: Allows removing contract schemas from the registry">
    *Dashboard only — no public API endpoint.*
  </Accordion>

  <Accordion title="Contract Schemas: Read: Allows viewing registered contract schemas">
    *Dashboard only — no public API endpoint.*
  </Accordion>
</AccordionGroup>

### Staking

<AccordionGroup>
  <Accordion title="Create: Allows creating staking operations">
    API permission: `Stakes:Create`

    * Create stake (<small><Post>/staking/stakes</Post></small> – [doc](/api-reference/staking/create-stake))
  </Accordion>

  <Accordion title="Read: Allows viewing staking positions">
    API permission: `Stakes:Read`

    * List stakes (<small><Get>/staking/stakes</Get></small> – [doc](/api-reference/staking/list-stakes))
    * List stake actions (<small><Get>/staking/stakes/\{stakeId}/actions</Get></small> – [doc](/api-reference/staking/list-stake-actions))
    * Get stakes (<small><Get>/staking/stakes/\{stakeId}</Get></small> – [doc](/api-reference/staking/get-stakes))
    * Get stake rewards (<small><Get>/staking/stakes/\{stakeId}/rewards</Get></small> – [doc](/api-reference/staking/get-stake-rewards))
  </Accordion>

  <Accordion title="Update: Allows updating staking configurations">
    API permission: `Stakes:Update`

    * Create stake action (<small><Post>/staking/stakes/\{stakeId}/actions</Post></small> – [doc](/api-reference/staking/create-stake-action))
  </Accordion>
</AccordionGroup>

### Swaps

<AccordionGroup>
  <Accordion title="Create: Allows creating asset swap operations">
    API permission: `Swaps:Create`

    * Create swap (<small><Post>/swaps</Post></small> – [doc](/api-reference/swaps/create-swap))
  </Accordion>

  <Accordion title="Read: Allows viewing swap history and details">
    API permission: `Swaps:Read`

    * List swaps (<small><Get>/swaps</Get></small> – [doc](/api-reference/swaps/list-swaps))
    * Get swap (<small><Get>/swaps/\{swapId}</Get></small> – [doc](/api-reference/swaps/get-swap))
  </Accordion>
</AccordionGroup>

### Vaults

<AccordionGroup>
  <Accordion title="Create: Allows creating vaults">
    API permission: `Vaults:Create`

    * Create vault (<small><Post>/vaults</Post></small> – [doc](/api-reference/vaults/create-vault))
    * Create vault address (<small><Post>/vaults/\{vaultId}/addresses</Post></small> – [doc](/api-reference/vaults/create-vault-address))
  </Accordion>

  <Accordion title="Locks: Create: Allows locking part of a vault balance">
    API permission: `Vaults:Locks:Create`

    * Create vault lock (<small><Post>/vaults/\{vaultId}/locks</Post></small> – [doc](/api-reference/vaults/create-vault-lock))
    * Replace vault lock (<small><Post>/vaults/\{vaultId}/locks/\{lockId}/replace</Post></small> – [doc](/api-reference/vaults/replace-vault-lock))
  </Accordion>

  <Accordion title="Locks: Release: Allows releasing vault balance locks (creator only)">
    API permission: `Vaults:Locks:Release`

    * Release vault lock (<small><Post>/vaults/\{vaultId}/locks/\{lockId}/release</Post></small> – [doc](/api-reference/vaults/release-vault-lock))
    * Replace vault lock (<small><Post>/vaults/\{vaultId}/locks/\{lockId}/replace</Post></small> – [doc](/api-reference/vaults/replace-vault-lock))
  </Accordion>

  <Accordion title="Locks: Transfer">
    API permission: `Vaults:Locks:Transfer`

    * Transfer vault lock (<small><Post>/vaults/\{vaultId}/locks/\{lockId}/transfer</Post></small> – [doc](/api-reference/vaults/transfer-vault-lock))
  </Accordion>

  <Accordion title="Quarantines: Release: Allows accepting quarantined vault deposits">
    API permission: `Vaults:Quarantines:Release`

    * Release quarantine (<small><Post>/vaults/\{vaultId}/quarantines/\{quarantineId}/release</Post></small> – [doc](/api-reference/vaults/release-quarantine))
  </Accordion>

  <Accordion title="Read: Allows viewing vaults, their assets and balances">
    API permission: `Vaults:Read`

    * List vaults (<small><Get>/vaults</Get></small> – [doc](/api-reference/vaults/list-vaults))
    * List vault locks (<small><Get>/vaults/\{vaultId}/locks</Get></small> – [doc](/api-reference/vaults/list-vault-locks))
    * Get vault (<small><Get>/vaults/\{vaultId}</Get></small> – [doc](/api-reference/vaults/get-vault))
    * Get vault lock (<small><Get>/vaults/\{vaultId}/locks/\{lockId}</Get></small> – [doc](/api-reference/vaults/get-vault-lock))
    * Get vault quarantine (<small><Get>/vaults/\{vaultId}/quarantines/\{quarantineId}</Get></small> – [doc](/api-reference/vaults/get-vault-quarantine))
    * List vault assets (<small><Get>/vaults/\{vaultId}/assets</Get></small> – [doc](/api-reference/vaults/list-vault-assets))
    * List vault balances (<small><Get>/vaults/\{vaultId}/balances</Get></small> – [doc](/api-reference/vaults/list-vault-balances))
    * List vault quarantines (<small><Get>/vaults/\{vaultId}/quarantines</Get></small> – [doc](/api-reference/vaults/list-vault-quarantines))
  </Accordion>

  <Accordion title="Tags: Add: Allows adding tags to vaults">
    API permission: `Vaults:Tags:Add`

    * Tag vault (<small><Put>/vaults/\{vaultId}/tags</Put></small> – [doc](/api-reference/vaults/tag-vault))
  </Accordion>

  <Accordion title="Tags: Remove: Allows removing vault tags">
    API permission: `Vaults:Tags:Remove`

    * Untag vault (<small><Delete>/vaults/\{vaultId}/tags</Delete></small> – [doc](/api-reference/vaults/untag-vault))
  </Accordion>

  <Accordion title="Transfers: Create: Allows creating vault transfers">
    API permission: `Vaults:Transfers:Create`

    * Create vault transfer (<small><Post>/vaults/\{vaultId}/transfers</Post></small> – [doc](/api-reference/vaults/create-vault-transfer))
  </Accordion>

  <Accordion title="Update: Allows updating vault details">
    API permission: `Vaults:Update`

    * Update vault (<small><Put>/vaults/\{vaultId}</Put></small> – [doc](/api-reference/vaults/update-vault))
  </Accordion>
</AccordionGroup>

### Wallets

<AccordionGroup>
  <Accordion title="Create: Allows creating wallets">
    API permission: `Wallets:Create`

    * Activate wallet (<small><Post>/wallets/\{walletId}/activate</Post></small> – [doc](/api-reference/wallets/activate-wallet))
    * Create wallet (<small><Post>/wallets</Post></small> – [doc](/api-reference/wallets/create-wallet))
    * Import wallet (<small><Post>/wallets/import</Post></small> – [doc](/api-reference/wallets/import-wallet))
  </Accordion>

  <Accordion title="Offers: Read: Allows viewing settlement offers">
    API permission: `Wallets:Offers:Read`

    * Get offer (<small><Get>/wallets/\{walletId}/offers/\{offerId}</Get></small> – [doc](/api-reference/wallets/get-offer))
    * List offers (<small><Get>/wallets/\{walletId}/offers</Get></small> – [doc](/api-reference/wallets/list-offers))
  </Accordion>

  <Accordion title="Offers: Settle: Allows settling offers">
    API permission: `Wallets:Offers:Settle`

    * Accept offer (<small><Put>/wallets/\{walletId}/offers/\{offerId}/accept</Put></small> – [doc](/api-reference/wallets/accept-offer))
    * Reject offer (<small><Put>/wallets/\{walletId}/offers/\{offerId}/reject</Put></small> – [doc](/api-reference/wallets/reject-offer))
  </Accordion>

  <Accordion title="Read: Allows viewing wallet details">
    API permission: `Wallets:Read`

    * Proxy a request to the canton ledger api (<small><Post>/wallets/\{walletId}/canton/ledger-api</Post></small> – [doc](/api-reference/wallets/proxy-a-request-to-the-canton-ledger-api))
    * List wallets (<small><Get>/wallets</Get></small> – [doc](/api-reference/wallets/list-wallets))
    * Get wallet (<small><Get>/wallets/\{walletId}</Get></small> – [doc](/api-reference/wallets/get-wallet))
    * Get wallet assets (<small><Get>/wallets/\{walletId}/assets</Get></small> – [doc](/api-reference/wallets/get-wallet-assets))
    * Get wallet history (<small><Get>/wallets/\{walletId}/history</Get></small> – [doc](/api-reference/wallets/get-wallet-history))
    * Get wallet nfts (<small><Get>/wallets/\{walletId}/nfts</Get></small> – [doc](/api-reference/wallets/get-wallet-nfts))
    * List org wallet history (<small><Get>/wallets/all/history</Get></small> – [doc](/api-reference/wallets/list-org-wallet-history))
  </Accordion>

  <Accordion title="Tags: Add: Allows adding tags to wallets">
    API permission: `Wallets:Tags:Add`

    * Create wallet (<small><Post>/wallets</Post></small> – [doc](/api-reference/wallets/create-wallet)) Required if **`tags`** are specified
    * Tag wallet (<small><Put>/wallets/\{walletId}/tags</Put></small> – [doc](/api-reference/wallets/tag-wallet))
  </Accordion>

  <Accordion title="Tags: Remove: Allows removing wallet tags">
    API permission: `Wallets:Tags:Remove`

    * Untag wallet (<small><Delete>/wallets/\{walletId}/tags</Delete></small> – [doc](/api-reference/wallets/untag-wallet))
  </Accordion>

  <Accordion title="Transactions: Abort: Allows aborting a pending wallet transaction">
    API permission: `Wallets:Transactions:Abort`

    * Abort transaction (<small><Put>/wallets/\{walletId}/transactions/\{transactionId}/abort</Put></small> – [doc](/api-reference/wallets/abort-transaction))
  </Accordion>

  <Accordion title="Transactions: Create: Allows creating transactions">
    API permission: `Wallets:Transactions:Create`

    * Create allocation (<small><Post>/allocations</Post></small> – [doc](/api-reference/allocations/create-allocation)) Always required. Allocation transactions are broadcast from your wallet
    * Create allocation action (<small><Post>/allocations/\{allocationId}/actions</Post></small> – [doc](/api-reference/allocations/create-allocation-action)) Always required. Allocation transactions are broadcast from your wallet
    * Cancel an unfilled 0fns order placement (<small><Post>/allocations/cancel-0fns-order-placement</Post></small> – [doc](/api-reference/allocations/cancel-an-unfilled-0fns-order-placement)) Always required. The cancellation (cancelOrder) is broadcast from your wallet
    * Create swap (<small><Post>/swaps</Post></small> – [doc](/api-reference/swaps/create-swap)) Always required. Swap transactions are broadcast from your wallet
    * Sign and broadcast transaction (<small><Post>/wallets/\{walletId}/transactions</Post></small> – [doc](/api-reference/wallets/sign-and-broadcast-transaction))
    * Cancel transaction (<small><Post>/wallets/\{walletId}/transactions/\{transactionId}/cancel</Post></small> – [doc](/api-reference/wallets/cancel-transaction))
    * Cancel transfer (<small><Post>/wallets/\{walletId}/transfers/\{transferId}/cancel</Post></small> – [doc](/api-reference/wallets/cancel-transfer))
    * Speed up transaction (<small><Post>/wallets/\{walletId}/transactions/\{transactionId}/speed-up</Post></small> – [doc](/api-reference/wallets/speed-up-transaction))
    * Speed up transfer (<small><Post>/wallets/\{walletId}/transfers/\{transferId}/speed-up</Post></small> – [doc](/api-reference/wallets/speed-up-transfer))
  </Accordion>

  <Accordion title="Transactions: Read: Allows viewing wallet transactions">
    API permission: `Wallets:Transactions:Read`

    * List transactions (<small><Get>/wallets/\{walletId}/transactions</Get></small> – [doc](/api-reference/wallets/list-transactions))
    * Cancel transaction (<small><Post>/wallets/\{walletId}/transactions/\{transactionId}/cancel</Post></small> – [doc](/api-reference/wallets/cancel-transaction))
    * Speed up transaction (<small><Post>/wallets/\{walletId}/transactions/\{transactionId}/speed-up</Post></small> – [doc](/api-reference/wallets/speed-up-transaction))
    * Get transaction (<small><Get>/wallets/\{walletId}/transactions/\{transactionId}</Get></small> – [doc](/api-reference/wallets/get-transaction))
  </Accordion>

  <Accordion title="Transfers: Abort: Allows aborting a pending wallet transfer">
    API permission: `Wallets:Transfers:Abort`

    * Abort transfer (<small><Put>/wallets/\{walletId}/transfers/\{transferId}/abort</Put></small> – [doc](/api-reference/wallets/abort-transfer))
  </Accordion>

  <Accordion title="Transfers: Create: Allows creating wallet transfers">
    API permission: `Wallets:Transfers:Create`

    * Create exchange deposit (<small><Post>/exchanges/\{exchangeId}/accounts/\{accountId}/deposits</Post></small> – [doc](/api-reference/exchanges/create-exchange-deposit))
    * Transfer asset (<small><Post>/wallets/\{walletId}/transfers</Post></small> – [doc](/api-reference/wallets/transfer-asset))
  </Accordion>

  <Accordion title="Transfers: Read: Allows viewing wallet transfers">
    API permission: `Wallets:Transfers:Read`

    * Cancel transfer (<small><Post>/wallets/\{walletId}/transfers/\{transferId}/cancel</Post></small> – [doc](/api-reference/wallets/cancel-transfer))
    * Speed up transfer (<small><Post>/wallets/\{walletId}/transfers/\{transferId}/speed-up</Post></small> – [doc](/api-reference/wallets/speed-up-transfer))
    * Get transfer (<small><Get>/wallets/\{walletId}/transfers/\{transferId}</Get></small> – [doc](/api-reference/wallets/get-transfer))
    * List transfers (<small><Get>/wallets/\{walletId}/transfers</Get></small> – [doc](/api-reference/wallets/list-transfers))
  </Accordion>

  <Accordion title="Update: Allows updating wallet configuration">
    API permission: `Wallets:Update`

    * Update wallet (<small><Put>/wallets/\{walletId}</Put></small> – [doc](/api-reference/wallets/update-wallet))
  </Accordion>
</AccordionGroup>

### Webhooks

<AccordionGroup>
  <Accordion title="Create: Allows creating webhooks">
    API permission: `Webhooks:Create`

    * Create webhook (<small><Post>/webhooks</Post></small> – [doc](/api-reference/webhooks/create-webhook))
  </Accordion>

  <Accordion title="Delete: Allows deleting webhooks">
    API permission: `Webhooks:Delete`

    * Delete webhook (<small><Delete>/webhooks/\{webhookId}</Delete></small> – [doc](/api-reference/webhooks/delete-webhook))
  </Accordion>

  <Accordion title="Events: Read: Allows viewing webhook event history">
    API permission: `Webhooks:Events:Read`

    * Get webhook event (<small><Get>/webhooks/\{webhookId}/events/\{webhookEventId}</Get></small> – [doc](/api-reference/webhooks/get-webhook-event))
    * List webhook events (<small><Get>/webhooks/\{webhookId}/events</Get></small> – [doc](/api-reference/webhooks/list-webhook-events))
  </Accordion>

  <Accordion title="Ping: Allows testing webhook endpoints">
    API permission: `Webhooks:Ping`

    * Ping webhook (<small><Post>/webhooks/\{webhookId}/ping</Post></small> – [doc](/api-reference/webhooks/ping-webhook))
  </Accordion>

  <Accordion title="Read: Allows viewing webhooks">
    API permission: `Webhooks:Read`

    * List webhooks (<small><Get>/webhooks</Get></small> – [doc](/api-reference/webhooks/list-webhooks))
    * Get webhook (<small><Get>/webhooks/\{webhookId}</Get></small> – [doc](/api-reference/webhooks/get-webhook))
  </Accordion>

  <Accordion title="Update: Allows updating webhook configuration">
    API permission: `Webhooks:Update`

    * Update webhook (<small><Put>/webhooks/\{webhookId}</Put></small> – [doc](/api-reference/webhooks/update-webhook))
  </Accordion>
</AccordionGroup>


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.