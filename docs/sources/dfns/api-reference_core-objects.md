> ## Documentation Index
> Fetch the complete documentation index at: https://docs.dfns.co/llms.txt
> Use this file to discover all available pages before exploring further.

# Core API Objects

> Reference for the core DFNS entities you interact with through the API: wallets, keys, transfers, transactions, signatures, users, and policies.

## Organizations

An Organization (or Org for short) is the master workspace under which all other objects reside. Currently only DFNS staff can create orgs, but soon users will be able to generate them in a self service flow from our marketing website to initiate trials. An org is a fully isolated instance. The only entity which can span orgs is Users.

## Users

Users are people who use the DFNS platform. Users generally leverage passkeys via WebAuthn to sign API requests. Users can be either `Employees` or `EndUsers`. Users can span between many orgs and must be assigned Permissions to execute operations. See [here](/api-reference/auth/users) for more information on Users.

## Service Accounts

Service Accounts are machine users. They are instantiated with a public key which is used to verify signatures created with a secret known only to the Service Account. Like Users, Service Accounts must be assigned Permissions. See [here](/api-reference/auth/service-accounts) for more information on Service Accounts.

## Credentials

Users can have many credentials which authenticate them to the platform. There are two types of credentials: standard credentials for signing API requests on an ongoing basis, and recovery credentials used one time to recover account access. Both credential types use asymmetric key pairs to sign challenges sent from the authentication service to verify user identity. See [here](/api-reference/auth/credentials) for more information on Credentials.

## Permissions & Permission Assignments

Permissions are collections of API operations which constitute user roles in the system. Permissions must be assigned to specific users in order to grant them access to platform functionality. Required permissions for any given API endpoint are found at the top of the API reference page. See [here](/core-concepts/roles-and-permissions) for more information on Permissions.

## Wallets

Wallets are the core entity used to execute MPC/TSS and interact with blockchains on the DFNS platform. Creating wallets executes distributed key generation, storing key shares in a distributed network. Transactions are initiated from wallets and blockchain events are indexed into wallet history. See [here](/core-concepts/vaults-wallets-and-keys) for more information on Wallets.

## Policies & Approvals

Policies are the core entity used to configure the DFNS policy engine. Policies contain a target transaction type, rule set, action, and filters. Policies can be used to trigger approvals requiring multiple signatures to execute a transaction. These are represented as approval entities. See [here](/core-concepts/policies) for more information on Policies.

## Webhooks & Events

Webhooks enable programmatic callbacks in response to events which take place within the DFNS platform or on chain. When you subscribe to webhook events, you receive Event entities with detailed information on the events that occurred in order to trigger programmatic actions in response. See [here](/guides/developers/webhooks) for more information on Webhooks.


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.