> ## Documentation Index
> Fetch the complete documentation index at: https://docs.dfns.co/llms.txt
> Use this file to discover all available pages before exploring further.

# Service Accounts

> API endpoints to create, list, activate, and manage service accounts used for server-to-server API access with scoped permissions.

Service Accounts are machine users for server-to-server communication, automated tasks, or background processes. Unlike human users who authenticate with passkeys, service accounts use a keypair to sign API requests.

<Card title="Create a service account" icon="plus" href="/guides/developers/service-account">
  Step-by-step guide to create a service account and assign permissions
</Card>

## How service accounts work

1. **Keypair**: You generate an asymmetric keypair. The public key is registered with DFNS, and you keep the private key to sign requests.
2. **Token**: When you create the service account, you receive an authentication token for the `Authorization` header.
3. **Permissions**: A new service account has no [permissions](/core-concepts/roles-and-permissions) by default. Assign a role after creation, or pass a `permissionId` at creation time (requires `PermissionsAssign` permission).

To create a Service Account via API, use the [Create Service Account](/api-reference/auth/create-service-account) endpoint.

<Note>
  DFNS recommends using services like AWS Secrets Manager or comparable services on other cloud platforms to securely store and manage the private key and authentication tokens.
</Note>


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.