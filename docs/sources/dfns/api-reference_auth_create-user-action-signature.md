> ## Documentation Index
> Fetch the complete documentation index at: https://docs.dfns.co/llms.txt
> Use this file to discover all available pages before exploring further.

# Create User Action Signature

> Completes the user action signing process and provides a signing token that can be used to verify the user intended to perform the action.

This is the first step of the [User Action Signing flow](https://docs.dfns.co/api-reference/auth/signing-flows).

The type of credentials used to sign the action is determined by the `kind` field in the nested objects (`firstFactor` and `secondFactor`). Supported credential kinds are:
* `Fido2`: User action is signed by a user's signing device using `WebAuthn`.
* `Key`: User action is signed by a user's, or token's, private key.
* `PasswordProtectedKey`: Login challenge is signed by the decrypted user's private key that was sent during [Create User Action Signature Challenge](https://docs.dfns.co/api-reference/auth/create-user-action-challenge) step.




## OpenAPI

````yaml /openapi.yaml post /auth/action
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
  /auth/action:
    post:
      tags:
        - Auth
      summary: Create User Action Signature
      description: >
        Completes the user action signing process and provides a signing token
        that can be used to verify the user intended to perform the action.


        This is the first step of the [User Action Signing
        flow](https://docs.dfns.co/api-reference/auth/signing-flows).


        The type of credentials used to sign the action is determined by the
        `kind` field in the nested objects (`firstFactor` and `secondFactor`).
        Supported credential kinds are:

        * `Fido2`: User action is signed by a user's signing device using
        `WebAuthn`.

        * `Key`: User action is signed by a user's, or token's, private key.

        * `PasswordProtectedKey`: Login challenge is signed by the decrypted
        user's private key that was sent during [Create User Action Signature
        Challenge](https://docs.dfns.co/api-reference/auth/create-user-action-challenge)
        step.
      operationId: createUserActionSignature
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                challengeIdentifier:
                  type: string
                  description: >-
                    Temporary authentication token returned by the Create
                    Challenge endpoint.
                firstFactor:
                  $ref: '#/components/schemas/FirstFactorAssertion'
                secondFactor:
                  $ref: '#/components/schemas/SecondFactorAssertion'
              required:
                - challengeIdentifier
                - firstFactor
              additionalProperties: false
            examples:
              Fido2 Passkey credential:
                value:
                  challengeIdentifier: eyJ0e...fQNA
                  firstFactor:
                    kind: Fido2
                    credentialAssertion:
                      credId: c1QEdgnPLJargwzy3cbYKny4Q18u0hr97unXsF3DiE8
                      clientData: >-
                        eyJ0eXBlIjoid2ViYXV0aG4uZ2V0IiwiY2hhbGxlbmdlIjoiTVdNME1tWTVZVFEwTURSaU56ZGhOVEZoTnpZNU9EUXdOV0k1WlRRNFkyUmhPRFppTkRrM1pUWXpPVEU1T0dZeU1EY3haakJqWXprNE1tUTVZelkxTUEiLCJvcmlnaW4iOiJodHRwczovL2FwcC5kZm5zLm5pbmphIiwiY3Jvc3NPcmlnaW4iOmZhbHNlfQ
                      authenticatorData: WT-zFZUBbJHfBkmhzTlPf49LTn7asLeTQKhm_riCvFgFAAAAAA
                      signature: >-
                        MEUCIQDJ8G9J1NTjdoKx0yloYw45bpn6fJhcqCoUGiZuOU1IAQIgAtPt7S8FHFYW9OMHh3S5FVAxk-lhli-2lX22bBNSDog
                      userHandle: dXMtMmJhMGgtbHZwMnEtOHYxODYwcGNqMWJoNWlyaQ
              Key Credential:
                value:
                  challengeIdentifier: eyJ0e...fQNA
                  firstFactor:
                    kind: Key
                    credentialAssertion:
                      credId: 6Ca6tAOFTx2odyJBnCoRO-gPvfpfy0EOoOcEaxfxIOk
                      clientData: >-
                        eyJ0eXBlIjoia2V5LmdldCIsImNoYWxsZW5nZSI6Ik1XTTBNbVk1WVRRME1EUmlOemRoTlRGaE56WTVPRFF3TldJNVpUUTRZMlJoT0RaaU5EazNaVFl6T1RFNU9HWXlNRGN4WmpCall6azRNbVE1WXpZMU1BIiwib3JpZ2luIjoiaHR0cHM6Ly9hcHAuZGZucy5uaW5qYSIsImNyb3NzT3JpZ2luIjpmYWxzZX0
                      signature: >-
                        owt8WtpJT_6eEuw4UwdIX2HMMwENgk0SrI-RoCMPhx_9YMVpNKJGmJfHUusf_R1Mor9a_hinQVuXj4_XRdeJFSY2AySXSUk
              Password-protected Key Credential:
                value:
                  challengeIdentifier: eyJ0e...fQNA
                  firstFactor:
                    kind: PasswordProtectedKey
                    credentialAssertion:
                      credId: 6Ca6tAOFTx2odyJBnCoRO-gPvfpfy0EOoOcEaxfxIOk
                      clientData: >-
                        eyJ0eXBlIjoia2V5LmdldCIsImNoYWxsZW5nZSI6Ik1XTTBNbVk1WVRRME1EUmlOemRoTlRGaE56WTVPRFF3TldJNVpUUTRZMlJoT0RaaU5EazNaVFl6T1RFNU9HWXlNRGN4WmpCall6azRNbVE1WXpZMU1BIiwib3JpZ2luIjoiaHR0cHM6Ly9hcHAuZGZucy5uaW5qYSIsImNyb3NzT3JpZ2luIjpmYWxzZX0
                      signature: >-
                        owt8WtpJT_6eEuw4UwdIX2HMMwENgk0SrI-RoCMPhx_9YMVpNKJGmJfHUusf_R1Mor9a_hinQVuXj4_XRdeJFSY2AySXSUk
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                type: object
                properties:
                  userAction:
                    type: string
                    description: >-
                      Signing token to use to verify the user intended to
                      perform the action.
                required:
                  - userAction
                example:
                  userAction: eyJ0eX...bzrQakA
      security:
        - authenticationToken: []
components:
  schemas:
    FirstFactorAssertion:
      oneOf:
        - $ref: '#/components/schemas/Fido2Assertion'
        - $ref: '#/components/schemas/KeyAssertion'
        - $ref: '#/components/schemas/PasswordProtectedKeyAssertion'
        - $ref: '#/components/schemas/PasswordAssertion'
      discriminator:
        propertyName: kind
        mapping:
          Fido2: '#/components/schemas/Fido2Assertion'
          Key: '#/components/schemas/KeyAssertion'
          PasswordProtectedKey: '#/components/schemas/PasswordProtectedKeyAssertion'
          Password: '#/components/schemas/PasswordAssertion'
      description: First factor credential used to sign the challenge.
    SecondFactorAssertion:
      oneOf:
        - $ref: '#/components/schemas/Fido2Assertion'
        - $ref: '#/components/schemas/KeyAssertion'
        - $ref: '#/components/schemas/PasswordProtectedKeyAssertion'
        - $ref: '#/components/schemas/TotpAssertion'
      discriminator:
        propertyName: kind
        mapping:
          Fido2: '#/components/schemas/Fido2Assertion'
          Key: '#/components/schemas/KeyAssertion'
          PasswordProtectedKey: '#/components/schemas/PasswordProtectedKeyAssertion'
          Totp: '#/components/schemas/TotpAssertion'
      description: Second factor credential used to authenticate a user.
    Fido2Assertion:
      type: object
      properties:
        kind:
          type: string
          enum:
            - Fido2
        credentialAssertion:
          type: object
          properties:
            credId:
              type: string
              minLength: 1
              description: >-
                Base64url-encoded id of the credential returned by the user's
                WebAuthn client.
            clientData:
              type: string
              minLength: 1
              description: >-
                Base64url-encoded, stringified JSON [client
                data](https://docs.dfns.co/api-reference/auth/credentials-data#client-data)
                object returned by the user's WebAuthn client.
            signature:
              type: string
              minLength: 1
              description: >-
                Base64url-encoded signature returned by the user's WebAuthn
                client.
            algorithm:
              type: string
              description: >-
                The algorithm/digest that the credential will use to sign data.
                If the algoritm is not specified then the algorithm will be
                determined by the key.
            authenticatorData:
              type: string
              minLength: 1
              description: >-
                Base64url encoded authenticator data object returned by the
                user's WebAuthn client.
            userHandle:
              type: string
              description: >-
                Base64url encoded userHandle returned by the user's WebAuthn
                client.
          required:
            - credId
            - clientData
            - signature
            - authenticatorData
          additionalProperties: false
      required:
        - kind
        - credentialAssertion
      additionalProperties: false
      description: Use a Fido2 Credential, also known as Passkeys or WebauthN credential.
      title: Fido2/Passkeys
    KeyAssertion:
      type: object
      properties:
        kind:
          type: string
          enum:
            - Key
        credentialAssertion:
          type: object
          properties:
            credId:
              type: string
              minLength: 1
              description: >-
                Base64url-encoded id of the credential returned by the user's
                WebAuthn client.
            clientData:
              type: string
              minLength: 1
              description: >-
                Base64url-encoded, stringified JSON [client
                data](https://docs.dfns.co/api-reference/auth/credentials-data#client-data)
                object returned by the user's WebAuthn client.
            signature:
              type: string
              minLength: 1
              description: >-
                Base64url-encoded signature returned by the user's WebAuthn
                client.
            algorithm:
              type: string
              description: >-
                The algorithm/digest that the credential will use to sign data.
                If the algoritm is not specified then the algorithm will be
                determined by the key.
          required:
            - credId
            - clientData
            - signature
          additionalProperties: false
      required:
        - kind
        - credentialAssertion
      additionalProperties: false
      description: Use a "raw" public/private keypair.
      title: Public/Private key pair
    PasswordProtectedKeyAssertion:
      type: object
      properties:
        kind:
          type: string
          enum:
            - PasswordProtectedKey
        credentialAssertion:
          type: object
          properties:
            credId:
              type: string
              minLength: 1
              description: >-
                Base64url-encoded id of the credential returned by the user's
                WebAuthn client.
            clientData:
              type: string
              minLength: 1
              description: >-
                Base64url-encoded, stringified JSON [client
                data](https://docs.dfns.co/api-reference/auth/credentials-data#client-data)
                object returned by the user's WebAuthn client.
            signature:
              type: string
              minLength: 1
              description: >-
                Base64url-encoded signature returned by the user's WebAuthn
                client.
            algorithm:
              type: string
              description: >-
                The algorithm/digest that the credential will use to sign data.
                If the algoritm is not specified then the algorithm will be
                determined by the key.
          required:
            - credId
            - clientData
            - signature
          additionalProperties: false
      required:
        - kind
        - credentialAssertion
      additionalProperties: false
      description: 'Use an encrypted private key. '
      title: Password-protected Key
    PasswordAssertion:
      type: object
      properties:
        kind:
          type: string
          enum:
            - Password
        password:
          type: string
          minLength: 1
          description: User password.
      required:
        - kind
        - password
      additionalProperties: false
      description: Not supported, will be removed in a future release.
      title: <Deprecated> Password
    TotpAssertion:
      type: object
      properties:
        kind:
          type: string
          enum:
            - Totp
        otpCode:
          type: string
          minLength: 1
          description: TOTP one-time code.
      required:
        - kind
        - otpCode
      additionalProperties: false
      description: Not supported, will be removed in a future release.
      title: <Deprecated> TOTP
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