> ## Documentation Index
> Fetch the complete documentation index at: https://docs.dfns.co/llms.txt
> Use this file to discover all available pages before exploring further.

# Create Service Account

> Create a new Service Account for your organization.



## OpenAPI

````yaml /openapi.yaml post /auth/service-accounts
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
  /auth/service-accounts:
    post:
      tags:
        - Auth
      summary: Create Service Account
      description: Create a new Service Account for your organization.
      operationId: createServiceAccount
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                name:
                  type: string
                  minLength: 1
                  description: Human-readable name of the Service Account.
                publicKey:
                  type: string
                  pattern: >-
                    ^-----BEGIN (RSA )?PUBLIC
                    KEY-----[A-Za-z0-9+/=\n\r\\]+-----END (RSA )?PUBLIC
                    KEY-----\s?$
                permissionId:
                  type: string
                  minLength: 1
                  maxLength: 64
                  pattern: ^pm-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
                  description: >-
                    ID of the permission (also referred to as "role" in the
                    dashboard).
                  example: pm-37vj4-jkr4l-lc9945spfftkne57
                externalId:
                  type: string
                  description: >-
                    Value that can be used to correlate the entity with an
                    external system.
                daysValid:
                  type: integer
                  exclusiveMinimum: 0
                  description: Number of days the service account will be valid for.
              required:
                - name
                - publicKey
              additionalProperties: false
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                type: object
                properties:
                  userInfo:
                    type: object
                    properties:
                      username:
                        type: string
                        description: >-
                          Username/identifier of the user (any unique string
                          accepted, e.g. your internal user ID or email).
                      name:
                        type: string
                        description: Display name of the user.
                      userId:
                        type: string
                        minLength: 1
                        maxLength: 64
                        pattern: ^us-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
                        description: User id.
                        example: us-6b58p-r53sr-rlrd3l5cj3uc4ome
                      kind:
                        type: string
                        enum:
                          - CustomerEmployee
                          - EndUser
                        description: User kind.
                      credentialUuid:
                        type: string
                        description: UUID of the user's primary credential.
                      orgId:
                        type: string
                        minLength: 1
                        maxLength: 64
                        pattern: ^or-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
                        description: Organization id.
                        example: or-30tnh-itmjs-s235s5ontr3r23h2
                      tenantId:
                        type: string
                        minLength: 1
                        maxLength: 64
                        pattern: ^acct-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
                        description: Tenant id.
                        example: acct-24hka-dhili-9hgvdlvr1ohpibp4
                      permissions:
                        type: array
                        items:
                          type: string
                        description: >-
                          @deprecated - Flat list of API operations the user has
                          access to.
                      isActive:
                        type: boolean
                        description: Whether the user is active.
                      isServiceAccount:
                        type: boolean
                        description: Whether the user is a service account.
                      isRegistered:
                        type: boolean
                        description: Whether the user has completed registration.
                      permissionAssignments:
                        type: array
                        items:
                          type: object
                          properties:
                            permissionName:
                              type: string
                              description: Human-readable name of the permission (role).
                            permissionId:
                              type: string
                              minLength: 1
                              maxLength: 64
                              pattern: ^pm-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
                              description: >-
                                ID of the permission (also referred to as "role"
                                in the dashboard).
                              example: pm-37vj4-jkr4l-lc9945spfftkne57
                            assignmentId:
                              type: string
                              minLength: 1
                              maxLength: 64
                              pattern: ^as-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
                              description: ID of the permission assignment.
                              example: as-1vcmc-qrek0-6b4vii9pln60907e
                            operations:
                              type: array
                              items:
                                type: string
                              description: >-
                                List of API operations granted by this
                                permission.
                          required:
                            - permissionName
                            - permissionId
                            - assignmentId
                        description: Permissions (roles) assigned to the user.
                    required:
                      - username
                      - name
                      - userId
                      - kind
                      - credentialUuid
                      - isActive
                      - isServiceAccount
                      - isRegistered
                      - permissionAssignments
                  accessTokens:
                    type: array
                    items:
                      $ref: '#/components/schemas/PersonalAccessToken'
                required:
                  - userInfo
                  - accessTokens
      security:
        - authenticationToken: []
          userActionSignature: []
components:
  schemas:
    PersonalAccessToken:
      type: object
      properties:
        accessToken:
          type: string
          description: The access token. Only returned at creation time.
        dateCreated:
          type: string
          format: date-time
          description: >-
            [ISO 8601](https://en.wikipedia.org/wiki/ISO_8601) date (must be
            UTC). Date the access token was created.
          example: '2023-04-14T20:41:28.715Z'
        credId:
          type: string
          description: ID of the credential associated with the access token.
        isActive:
          type: boolean
          description: Whether the access token is active.
        kind:
          type: string
          enum:
            - Pat
            - ServiceAccount
            - Token
            - Code
            - Recovery
            - Temp
            - Application
          description: Access token kind.
        linkedUserId:
          type: string
          minLength: 1
          maxLength: 64
          pattern: ^us-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
          description: User id.
          example: us-6b58p-r53sr-rlrd3l5cj3uc4ome
        linkedAppId:
          type: string
          minLength: 1
          maxLength: 64
          pattern: ^ap-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
          description: ID of the application the access token is linked to.
          example: ap-2a9in-tt2a1-983lho480p35ejd0
        name:
          type: string
          description: Human-readable name of the access token.
        orgId:
          type: string
          minLength: 1
          maxLength: 64
          pattern: ^or-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
          description: Organization id.
          example: or-30tnh-itmjs-s235s5ontr3r23h2
        permissionAssignments:
          type: array
          items:
            type: object
            properties:
              permissionName:
                type: string
                description: Human-readable name of the permission (role).
              permissionId:
                type: string
                minLength: 1
                maxLength: 64
                pattern: ^pm-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
                description: >-
                  ID of the permission (also referred to as "role" in the
                  dashboard).
                example: pm-37vj4-jkr4l-lc9945spfftkne57
              assignmentId:
                type: string
                minLength: 1
                maxLength: 64
                pattern: ^as-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
                description: ID of the permission assignment.
                example: as-1vcmc-qrek0-6b4vii9pln60907e
              operations:
                type: array
                items:
                  type: string
                description: List of API operations granted by this permission.
            required:
              - permissionName
              - permissionId
              - assignmentId
          description: Permissions (roles) assigned to the access token.
        publicKey:
          type: string
          description: Public key associated with the access token.
        tokenId:
          type: string
          minLength: 1
          maxLength: 64
          pattern: ^to-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
          description: Token id.
          example: to-202a0-cdo33-o65mbt6q758lvvnt
      required:
        - dateCreated
        - credId
        - isActive
        - kind
        - linkedUserId
        - linkedAppId
        - name
        - orgId
        - permissionAssignments
        - publicKey
        - tokenId
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