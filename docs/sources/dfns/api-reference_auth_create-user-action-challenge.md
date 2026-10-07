> ## Documentation Index
> Fetch the complete documentation index at: https://docs.dfns.co/llms.txt
> Use this file to discover all available pages before exploring further.

# Create User Action Challenge

> Starts a user action signing session, returning a challenge that will be used to verify the user's intent to perform an action.
  
  This is the first step of the [User Action Signing flow](https://docs.dfns.co/api-reference/auth/signing-flows).



## OpenAPI

````yaml /openapi.yaml post /auth/action/init
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
  /auth/action/init:
    post:
      tags:
        - Auth
      summary: Create User Action Challenge
      description: >-
        Starts a user action signing session, returning a challenge that will be
        used to verify the user's intent to perform an action.
          
          This is the first step of the [User Action Signing flow](https://docs.dfns.co/api-reference/auth/signing-flows).
      operationId: createUserActionChallenge
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                userActionServerKind:
                  type: string
                  enum:
                    - Api
                  description: Optional indicator of which Dfns service being called.
                userActionHttpMethod:
                  type: string
                  enum:
                    - POST
                    - PUT
                    - DELETE
                    - GET
                  description: >-
                    The HTTP method that will be used to make the request that
                    is being signed.
                userActionHttpPath:
                  type: string
                  minLength: 1
                  description: The path of the request that is being signed.
                userActionPayload:
                  type: string
                  description: The JSON-encoded body of the request that is being signed.
              required:
                - userActionHttpMethod
                - userActionHttpPath
                - userActionPayload
              additionalProperties: false
              example:
                userActionPayload: >-
                  {"name": "My PAT","publicKey": "-----BEGIN PUBLIC
                  KEY-----\nMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEZQt0YI2hdsFNmKJesSkAHldyPLIV\nFLI/AhQ5eGasA7jU8tEXOb6nGvxRaTIXrgZ2NPdk78O8zMqz5u9AekH8jA==\n-----END
                  PUBLIC KEY-----","daysValid": 365,"permissionId":
                  "pm-delaw-avoca-v16r37fpp8koqebc"}
                userActionHttpMethod: POST
                userActionHttpPath: /auth/pats
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                type: object
                properties:
                  challenge:
                    type: string
                    description: >-
                      Challenge (string) to be signed by the requester with his
                      private key.
                  challengeIdentifier:
                    type: string
                    description: A JWT that identifies the signing session.
                  rp:
                    type: object
                    properties:
                      id:
                        type: string
                        description: >-
                          ID of the WebAuthn relying party (typically a domain
                          name).
                      name:
                        type: string
                        description: Human-readable name of the relying party.
                    required:
                      - id
                      - name
                    description: Deprecated. Should not be used.
                  supportedCredentialKinds:
                    type: array
                    items:
                      type: object
                      properties:
                        kind:
                          $ref: '#/components/schemas/CredentialKind'
                        factor:
                          type: string
                          enum:
                            - first
                            - second
                            - either
                          description: >-
                            Indicates if the credential can be used as a first
                            factor, second factor, or either; can be `first`,
                            `second`, or `either`.
                        requiresSecondFactor:
                          type: boolean
                          description: >-
                            When true indicates a second factor credential is
                            required if the credential is used as a first
                            factor.
                      required:
                        - kind
                        - factor
                        - requiresSecondFactor
                    description: >-
                      Identifies the kind of credentials that can be used to
                      sign the user action.
                  userVerification:
                    type: string
                    enum:
                      - required
                      - preferred
                      - discouraged
                    description: >
                      Value indicating if the user should be prompted for a
                      second factor. Can be one of the following values:

                      * required to indicate the user must be prompted for their
                      pin, biometrics, or another second factor option

                      * preferred to indicate the user should be prompted for a
                      second factor if it is supported

                      * discouraged to indicate the user should not be prompted
                      for their second factor unless the device requires it
                  attestation:
                    type: string
                    enum:
                      - none
                      - indirect
                      - direct
                      - enterprise
                    description: >
                      Identifies the information needed to verify the user's
                      signing certificate; can be one of the following:

                      * none: indicates no attestation data is required

                      * indirect: indicates the attestation data should be
                      given, but that it can be generated using an Anonymization
                      CA

                      * direct: indicates the attestation data must be given and
                      should be generated by the authenticator

                      * enterprise: indicates the attestation data should
                      include information to uniquely identify the user's device
                  allowCredentials:
                    type: object
                    properties:
                      key:
                        type: array
                        items:
                          type: object
                          properties:
                            type:
                              type: string
                              enum:
                                - public-key
                              description: Is always `public-key`.
                            id:
                              type: string
                              minLength: 1
                              maxLength: 64
                              pattern: ^cr-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
                              description: ID that identifies the credential.
                              example: cr-6uunn-bm6ja-f6rmod5kqrk5rbel
                          required:
                            - type
                            - id
                        description: >-
                          List of keys that the user can use to sign the user
                          action.
                      passwordProtectedKey:
                        type: array
                        items:
                          type: object
                          properties:
                            type:
                              type: string
                              enum:
                                - public-key
                              description: Is always `public-key`.
                            id:
                              type: string
                              minLength: 1
                              maxLength: 64
                              pattern: ^cr-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
                              description: ID that identifies the credential.
                              example: cr-6uunn-bm6ja-f6rmod5kqrk5rbel
                            encryptedPrivateKey:
                              type: string
                              description: >-
                                Encrypted Private Key. Only the user knows the
                                password to decrypt it and have access to the
                                private key.
                          required:
                            - type
                            - id
                            - encryptedPrivateKey
                        description: >-
                          List of password protected keys that the user can use
                          to sign the login challenge.
                      webauthn:
                        type: array
                        items:
                          type: object
                          properties:
                            type:
                              type: string
                              enum:
                                - public-key
                              description: Is always `public-key`.
                            id:
                              type: string
                              minLength: 1
                              maxLength: 64
                              pattern: ^cr-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{14,16}$
                              description: ID that identifies the credential.
                              example: cr-6uunn-bm6ja-f6rmod5kqrk5rbel
                          required:
                            - type
                            - id
                        description: >-
                          List of WebAuthn credentials that the user can use to
                          sign the user action.
                    required:
                      - key
                      - webauthn
                    description: >-
                      List of credentials that the user can use to sign the user
                      action.
                  externalAuthenticationUrl:
                    type: string
                    description: >-
                      Optional url containing a secret value that can be used to
                      enable cross device/origin signing.
                required:
                  - challenge
                  - challengeIdentifier
                  - supportedCredentialKinds
                  - userVerification
                  - attestation
                  - allowCredentials
                  - externalAuthenticationUrl
                example:
                  supportedCredentialKinds:
                    - kind: Fido2
                      factor: first
                      requiresSecondFactor: true
                  challenge: >-
                    MWM0MmY5YTQ0MDRiNzdhNTFhNzY5ODQwNWI5ZTQ4Y2RhODZiNDk3ZTYzOTE5OGYyMDcxZjBjYzk4MmQ5YzY1MA
                  challengeIdentifier: eyJ0e...fQNA
                  userVerification: required
                  attestation: direct
                  externalAuthenticationUrl: ''
                  allowCredentials:
                    key: []
                    passwordProtectedKey:
                      - type: public-key
                        id: hIjkx5PqVxz8wbtuvOh2UYHEY1QXS8mMfKeEDGt-0Fo=
                        encryptedPrivateKey: >-
                          LsXVskHYqqrKKxBC9KvqStLEmxak5Y7NaboDDlRSIW7evUJpQTT1AYvx0EsFskmriaVb3AjTCGEv7gqUKokml1USL7+dVmrUVhV+cNWtS5AorvRuZr1FMGVKFkW1pKJhFNH2e2O661UhpyXsRXzcmksA7ZN/V37ZK7ITue0gs6I=
                    webauthn:
                      - type: public-key
                        id: c1QEdgnPLJargwzy3cbYKny4Q18u0hr97unXsF3DiE8
      security:
        - authenticationToken: []
components:
  schemas:
    CredentialKind:
      type: string
      description: The kind of credential.
      enum:
        - Fido2
        - Key
        - RecoveryKey
        - PasswordProtectedKey
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