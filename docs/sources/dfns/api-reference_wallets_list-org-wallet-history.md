> ## Documentation Index
> Fetch the complete documentation index at: https://docs.dfns.co/llms.txt
> Use this file to discover all available pages before exploring further.

# List Org Wallet History

> Retrieve the transaction history across all wallets within a specified timeframe. The time range is unbounded, but the CSV export is capped at 100,000 rows.



## OpenAPI

````yaml /openapi.yaml get /wallets/all/history
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
  /wallets/all/history:
    get:
      tags:
        - Wallets
      summary: List Org Wallet History
      description: >-
        Retrieve the transaction history across all wallets within a specified
        timeframe. The time range is unbounded, but the CSV export is capped at
        100,000 rows.
      operationId: listOrgWalletHistory
      parameters:
        - schema:
            type: integer
            minimum: 1
            maximum: 500
            default: 50
            description: Maximum number of items to return.
          required: false
          description: Maximum number of items to return.
          name: limit
          in: query
        - schema:
            type: string
            minLength: 1
            description: >-
              Opaque token used to retrieve the next page. Returned as
              `nextPageToken` from the previous request.
          required: false
          description: >-
            Opaque token used to retrieve the next page. Returned as
            `nextPageToken` from the previous request.
          name: paginationToken
          in: query
        - schema:
            type: string
            format: date-time
            description: >-
              [ISO 8601](https://en.wikipedia.org/wiki/ISO_8601) date (must be
              UTC). Start of the time range to query.
          required: true
          description: >-
            [ISO 8601](https://en.wikipedia.org/wiki/ISO_8601) date (must be
            UTC). Start of the time range to query.
          name: startTime
          in: query
        - schema:
            type: string
            format: date-time
            description: >-
              [ISO 8601](https://en.wikipedia.org/wiki/ISO_8601) date (must be
              UTC). End of the time range to query.
          required: true
          description: >-
            [ISO 8601](https://en.wikipedia.org/wiki/ISO_8601) date (must be
            UTC). End of the time range to query.
          name: endTime
          in: query
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                anyOf:
                  - type: object
                    properties:
                      orgId:
                        type: string
                      items:
                        type: array
                        items:
                          type: object
                          properties:
                            timestamp:
                              type: string
                            walletId:
                              type: string
                            network:
                              type: string
                            direction:
                              type: string
                            from:
                              type: string
                            to:
                              type: string
                            amount:
                              type: string
                            tokenId:
                              type: string
                            asset:
                              type: string
                            symbol:
                              type: string
                            decimals:
                              type: string
                            fee:
                              type: string
                            feeSymbol:
                              type: string
                            feeDecimals:
                              type: string
                            txHash:
                              type: string
                            verified:
                              type: boolean
                            usdAmount:
                              type: string
                          required:
                            - timestamp
                            - walletId
                            - network
                            - direction
                            - txHash
                      nextPageToken:
                        type: string
                    required:
                      - orgId
                      - items
                  - type: string
      security:
        - authenticationToken: []
components:
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