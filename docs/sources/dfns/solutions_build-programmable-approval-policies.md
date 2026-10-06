> ## Documentation Index
> Fetch the complete documentation index at: https://docs.dfns.co/llms.txt
> Use this file to discover all available pages before exploring further.

# Build programmable approval policies

> Use a DFNS service account to decode pending smart-contract calls and approve or deny them programmatically with custom business logic.

export const SupportLink = ({children}) => {
  const url = "https://support.dfns.co";
  return <a href={url} target="_blank">{children || url}</a>;
};

A user initiates a transaction from a DFNS wallet. The policy engine intercepts the request and puts it in `Pending`. A service account fetches the pending approval, decodes the ABI-encoded call data, evaluates the function name, recipient and amount against your business rules, and posts a decision. Every decision is cryptographically signed, preserving full non-repudiation regardless of who approves.

Static policies decide on amounts and addresses. Smart-contract calls need more: the meaning of the transaction is encoded in ABI-packed call data, not in `value` or `to`. Decoding the call lets the checker enforce per-function rules in plain TypeScript.

<Card title="Get the code" icon="github" href="https://github.com/dfns/dfns-solutions/tree/m/programmable-policy">
  dfns/dfns-solutions: programmable-policy
</Card>

## When to use this

* **Custom contract rules**: only allow `mint` to whitelisted recipients, only allow `approve` for known spenders, cap a `transfer` amount per call
* **Compliance checks**: screen recipients against sanctions lists or internal rules before they execute
* **Speed**: remove human bottlenecks for routine operations while keeping oversight on exceptions

## How it works

```mermaid theme={null}
sequenceDiagram
    participant User as Maker
    participant DFNS
    participant SA as Service account (Checker)
    participant Human as Human approver

    User->>DFNS: signAndBroadcastTransaction (mint(...))
    DFNS->>DFNS: Evaluate policies
    DFNS->>SA: approval Pending
    SA->>SA: decodeFunctionData(abi, data)
    SA->>SA: Evaluate rules
    alt Passes automated checks
        SA->>DFNS: createApprovalDecision (Approved)
        DFNS->>DFNS: Quorum met, broadcast transaction
    else Cannot decide automatically
        SA-->>Human: Notify for review
        Human->>DFNS: Approve or reject
    end
```

The service account and one or more human approvers are listed in the same approval group with a quorum of 1. Whoever approves first satisfies the requirement: the service account handles the routine cases, humans handle the exceptions.

## Reference implementation

The [recipes repo](https://github.com/dfns/dfns-solutions/tree/m/programmable-policy) deploys a sample ERC-20 stablecoin, creates the policy, and runs a service-account checker against pending `mint` calls.

| Component | Technology |
| - | - |
| Contract | Solidity 0.8.28 ERC-20 (OpenZeppelin, Hardhat v3) |
| Signing | DFNS KMS via `@dfns/sdk` |
| Scripts | TypeScript (tsx, viem) |
| Network | Ethereum Sepolia |

## What you'll need

* A [DFNS account](https://app.dfns.io)
* A [service account](/guides/developers/service-account) with permissions to read approvals and submit decisions. This is the **Checker**.
* `serviceAccountsCanApprove` enabled on your organization (contact our <SupportLink>Support Team</SupportLink>)
* A DFNS wallet for the **Maker**, tagged so the policy can target it
* A DFNS user listed as an additional approver on the policy
* Node.js v22+
* Testnet ETH in the Maker wallet for gas fees (use a [Sepolia faucet](https://www.alchemy.com/faucets/ethereum-sepolia))

## Configuration

<Steps>
  <Step title="Clone and install">
    ```bash theme={null}
    git clone https://github.com/dfns/dfns-solutions.git
    cd dfns-solutions/programmable-policy
    npm install
    ```
  </Step>

  <Step title="Set up environment variables">
    The `.env` identifies the **service account** (the checker), not the maker. The maker is identified only by `SENDER_WALLET_ID`.

    ```bash theme={null}
    cp .env.example .env
    ```

    ```bash .env theme={null}
    # DFNS API — service account (checker)
    DFNS_API_URL=https://api.dfns.io
    DFNS_ORG_ID=or-xxx-xxx
    DFNS_AUTH_TOKEN=eyJ...
    DFNS_CRED_ID=cred-xxx
    DFNS_PRIVATE_KEY="-----BEGIN EC PRIVATE KEY-----\n...\n-----END EC PRIVATE KEY-----"

    # Maker wallet and policy
    SENDER_WALLET_ID=wa-xxx-xxx
    POLICY_USER_ID=us-xxx-xxx

    # Contract under control
    CONTRACT_ADDRESS=0x...
    WHITELIST_ADDRESS=0x...
    ```

    | Variable | Description |
    | - | - |
    | `DFNS_API_URL` | DFNS API base URL (`api.dfns.io`) |
    | `DFNS_ORG_ID` | Your DFNS organization ID. See [how to find it](/guides/find-organization-id). |
    | `DFNS_AUTH_TOKEN` | Auth token for the **service account** |
    | `DFNS_CRED_ID` | Credential ID for the service account signing key |
    | `DFNS_PRIVATE_KEY` | Service account private key (PEM) |
    | `SENDER_WALLET_ID` | Maker wallet — its pending requests will be evaluated |
    | `POLICY_USER_ID` | User listed as an additional approver on the policy |
    | `CONTRACT_ADDRESS` | Filled in after `npm run deploy` |
    | `WHITELIST_ADDRESS` | Address allowed as `mint` recipient |
  </Step>

  <Step title="Compile the contract">
    ```bash theme={null}
    npm run compile
    ```
  </Step>
</Steps>

## Deploy and create the policy

### Step 1: Deploy the stablecoin

```bash theme={null}
npm run deploy
```

The script broadcasts the deployment from the Maker wallet and prints the deployed contract address. Copy it into `.env` as `CONTRACT_ADDRESS`.

### Step 2: Tag the maker wallet

In the DFNS dashboard, add the tag `autoreview` to the Maker wallet (see `walletTags` in `scripts/CreatePolicy.ts`). The policy filter uses this tag to scope itself to that wallet.

### Step 3: Create the approval policy

```bash theme={null}
npm run policy:create
```

This creates a `Wallets:Sign` policy with `AlwaysTrigger` and an approval group of quorum 1, listing both the user (`POLICY_USER_ID`) and the service account as eligible approvers.

<Note>
  A service account votes like any other approver: list it by its `userId` in the group's `approvers.userId.in`, and set `serviceAccountsCanApprove: true` on that same group. There is no separate `serviceAccountId` approver key. This only takes effect once the org-level service-account-approval feature is enabled — contact our <SupportLink>Support Team</SupportLink> to turn it on.
</Note>

<Warning>
  The policy is created with `initiatorCanApprove: true` so a single identity can demo the flow end-to-end. **In production set this to `false`** so the maker cannot bypass the checker by self-approving.
</Warning>

## Trigger and review a transaction

### Step 1: Broadcast a mint as the maker

```bash theme={null}
npm run mint -- 0xYourWhitelistedAddress 100
```

The transaction is intercepted by the policy and lands in `Pending`.

### Step 2: List pending approvals

```bash theme={null}
npm run approvals:list
```

### Step 3: Run the automated checker

```bash theme={null}
npm run approvals:auto
```

The script:

1. Calls `policies.listApprovals({ status: 'Pending' })`
2. Filters to approvals from `SENDER_WALLET_ID`
3. Loads the contract ABI from the Hardhat artifact
4. Calls `decodeFunctionData` from viem on `requestBody.data`
5. Evaluates the rules and posts a decision via `policies.createApprovalDecision`

To see denials, try:

```bash theme={null}
npm run mint -- 0x0000000000000000000000000000000000000001 100   # not whitelisted
npm run mint -- 0xYourWhitelistedAddress 999999999                # over the cap
```

Then re-run `npm run approvals:auto`.

## How the checker works

```ts theme={null}
const approvals = await dfnsApi.policies.listApprovals({ query: { status: 'Pending' } });

for (const approval of approvals.items) {
  const requestBody = activity.requestBody || activity.transactionRequest?.requestBody;

  if (requestBody.to.toLowerCase() !== CONTRACT_ADDRESS) {
    await reject(approval.id, 'Target address not allowed');
    continue;
  }

  const decoded = decodeFunctionData({ abi, data: requestBody.data });

  if (decoded.functionName !== 'mint') {
    await reject(approval.id, `Function ${decoded.functionName} not allowed`);
    continue;
  }

  const [recipient, amount] = decoded.args as [string, bigint];
  if (recipient.toLowerCase() !== WHITELIST_ADDRESS) {
    await reject(approval.id, 'Recipient not whitelisted');
  } else if (amount > MAX_MINT_AMOUNT) {
    await reject(approval.id, 'Amount exceeds policy cap');
  } else {
    await approve(approval.id, 'Recipient whitelisted and amount within policy cap');
  }
}
```

`decodeFunctionData` from viem reads the 4-byte function selector at the start of the call data, finds the matching entry in the ABI, and decodes the remaining bytes into typed arguments. The rules above are then plain TypeScript, no DSL to learn.

## Polling vs. webhooks

The reference implementation polls `listApprovals` from a CLI, which is simple to demo and run locally. For production, use a [webhook](/guides/developers/webhooks) on the `policy.approval.pending` event so the checker reacts the moment a request is created instead of on a polling interval.

## Design considerations

### Prefer abstaining over rejecting

A service-account rejection is final and irrevocable: it denies the entire approval with no override. The reference implementation rejects on every failure path so that denials are observable in the dashboard during a demo. In production, prefer abstaining when uncertain. Don't post a decision, and let a human approver in the same group review the case. Reject only on conditions that are unambiguously malicious.

### Separate automation from initiation

Don't use the same identity to both initiate transactions and approve them. The policy engine prevents self-approval when `initiatorCanApprove` is `false`. Keep maker and checker on distinct DFNS identities.

### Pin the ABI

`decodeFunctionData` will silently match any function whose selector collides with the bytes you feed it. Always validate `requestBody.to` against an allowlist of contracts whose ABI you trust before decoding, and reject calls to unknown targets.

### Monitor your automation

Track approval latency, escalation rates, and false positives. If the checker escalates too often, the rules may be too strict. If it never escalates, the checks may not be thorough enough.

## Adapting for your contract

**Different contract.** Replace `contracts/StableCoin.sol` with your own and update the artifact path in `SCApproveOrReject.ts`. The ABI is the only thing the checker needs to decode calls.

**More functions.** Replace the single `if (decoded.functionName === 'mint')` block with a `switch` over the function names you want to allow, each with its own argument validation.

**Off-chain data.** Because the checker runs as TypeScript, you can call any HTTP API, read a database, or query other on-chain state before deciding. Common examples: AML/KYC lookups on the recipient, market-data sanity checks on a swap amount.

**Long-lived runner.** Run the checker as a worker (cron, AWS Lambda on a schedule, or a Kubernetes CronJob) polling `listApprovals` every few seconds, or behind a webhook handler.

## Related

<CardGroup cols={2}>
  <Card title="Manage policies via API" icon="code" href="/guides/developers/manage-policies#automated-approvals-with-service-accounts">
    Implementation code for automated approvals
  </Card>

  <Card title="Define treasury policies" icon="shield-check" href="/solutions/define-treasury-policies">
    Spending limits and approval quorums
  </Card>

  <Card title="Apply compliance controls" icon="magnifying-glass" href="/solutions/apply-compliance-controls">
    KYT/AML screening integration
  </Card>

  <Card title="Automate payments" icon="money-bill-transfer" href="/solutions/automate-payments">
    Service account payment workflows
  </Card>
</CardGroup>


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.