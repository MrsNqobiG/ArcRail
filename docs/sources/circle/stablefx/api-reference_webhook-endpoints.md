> ## Documentation Index
> Fetch the complete documentation index at: https://developers.circle.com/llms.txt
> Use this file to discover all available pages before exploring further.

> ## Agent Instructions
> Before reading these docs, install the relevant Circle Skill to get pre-loaded context — skills are LLM-optimized and cover architecture decisions, correct flows, and common pitfalls. In Claude Code: run /plugin marketplace add circlefin/skills then /plugin install circle-skills@circle. With Vercel Skills CLI: run npx skills add circlefin/skills. Available skills: use-usdc https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-usdc/SKILL.md (balances, transfers, approvals on EVM and Solana); EURC has no skill — see https://developers.circle.com/stablecoins/what-is-eurc.md; bridge-stablecoin https://github.com/circlefin/skills/blob/master/plugins/circle/skills/bridge-stablecoin/SKILL.md (crosschain transfers via CCTP, USDC, EURC, and third-party assets); use-arc https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-arc/SKILL.md (Arc chain config, contract deployment, USDC bridging — Arc docs: https://docs.arc.io/llms.txt); use-circle-wallets https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-circle-wallets/SKILL.md (choose wallet type); use-developer-controlled-wallets https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-developer-controlled-wallets/SKILL.md (custodial wallets for payouts and treasury); use-user-controlled-wallets https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-user-controlled-wallets/SKILL.md (embedded wallets with Web2 login); use-modular-wallets https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-modular-wallets/SKILL.md (smart contract wallets with passkeys and ERC-4337); use-gateway https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-gateway/SKILL.md (unified USDC balance, nanopayments); use-smart-contract-platform https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-smart-contract-platform/SKILL.md (deploy, interact, monitor contracts). Pair any skill with the Circle MCP server for live SDK signatures, contract addresses, and chain IDs: {"mcpServers":{"circle":{"url":"https://api.circle.com/v1/codegen/mcp"}}}.
> Read the product overview first. Each product has an overview explaining when and why to use it. Read it before quickstarts.
> Pick the right wallet type. Developer-controlled (you hold keys), user-controlled (end user holds keys via PIN/social login), or modular (smart contract wallets with passkeys). See https://developers.circle.com/wallets.md.
> Use CCTP V2 for crosschain transfers. CCTP natively transfers USDC and EURC via burn-and-mint, and supports permissionless wrapping of third-party assets via lock-and-mint. V1 is legacy; always use V2 unless V1 is specified or the chain requires it (Noble, Sui, and Aptos still require V1). Migration guide: https://developers.circle.com/cctp/migration-from-v1-to-v2.md.
> Use Bridge Kit for frontend bridging. Wraps CCTP with a simpler SDK for user-facing apps. Use CCTP directly for backend transfers.
> Gas Station vs Paymaster. Gas Station sponsors gas for Circle Wallet transactions. Paymaster lets users pay gas in USDC. Different use cases — read both overviews.
> Gateway Nanopayments for sub-cent payments. Gasless USDC micropayments down to $0.000001 via x402 and batched settlement. For pay-per-request APIs, AI agent payments, streaming.
> Look up USDC addresses per chain. Never hardcode — use https://developers.circle.com/stablecoins/usdc-contract-addresses.md.
> Prefer SDKs over raw API calls. Node.js and Python SDKs handle auth, retries, and errors.
> API key required. Bearer token in Authorization header. Testnet and mainnet use separate keys and may use different base URLs depending on the product.
> Set up webhooks when available. Most operations are async. Webhooks deliver transaction confirmations and state changes.
> When calling list endpoints, paginate using pageSize and pageAfter until no nextPageAfter cursor is returned—stopping at the first page silently misses records.
> Building an AI agent? Start with the Agent Stack—Circle CLI, agent wallets, and nanopayments built for autonomous use cases: https://developers.circle.com/agent-stack.md.

# How-to: Set up a webhook endpoint

> Expose a subscriber endpoint and subscribe to webhook notifications from a Circle product.

To start receiving webhook notifications from a Circle product, expose a
subscriber endpoint, then register that endpoint as a subscriber to the events
you care about. The exact flow depends on which
[notification API version](/api-reference/webhooks#notification-api-versions)
the product uses.

<Tabs>
  <Tab title="v2 notifications">
    Used by [Circle Wallets](/wallets), [Circle Contracts](/contracts),
    [CPN payments](/cpn), [CPN Managed Payments](/cpn/managed-payments),
    [Digital Asset Accounts](/digital-asset-accounts), [Gateway](/gateway), and
    [StableFX](/stablefx).

    <Steps>
      <Step title="Set up a subscriber endpoint">
        Expose a publicly accessible HTTPS endpoint that:

        * Is reachable from the public internet.
        * Handles both `HEAD` and `POST` requests. Circle uses `HEAD` to validate the
          URL when you create or update a subscription, and `POST` to deliver
          notifications.
        * Responds to `POST` requests with a `2XX` status code so Circle treats the
          delivery as successful. Any other status causes Circle to retry the
          notification.

        To test before deploying a real endpoint, generate a temporary URL with
        [webhook.site](https://webhook.site/) and use it as your subscriber endpoint.
      </Step>

      <Step title="Allowlist Circle's source IP addresses">
        Configure your firewall, load balancer, or cloud security groups so your
        endpoint only trusts webhook requests from Circle's source IP addresses. This
        blocks unauthenticated traffic at the network edge as a layer of defense in
        addition to [signature verification](/api-reference/verify-webhook-signatures).
        Allowlist the IP addresses for each product you integrate with separately.

        **Wallets, Contracts, Gateway, and Digital Asset Accounts** share the same
        webhook delivery infrastructure:

        * `54.243.112.156`
        * `100.24.191.35`
        * `54.165.52.248`
        * `54.87.106.46`

        **Circle Payments Network (CPN)**: the same IP set applies to both mainnet and
        testnet:

        * `35.169.154.32`
        * `3.90.127.28`
        * `3.230.111.7`
        * `54.88.227.75`

        **Stablecoin FX (StableFX):**

        * `3.230.111.7`
        * `3.90.127.28`
        * `35.169.154.32`
        * `54.88.227.75`
      </Step>

      <Step title="Subscribe to notifications">
        Register your endpoint as a subscriber by calling the Create Subscription
        endpoint for your product. Select your product for the request shape:

        <Tabs>
          <Tab title="Wallets and Contracts">
            These products share the same subscription endpoint. See the Create Subscription
            reference for [Wallets](/api-reference/wallets/common/create-subscription) or
            [Contracts](/api-reference/contracts/common/create-subscription) for the full
            schema.

            ```bash theme={null}
            curl --request POST \
              --url https://api.circle.com/v2/notifications/subscriptions \
              --header "Authorization: Bearer $CIRCLE_API_KEY" \
              --header "Content-Type: application/json" \
              --data '{
                "endpoint": "https://your-app.example.com/webhooks",
                "notificationTypes": ["*"]
              }'
            ```

            Example response:

            ```json theme={null}
            {
              "data": {
                "id": "b3d9d2d5-4c12-4946-a09d-953e82fae2b0",
                "name": "Transactions Webhook",
                "endpoint": "https://your-app.example.com/webhooks",
                "enabled": true,
                "createDate": "2026-01-15T21:47:35.107250Z",
                "updateDate": "2026-01-15T21:47:35.107250Z",
                "notificationTypes": ["*"],
                "restricted": false
              }
            }
            ```
          </Tab>

          <Tab title="Digital Asset Accounts">
            Digital Asset Accounts distributors can register a subscription from Circle Hub
            or with the API.

            ## Create a subscription from Circle Hub

            Circle Hub takes no code, validates your endpoint on creation, surfaces delivery
            status, and lets you pause a subscription without a deploy.

            Before you begin, ensure that you've:

            * Completed Digital Asset Accounts onboarding, which grants sandbox access
              automatically and exposes the **Digital Asset Accounts** capability in
              production once the account clears onboarding. See
              [Going to production](/digital-asset-accounts/references/going-to-production).
            * Deployed a publicly accessible HTTPS endpoint that handles `HEAD` and `POST`
              requests and responds to `POST` with a `200 OK`.

            Sign in to [Circle Hub](https://hub.circle.com), go to **Developers >
            Webhooks**, and select **Create webhook**.

            <Steps>
              <Step title="Select the capability">
                Under **Capability**, select **Digital Asset Accounts**. The event list under
                **Events** narrows to the notification types this capability delivers.
              </Step>

              <Step title="Enter your endpoint">
                Enter your endpoint's host and path in **URL**. Circle Hub prefixes the value
                with `https://`, so enter `your-app.example.com/webhooks` rather than the full
                URL. Optionally add a **Name** to identify the subscription in the table.
              </Step>

              <Step title="Select the events to receive">
                Under **Events**, select the events you want to receive, or select all. See
                [Webhook notifications](/api-reference/digital-asset-accounts) for the full
                event catalog.
              </Step>

              <Step title="Create the subscription">
                Select **Create webhook**. Circle Hub creates the subscription in the
                **Inactive** state and no events are delivered yet. To go active, open the
                subscription and select **Test & Activate**. Circle Hub sends a test payload to
                your endpoint and activates the subscription once your endpoint responds with
                `2XX`. If the test fails, Circle Hub reports the reason, such as a refused
                connection, a TLS error, or a response timeout.
              </Step>
            </Steps>

            ## Create a subscription with the API

            Use the API when you need to manage subscriptions programmatically. Digital
            Asset Accounts uses the shared `/v2/notifications/subscriptions` endpoint. See
            the
            [Create Subscription](/api-reference/digital-asset-accounts/all/create-subscription)
            reference for the full schema.

            ```bash theme={null}
            curl --request POST \
              --url https://api.circle.com/v2/notifications/subscriptions \
              --header "Authorization: Bearer $CIRCLE_API_KEY" \
              --header "Content-Type: application/json" \
              --data '{
                "endpoint": "https://your-app.example.com/webhooks",
                "notificationTypes": ["*"]
              }'
            ```

            Example response:

            ```json theme={null}
            {
              "data": {
                "id": "b3d9d2d5-4c12-4946-a09d-953e82fae2b0",
                "name": "Digital Asset Accounts Webhook",
                "endpoint": "https://your-app.example.com/webhooks",
                "enabled": true,
                "createDate": "2026-01-15T21:47:35.107250Z",
                "updateDate": "2026-01-15T21:47:35.107250Z",
                "notificationTypes": ["*"],
                "restricted": false
              }
            }
            ```
          </Tab>

          <Tab title="CPN">
            CPN requires `name` and `enabled` in the request body in addition to the common
            fields. See the
            [Create Subscription](/api-reference/cpn/common/create-subscription) reference
            for the full schema.

            ```bash theme={null}
            curl --request POST \
              --url https://api.circle.com/v2/cpn/notifications/subscriptions \
              --header "Authorization: Bearer $CIRCLE_API_KEY" \
              --header "Content-Type: application/json" \
              --data '{
                "endpoint": "https://your-app.example.com/webhooks",
                "name": "CPN Webhooks",
                "enabled": true,
                "notificationTypes": ["*"]
              }'
            ```

            Example response:

            ```json theme={null}
            {
              "data": {
                "id": "1609aa1c-510a-448d-b9b9-3a13566ff922",
                "name": "CPN Webhooks",
                "endpoint": "https://your-app.example.com/webhooks",
                "enabled": true,
                "createDate": "2026-01-15T21:47:35.107250Z",
                "updateDate": "2026-01-15T21:47:35.107250Z",
                "notificationTypes": ["*"],
                "restricted": false
              }
            }
            ```
          </Tab>

          <Tab title="StableFX">
            See the [Create Subscription](/api-reference/stablefx/all/create-subscription)
            reference for the full schema.

            ```bash theme={null}
            curl --request POST \
              --url https://api.circle.com/v2/stablefx/notifications/subscriptions \
              --header "Authorization: Bearer $CIRCLE_API_KEY" \
              --header "Content-Type: application/json" \
              --data '{
                "endpoint": "https://your-app.example.com/webhooks",
                "notificationTypes": ["*"]
              }'
            ```

            Example response:

            ```json theme={null}
            {
              "data": {
                "id": "c4d1da72-111e-4d52-bdbf-2e74a2d803d5",
                "name": "Transactions Webhook",
                "endpoint": "https://your-app.example.com/webhooks",
                "enabled": true,
                "createDate": "2026-01-15T21:47:35.107250Z",
                "updateDate": "2026-01-15T21:47:35.107250Z",
                "notificationTypes": ["*"],
                "restricted": false
              }
            }
            ```
          </Tab>

          <Tab title="Gateway">
            Gateway uses a subscription that includes the wallet addresses and blockchain
            domains to monitor. See the
            [Create Subscription](/api-reference/gateway/all/create-permissionless-subscription)
            reference for the full schema.

            ```bash theme={null}
            curl --request POST \
              --url https://api.circle.com/v2/notifications/subscriptions/permissionless \
              --header "Authorization: Bearer $CIRCLE_API_KEY" \
              --header "Content-Type: application/json" \
              --data '{
                "environment": "mainnet",
                "endpoint": "https://your-app.example.com/webhooks",
                "addresses": ["0xYourWalletAddress"],
                "domains": [0],
                "notificationTypes": ["gateway.*"]
              }'
            ```

            Example response:

            ```json theme={null}
            {
              "data": {
                "id": "9d1fa351-b24d-442a-8aa5-e717db1ed636",
                "name": "Gateway Webhooks",
                "endpoint": "https://your-app.example.com/webhooks",
                "environment": "mainnet",
                "enabled": true,
                "addresses": ["0xYourWalletAddress"],
                "domains": [0],
                "notificationTypes": ["gateway.*"],
                "createDate": "2026-01-15T21:47:35.107250Z",
                "updateDate": "2026-01-15T21:47:35.107250Z"
              }
            }
            ```
          </Tab>
        </Tabs>
      </Step>
    </Steps>
  </Tab>

  <Tab title="v1 notifications">
    <Warning>
      Webhooks v1 are legacy and being phased out. If you have existing integrations
      with v1 endpoints, [learn how to migrate to
      v2](https://help.circle.com/support/en/migrating-from-v1-webhooks-to-v2-webhooks?id=support_article_view\&sys_kb_id=9e9fe9a63b27c310cfb54b9aa4e45a1f).
    </Warning>

    Used by [Circle Mint](/circle-mint) and
    [End User Onboarding](/end-user-onboarding).

    <Steps>
      <Step title="Set up a subscriber endpoint">
        Expose a publicly accessible HTTPS endpoint that:

        * Is reachable from the public internet.
        * Handles both `HEAD` and `POST` requests. Circle issues `HEAD` requests as a
          connectivity warmup. SNS deliveries arrive as `POST` requests with the SNS
          message in the request body.
        * Responds with a `2xx` status code so SNS treats the delivery as successful.

        To test before deploying a real endpoint, generate a temporary URL with
        [webhook.site](https://webhook.site/), use it as your subscriber endpoint, and
        copy the `SubscribeURL` from each confirmation message into your browser to
        complete the handshake. Expect two confirmation messages, one per region.
      </Step>

      <Step title="Register your subscription">
        Call `POST /v1/notifications/subscriptions` with your endpoint URL.

        ```bash theme={null}
        curl --request POST \
          --url https://api.circle.com/v1/notifications/subscriptions \
          --header "Authorization: Bearer $CIRCLE_API_KEY" \
          --header "Content-Type: application/json" \
          --data '{
            "endpoint": "https://your-app.example.com/webhooks"
          }'
        ```

        Example response:

        ```json theme={null}
        {
          "data": {
            "id": "b8627ae8-732b-4d25-b947-1df8f4007a29",
            "endpoint": "https://your-app.example.com/webhooks",
            "subscriptionDetails": [
              {
                "url": "arn:aws:sns:us-east-1:908968368384:sandbox_platform-notifications-topic",
                "arn": "arn:aws:sns:us-east-1:908968368384:sandbox_platform-notifications-topic:9b1e0c7a-2d84-4f1b-8c3a-71a2650f5c22",
                "status": "pending"
              },
              {
                "url": "arn:aws:sns:us-west-2:908968368384:sandbox_platform-notifications-topic",
                "arn": "arn:aws:sns:us-west-2:908968368384:sandbox_platform-notifications-topic:fcb4a2c9-9c4f-4706-b312-6b22650f5d17",
                "status": "pending"
              }
            ]
          }
        }
        ```

        Circle publishes v1 notifications from two AWS regions (`us-east-1` and
        `us-west-2`) for redundancy, so `subscriptionDetails[]` contains one entry per
        region. Each entry starts as `pending` and moves to `confirmed` independently
        once you confirm its own `SubscribeURL` in the next step. v1 subscriptions
        deliver all account events; filtering by `notificationTypes` isn't supported.

        <Tip>
          Circle Mint customers can also register subscriptions through the [Circle Mint
          console](https://app.circle.com/) under **Developer → Subscriptions**.
        </Tip>
      </Step>

      <Step title="Confirm the subscription">
        After you register the subscription, SNS sends a `POST` to your endpoint with
        `Type: SubscriptionConfirmation`. Because Circle publishes from two regions,
        your endpoint receives one confirmation message per region (`us-east-1` and
        `us-west-2`), each carrying its own `SubscribeURL`. Confirm **both**: open each
        `SubscribeURL` in your browser, or have your endpoint fetch it server-side, to
        finish the handshake.

        The endpoint isn't fully subscribed until both regional `SubscribeURL` values
        are confirmed. Each `subscriptionDetails[]` entry moves to `confirmed` as its
        own `SubscribeURL` is confirmed; confirm both to ensure uninterrupted event
        delivery.

        Example `SubscriptionConfirmation` payload (the `us-west-2` message; the
        `us-east-1` message has the same shape, with `us-east-1` in its `TopicArn` and
        `SubscribeURL`):

        ```json theme={null}
        {
          "Type": "SubscriptionConfirmation",
          "MessageId": "ddbdcdcf-d36a-45b5-927c-da25b9b009ae",
          "Token": "2336412f37fb687f5d51e6e2425f004aed7b7526d5fae41bc257a0d80532a6820258bf77eb25b90453b863450713a2a5a4250696d725a306ef39962b5b543752c9003e0841c0e61253fd6c517a94edebe44f36c5fe4ba131c8ea5f6f42a43f97f6e1865505e2f29f79a62f89e18f97e03a0dd5d982a7578c8d6e21154163f2d6aae523cff25557f9bc21b2503d413006",
          "TopicArn": "arn:aws:sns:us-west-2:908968368384:sandbox_platform-notifications-topic",
          "Message": "You have chosen to subscribe to the topic arn:aws:sns:us-west-2:908968368384:sandbox_platform-notifications-topic.\nTo confirm the subscription, visit the SubscribeURL included in this message.",
          "SubscribeURL": "https://sns.us-west-2.amazonaws.com/?Action=ConfirmSubscription&TopicArn=...",
          "Timestamp": "2026-04-11T20:50:16.324Z",
          "SignatureVersion": "1",
          "Signature": "...",
          "SigningCertURL": "https://sns.us-west-2.amazonaws.com/SimpleNotificationService-...pem"
        }
        ```
      </Step>

      <Step title="(Optional) Manage subscriptions">
        List active subscriptions with `GET /v1/notifications/subscriptions` and remove
        one with `DELETE /v1/notifications/subscriptions/{id}`. A subscription can be
        deleted only when every entry in `subscriptionDetails[]` is `confirmed`,
        `deleted`, or a mix of the two. A subscription with any `pending` entry cannot
        be deleted. Resolve the pending state first.

        | Environment | Active subscription cap | `pending` auto-removal |
        | - | - | - |
        | Sandbox | 3 | After 30 days |
        | Production | 1 | After 72 hours |
      </Step>
    </Steps>

    <Note>
      v1 traffic originates from Amazon SNS rather than Circle, so the IP range is
      the published [AWS SNS IP
      range](https://docs.aws.amazon.com/general/latest/gr/aws-ip-ranges.html) and
      not practical to allowlist narrowly. Rely on [signature
      verification](/api-reference/verify-webhook-signatures) to confirm
      authenticity.
    </Note>
  </Tab>
</Tabs>
