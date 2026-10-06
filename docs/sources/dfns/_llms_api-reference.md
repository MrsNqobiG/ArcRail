# DFNS documentation: API reference

> DFNS documentation

## API reference

- [API Reference](https://docs.dfns.co/api-reference/index.md): Complete API reference for DFNS, including authentication, wallets, keys, transfers, policies, webhooks, and per-network signing endpoints.
- [Regions](https://docs.dfns.co/api-reference/regions.md): Cloud platform regions where DFNS hosts API endpoints and signer infrastructure, including how to choose a region for compliance and latency.
- [Core API Objects](https://docs.dfns.co/api-reference/core-objects.md): Reference for the core DFNS entities you interact with through the API: wallets, keys, transfers, transactions, signatures, users, and policies.
- [API Errors](https://docs.dfns.co/api-reference/error-codes.md): Reference for HTTP status codes and error responses returned by the DFNS API, including authentication, validation, and policy approval errors.
- [Idempotency](https://docs.dfns.co/api-reference/idempotency.md): Use the externalId field to prevent duplicate transactions, safely retry requests, and track DFNS API calls across signing and transfer endpoints.
- [Pagination](https://docs.dfns.co/api-reference/pagination.md): List endpoints in the DFNS API use cursor-based pagination via limit and paginationToken query parameters.
- [Rate Limits](https://docs.dfns.co/api-reference/rate-limits.md): How DFNS rate limits the API: what the limit is measured against, the response headers that report your usage, and where to find the request-per-minute quota for your plan.
- [OpenAPI & Postman](https://docs.dfns.co/api-reference/openapi-postman.md): Download the standardized OpenAPI specification and ready-to-use Postman collection for the DFNS API to scaffold integrations and testing.

### API Authorization

- [Required headers](https://docs.dfns.co/api-reference/auth/index.md): Headers required when calling the DFNS API, including the authentication token (`Authorization: Bearer`) and how to obtain one for users and service accounts.

#### Authentication

- [Authentication flows](https://docs.dfns.co/api-reference/auth/login-flows.md): Authentication flows DFNS supports for connecting users and machines, including standard login, social login, delegated login, and read-only access.
- [Send Login Code](https://docs.dfns.co/api-reference/auth/send-login-code.md): Sends a temporary one time code to the user that can be used during login flow.
- [Create Login Challenge](https://docs.dfns.co/api-reference/auth/create-login-challenge.md): Start a user login session, returning a challenge that will be used to verify the user's identity.
- [Complete User Login](https://docs.dfns.co/api-reference/auth/complete-user-login.md): Completes the login process and provides the authenticated user with their authentication token.
- [Initiate SSO Login](https://docs.dfns.co/api-reference/auth/initiate-sso-login.md): Initialize the login process with SSO by returning the IdP URL to call.
- [Complete SSO Login](https://docs.dfns.co/api-reference/auth/complete-sso-login.md): Completes the SSO login process by exchanging the authorization code obtained from the identity provider for the user's authentication token.
- [Initiate OIDC Login](https://docs.dfns.co/api-reference/auth/initiate-oidc-login.md): Initialize the OIDC login process by returning the identity provider authorization URL to redirect the user to.
- [Complete OIDC Login](https://docs.dfns.co/api-reference/auth/complete-oidc-login.md): Completes the OIDC login process by exchanging the authorization code obtained from the identity provider. If the verified user has no active first-factor credential yet, it returns a registration challenge to complete via [Complete User Registration](/api-reference/auth/complete-user-registration);…
- [Social Login](https://docs.dfns.co/api-reference/auth/social-login.md): Logs a user in with a JWT id token issued by a social login provider and provides the authenticated user with their authentication token.
- [Delegated Login](https://docs.dfns.co/api-reference/auth/delegated-login.md): <Warning> Only a [Service Account](https://docs.dfns.co/api-reference/auth/service-accounts) can use this endpoint. </Warning>
- [Logout](https://docs.dfns.co/api-reference/auth/logout.md): Completes the user logout process.

#### User Action Signature

- [User Action Signing flows](https://docs.dfns.co/api-reference/auth/signing-flows.md): All DFNS API calls that change state must be signed by a user or service account, ensuring authorization and creating an auditable trail of every action.
- [Create User Action Challenge](https://docs.dfns.co/api-reference/auth/create-user-action-challenge.md): Starts a user action signing session, returning a challenge that will be used to verify the user's intent to perform an action.      This is the first step of the [User Action Signing flow](https://docs.dfns.co/api-reference/auth/signing-flows).
- [Create User Action Signature](https://docs.dfns.co/api-reference/auth/create-user-action-signature.md): Completes the user action signing process and provides a signing token that can be used to verify the user intended to perform the action.
- [List Audit Logs](https://docs.dfns.co/api-reference/auth/list-audit-logs.md): Gets all signature events which have occurred in the over the timeframe. The time range is unbounded, but the export is capped at 100,000 rows. When the result is truncated, the `X-Dfns-Result-Truncated: true` response header is set and a trailing `# TRUNCATED ...` line is appended to the CSV; narro…
- [Get Audit Log](https://docs.dfns.co/api-reference/auth/get-audit-log.md): Gets detailed information for a particular audit log. Specifically, the API returns the action performed, as well as the `firstFactorCredential` in which you will find the signature information required to validate it.

### Identity & Access Management

#### Registration

- [Registration flows](https://docs.dfns.co/api-reference/auth/registration-flows.md): How DFNS handles user, employee, and end-user registration, including standard registration, delegated registration, and social signup flows.
- [Create Registration Challenge](https://docs.dfns.co/api-reference/auth/create-registration-challenge.md): Starts a user registration session. It returns a challenge that will need to be signed by a passkey and used to perform the step [Complete User Registration](/api-reference/auth/complete-user-registration)
- [Create Delegated Registration Challenge](https://docs.dfns.co/api-reference/auth/create-delegated-registration-challenge.md): <Warning> Only a [Service Account](https://docs.dfns.co/api-reference/auth/service-accounts) can use this endpoint. </Warning>
- [Create Social Registration Challenge](https://docs.dfns.co/api-reference/auth/create-social-registration-challenge.md): Starts an end-user registration session by passing a JWT obtained by an IdP. It returns a challenge that will need to be signed by a passkey and used to perform [Complete End User Registration with Wallets](/api-reference/auth/complete-end-user-registration-with-wallets).
- [Complete User Registration](https://docs.dfns.co/api-reference/auth/complete-user-registration.md): Completes the user registration process and creates the user's initial credentials.
- [Complete End User Registration with Wallets](https://docs.dfns.co/api-reference/auth/complete-end-user-registration-with-wallets.md): Completes the end user registration process and creates the user's initial credentials along with delegated wallets for the new end user.
- [Resend Registration Code](https://docs.dfns.co/api-reference/auth/resend-registration-code.md): Sends the user a new registration code. The previous registration code will be marked invalid. If the user has already completed their registration no action will be taken.

#### Users management

- [Users](https://docs.dfns.co/api-reference/auth/users.md): API endpoints to create, list, activate, deactivate, and manage end users and employee users within your DFNS organization, including roles.
- [List Users](https://docs.dfns.co/api-reference/auth/list-users.md): List all Users in your organization.
- [Create User](https://docs.dfns.co/api-reference/auth/create-user.md): Invite a new user in the caller's org. This will create the user and send a registration email to the created User's email, with a registration code, and pointing him to complete his registration on Dfns Dashboard. The user is created without any permissions.      <Note>If you want the created User…
- [Get User](https://docs.dfns.co/api-reference/auth/get-user.md): Retrieve information about a specific User.
- [Update User](https://docs.dfns.co/api-reference/auth/update-user.md): Update a specific User.
- [Activate User](https://docs.dfns.co/api-reference/auth/activate-user.md): Activate a specific User.
- [Deactivate User](https://docs.dfns.co/api-reference/auth/deactivate-user.md): Deactivate a specific User.
- [Delete User](https://docs.dfns.co/api-reference/auth/delete-user.md): Delete a specific User.

#### Permissions

- [List Permissions](https://docs.dfns.co/api-reference/permissions/list-permissions.md): Lists all permissions (roles) in the organization.
- [Create Permission](https://docs.dfns.co/api-reference/permissions/create-permission.md): Creates a new permission (also referred to as "role" in the dashboard) that grants access to the specified API operations.
- [Get Permission](https://docs.dfns.co/api-reference/permissions/get-permission.md): Retrieves a permission (role) by ID, including any pending change request.
- [Update Permission](https://docs.dfns.co/api-reference/permissions/update-permission.md): Updates the name or operations of an existing permission (role).
- [Archive Permission](https://docs.dfns.co/api-reference/permissions/archive-permission.md): Archives or unarchives a permission (role). Archived permissions are effectively soft-deleted.
- [List Permission Assignments](https://docs.dfns.co/api-reference/permissions/list-permission-assignments.md): Lists all permission (role) assignments for a given permission.
- [Assign Permission](https://docs.dfns.co/api-reference/permissions/assign-permission.md): Assigns a permission (role) to an identity (user, PAT or service account), granting it access to the operations defined in the permission. Returns the assignment on success (200), or a pending change request if approval is required (202).
- [Revoke Permission](https://docs.dfns.co/api-reference/permissions/revoke-permission.md): Revokes a permission (role) assignment, removing the identity's access to the operations granted by the permission.

#### Credentials

- [Credentials](https://docs.dfns.co/api-reference/auth/credentials.md): API endpoints to create, list, activate, deactivate, and manage user credentials such as passkeys, signing keys, and recovery credentials.
- [Credentials API data](https://docs.dfns.co/api-reference/auth/credentials-data.md): Reference for the credential data structures returned by DFNS auth endpoints, including passkey, key, password, and recovery credential types.
- [List Credentials](https://docs.dfns.co/api-reference/auth/list-credentials.md): List all credentials for a user.
- [Create Credential Challenge](https://docs.dfns.co/api-reference/auth/create-credential-challenge.md): Part of the flow [Create Credential Regular flow](https://docs.dfns.co/api-reference/auth/credentials#regular-flow).      Starts a create user credential session, returning a challenge that will be used to verify the user's identity.
- [Create Credential](https://docs.dfns.co/api-reference/auth/create-credential.md): Part of the flow [Create Credential Regular flow](https://docs.dfns.co/api-reference/auth/credentials#regular-flow).
- [Create Credential Challenge With Code](https://docs.dfns.co/api-reference/auth/create-credential-challenge-with-code.md): Part of the flow [Create Credential With Code](https://docs.dfns.co/api-reference/auth/credentials#create-credential-with-code-flow).
- [Create Credential With Code](https://docs.dfns.co/api-reference/auth/create-credential-with-code.md): Finalizes the flow [Create Credential With Code](https://docs.dfns.co/api-reference/auth/credentials#create-credential-with-code-flow).    Adds a new credential to a user's account. This endpoint is similar to the [Create Credential](https://docs.dfns.co/api-reference/auth/create-credential) endpoin…
- [Activate Credential](https://docs.dfns.co/api-reference/auth/activate-credential.md): Activates a credential that was previously deactivated. If the credential is already activated no action is taken.
- [Deactivate Credential](https://docs.dfns.co/api-reference/auth/deactivate-credential.md): Deactivates a credential that was previously active. If the credential is already deactivated no action is taken.
- [Delete Credential](https://docs.dfns.co/api-reference/auth/delete-credential.md): Delete a specific credential.
- [Create Credential Code](https://docs.dfns.co/api-reference/auth/create-credential-code.md): Part of the [Create Credential With Code flow](https://docs.dfns.co/api-reference/auth/credentials#create-credential-with-code-flow).

#### Personal Access Tokens

- [Personal Access Tokens (PAT)](https://docs.dfns.co/api-reference/auth/personal-access-tokens.md): API endpoints to create, list, activate, and revoke personal access tokens (PATs) used to authenticate API requests on behalf of a user.
- [List Personal Access Tokens](https://docs.dfns.co/api-reference/auth/list-personal-access-tokens.md): Retrieve the list of your Personal Access Tokens.
- [Create Personal Access Token](https://docs.dfns.co/api-reference/auth/create-personal-access-token.md): Create a new Personal Access Token for the caller.
- [Get Personal Access Token](https://docs.dfns.co/api-reference/auth/get-personal-access-token.md): Retrieve a specific Personal Access Token.
- [Update Personal Access Token](https://docs.dfns.co/api-reference/auth/update-personal-access-token.md): Update a specific Personal Access Token.
- [Activate Personal Access Token](https://docs.dfns.co/api-reference/auth/activate-personal-access-token.md): Activate a specific Personal Access Token.
- [Deactivate Personal Access Token](https://docs.dfns.co/api-reference/auth/deactivate-personal-access-token.md): Deactivates a personal access token that was previously active. If the token is already deactivated no action is taken.
- [Delete Personal Access Token](https://docs.dfns.co/api-reference/auth/delete-personal-access-token.md): Delete a specific Personal Access Token.

#### Account recovery

- [Account recovery](https://docs.dfns.co/api-reference/auth/account-recovery.md): API endpoints to recover access to a DFNS user account when a passkey or device is lost, using recovery codes and verification flows.
- [Send Recovery Code Email](https://docs.dfns.co/api-reference/auth/send-recovery-code-email.md): Send the user a recovery verification code. This code is used as a second factor to verify the user initiated the recovery request.
- [Create Recovery Challenge](https://docs.dfns.co/api-reference/auth/create-recovery-challenge.md): Starts a user recovery session, returning a challenge that will be used to verify the user's identity.
- [Create Delegated Recovery Challenge](https://docs.dfns.co/api-reference/auth/create-delegated-recovery-challenge.md): <Warning> Only a [Service Account](https://docs.dfns.co/api-reference/auth/service-accounts) can use this endpoint. </Warning>
- [Recover User](https://docs.dfns.co/api-reference/auth/recover-user.md): Recovers a user, using a recovery credential. After successfully recovering the user, all of the user's previous credentials and personal access tokens will be invalidated.

#### Service Accounts

- [Service Accounts](https://docs.dfns.co/api-reference/auth/service-accounts.md): API endpoints to create, list, activate, and manage service accounts used for server-to-server API access with scoped permissions.
- [List Service Accounts](https://docs.dfns.co/api-reference/auth/list-service-accounts.md): List all Service Accounts in your organization.
- [Create Service Account](https://docs.dfns.co/api-reference/auth/create-service-account.md): Create a new Service Account for your organization.
- [Get Service Account](https://docs.dfns.co/api-reference/auth/get-service-account.md): Get information about a specific Service Account.
- [Update Service Account](https://docs.dfns.co/api-reference/auth/update-service-account.md): Update a specific Service Account.
- [Activate Service Account](https://docs.dfns.co/api-reference/auth/activate-service-account.md): Activate a specific Service Account.
- [Deactivate Service Account](https://docs.dfns.co/api-reference/auth/deactivate-service-account.md): Deactivate a specific Service Account.
- [Delete Service Account](https://docs.dfns.co/api-reference/auth/delete-service-account.md): Delete a specific Service Account.

### Wallets & Transactions

#### Wallets

- [Wallets](https://docs.dfns.co/api-reference/wallets/index.md): API endpoints to create, list, update, archive, and manage MPC wallets, including imports, exports, balances, history, and tagging.
- [Create Wallet](https://docs.dfns.co/api-reference/wallets/create-wallet.md): Creates a new Wallet associated with the given chain (such as Bitcoin or Ethereum ). Returns a new wallet entity.
- [List Wallets](https://docs.dfns.co/api-reference/wallets/list-wallets.md): Retrieves the list of Wallets in your organization. You can filter the results by owner (either by owner id or owner username). The list cannot be filtered by tags or externalId — those are set at wallet creation only; to segment wallets by tag or externalId, list them and filter client-side, or mai…
- [Get Wallet](https://docs.dfns.co/api-reference/wallets/get-wallet.md): Retrieves a Wallet information by its ID.
- [Update Wallet](https://docs.dfns.co/api-reference/wallets/update-wallet.md): Updates the name of an existing wallet.
- [Activate Wallet](https://docs.dfns.co/api-reference/wallets/activate-wallet.md): Activates a wallet by deploying the account contract on-chain, making it ready for transactions.
- [Get Wallet Assets](https://docs.dfns.co/api-reference/wallets/get-wallet-assets.md): Retrieves a list of assets owned by the specified wallet.  Return values vary by chain as shown below. Each asset includes its current USD market price (`quotes`); pass `netWorth=true` to also return the wallet's total USD value (net worth).
- [Get Wallet History](https://docs.dfns.co/api-reference/wallets/get-wallet-history.md): Retrieves a list of historical on chain activities for the specified wallet.
- [Get Wallet Nfts](https://docs.dfns.co/api-reference/wallets/get-wallet-nfts.md): Retrieves a list of NFTs owned by the specified Wallet.
- [List Org Wallet History](https://docs.dfns.co/api-reference/wallets/list-org-wallet-history.md): Retrieve the transaction history across all wallets within a specified timeframe. The time range is unbounded, but the CSV export is capped at 100,000 rows.
- [Import Wallet](https://docs.dfns.co/api-reference/wallets/import-wallet.md): <Warning> This endpoint is not enabled by default. [Contact Dfns](https://support.dfns.co) to have it activated. </Warning>

##### Watched Addresses

- [Create Address Watch](https://docs.dfns.co/api-reference/address-watches/create-address-watch.md): Registers an on chain address to watch. An address watch is not controlled by Dfns: it holds no key, it cannot sign or move funds. The indexer matches on chain activity touching the address and sends the corresponding webhooks.
- [List Address Watches](https://docs.dfns.co/api-reference/address-watches/list-address-watches.md): Retrieves the list of address watches in your organization. Pagination is supported via limit and paginationToken parameters.
- [Get Address Watch](https://docs.dfns.co/api-reference/address-watches/get-address-watch.md): Retrieves an address watch by its ID.
- [Get Address Watch Assets](https://docs.dfns.co/api-reference/address-watches/get-address-watch-assets.md): Retrieves the list of assets held by the address watch, as tracked by the indexer. Balances are tracked from the moment the watch is created.
- [Get Address Watch Blockchain Events](https://docs.dfns.co/api-reference/address-watches/get-address-watch-blockchain-events.md): Retrieves a list of decoded blockchain events indexed for the specified address watch.
- [Get Address Watch History](https://docs.dfns.co/api-reference/address-watches/get-address-watch-history.md): Retrieves the list of indexed on chain activities for the specified address watch.
- [Delete Address Watch](https://docs.dfns.co/api-reference/address-watches/delete-address-watch.md): Deletes an address watch. Once deleted, the address is not watched anymore, no webhook is sent for it, and it won't count in your overall organisation wallet count. Watching the same address again on the same network re-activates this watch, with the same ID and the same history.
- [Address watch blockchain event transfer confirmed](https://docs.dfns.co/api-reference/wallets/address-watch-blockchain-event-transfer-confirmed.md): A transfer touching a watched address has been confirmed on chain (e.g.: a deposit).

##### Webhooks

- [Wallet activated](https://docs.dfns.co/api-reference/wallets/wallet-activated.md): A wallet has been [activated](https://docs.dfns.co/api-reference/wallets/activate-wallet) (for example, a Canton wallet).
- [Wallet created](https://docs.dfns.co/api-reference/wallets/wallet-created.md): A new wallet has been [created](https://docs.dfns.co/api-reference/wallets/create-wallet).
- [Wallet delegated](https://docs.dfns.co/api-reference/wallets/wallet-delegated.md): A wallet has been [delegated](https://docs.dfns.co/api-reference/wallets/delegate-wallet) to an end user.
- [Wallet exported](https://docs.dfns.co/api-reference/wallets/wallet-exported.md): A wallet has been exported (deprecated).
- [Blockchain event transfer included](https://docs.dfns.co/api-reference/wallets/blockchain-event-transfer-included.md): A transfer to a wallet has been included in a block but is not yet confirmed on chain. Available only for selected networks ([see list](https://docs.dfns.co/networks)).
- [Blockchain event detected](https://docs.dfns.co/api-reference/wallets/blockchain-event-detected.md): A wallet event has been confirmed on chain (e.g.: a deposit). The `blockchainEvent.kind` field identifies the type of asset transfer and varies by network and asset (for example `NativeTransfer`, `Erc20Transfer`, `UtxoTransfer`, `SplTransfer`, `Trc20Transfer`); see the full list of event kinds per c…

##### Wallet Tags

- [Tags](https://docs.dfns.co/api-reference/wallets/tags.md): API endpoints to add, list, and remove tags on DFNS wallets for organizing custody by team, customer, environment, or business unit.
- [Tag Wallet](https://docs.dfns.co/api-reference/wallets/tag-wallet.md): Add a [Tag](https://docs.dfns.co/api-reference/wallets/tags) to a wallet.
- [Untag Wallet](https://docs.dfns.co/api-reference/wallets/untag-wallet.md): Removes the specified tags from a wallet.
- [Wallet tags modified](https://docs.dfns.co/api-reference/wallets/wallet-tags-modified.md): The tags of a wallet have been modified.

##### Canton Wallets

- [List Offers](https://docs.dfns.co/api-reference/wallets/list-offers.md): List all offers received on a specific wallet.
- [Get Offer](https://docs.dfns.co/api-reference/wallets/get-offer.md): Retrieve information about a specific offer received on your wallet.
- [Accept Offer](https://docs.dfns.co/api-reference/wallets/accept-offer.md): Accept an offer received on your wallet.
- [Reject Offer](https://docs.dfns.co/api-reference/wallets/reject-offer.md): Reject an offer received on your wallet.
- [Proxy a request to the Canton Ledger API](https://docs.dfns.co/api-reference/wallets/proxy-a-request-to-the-canton-ledger-api.md): Proxies a request to the Canton Ledger API associated with this wallet, using the validator's OAuth2 credentials. Restricted to a curated allow-list of read-style resources. Used to satisfy the Canton WalletConnect `canton_ledgerApi` method.

###### Webhooks

- [Offer accepted](https://docs.dfns.co/api-reference/wallets/offer-accepted.md): A transfer [offer](https://docs.dfns.co/api-reference/wallets/accept-offer) has been accepted and the settlement confirmed on chain.
- [Offer received](https://docs.dfns.co/api-reference/wallets/offer-received.md): A new transfer [offer](https://docs.dfns.co/api-reference/wallets/list-offers) has been made to a wallet.
- [Offer rejected](https://docs.dfns.co/api-reference/wallets/offer-rejected.md): A transfer [offer](https://docs.dfns.co/api-reference/wallets/reject-offer) has been rejected and the settlement confirmed on chain.
- [Offer withdrawn](https://docs.dfns.co/api-reference/wallets/offer-withdrawn.md): A transfer offer has been withdrawn by the sender.

#### Vaults

- [Vaults](https://docs.dfns.co/api-reference/vaults/index.md): API endpoints to create, list, update, and manage vaults: multichain balance sheets with quarantine, segregated balances, and an immutable audit ledger.
- [Create Vault](https://docs.dfns.co/api-reference/vaults/create-vault.md): Creates a new Vault.
- [List Vaults](https://docs.dfns.co/api-reference/vaults/list-vaults.md): Retrieves the list of Vaults in your organization.
- [Get Vault](https://docs.dfns.co/api-reference/vaults/get-vault.md): Retrieves a Vault by its ID.
- [Update Vault](https://docs.dfns.co/api-reference/vaults/update-vault.md): Updates an existing Vault.
- [Create Vault Address](https://docs.dfns.co/api-reference/vaults/create-vault-address.md): Creates a vault address (managed wallet) on a network that supports vaults — EVM networks, Bitcoin, and Solana (native SOL and SPL/Token-2022 tokens). Add one network per call.
- [Create Vault Transfer](https://docs.dfns.co/api-reference/vaults/create-vault-transfer.md): Creates a transfer out of a vault, reserving the amount and estimated fee from the vault's available balance.
- [List Vault Assets](https://docs.dfns.co/api-reference/vaults/list-vault-assets.md): Lists a vault's assets with balances (available/quarantined/locked) and USD valuation.
- [List Vault Balances](https://docs.dfns.co/api-reference/vaults/list-vault-balances.md): Lists a vault's balance entries.
- [List Vault Quarantines](https://docs.dfns.co/api-reference/vaults/list-vault-quarantines.md): Lists a vault's quarantines, active and released.
- [Get Vault Quarantine](https://docs.dfns.co/api-reference/vaults/get-vault-quarantine.md): Retrieves a vault quarantine by its ID.
- [Release Quarantine](https://docs.dfns.co/api-reference/vaults/release-quarantine.md): Releases quarantined funds into the available balance.
- [Create Vault Lock](https://docs.dfns.co/api-reference/vaults/create-vault-lock.md): Requests locking funds from the vault's available balance for off-chain settlement or escrow. Returns the created lock (200), or the pending lock request (202) when a policy requires approval.
- [List Vault Locks](https://docs.dfns.co/api-reference/vaults/list-vault-locks.md): Lists a vault's locks, active and released.
- [Get Vault Lock](https://docs.dfns.co/api-reference/vaults/get-vault-lock.md): Retrieves a vault lock by its ID.
- [Release Vault Lock](https://docs.dfns.co/api-reference/vaults/release-vault-lock.md): Releases a lock, returning the locked funds to the vault's available balance. Owner only.
- [Replace Vault Lock](https://docs.dfns.co/api-reference/vaults/replace-vault-lock.md): Requests replacing a lock with a new lock at a new total amount. Owner only. Executed immediately unless a policy requires approval. On execution the lock is released, a new lock is created at the new amount (carrying over the owner, externalId and reason), and the new lock is returned. If a policy…
- [Transfer Vault Lock](https://docs.dfns.co/api-reference/vaults/transfer-vault-lock.md): Sends part or all of the locked amount to the lock's beneficiary, paying the network fee from the vault's available balance. Owner only, not subject to policies. Returns the outgoing transfer. The funds stay locked while it is in flight; once confirmed the lock is deleted and any unsent remainder re…

##### Webhooks

- [Vault created](https://docs.dfns.co/api-reference/vaults/vault-created.md): A vault has been created
- [Vault updated](https://docs.dfns.co/api-reference/vaults/vault-updated.md): A vault has been updated
- [Vault event created](https://docs.dfns.co/api-reference/vaults/vault-event-created.md): An entry has been appended to the vault balance ledger: an incoming transfer was detected, quarantined funds were released, or an outgoing transfer was initiated, confirmed, aborted, rejected or failed (see the `kind` field of the vault event)

##### Vault Tags

- [Tags](https://docs.dfns.co/api-reference/vaults/tags.md): API endpoints to add, list, and remove tags on DFNS vaults for organizing custody by team, customer, environment, or business unit.
- [Tag Vault](https://docs.dfns.co/api-reference/vaults/tag-vault.md): Add tags to a vault.
- [Untag Vault](https://docs.dfns.co/api-reference/vaults/untag-vault.md): Removes the specified tags from a vault.
- [Vault tags modified](https://docs.dfns.co/api-reference/vaults/vault-tags-modified.md): Tags have been added to or removed from a vault

#### Keys

- [Keys](https://docs.dfns.co/api-reference/keys.md): Technical overview of the DFNS Key object, used to derive wallets across networks and to sign raw payloads for advanced custody workflows.
- [List Keys](https://docs.dfns.co/api-reference/keys/list-keys.md): Retrieve all keys registered for your organization.
- [Create Key](https://docs.dfns.co/api-reference/keys/create-key.md): Creates a key for the given scheme and curve. Returns the new key entity.
- [Delegate Key](https://docs.dfns.co/api-reference/keys/delegate-key.md): <Warning> Only keys created with "`delayDelegation: true`" can then be delegated to an end-user. It means you need to know ahead of time that you're creating a wallet meant to be delegated to an end-user later. This is a safety to prevent, for example, a treasury wallet from being unintentionally de…
- [Get Key](https://docs.dfns.co/api-reference/keys/get-key.md): Retrieves a key information by its ID.
- [Update Key](https://docs.dfns.co/api-reference/keys/update-key.md): Updates the name of an existing key.
- [Delete Key](https://docs.dfns.co/api-reference/keys/delete-key.md): Deletes the key and all wallets using this key. Once deleted, keys (and wallets) are not usable anymore, and won't count in your overall organisation wallet count.
- [Derive Key](https://docs.dfns.co/api-reference/keys/derive-key.md): Dfns decentralized key management network supports threshold Diffie-Hellman protocol based on [GLOW20 paper](https://eprint.iacr.org/2020/096). You can use the DH protocol to derive output from a domain separation tag and a seed value. The derivation process is deterministic, i.e. the same Diffie-He…
- [Export Key](https://docs.dfns.co/api-reference/keys/export-key.md): Dfns secures private keys by generating them as MPC key shares in our decentralized key management network.  Our goal is to eliminate all single points of failure (SPOFs) associated with blockchain private keys.
- [Import Key](https://docs.dfns.co/api-reference/keys/import-key.md): Dfns secures private keys by generating them as MPC key shares in our decentralized key management network.  This happens by default when you create a [key](https://docs.dfns.co/api-reference/keys/create-key) or [wallet](https://docs.dfns.co/api-reference/wallets/create-wallet).

##### Webhooks

- [Key created](https://docs.dfns.co/api-reference/keys/key-created.md): A key has been [created](https://docs.dfns.co/api-reference/keys/create-key).
- [Key delegated](https://docs.dfns.co/api-reference/keys/key-delegated.md): A key has been [delegated](https://docs.dfns.co/api-reference/keys/delegate-key) to an end user.
- [Key deleted](https://docs.dfns.co/api-reference/keys/key-deleted.md): A key has been [deleted](https://docs.dfns.co/api-reference/keys/delete-key).
- [Key exported](https://docs.dfns.co/api-reference/keys/key-exported.md): A key has been [exported](https://docs.dfns.co/api-reference/keys/export-key).

#### Transfer

- [Transfer](https://docs.dfns.co/api-reference/transfer.md): Reference for the TransferRequest object used by the DFNS transfer endpoint to send native assets, tokens, and NFTs across supported networks.
- [Transfer Asset](https://docs.dfns.co/api-reference/wallets/transfer-asset.md): Transfer an asset out of the specified wallet to a destination address. For all fungible token transfers, the transfer amount must be specified in the minimum denomination of that token. For example, use the amount in Satoshi for a Bitcoin transfer, or the amount in Wei for an Ethereum transfer etc.
- [List Transfers](https://docs.dfns.co/api-reference/wallets/list-transfers.md): Retrieves a list of transfer requests for the specified wallet.
- [Get Transfer](https://docs.dfns.co/api-reference/wallets/get-transfer.md): Retrieves a Wallet Transfer Request by its ID.
- [Cancel Transfer](https://docs.dfns.co/api-reference/wallets/cancel-transfer.md): Cancels an EVM transfer by creating a replacement transaction with the same nonce. The new transaction sends 0 value to the same address, effectively nullifying the original transfer.      This endpoint works for:   - EVM-compatible networks (Ethereum, Polygon, BSC, etc.)   - Transfers that are in '…
- [Abort Transfer](https://docs.dfns.co/api-reference/wallets/abort-transfer.md): Aborts a transfer that is currently in 'Executing' status and has not yet been signed. Sets the transfer status to 'Failed' and removes it from the retry queue.
- [Speed Up Transfer](https://docs.dfns.co/api-reference/wallets/speed-up-transfer.md): Speeds up a transfer by creating a replacement transaction with the same parameters but higher gas fees.      This endpoint only works for:   - EVM-compatible networks (Ethereum, Polygon, BSC, etc.)   - Transfers that are in 'Broadcasted' status (already submitted to blockchain, but not confirmed ye…

##### Webhooks

- [Transfer requested](https://docs.dfns.co/api-reference/wallets/transfer-requested.md): A [wallet transfer](https://docs.dfns.co/api-reference/wallets/transfer-asset) request has been created.
- [Transfer broadcasted](https://docs.dfns.co/api-reference/wallets/transfer-broadcasted.md): A [wallet transfer](https://docs.dfns.co/api-reference/wallets/transfer-asset) request has been submitted to the mempool.
- [Transfer confirmed](https://docs.dfns.co/api-reference/wallets/transfer-confirmed.md): A [wallet transfer](https://docs.dfns.co/api-reference/wallets/transfer-asset) request has been confirmed on chain. The confirmation delay per network is listed [here](https://docs.dfns.co/networks).
- [Transfer failed](https://docs.dfns.co/api-reference/wallets/transfer-failed.md): A [wallet transfer](https://docs.dfns.co/api-reference/wallets/transfer-asset) request has failed to process.
- [Transfer rejected](https://docs.dfns.co/api-reference/wallets/transfer-rejected.md): A [wallet transfer](https://docs.dfns.co/api-reference/wallets/transfer-asset) request with a policy approval has been rejected.

#### Broadcast

- [Broadcast](https://docs.dfns.co/api-reference/broadcast/index.md): Network-specific transaction payload references for the DFNS sign and sign-and-broadcast endpoints across all supported blockchains.
- [Sign and Broadcast Transaction](https://docs.dfns.co/api-reference/wallets/sign-and-broadcast-transaction.md): Sign & Broadcast transaction enables communication with any arbitrary smart contract of the target blockchain. You can construct a transaction that performs a complex task and this endpoint will sign the transaction, add the signature and broadcast it to chain. It can be used to call smart contract…
- [List Transactions](https://docs.dfns.co/api-reference/wallets/list-transactions.md): Retrieves a list of transactions requests for the specified wallet.
- [Get Transaction](https://docs.dfns.co/api-reference/wallets/get-transaction.md): Retrieve information about a specific transaction.
- [Cancel Transaction](https://docs.dfns.co/api-reference/wallets/cancel-transaction.md): Cancels an EVM transaction by creating a replacement transaction with the same nonce. The new transaction sends 0 value to the same address, effectively nullifying the original transaction.      This endpoint works for:   - EVM-compatible networks (Ethereum, Polygon, BSC, etc.)   - Transactions that…
- [Abort Transaction](https://docs.dfns.co/api-reference/wallets/abort-transaction.md): Aborts a transaction that is currently in 'Executing' status and has not yet been signed. Sets the transaction status to 'Failed' and removes it from the retry queue.
- [Speed Up Transaction](https://docs.dfns.co/api-reference/wallets/speed-up-transaction.md): Speeds up a transaction by creating a replacement transaction with the same parameters but higher gas fees.      This endpoint only works for:   - EVM-compatible networks (Ethereum, Polygon, BSC, etc.)   - Transactions that are in 'Broadcasted' status (already submitted to blockchain, but not confir…

##### Examples per chain

- [Algorand transactions](https://docs.dfns.co/api-reference/broadcast/algorand.md): Reference for the Algorand transaction payload used with the DFNS sign and sign-and-broadcast endpoints, including required and optional fields.
- [Aptos transactions](https://docs.dfns.co/api-reference/broadcast/aptos.md): Reference for the Aptos transaction payload used with the DFNS sign and sign-and-broadcast endpoints, including required and optional fields.
- [Bitcoin / Litecoin transactions](https://docs.dfns.co/api-reference/broadcast/bitcoin.md): Reference for Bitcoin PSBT and transaction payloads used with the DFNS sign and sign-and-broadcast endpoints, including UTXO and fee fields.
- [Canton transactions](https://docs.dfns.co/api-reference/broadcast/canton.md): Reference for Canton transaction payloads used with the DFNS sign and sign-and-broadcast endpoints to interact with the Canton Network.
- [Cardano transactions](https://docs.dfns.co/api-reference/broadcast/cardano.md): Reference for Cardano transaction payloads used with the DFNS sign and sign-and-broadcast endpoints, including CBOR-encoded transaction fields.
- [EVM transactions](https://docs.dfns.co/api-reference/broadcast/evm.md): Reference for EVM transaction and message payloads used with the DFNS sign and sign-and-broadcast endpoints across Ethereum and EVM-compatible chains.
- [Hedera transactions](https://docs.dfns.co/api-reference/broadcast/hedera.md): Reference for Hedera transaction payloads used with the DFNS sign and sign-and-broadcast endpoints, including HBAR transfers and HCS messages.
- [IOTA transactions](https://docs.dfns.co/api-reference/broadcast/iota.md): Reference for IOTA transaction payloads used with the DFNS sign and sign-and-broadcast endpoints, including the required fields and encoding.
- [NEAR transactions](https://docs.dfns.co/api-reference/broadcast/near.md): Reference for NEAR transaction payloads used with the DFNS sign and sign-and-broadcast endpoints, including required and optional fields.
- [Solana transactions](https://docs.dfns.co/api-reference/broadcast/solana.md): Reference for Solana transaction payloads used with the DFNS sign and sign-and-broadcast endpoints, including versioned transactions and message encoding.
- [Stellar transactions](https://docs.dfns.co/api-reference/broadcast/stellar.md): Reference for Stellar transaction payloads used with the DFNS sign and sign-and-broadcast endpoints, including XDR-encoded transactions.
- [Sui transactions](https://docs.dfns.co/api-reference/broadcast/sui.md): Reference for Sui transaction payloads used with the DFNS sign and sign-and-broadcast endpoints, including required and optional fields.
- [Tezos transactions](https://docs.dfns.co/api-reference/broadcast/tezos.md): Reference for Tezos transaction payloads used with the DFNS sign and sign-and-broadcast endpoints, including operation encoding and fields.
- [TRON transactions](https://docs.dfns.co/api-reference/broadcast/tron.md): Reference for TRON transaction payloads used with the DFNS sign and sign-and-broadcast endpoints, including raw transaction fields and encoding.
- [XRP Ledger transactions](https://docs.dfns.co/api-reference/broadcast/xrp.md): Reference for XRP Ledger transaction payloads used with the DFNS sign and sign-and-broadcast endpoints, including transaction types and fields.

##### Webhooks

- [Transaction requested](https://docs.dfns.co/api-reference/wallets/transaction-requested.md): A [broadcast transaction](https://docs.dfns.co/api-reference/wallets/sign-and-broadcast-transaction) request has been created.
- [Transaction broadcasted](https://docs.dfns.co/api-reference/wallets/transaction-broadcasted.md): A [broadcast transaction](https://docs.dfns.co/api-reference/wallets/sign-and-broadcast-transaction) request has been submitted to the mempool.
- [Transaction confirmed](https://docs.dfns.co/api-reference/wallets/transaction-confirmed.md): A [broadcast transaction](https://docs.dfns.co/api-reference/wallets/sign-and-broadcast-transaction) request has been confirmed on chain. The confirmation delay per network is listed [here](https://docs.dfns.co/networks).
- [Transaction failed](https://docs.dfns.co/api-reference/wallets/transaction-failed.md): A [broadcast transaction](https://docs.dfns.co/api-reference/wallets/sign-and-broadcast-transaction) request has failed to process. Indicates either a system failure to complete the request or that the transaction failed on chain.
- [Transaction rejected](https://docs.dfns.co/api-reference/wallets/transaction-rejected.md): A [broadcast transaction](https://docs.dfns.co/api-reference/wallets/sign-and-broadcast-transaction) request with a policy approval has been rejected.

#### Sign

- [Sign](https://docs.dfns.co/api-reference/sign/index.md): Per-network reference for the DFNS signing endpoint, with supported signature kinds, payloads, and required fields for each supported blockchain.
- [Generate Signature](https://docs.dfns.co/api-reference/keys/generate-signature.md): Request to generate a signature with the key. **This process does not broadcast anything on-chain**, this is just an off-chain signature request.
- [List Signatures](https://docs.dfns.co/api-reference/keys/list-signatures.md): List all signature requests for a key.
- [Get Signature](https://docs.dfns.co/api-reference/keys/get-signature.md): Retrieve a signature request details.

##### Examples per chain

- [Algorand signing](https://docs.dfns.co/api-reference/sign/algorand.md): Reference for the Algorand signing endpoint, including supported signature kinds, request payloads, and the fields required to sign transactions.
- [Aptos signing](https://docs.dfns.co/api-reference/sign/aptos.md): Reference for the Aptos signing endpoint, including supported signature kinds, request payloads, and the fields required to sign transactions.
- [Bitcoin / Litecoin signing](https://docs.dfns.co/api-reference/sign/bitcoin.md): Reference for the Bitcoin signing endpoint, including PSBT signing, supported signature kinds, request payloads, and required fields.
- [Cardano signing](https://docs.dfns.co/api-reference/sign/cardano.md): Reference for the Cardano signing endpoint, including supported signature kinds, CBOR transaction payloads, and required signing fields.
- [Cosmos signing](https://docs.dfns.co/api-reference/sign/cosmos.md): Reference for the Cosmos signing endpoint, including supported signature kinds, request payloads, and the fields required to sign Cosmos SDK transactions.
- [EVM signing](https://docs.dfns.co/api-reference/sign/evm.md): Reference for the EVM signing endpoint, including transaction, message, EIP-191, and EIP-712 typed data signing across Ethereum and EVM chains.
- [Hedera signing](https://docs.dfns.co/api-reference/sign/hedera.md): Reference for the Hedera signing endpoint, including supported signature kinds, request payloads, and the fields required to sign Hedera transactions.
- [IOTA signing](https://docs.dfns.co/api-reference/sign/iota.md): Reference for the IOTA signing endpoint, including supported signature kinds, request payloads, and the fields required to sign IOTA transactions.
- [Kadena signing](https://docs.dfns.co/api-reference/sign/kadena.md): Reference for the Kadena signing endpoint, including supported signature kinds, request payloads, and the fields required to sign Kadena transactions.
- [NEAR signing](https://docs.dfns.co/api-reference/sign/near.md): Reference for the NEAR signing endpoint, including supported signature kinds, request payloads, and the fields required to sign NEAR transactions.
- [Solana signing](https://docs.dfns.co/api-reference/sign/solana.md): Reference for the Solana signing endpoint, including supported signature kinds, request payloads, and the fields required to sign Solana transactions.
- [Stellar signing](https://docs.dfns.co/api-reference/sign/stellar.md): Reference for the Stellar signing endpoint, including supported signature kinds, XDR payloads, and the fields required to sign Stellar transactions.
- [Substrate signing](https://docs.dfns.co/api-reference/sign/substrate.md): Reference for the Substrate signing endpoint, including supported signature kinds, request payloads, and the fields required to sign Substrate transactions.
- [Sui signing](https://docs.dfns.co/api-reference/sign/sui.md): Reference for the Sui signing endpoint, including supported signature kinds, request payloads, and the fields required to sign Sui transactions.
- [Tezos signing](https://docs.dfns.co/api-reference/sign/tezos.md): Reference for the Tezos signing endpoint, including supported signature kinds, request payloads, and the fields required to sign Tezos operations.
- [TRON signing](https://docs.dfns.co/api-reference/sign/tron.md): Reference for the TRON signing endpoint, including supported signature kinds, request payloads, and the fields required to sign TRON transactions.
- [TON signing](https://docs.dfns.co/api-reference/sign/ton.md): Reference for the TON signing endpoint, including supported signature kinds, request payloads, and the fields required to sign TON transactions.
- [XRP Ledger signing](https://docs.dfns.co/api-reference/sign/xrp.md): Reference for the XRP Ledger signing endpoint, including supported signature kinds, request payloads, and the fields required to sign XRP transactions.

##### Webhooks

- [Signature requested](https://docs.dfns.co/api-reference/keys/signature-requested.md): A [generate signature](https://docs.dfns.co/api-reference/keys/generate-signature) request has been created.
- [Signature complete](https://docs.dfns.co/api-reference/keys/signature-complete.md): A [generate signature](https://docs.dfns.co/api-reference/keys/generate-signature) request has completed. The signature is available.
- [Signature failed](https://docs.dfns.co/api-reference/keys/signature-failed.md): A [generate signature](https://docs.dfns.co/api-reference/keys/generate-signature) request has failed to process.
- [Signature rejected](https://docs.dfns.co/api-reference/keys/signature-rejected.md): A [generate signature](https://docs.dfns.co/api-reference/keys/generate-signature) request with a policy approval has been rejected.

#### Fee Sponsors

- [Fee Sponsors API](https://docs.dfns.co/api-reference/fee-sponsors.md): API endpoints to create and manage fee sponsors that pay gas for your DFNS wallets so users can transact without holding any native tokens.
- [List Fee Sponsors](https://docs.dfns.co/api-reference/fee-sponsors/list-fee-sponsors.md): Retrieves all Fee Sponsors configured in your organization.
- [Create Fee Sponsor](https://docs.dfns.co/api-reference/fee-sponsors/create-fee-sponsor.md): Creates a new `FeeSponsor` associated with a sponsor wallet. Returns a new fee sponsor entity with the `id` to be used when making a transfer.
- [Get Fee Sponsor](https://docs.dfns.co/api-reference/fee-sponsors/get-fee-sponsor.md): Retrieve a Fee Sponsor information by ID.
- [Activate Fee Sponsor](https://docs.dfns.co/api-reference/fee-sponsors/activate-fee-sponsor.md): Activate a Fee Sponsor: The fee sponsor can be used when making a transfer.
- [Deactivate Fee Sponsor](https://docs.dfns.co/api-reference/fee-sponsors/deactivate-fee-sponsor.md): Deactivate a Fee Sponsor: The fee sponsor won't be able to be used anymore when making a transfer.
- [Delete Fee Sponsor](https://docs.dfns.co/api-reference/fee-sponsors/delete-fee-sponsor.md): Delete a Fee Sponsor. This action is irreversible. The fee sponsor won't be able to be used anymore when making a transfer.
- [List Sponsored Fees](https://docs.dfns.co/api-reference/fee-sponsors/list-sponsored-fees.md): Retrieves all fees paid by the specific Fee Sponsor.

#### Swaps

- [Swaps API](https://docs.dfns.co/api-reference/swaps.md): Reference for the DFNS Swaps API, which lets you execute token swaps across supported EVM chains through integrated providers like Uniswap.
- [Request Swap Quote](https://docs.dfns.co/api-reference/swaps/request-swap-quote.md): Request a quote from a given provider for swapping assets. This is the first step of the [Swap flow](https://docs.dfns.co/api-reference/swaps#flow-overview).
- [Get Swap Quote](https://docs.dfns.co/api-reference/swaps/get-swap-quote.md): Get details of a specific swap quote by its ID
- [Create Swap](https://docs.dfns.co/api-reference/swaps/create-swap.md): Create a new swap based on an existing quote. This is the second step of the [Swap flow](https://docs.dfns.co/api-reference/swaps#flow-overview).
- [Get Swap](https://docs.dfns.co/api-reference/swaps/get-swap.md): Get details of a specific swap by its ID
- [List Swaps](https://docs.dfns.co/api-reference/swaps/list-swaps.md): List all swaps with pagination

##### Webhooks

- [Swap completed](https://docs.dfns.co/api-reference/swaps/swap-completed.md): A swap has completed successfully.
- [Swap failed](https://docs.dfns.co/api-reference/swaps/swap-failed.md): A swap request has failed to process.

#### Payouts

- [Request Payout Quote](https://docs.dfns.co/api-reference/payouts/request-payout-quote.md): Request a quote from a given provider for a payout. Returns estimated fiat amount and fees.
- [Create Payout](https://docs.dfns.co/api-reference/payouts/create-payout.md): Create a new payout to convert crypto assets to fiat currency.
- [List Payouts](https://docs.dfns.co/api-reference/payouts/list-payouts.md): List payouts with optional filtering and pagination.
- [Get Payout Status](https://docs.dfns.co/api-reference/payouts/get-payout-status.md): Retrieve the current status of a payout by its ID.
- [Create Payout Action](https://docs.dfns.co/api-reference/payouts/create-payout-action.md): Perform an action on a payout, such as confirming or canceling.
- [Create Payin](https://docs.dfns.co/api-reference/payins/create-payin.md): Deliver stablecoin from the organisation's provider balance to a wallet on-chain.
- [List Payins](https://docs.dfns.co/api-reference/payins/list-payins.md): List payins with optional filtering and pagination.
- [Get Payin Status](https://docs.dfns.co/api-reference/payins/get-payin-status.md): Retrieve the current status of an payin by its ID.
- [List Payin Balances](https://docs.dfns.co/api-reference/payins/list-payin-balances.md): The organisation's available balance at the payin provider, one entry per currency —     the funds payins can deliver on-chain.
- [Get Payin Recipient](https://docs.dfns.co/api-reference/payins/get-payin-recipient.md): Check whether a wallet's address is registered (and approved) as an payin recipient with the provider.
- [Register Payin Recipient](https://docs.dfns.co/api-reference/payins/register-payin-recipient.md): Register a wallet's address as an payin recipient with the provider. The registration then needs     to be approved on the provider's side (for Circle Mint: by an administrator in the Mint Console)     before payins to that wallet can be created.
- [List Payin Accounts](https://docs.dfns.co/api-reference/payins/list-payin-accounts.md): List the provider accounts, with their registered wallet addresses per asset. An account is created on the provider platform (e.g. the Borderless dashboard) and its registered addresses serve both directions: a payin delivers to — and a payout is funded from — a wallet whose address is registered on…
- [List Payin Options](https://docs.dfns.co/api-reference/payins/list-payin-options.md): List the currently available payin options — deliverable assets and fiat currency/payment-method/country combinations — as covered by the active provider institutions.
- [Request Payin Quote](https://docs.dfns.co/api-reference/payins/request-payin-quote.md): Request a quote from a given provider for a payin. Returns the stablecoin amount to be delivered and the fees.
- [Register Payin Account Asset](https://docs.dfns.co/api-reference/payins/register-payin-account-asset.md): Register a wallet's address for an asset on a provider account, a prerequisite for both payins (the wallet receives the delivered asset) and payouts (the wallet funds the withdrawal). Returns the updated account.

##### Webhooks

- [Payout action required](https://docs.dfns.co/api-reference/payouts/payout-action-required.md): A [payout](https://docs.dfns.co/features/payouts) requires an action (for example, a confirmation) before it can proceed.

#### Allocations

- [Allocations API](https://docs.dfns.co/api-reference/allocations.md): Reference for the DFNS Allocations API, which lets you earn rewards on your crypto holdings through integrated rewards providers across supported chains.
- [List Allocations](https://docs.dfns.co/api-reference/allocations/list-allocations.md): Lists the allocations of your organization.
- [Create Allocation](https://docs.dfns.co/api-reference/allocations/create-allocation.md): Create a new allocation.
- [Get Allocations Info](https://docs.dfns.co/api-reference/allocations/get-allocations-info.md): Retrieve the current reward rate (APY) for each supported allocation protocol.
- [Get Allocation](https://docs.dfns.co/api-reference/allocations/get-allocation.md): Retrieve the details of a specific allocation.
- [List Allocation Actions](https://docs.dfns.co/api-reference/allocations/list-allocation-actions.md): Retrieve the list of actions for a specific allocation.
- [Create Allocation Action](https://docs.dfns.co/api-reference/allocations/create-allocation-action.md): Create a new action for an existing allocation.
- [Request 0fns Allocation Quote](https://docs.dfns.co/api-reference/allocations/request-0fns-allocation-quote.md): Get a price quote for a 0fns deposit or withdrawal at the current market rate.
- [Cancel an unfilled 0fns order placement](https://docs.dfns.co/api-reference/allocations/cancel-an-unfilled-0fns-order-placement.md): Craft and broadcast an on-chain cancelOrder to cancel a 0fns OrderBook order placement that was not filled, reclaiming its escrow. The escrowed input token is returned to the wallet that funded the order.

#### Staking

- [Staking API](https://docs.dfns.co/api-reference/staking.md): Stake assets to earn rewards through integrated providers, with API endpoints to create stakes, claim rewards, and manage delegations.
- [List Stakes](https://docs.dfns.co/api-reference/staking/list-stakes.md): Retrieve the list of stakes.
- [Create Stake](https://docs.dfns.co/api-reference/staking/create-stake.md): Create a new stake.
- [Get Stakes](https://docs.dfns.co/api-reference/staking/get-stakes.md): Retrieve the details of a specific stake.
- [List Stake Actions](https://docs.dfns.co/api-reference/staking/list-stake-actions.md): Retrieve the list of actions for a specific stake.
- [Create Stake Action](https://docs.dfns.co/api-reference/staking/create-stake-action.md): Create a new action for an existing stake.
- [Get Stake Rewards](https://docs.dfns.co/api-reference/staking/get-stake-rewards.md): Retrieves the rewards linked to a specific stake.

#### Networks

- [Networks](https://docs.dfns.co/api-reference/networks.md): API endpoints for network utilities, including fee estimation, smart contract reads, Canton validator management, and other chain-specific helpers.
- [Estimate Fees](https://docs.dfns.co/api-reference/networks/estimate-fees.md): Gets real-time fee details for a given network, allowing users to make decisions based on their preferences for transaction speed/priority. Three levels of priority will be displayed: `slow`, `standard`, `fast`.
- [Call Function](https://docs.dfns.co/api-reference/networks/call-function.md): Call a read-only function on a smart contract. In Solidity, these are functions with the state mutability set to `view`.

##### Canton Validators

- [List Canton Validators](https://docs.dfns.co/api-reference/networks/list-canton-validators.md): Retrieve the list of configured Canton Validators in your organization.
- [Create Canton Validator](https://docs.dfns.co/api-reference/networks/create-canton-validator.md): Link a Canton Validator to your organization. This is required in order to create wallets or interact with the Canton network.
- [Update Canton Validator](https://docs.dfns.co/api-reference/networks/update-canton-validator.md): Update an existing Canton Validator configuration.      Read details about the process [here](https://docs.dfns.co/networks/canton).
- [Get Canton Validator](https://docs.dfns.co/api-reference/networks/get-canton-validator.md): Return a configured Canton Validator in your organization.
- [Delete Canton Validator](https://docs.dfns.co/api-reference/networks/delete-canton-validator.md): Delete a specific Canton Validator configuration.

#### Exchanges

- [Exchanges API](https://docs.dfns.co/api-reference/exchanges.md): Connect centralized exchanges to deposit and withdraw assets between your DFNS wallets and exchange accounts using API endpoints and policy controls.
- [List Exchanges](https://docs.dfns.co/api-reference/exchanges/list-exchanges.md): List all configured exchange integrations.
- [Create Exchange](https://docs.dfns.co/api-reference/exchanges/create-exchange.md): Link your organization with a cryptocurrency exchange.
- [Get Exchange](https://docs.dfns.co/api-reference/exchanges/get-exchange.md): Retrieve the details of a specific exchange integration configuration.
- [List Accounts](https://docs.dfns.co/api-reference/exchanges/list-accounts.md): Get a list of accounts for a specific exchange.
- [List Account Assets](https://docs.dfns.co/api-reference/exchanges/list-account-assets.md): Retrieve the list of assets for a specific account on a specific exchange.
- [List Asset Withdrawal Networks](https://docs.dfns.co/api-reference/exchanges/list-asset-withdrawal-networks.md): Lists the networks to which the given asset can be withdrawn from an exchange account.
- [Create Exchange Deposit](https://docs.dfns.co/api-reference/exchanges/create-exchange-deposit.md): Creates a new exchange deposit transaction.
- [Create Exchange Withdrawal](https://docs.dfns.co/api-reference/exchanges/create-exchange-withdrawal.md): Creates a new exchange withdrawal transaction.
- [Delete Exchange](https://docs.dfns.co/api-reference/exchanges/delete-exchange.md): Delete the exchange configuration from your organization.

### Management

#### Policies

- [Policies API](https://docs.dfns.co/api-reference/policies.md): API endpoints to create, list, update, archive, and manage policies that enforce business rules and approval workflows on wallet activity.
- [List Policies](https://docs.dfns.co/api-reference/policies/list-policies.md): Retrieve the list of policies on your organization.
- [Create Policy](https://docs.dfns.co/api-reference/policies/create-policy.md): Setup a new Policy for your organization.      Every policy requires a rule to be specified. Upon policy evaluation, the configuration specified in the rule will be used to determine whether the policy should trigger or not for a given activity.      By exposing controls on permissions and policies,…
- [Get Policy](https://docs.dfns.co/api-reference/policies/get-policy.md): Retrieve information about a specific policy.
- [Update Policy](https://docs.dfns.co/api-reference/policies/update-policy.md): Update an existing policy. The policy status is not editable through this endpoint — the update body has no `status` field. To deactivate a policy, use the Archive Policy endpoint instead.
- [Delete Policy](https://docs.dfns.co/api-reference/policies/delete-policy.md): Delete an existing policy.

##### Webhooks

- [Policy triggered](https://docs.dfns.co/api-reference/policies/policy-triggered.md): A policy got triggered upon some activity (the policy rule got evaluated, and it triggered).
- [Policy activity resolved](https://docs.dfns.co/api-reference/policies/policy-activity-resolved.md): A policy has been fulfilled.

#### Approval management

- [Policy Approvals](https://docs.dfns.co/api-reference/policy-approvals.md): API endpoints to list pending policy approvals and to approve or deny actions that triggered a policy requiring human or programmatic review.
- [Create Approval Decision](https://docs.dfns.co/api-reference/policies/create-approval-decision.md): Approve or Reject an Approval request.
- [Get Approval](https://docs.dfns.co/api-reference/policies/get-approval.md): Retrieve information about a specific approval request.
- [List Approvals](https://docs.dfns.co/api-reference/policies/list-approvals.md): Retrieve the list of pending approval requests.

##### Webhooks

- [Policy approval pending](https://docs.dfns.co/api-reference/policies/policy-approval-pending.md): A new [Approval](https://docs.dfns.co/api-reference/policy-approvals) process has been created and is pending.
- [Policy approval resolved](https://docs.dfns.co/api-reference/policies/policy-approval-resolved.md): An [Approval](https://docs.dfns.co/api-reference/policy-approvals) process is finalized: it has been either approved or rejected.

#### Agreements

- [Agreements](https://docs.dfns.co/api-reference/agreements.md): Programmatically accept DFNS and third-party provider service agreements, privacy policies, and terms of service required for certain features.
- [Get Latest Unaccepted Agreement](https://docs.dfns.co/api-reference/agreements/get-latest-unaccepted-agreement.md): Get the latest unaccepted agreement for a specific agreement type
- [Record Agreement Acceptance](https://docs.dfns.co/api-reference/agreements/record-agreement-acceptance.md): Record the acceptance of a specific agreement by its ID

#### Key Storage

- [List Signers](https://docs.dfns.co/api-reference/signers/list-signers.md): Lists the signer clusters of your key store, including each signer's ID and encryption public key.
- [List Key Stores](https://docs.dfns.co/api-reference/signers/list-key-stores.md): Lists the key stores of your organization.

##### Offline Signer

- [Create Clone Input](https://docs.dfns.co/api-reference/signers/create-clone-input.md): Creates the input archive for a clone fleet operation, which replicates a key store from a source HSM to a target HSM.
- [Submit Clone Output](https://docs.dfns.co/api-reference/signers/submit-clone-output.md): Submits the output archive produced by the offline signer fleet for a clone operation.
- [Create Genesis Input](https://docs.dfns.co/api-reference/signers/create-genesis-input.md): Creates the input archive for a genesis fleet operation, which provisions a new offline signer fleet and generates the key store's initial signing keys.
- [Submit Genesis Output](https://docs.dfns.co/api-reference/signers/submit-genesis-output.md): Submits the output archive produced by the offline signer fleet for a genesis operation.
- [Create Onchain Sign Input](https://docs.dfns.co/api-reference/signers/create-onchain-sign-input.md): Creates the input archive for an onchain-sign operation covering the key store's pending signature requests.
- [Submit Onchain Sign Output](https://docs.dfns.co/api-reference/signers/submit-onchain-sign-output.md): Submits the output archive produced by the offline signer fleet for an onchain-sign operation.
- [Create Proof Of Control Input](https://docs.dfns.co/api-reference/signers/create-proof-of-control-input.md): Creates the input archive for a proof-of-control operation covering the keys of the specified wallets.
- [Submit Proof Of Control Output](https://docs.dfns.co/api-reference/signers/submit-proof-of-control-output.md): Submits the output archive produced by the offline signer fleet for a proof-of-control operation.
- [Create Add Mac User Input](https://docs.dfns.co/api-reference/signers/create-add-mac-user-input.md): Creates the input archive for an add-mac-user fleet operation, which registers a new Mac operator machine with an HSM in the key store's trust set.
- [Submit Add Mac User Output](https://docs.dfns.co/api-reference/signers/submit-add-mac-user-output.md): Submits the output archive produced by the offline signer fleet for an add-mac-user operation.
- [Create Key Harvest Input](https://docs.dfns.co/api-reference/signers/create-key-harvest-input.md)
- [Submit Key Harvest Output](https://docs.dfns.co/api-reference/signers/submit-key-harvest-output.md)
- [Cancel Fleet Operation](https://docs.dfns.co/api-reference/signers/cancel-fleet-operation.md)
- [Create Add Provisioner Input](https://docs.dfns.co/api-reference/signers/create-add-provisioner-input.md): Creates the input archive for an add-provisioner fleet operation, which registers a new provisioner YubiKey into the key store's governance set.
- [Submit Add Provisioner Output](https://docs.dfns.co/api-reference/signers/submit-add-provisioner-output.md): Submits the output archive produced by the offline signer fleet for an add-provisioner operation.

### Webhooks

#### Webhook Configuration

- [Webhooks Configuration](https://docs.dfns.co/api-reference/webhooks.md): Manage webhook subscriptions and learn about the events emitted by DFNS, including wallet, transfer, signature, and policy approval events.
- [List Webhooks](https://docs.dfns.co/api-reference/webhooks/list-webhooks.md): List all webhooks for the authenticated user's organization. The results are paginated.
- [Create Webhook](https://docs.dfns.co/api-reference/webhooks/create-webhook.md): Register a new webhook.
- [Get Webhook](https://docs.dfns.co/api-reference/webhooks/get-webhook.md): Retrieve information about a specific webhook.
- [Update Webhook](https://docs.dfns.co/api-reference/webhooks/update-webhook.md): Update the definition of an existing webhook.
- [Delete Webhook](https://docs.dfns.co/api-reference/webhooks/delete-webhook.md): Deletes an existing webhook registration.
- [Ping Webhook](https://docs.dfns.co/api-reference/webhooks/ping-webhook.md): This endpoint is meant for webhook setup and troubleshooting. Calling the endpoint will trigger a fake test event that will be pushed to the webhook URL. The fake event will not be saved and not appear in further requests to Webhook Events.

#### Events History

- [Webhook Events](https://docs.dfns.co/api-reference/webhook-events.md): Reference for every webhook event emitted by DFNS, including wallet, transfer, signature, policy, and authentication events with example payloads.
- [Get Webhook Event](https://docs.dfns.co/api-reference/webhooks/get-webhook-event.md): Retrieve a specific webhook event details by its ID.    <Warning> We only keep a trace of those Webhook Events in our system for a **retention period of 31 days**. Past that, they are discarded, so you cannot see them using [List Webhook Events](https://docs.dfns.co/api-reference/webhooks/list-webho…
- [List Webhook Events](https://docs.dfns.co/api-reference/webhooks/list-webhook-events.md): Lists all events for a given webhook.
- [Webhook event retry triggered](https://docs.dfns.co/api-reference/webhooks/webhook-event-retry-triggered.md): Inbound event DFNS sends to your endpoint when it automatically retries a failed webhook delivery. This is a webhook event you receive, not an API method you can call. See [Webhook Event Deliveries & Retries](https://docs.dfns.co/api-reference/webhook-events#webhook-event-deliveries-%26-retries) for…

## OpenAPI Specs

- [openapi](/openapi.yaml)
