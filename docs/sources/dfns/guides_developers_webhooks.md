> ## Documentation Index
> Fetch the complete documentation index at: https://docs.dfns.co/llms.txt
> Use this file to discover all available pages before exploring further.

# Set up webhooks

> Listen for DFNS events, verify webhook signatures with HMAC-SHA256, and manage webhook subscriptions to react to wallet and transfer activity.

export const Youtube = props => {
  return <iframe className="w-full aspect-video rounded-xl" src={`https://www.youtube.com/embed/${props.videoId}`} title="YouTube video player" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen>
      </iframe>;
};

<Youtube videoId="3WEDWRkmDAQ" />

When integrating with DFNS, you might want your applications to receive events as they occur in your DFNS account, so that your backend systems can execute actions accordingly.

To start being notified about Webhook Events, you first need to register webhooks. After you register them, DFNS can push real-time event data to your application’s webhook endpoint when events happen in your DFNS account. DFNS uses a POST HTTP request to send webhook events to your app, as a JSON payload which includes a [Webhook Event Object](/api-reference/webhook-events).

Receiving webhook events are particularly useful for listening to asynchronous events, such as doing a wallet transfer request.

More details about Webhook configuration can be found in the [API Reference](/api-reference/webhooks).

## Webhooks best practices

Review these best practices to make sure your Webhooks remain secure and work properly.

### Respond quickly with a 200

The webhook event handler defined on your server, when it receives a new event from DFNS, should be quick to handle it, and return quickly a `200` status code to indicate that the event was indeed delivered. If your handler expects to do some processing taking longer than a few seconds, you should consider adding this to a queue for processing on your side. Otherwise the request delivering the event might timeout.

Also, your handler should catch any error that happens on your side, so it still respond with a `200` response to DFNS, indicating that you received it already, otherwise the same event might be retried a few times and fail all the same.

### Verify events are sent from DFNS

Verify webhook signatures to confirm that received events are sent from DFNS. DFNS signs webhook events it sends to your endpoints by including a signature in each event’s `X-DFNS-WEBHOOK-SIGNATURE` header. This allows you to verify that the events were sent by DFNS, not by a third party.

<Note>
  The webhook secret is returned **only once**, in the response to [Create Webhook](/api-reference/webhooks/create-webhook). Get and List webhook responses do not include it. Store it securely when you create the webhook; to roll it, create a new webhook and delete the old one.
</Note>

DFNS signatures is a [HMAC](https://en.wikipedia.org/wiki/Hash-based_message_authentication_code) of the received event payload, using [SHA-256](https://en.wikipedia.org/wiki/SHA-2) hash function and the webhook secret as the secret. It has this shape:

```
X-DFNS-WEBHOOK-SIGNATURE: sha256=33008aa9673b764cc752362034dfe49ef466315c45d62b3e8cb8588b23d0d06a
```

Here is an example function showing how you can validate the webhook event signature:

<CodeGroup>
  ```javascript Node.js theme={null}
  const crypto = require('crypto')

  const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET // the webhook secret you got upon webhook creation
  const REPLAY_ATTACK_TOLERANCE = 5 * 60 // 5 minutes

  function verifyDfnsWebhookSignature(eventPayload, eventSignature) {
    const messageToSign = JSON.stringify(eventPayload) // this assumes "eventPayload" was already JSON-parsed, and is an object (the full payload of the webhook event)

    const signature = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(messageToSign)
      .digest('hex')

    const trustedSig = Buffer.from(`sha256=${signature}`, 'ascii')
    const untrustedSig = Buffer.from(eventSignature, 'ascii')

    const isSignatureValid = crypto.timingSafeEqual(trustedSig, untrustedSig) // using a constant-time equality comparison (to avoid timing attacks)

    const now = new Date().getTime() / 1000 // your server unix timestamp
    const isTimestampWithinTolerance = Math.abs(now - eventPayload.timestampSent) < REPLAY_ATTACK_TOLERANCE

    return isSignatureValid && isTimestampWithinTolerance
  }
  ```

  ```python Python theme={null}
  import os
  import json
  import hmac
  import hashlib
  import time

  WEBHOOK_SECRET = os.environ["WEBHOOK_SECRET"]  # the webhook secret you got upon webhook creation
  REPLAY_ATTACK_TOLERANCE = 5 * 60  # 5 minutes

  def verify_dfns_webhook_signature(event_payload: dict, event_signature: str) -> bool:
      # event_payload should be the parsed JSON object
      message_to_sign = json.dumps(event_payload, separators=(',', ':'))

      expected_signature = "sha256=" + hmac.new(
          WEBHOOK_SECRET.encode(),
          message_to_sign.encode(),
          hashlib.sha256
      ).hexdigest()

      # Use constant-time comparison to avoid timing attacks
      is_signature_valid = hmac.compare_digest(expected_signature, event_signature)

      now = time.time()
      is_timestamp_valid = abs(now - event_payload["timestampSent"]) < REPLAY_ATTACK_TOLERANCE

      return is_signature_valid and is_timestamp_valid
  ```
</CodeGroup>

### Only listen to event types your integration requires

Configure your webhook endpoints to receive only the types of events required by your integration. Listening for extra events (or all events) puts undue strain on the server and we don’t recommend it.

### Handle duplicate events

<Note>
  Webhook endpoints might occasionally receive the same event more than once
</Note>

We don't guarantee webhook event uniqueness. You should guard against duplicate events by making sure your event processing is idempotent.

### Receive events with an HTTPS server

If you use an HTTPS URL for your webhook, we validate that the connection to your server is secure before sending your webhook data. For this to work, your server must be correctly configured to support HTTPS with a valid server certificate.

### Exempt webhook route from CSRF protection

If you're using Rails, Django, or another web framework, your site might automatically check that every POST request contains a *CSRF token*. This is an important security feature that helps protect you and your users from [cross-site request forgery](https://owasp.org/www-community/attacks/csrf) attempts. However, this security measure might also prevent your site from processing legitimate events. If so, you might need to exempt the webhooks route from CSRF protection.

<CodeGroup>
  ```ruby Rails theme={null}
  class DfnsController < ApplicationController
    # If your controller accepts requests other than webhooks,
    # you'll probably want to use `protect_from_forgery` to add CSRF
    # protection for your application. But don't forget to exempt
    # your webhook route!
    protect_from_forgery except: :webhook

    def webhook
      # Process webhook data in `params`
    end
  end
  ```

  ```python Django theme={null}
  import json

  # Webhooks are always sent as HTTP POST requests, so ensure
  # that only POST requests reach your webhook view by
  # decorating `webhook()` with `require_POST`.
  #
  # To ensure that the webhook view can receive webhooks,
  # also decorate `webhook()` with `csrf_exempt`.
  @require_POST
  @csrf_exempt
  def webhook(request):
    # Process webhook data in `request.body`
  ```
</CodeGroup>

## Local Development

To add a new webhook, you first need a http server which can receive requests from public internet.

During development, one way to achieve this (without deploying a new server on a cloud provider), is to spin up a local server on your machine (localhost), and then use a tunnel services (eg [https://ngrok.com](https://ngrok.com/)) to create a public url pointing to your local server.

As an example, here are steps to create a basic Express server in **NodeJS:**

* Create a new npm project, install express

```
mkdir basic-server && cd basic-server
npm init
npm install express
```

* Add a new file `index.js` :

```javascript theme={null}
const express = require('express')

const app = express()
const port = 3000

app.use(express.json())

app.post('/', (req) => {
  console.log('Received event:', req.body)
})

app.listen(port, () => {
  console.log(`Listening on port ${port}`)
})
```

* In one terminal, run your server

```
node index.js
```

* In another terminal, start a [ngrok](https://ngrok.com/docs/getting-started/) tunnel pointing to your local server

```
ngrok http 3000
```

* Now, you can [Create a Webhook](/api-reference/webhooks/create-webhook) using the url displayed in the result of above the terminal (looking like "`https://xxxxxx.ngrok-free.dev`"), and test that the webhook is setup properly by using [Ping Webhook](/api-reference/webhooks/ping-webhook). If properly setup, you should see incoming events received by your local server.

<Note>
  If you use a free Ngrok account, every time you re-launch the tunnel you'll get a new url, so make sure you update the DFNS webhook url to test.
</Note>


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.