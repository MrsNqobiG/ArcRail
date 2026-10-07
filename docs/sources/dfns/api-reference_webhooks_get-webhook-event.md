> ## Documentation Index
> Fetch the complete documentation index at: https://docs.dfns.co/llms.txt
> Use this file to discover all available pages before exploring further.

# Get Webhook Event

> Retrieve a specific webhook event details by its ID.
  
<Warning>
We only keep a trace of those Webhook Events in our system for a **retention period of 31 days**. Past that, they are discarded, so you cannot see them using [List Webhook Events](https://docs.dfns.co/api-reference/webhooks/list-webhook-events) or [Get Webhook Event](https://docs.dfns.co/api-reference/webhooks/get-webhook-event) endpoints.
</Warning>



## OpenAPI

````yaml /openapi.yaml get /webhooks/{webhookId}/events/{webhookEventId}
openapi: 3.1.0
info:
  version: 2.0.155
  title: Dfns
servers:
  - url: https://api.dfns.io
    description: Default - Europe
  - url: https://api.uae.dfns.io
    description: UAE
  - url: https://api.dfns.ninja
    description: <Deprecated> Staging
security: []
paths:
  /webhooks/{webhookId}/events/{webhookEventId}:
    get:
      tags:
        - Webhooks
      summary: Get Webhook Event
      description: >-
        Retrieve a specific webhook event details by its ID.
          
        <Warning>

        We only keep a trace of those Webhook Events in our system for a
        **retention period of 31 days**. Past that, they are discarded, so you
        cannot see them using [List Webhook
        Events](https://docs.dfns.co/api-reference/webhooks/list-webhook-events)
        or [Get Webhook
        Event](https://docs.dfns.co/api-reference/webhooks/get-webhook-event)
        endpoints.

        </Warning>
      operationId: getWebhookEvent
      parameters:
        - schema:
            type: string
            minLength: 1
            maxLength: 64
            pattern: ^wh-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
          required: true
          name: webhookId
          in: path
        - schema:
            type: string
            minLength: 1
            maxLength: 64
            pattern: ^whe-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
          required: true
          name: webhookEventId
          in: path
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/WebhookEvent'
      security:
        - authenticationToken: []
components:
  schemas:
    WebhookEvent:
      type: object
      properties:
        id:
          type: string
          description: WebhookEvent ID
        date:
          type: string
          description: ISO date string when event was raised
        kind:
          type: string
          enum:
            - policy.triggered
            - policy.approval.pending
            - policy.approval.resolved
            - key.created
            - key.deleted
            - key.delegated
            - key.exported
            - wallet.blockchainevent.detected
            - wallet.blockchain_event.transfer.included
            - wallet.blockchain_event.misc.confirmed
            - wallet.created
            - wallet.activated
            - wallet.delegated
            - wallet.exported
            - wallet.signature.failed
            - wallet.signature.rejected
            - wallet.signature.requested
            - wallet.signature.signed
            - wallet.transaction.broadcasted
            - wallet.transaction.confirmed
            - wallet.transaction.failed
            - wallet.transaction.rejected
            - wallet.transaction.requested
            - wallet.transfer.broadcasted
            - wallet.transfer.confirmed
            - wallet.transfer.failed
            - wallet.transfer.rejected
            - wallet.transfer.requested
            - wallet.offer.received
            - wallet.offer.accepted
            - wallet.offer.rejected
            - wallet.offer.withdrawn
            - wallet.tags.modified
            - vault.created
            - vault.updated
            - vault.tags.modified
            - vault.event.created
            - address_watch.blockchain_event.transfer.confirmed
            - address_watch.blockchain_event.misc.confirmed
            - payout.action.required
          description: Webhook event
        data:
          type: object
          additionalProperties: {}
        status:
          type: string
          description: Status code of the webhook request
        error:
          type: string
          description: Error message if any error happened during the webhook request.
        timestampSent:
          type: integer
          exclusiveMinimum: 0
          description: >-
            Unix timestamp when the event was forwarded to the webhook url by
            our servers.
      required:
        - id
        - date
        - kind
        - data
        - status
        - timestampSent
  securitySchemes:
    authenticationToken:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: >-
        **Bearer Token:** Used to authenticate API requests.

        More details how to generate the token: [Authentication
        flows](https://docs.dfns.co/api-reference/auth/login-flows)

````

This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.