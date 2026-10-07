> ## Documentation Index
> Fetch the complete documentation index at: https://docs.dfns.co/llms.txt
> Use this file to discover all available pages before exploring further.

# Create a service account

> How to create a DFNS service account, assign it permissions, and use its signing key for server-to-server API access without a human user.

export const Youtube = props => {
  return <iframe className="w-full aspect-video rounded-xl" src={`https://www.youtube.com/embed/${props.videoId}`} title="YouTube video player" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen>
      </iframe>;
};

<Youtube videoId="PewJoozkoZM" />

Service accounts are machine users for server-to-server communication. Unlike human users who authenticate with passkeys, service accounts use a keypair to sign API requests.

## When to use a service account

Use a service account when you need to:

* Call the DFNS API from your backend server
* Run automated processes (scheduled transfers, batch operations)
* Build applications that create wallets or manage users on behalf of your organization

## Create the service account

<Steps>
  <Step title="Generate a keypair">
    Your service account authenticates by signing API requests with a private key. Generate the keypair yourself — **only the public key is uploaded to DFNS; the private key never leaves your control and DFNS never sees it.** Generate it on the machine or secrets manager that will use it, not on a shared workstation.

    ```bash theme={null}
    # Generate the private key with owner-only permissions from the start
    (umask 077 && openssl genrsa -out service-account.pem 2048)

    # Extract the public key — this is the only part you give to DFNS
    openssl pkey -in service-account.pem -pubout -out service-account.public.pem
    ```

    RSA 2048 is the minimum; DFNS also accepts ECDSA (P-256) and Ed25519 public keys (see the note in the next step) if you prefer a smaller, modern key. Generate a **dedicated** key for this service account — don't reuse one across accounts or environments. See [Generating and storing keys safely](#generating-and-storing-keys-safely) below before you continue.
  </Step>

  <Step title="Create the service account in the dashboard">
    1. Navigate to **Settings > Developers > Service Accounts** (direct link: [https://app.dfns.io/settings/service-accounts](https://app.dfns.io/settings/service-accounts))
    2. Click **New Service Account**
    3. Enter a name (e.g., "Backend Server" or "Trading Bot")
    4. Paste the contents of your public key file (including the `-----BEGIN PUBLIC KEY-----` and `-----END PUBLIC KEY-----` lines)
    5. Click **Create** and 🔑 sign with your passkey

    <Note>
      DFNS accepts **only PEM-encoded SPKI** public keys — the `-----BEGIN PUBLIC KEY-----` … `-----END PUBLIC KEY-----` block produced by `openssl pkey -pubout` (for ECDSA, EdDSA, or RSA keys). **OpenSSH-format** keys (`ssh-ed25519 AAAA...`, `ssh-rsa AAAA...`, `ecdsa-sha2-nistp256 ...` — the contents of a `.pub` file) are rejected as the wrong format. If your key is in OpenSSH format, convert it to PEM first: `ssh-keygen -f id_ed25519.pub -e -m PKCS8`.
    </Note>

    <Frame>
      <img src="https://mintcdn.com/dfns-6d8c7466/k4PlkpvHXsR9GGmT/images/auto/creating-a-service-account-1.png?fit=max&auto=format&n=k4PlkpvHXsR9GGmT&q=85&s=8ad571e7b3584d04de7850c3e349085d" alt="New service account form with a name and public key, Create button highlighted" width="2688" height="2332" data-path="images/auto/creating-a-service-account-1.png" />
    </Frame>
  </Step>

  <Step title="Save the authentication token">
    After creation, you'll see the service account token. **Copy it immediately** - it won't be shown again.

    <Frame>
      <img src="https://mintcdn.com/dfns-6d8c7466/k4PlkpvHXsR9GGmT/images/auto/creating-a-service-account-2.png?fit=max&auto=format&n=k4PlkpvHXsR9GGmT&q=85&s=f0cd63efb130f43fa81144a67780b032" alt="Service account creation showing the masked authentication token with a Copy button" width="2688" height="1672" data-path="images/auto/creating-a-service-account-2.png" />
    </Frame>

    <Warning>
      If you lose the token, you'll need to create a new service account.
    </Warning>

    Store both the token and private key securely. DFNS recommends using a secrets manager like AWS Secrets Manager, HashiCorp Vault, or your cloud provider's equivalent.

    <Note>
      Service account tokens are valid for **2 years** by default, which is also the maximum. To set a shorter lifetime, pass `daysValid` (or `secondsValid`) when creating the service account via the [API](/api-reference/auth/create-service-account); the dashboard always uses the default. When a token expires, requests fail with a `401`, and you need to [rotate the credential](/guides/developers/credential-rotation).
    </Note>
  </Step>

  <Step title="Review permissions">
    By default, a new service account has **no permissions**. You must explicitly assign a role with the permissions it needs:

    1. Navigate to **Settings > Roles** and create a new role with only the required permissions
    2. Go back to **Settings > Developers > Service Accounts** and click on your service account
    3. Assign the dedicated role

    **Common permission sets:**

    | Use case | Permissions needed |
    | - | - |
    | Create and manage wallets | `Wallets:Create`, `Wallets:Read` |
    | Transfer assets | `Wallets:Read`, `Wallets:Sign` |
    | Register end users | `Auth:Users:Create`, `Auth:Users:Read` |
    | Full wallet management | `Wallets:Create`, `Wallets:Read`, `Wallets:Sign`, `Wallets:Update` |

    See the [full list of permissions](/core-concepts/roles-and-permissions#list-of-permissions) for all available options.

    <Tip>
      You can also assign a permission at creation time by passing a `permissionId` in the [Create Service Account](/api-reference/auth/create-service-account) API request body. The creating user must have the `PermissionsAssign` permission.
    </Tip>
  </Step>
</Steps>

## Generating and storing keys safely

The private key, together with the token, lets anyone call the API as this service account. Treat it like a production secret.

* **Generate it where it will run.** Create the keypair on the server or secrets manager that will use it. Only the public key goes to DFNS; the private key should travel no further than it has to.
* **Lock down the file.** Restrict the private key to its owner (`chmod 600`, or the `umask 077` shown above). For extra protection at rest, encrypt it with a passphrase (`openssl genrsa -aes256 -out service-account.pem 2048`).
* **Never commit it.** Keep the private key and token out of source control, container images, CI logs, and committed `.env` or example files. Load them from a secrets manager (AWS Secrets Manager, HashiCorp Vault, or your cloud provider's equivalent) or from environment variables injected at runtime.
* **One key per account and environment.** Use separate service accounts — and separate keys — for production and non-production, and for distinct automations, so you can revoke one without disrupting the others.
* **Rotate on a schedule and on suspicion.** Rotate the key periodically, and immediately if it may have been exposed. See [credential rotation](/guides/developers/credential-rotation).
* **Scope permissions tightly.** Give the account only the permissions its job needs (see [Review permissions](#create-the-service-account)) so a leaked key has a limited blast radius.

## Service account limitations

Service accounts can perform most operations, but some actions require human interaction:

| Operation | Service Account | Notes |
| - | - | - |
| Create wallets | Yes | |
| Transfer assets | Yes | Subject to policies |
| Sign transactions | Yes | Subject to policies |
| Create end users | Yes | For delegated wallets |
| Approve policy requests | Opt-in | Requires `serviceAccountsCanApprove` on the approval group and staff activation |
| Create policies | Yes | |
| Create other service accounts | No | Requires human passkey |
| Modify policies | Yes | But approval may require humans |

<Note>
  Service accounts can participate in [policy approvals](/core-concepts/policies#service-account-approvers) when explicitly enabled on the approval group. This feature requires activation by DFNS staff on your organization.
</Note>

## Using your service account

You now have everything needed to make API calls:

| Credential | Purpose |
| - | - |
| **Token** | Used in the `Authorization: Bearer <token>` header |
| **Private key** | Used to sign [user action challenges](/api-reference/auth/signing-flows) for POST/PUT/DELETE requests |

See the [TypeScript SDK service account example](https://github.com/dfns/dfns-sdk-ts/tree/m/examples/sdk/service-account) for a complete implementation.

## Related

<CardGroup cols={2}>
  <Card title="Sign requests" icon="signature" href="/guides/developers/signing-requests">
    How to sign API requests with your service account
  </Card>

  <Card title="Permissions reference" icon="shield" href="/core-concepts/roles-and-permissions">
    Full list of available permissions
  </Card>
</CardGroup>


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.