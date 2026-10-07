> ## Documentation Index
> Fetch the complete documentation index at: https://docs.dfns.co/llms.txt
> Use this file to discover all available pages before exploring further.

# Create Webhook

> Register a new webhook.



## OpenAPI

````yaml /openapi.yaml post /webhooks
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
  /webhooks:
    post:
      tags:
        - Webhooks
      summary: Create Webhook
      description: Register a new webhook.
      operationId: createWebhook
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                url:
                  type: string
                  description: Webhook url
                status:
                  type: string
                  enum:
                    - Enabled
                    - Disabled
                  description: Webhook status
                description:
                  type: string
                  maxLength: 256
                events:
                  type: array
                  items:
                    anyOf:
                      - type: string
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
                        description: WebhookEventKind
                      - type: string
                        enum:
                          - '*'
                    description: WebhookEventKind
                  minItems: 1
                  description: All events this webhook is subscribed to.
              required:
                - url
                - events
              additionalProperties: false
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/WebhookWithSecret'
      security:
        - authenticationToken: []
          userActionSignature: []
components:
  schemas:
    WebhookWithSecret:
      type: object
      properties:
        id:
          type: string
          description: Webhook ID
        url:
          type: string
          description: Webhook url
        events:
          type: array
          items:
            anyOf:
              - type: string
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
                description: WebhookEventKind
              - type: string
                enum:
                  - '*'
            description: WebhookEventKind
          description: All events this webhook is subscribed to.
        status:
          type: string
          enum:
            - Enabled
            - Disabled
          description: Webhook status
        description:
          type: string
          description: Short description this webhook's purpose
        dateCreated:
          type: string
          description: Date when webhook was created
        dateUpdated:
          type: string
          description: Date when webhook was last updated
        secret:
          type: string
          description: >-
            The secret associated with this webhook, with which webhook requests
            will be signed.
      required:
        - id
        - url
        - events
        - status
        - dateCreated
        - dateUpdated
        - secret
  securitySchemes:
    authenticationToken:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: >-
        **Bearer Token:** Used to authenticate API requests.

        More details how to generate the token: [Authentication
        flows](https://docs.dfns.co/api-reference/auth/login-flows)
    userActionSignature:
      type: apiKey
      in: header
      name: X-DFNS-USERACTION
      description: >-
        **User Action Signature:** Used to sign the change-inducing API
        requests.

        More details how to generate the token: [User Action Signing
        flows](https://docs.dfns.co/api-reference/auth/signing-flows)

````

This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.