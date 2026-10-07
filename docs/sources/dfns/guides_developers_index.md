> ## Documentation Index
> Fetch the complete documentation index at: https://docs.dfns.co/llms.txt
> Use this file to discover all available pages before exploring further.

# Start building with DFNS

> Your first steps to integrating with the DFNS API, focused on our unique two-token authentication model, request signing, and core wallet flows.

DFNS uses a two-token system for sensitive operations: an **`Authentication Token`** that authenticates your application, and a **`User Action Signature`** that proves end-user consent.

## Token 1: The login token

The `Authentication Token` is like your API key, proving that requests are coming from a legitimate source. You must include this token in the `Authorization` header for every API call.

### How to get it

Follow one of the [authentication flows](/api-reference/auth/login-flows). The easiest way: create a service account and use it in your backend to call our API.

This token answers the question: "**Is my application allowed to talk to DFNS?**"

<Info>
  For a step-by-step guide on creating credentials and generating your first token, see the [DFNS API using a service account](/introduction/quickstart/6-non-custody-1-2-dfns-api-using-a-service-account) tutorial.
</Info>

## Token 2: The User Action Signature

For sensitive operations like creating a key, initiating a transaction, or registering a wallet, you need a second token. The `User Action Signature` is a signed challenge that proves a user with a registered passkey has explicitly approved the action.

This token is sent in the `X-DFNS-USERACTION` header and is required for most `POST`, `PUT`, and `DELETE` requests.

Think of it like a bank transaction:

* The **`Authentication Token`** is the bank teller's ID, allowing them to access the banking system.
* The **`User Action Signature`** is the customer's signed withdrawal slip, authorizing a specific transaction.

The teller needs both to release the funds. Similarly, DFNS requires both tokens to ensure that a request is not only from a trusted application but is also explicitly authorized by the asset owner.

This token answers the question: "**Did the user consent to this specific action?**"

<Info>
  To learn how to generate and use this signature, see the detailed **[User Action Signature Guide](/guides/developers/signing-requests)**.
</Info>

## Next steps

### Recommended guides

<CardGroup>
  <Card title="Credentials" href="/api-reference/auth/credentials">
    Learn how to register users and their passkeys with DFNS.
  </Card>

  <Card title="Delegated wallets" href="/guides/developers/delegated-wallets">
    Implement delegated wallets for your end users.
  </Card>

  <Card title="Sign requests" href="/guides/developers/signing-requests">
    Generate User Action Signature.
  </Card>

  <Card title="Set up webhooks" href="/guides/developers/webhooks">
    Set up webhooks to receive real-time updates on your operations.
  </Card>
</CardGroup>

### Essential References

<CardGroup>
  <Card title="API Reference" href="/api-reference">
    Explore every endpoint, parameter, and schema in the DFNS API.
  </Card>

  <Card title="SDKs" href="/sdks">
    Get started quickly with our TypeScript, Go, and Java SDKs.
  </Card>
</CardGroup>


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.