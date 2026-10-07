> ## Documentation Index
> Fetch the complete documentation index at: https://docs.dfns.co/llms.txt
> Use this file to discover all available pages before exploring further.

# Rate Limits

> How DFNS rate limits the API: what the limit is measured against, the response headers that report your usage, and where to find the request-per-minute quota for your plan.

export const SupportLink = ({children}) => {
  const url = "https://support.dfns.co";
  return <a href={url} target="_blank">{children || url}</a>;
};

DFNS caps how many API requests an organization can make per minute. This keeps the platform stable and usage fair across all organizations.

## How the limit is measured

* The limit applies **per organization**, across every application and service account it owns — not per API key or per endpoint.
* Requests are counted over a **60-second window**. Exceeding the limit returns [`429 Too Many Requests`](/api-reference/error-codes#429-too-many-requests) until the window resets.

Rate-limited responses carry headers describing your current usage:

| Header | Meaning |
| - | - |
| `X-RateLimit-Limit` | Your maximum requests per minute. |
| `X-RateLimit-Remaining` | Requests left in the current window. |
| `X-RateLimit-Reset` | Unix time (seconds) when the window resets. |
| `Retry-After` | On a `429`, the number of seconds to wait before retrying. |

Back off using `Retry-After` (or `X-RateLimit-Reset`) rather than retrying immediately. See [handling `429` responses](/api-reference/error-codes#429-too-many-requests) for the recommended retry strategy.

## Your quota

The request-per-minute limit depends on your plan. See [DFNS pricing](https://www.dfns.co/pricing) for the quota at each tier.

Need a higher limit? Contact our <SupportLink>Support Team</SupportLink>.


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.