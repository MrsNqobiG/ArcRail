> ## Documentation Index
> Fetch the complete documentation index at: https://docs.dfns.co/llms.txt
> Use this file to discover all available pages before exploring further.

# Set up environments

> Best practices for managing multiple DFNS organizations across development, staging, and production with service accounts, secrets, and CI/CD.

export const SupportLink = ({children}) => {
  const url = "https://support.dfns.co";
  return <a href={url} target="_blank">{children || url}</a>;
};

When building applications with DFNS, you'll typically want separate environments for development, staging, and production. This guide covers best practices for setting up and managing multiple DFNS organizations for environment separation.

## When to use multiple organizations

Use separate organizations for each environment when:

* You need isolated wallets, users, and policies per environment
* You want to test policy changes without affecting production
* Different team members should have access to different environments
* You need to prevent accidental production operations during development

<Note>
  Each DFNS organization is fully isolated. Wallets, users, policies, and configurations in one organization cannot access or affect another organization.
</Note>

## Setting up your organizations

Contact our <SupportLink>Support Team</SupportLink> to create organizations for each environment. We recommend a naming convention that clearly identifies each environment:

| Environment | Organization name | Purpose |
| - | - | - |
| Development | `Acme Corp - Dev` | Local development and testing |
| Staging | `Acme Corp - Staging` | Pre-production testing, QA |
| Production | `Acme Corp - Production` | Live application |

<Tip>
  The same email address can be used to create separate user accounts in different organizations. This allows your team members to access all environments with familiar credentials.
</Tip>

## Service accounts per environment

As for the rest of the configuration, you will need to create separate [service accounts](/guides/developers/service-account) for each environment. We recommend to use separate keys for each one of them.
This provides:

* **Isolation**: Compromised development credentials can't affect production
* **Audit trails**: Clear attribution of which environment performed actions
* **Different permissions**: Broader permissions in dev, restricted in production

### Recommended setup

<Steps>
  <Step title="Generate unique keypairs per environment">
    Create separate keypairs for each environment:

    ```bash theme={null}
    # Development
    openssl genrsa -out service-account-dev.pem 2048
    openssl pkey -in service-account-dev.pem -pubout -out service-account-dev.public.pem

    # Staging
    openssl genrsa -out service-account-staging.pem 2048
    openssl pkey -in service-account-staging.pem -pubout -out service-account-staging.public.pem

    # Production
    openssl genrsa -out service-account-prod.pem 2048
    openssl pkey -in service-account-prod.pem -pubout -out service-account-prod.public.pem
    ```
  </Step>

  <Step title="Create service accounts in each organization">
    In each organization's dashboard:

    1. Navigate to **Settings > Developers > Service Accounts**
    2. Create a service account with the corresponding public key
    3. Save the authentication token securely
  </Step>

  <Step title="Assign appropriate permissions">
    Consider granting broader permissions in development for easier testing, while restricting production to the minimum required:

    | Environment | Recommended approach |
    | - | - |
    | Development | Broader permissions for rapid iteration |
    | Staging | Match production permissions to catch issues |
    | Production | Minimum required permissions only |
  </Step>
</Steps>

## Configuration management

### Environment variables

Structure your configuration to switch between environments:

```typescript title="config.ts" theme={null}
interface DfnsConfig {
  baseUrl: string
  orgId: string
  serviceAccountToken: string
  serviceAccountPrivateKey: string
}

const configs: Record<string, DfnsConfig> = {
  development: {
    baseUrl: 'https://api.dfns.io',
    orgId: process.env.DFNS_ORG_ID_DEV!,
    serviceAccountToken: process.env.DFNS_TOKEN_DEV!,
    serviceAccountPrivateKey: process.env.DFNS_PRIVATE_KEY_DEV!,
  },
  staging: {
    baseUrl: 'https://api.dfns.io',
    orgId: process.env.DFNS_ORG_ID_STAGING!,
    serviceAccountToken: process.env.DFNS_TOKEN_STAGING!,
    serviceAccountPrivateKey: process.env.DFNS_PRIVATE_KEY_STAGING!,
  },
  production: {
    baseUrl: 'https://api.dfns.io',
    orgId: process.env.DFNS_ORG_ID_PROD!,
    serviceAccountToken: process.env.DFNS_TOKEN_PROD!,
    serviceAccountPrivateKey: process.env.DFNS_PRIVATE_KEY_PROD!,
  },
}

export const dfnsConfig = configs[process.env.NODE_ENV || 'development']
```

### Secrets management

Store credentials securely using a secrets manager:

| Environment | Recommended storage |
| - | - |
| Development | Local `.env` file (gitignored) |
| Staging/Production | AWS Secrets Manager, HashiCorp Vault, or similar |

<Warning>
  Never commit service account tokens or private keys to version control.
</Warning>

Example `.env` structure:

```bash title=".env.development" theme={null}
DFNS_ORG_ID_DEV=or-xxxxx-xxxxx-xxxxxxxxx
DFNS_TOKEN_DEV=eyJhbGciOiJS...
DFNS_PRIVATE_KEY_DEV="-----BEGIN RSA PRIVATE KEY-----
...
-----END RSA PRIVATE KEY-----"
```

## Policies and permissions

Policies and permissions must be configured separately in each organization. Consider:

### Development environment

* Simpler policies or no policies for rapid iteration
* Broader permissions for all developers
* Use testnet chains only

### Staging environment

* Mirror production policies to catch issues before release
* Test policy changes here before applying to production
* Use testnet chains for most testing

### Production environment

* Strict policies with appropriate approval requirements
* Minimum necessary permissions
* Mainnet chains for real transactions

<Tip>
  Document your production policies and permissions so you can replicate them in staging for accurate testing.
</Tip>

## Webhooks

Configure [webhooks](/guides/developers/webhooks) separately for each environment to send events to the appropriate endpoints:

| Environment | Webhook URL |
| - | - |
| Development | `https://dev.example.com/webhooks/dfns` or local tunnel |
| Staging | `https://staging.example.com/webhooks/dfns` |
| Production | `https://api.example.com/webhooks/dfns` |

For local development, use a tunneling service to receive webhooks on your local machine.

## Related

<CardGroup cols={2}>
  <Card title="Create a service account" icon="robot" href="/guides/developers/service-account">
    Step-by-step service account setup
  </Card>

  <Card title="Configure WebAuthn" icon="key" href="/guides/developers/webauthn-configuration">
    Configure passkeys for multiple domains
  </Card>

  <Card title="Manage policies via API" icon="shield-check" href="/guides/developers/manage-policies">
    Set up transaction policies
  </Card>

  <Card title="Set up webhooks" icon="webhook" href="/guides/developers/webhooks">
    Configure event notifications
  </Card>
</CardGroup>


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.