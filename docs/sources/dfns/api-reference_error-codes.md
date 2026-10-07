> ## Documentation Index
> Fetch the complete documentation index at: https://docs.dfns.co/llms.txt
> Use this file to discover all available pages before exploring further.

# API Errors

> Reference for HTTP status codes and error responses returned by the DFNS API, including authentication, validation, and policy approval errors.

export const SupportLink = ({children}) => {
  const url = "https://support.dfns.co";
  return <a href={url} target="_blank">{children || url}</a>;
};

Below is the error structure returned by DFNS API.

| Field | Description | Type |
| - | - | - |
| `id` | The error ID. You can share this with DFNS support to help troubleshoot your issue. | String |
| `status` | [HTTP status code](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status). | Integer |
| `message` | The error message. | String |
| `details` | Structured data that provides additional error context. | Object |

### Example

```json theme={null}
{
  "error": {
    "id": "2038837570328299032",
    "status": 404,
    "message": "wallet not found",
    "details": {
      "walletId": "wa-1f04s-lqc9q-xxxxxxxxxxxxxxxx",
      "orgId": "or-195qp-opddr-xxxxxxxxxxxxxxxx"
    }
  }
}
```

## Common errors

### 400 Bad Request

The request body or parameters are invalid.

**Common causes:**

* Missing required fields
* Invalid field values or types (e.g., wrong address format, unsupported network)
* Malformed JSON body

Check the `message` and `details` fields for specifics on which parameter failed validation.

### 401 Unauthorized

Your `Authorization` header is missing, malformed, or the token is invalid/expired.

**Solutions:**

* Verify the token is included as `Authorization: Bearer <token>`
* Check the token hasn't expired — decode it at [jwt.io](https://jwt.io) and check the `exp` field
* Ensure you're using the correct [region](/api-reference/regions) (`api.dfns.io` vs `api.uae.dfns.io`)

### 402 Payment Required

The requested feature is not available on your current plan.

**Solutions:**

* Contact your account manager or our <SupportLink>Support Team</SupportLink> to upgrade your plan

### 403 Forbidden

You're calling a state-changing endpoint (POST, PUT, DELETE) without the required `X-DFNS-USERACTION` header, or the user lacks permission.

**Solutions:**

* Follow the [User Action Signing flow](/api-reference/auth/signing-flows) to get the signature
* If using Postman, ensure the pre-request script is running — see [Postman setup](/api-reference/openapi-postman)
* If using the SDK, ensure you've configured a signer — see [SDKs](/sdks)
* Check the user has the required [permissions](/core-concepts/roles-and-permissions)

<Tip>
  GET requests don't require the `X-DFNS-USERACTION` header. If you're getting this error on a GET request, check your permissions.
</Tip>

### 404 Not Found

The requested resource doesn't exist.

**Common causes:**

* Incorrect wallet, user, or policy ID
* Resource was deleted
* Resource belongs to a different organization

### 409 Conflict

A resource with the same unique constraint already exists.

**Common causes:**

* Reusing an `externalId` with a different request body or wallet — see [idempotency](/api-reference/idempotency)
* Assigning a [permission](/core-concepts/roles-and-permissions) that is already assigned to the user

**Solutions:**

* For idempotency conflicts: use a unique `externalId` for each distinct request. Retrying the exact same request (same body, same wallet) with the same `externalId` returns the original response with status 200.
* Check the `details` field in the error response to identify the existing entity

### 410 Gone

The resource was permanently deleted and can no longer be accessed.

### 412 Precondition Failed

A business logic precondition was not met. For example, the resource is in a state that doesn't allow the requested operation.

### 422 Unprocessable Content

The request is well-formed but cannot be processed because the target resource is in an invalid state (e.g., archived or deactivated).

### 429 Too Many Requests

You've exceeded the API [rate limits](/api-reference/rate-limits).

**Solutions:**

* Implement exponential backoff and retry logic
* Reduce the frequency of API calls
* Contact our <SupportLink>Support Team</SupportLink> if you need higher limits

### 500 Internal Server Error

An unexpected error occurred on the server.

**Solutions:**

* Retry the request after a short delay
* If the error persists, contact our <SupportLink>Support Team</SupportLink> with the error `id` from the response

## Policy pending (202)

Not an error — this response means your request was accepted but a [policy](/core-concepts/policies) requires approval before it can be completed. The DFNS SDKs surface this as a `PolicyPendingError`.

Check the [approval process](/core-concepts/policies#approval-process) for how to approve pending requests.


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.