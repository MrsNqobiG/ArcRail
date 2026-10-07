> ## Documentation Index
> Fetch the complete documentation index at: https://docs.dfns.co/llms.txt
> Use this file to discover all available pages before exploring further.

# User Action Signing flows

> All DFNS API calls that change state must be signed by a user or service account, ensuring authorization and creating an auditable trail of every action.

export const Post = props => {
  return <code style={{
    paddingLeft: 0,
    paddingTop: 0
  }}>
      <Badge color="blue" size="sm">POST</Badge>
      <span style={{
    marginLeft: '0.5em'
  }}>{props.children}</span>
    </code>;
};

<Tip>
  You can find more details in the [developers guides](/guides/developers/signing-requests) section.
</Tip>

## Fido2 signing flow

This flow is for a human user interacting with a frontend (website, mobile app, etc) and signing the request using his passkey from that frontend.

The `authToken` to use here is from that user, refer to the [login flows](/api-reference/auth/login-flows) for details how to obtain that token.

<Steps>
  <Step title="Prepare your endpoint call payload">
    For starting a signing session you need to prepare the API call you intend to make eventually.

    As an example let's use [Transfer Asset](/api-reference/wallets/transfer-asset).

    * Method: `POST`
    * Path: `/wallets/wa-12345-12345-12345678910/transfers`
    * Payload: `{"kind": "Native", "to": "0xe5a2ebc128e262ab1e3bd02bffbe16911adfbffb", "amount": "100000"}`

    <CodeGroup>
      ```typescript Backend TypeScript SDK theme={null}
      import { DfnsDelegatedApiClient } from '@dfns/sdk'

      const dfnsClient = new DfnsDelegatedApiClient({
        baseUrl: 'https://api.dfns.io', // base Url of DFNS API
        orgId: 'org-2ng9jv-80cfc-983pop0iauf2sv8r', // ID of the DFNS Organisation
        authToken: userAuthToken, // Auth token of the User
      })

      const payload = {
          kind: "Native",
          to: "0xe5a2ebc128e262ab1e3bd02bffbe16911adfbffb",
          amount: "100000"
        }
      ```

      ```python Backend Python SDK theme={null}
      from dfns_sdk import DfnsDelegatedClient, DfnsDelegatedClientConfig

      config = DfnsDelegatedClientConfig(
          auth_token=user_auth_token,  # Auth token of the User
          base_url="https://api.dfns.io",  # base Url of DFNS API
      )

      dfns_client = DfnsDelegatedClient(config)

      payload = {
          "kind": "Native",
          "to": "0xe5a2ebc128e262ab1e3bd02bffbe16911adfbffb",
          "amount": "100000"
      }
      ```

      ```typescript Backend direct API call theme={null}
      const payload = {
          kind: "Native",
          to: "0xe5a2ebc128e262ab1e3bd02bffbe16911adfbffb",
          amount: "100000"
        }
      ```
    </CodeGroup>
  </Step>

  <Step title="Request a User Action Challenge">
    Use <Post>/auth/action/init</Post>: [Create User Action Challenge](/api-reference/auth/create-user-action-challenge).

    This starts a user action signing session, returning a challenge that will be used to verify the user's intent to perform an action. You need to provide details about the intended call:

    <CodeGroup>
      ```typescript Backend TypeScript SDK theme={null}
      const challenge = await dfnsClient.wallets.transferAssetInit(payload)
      ```

      ```python Backend Python SDK theme={null}
      wallet_id = "wa-12345-12345-12345678910"
      challenge = dfns_client.wallets.transfer_asset_init(wallet_id, body=payload)
      ```

      ```typescript expandable Backend direct API call theme={null}
      const url = 'https://api.dfns.io/auth/action/init';
      const options = {
        method: 'POST',
        headers: {
          Authorization: 'Bearer <token>',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      };

      try {
        const response = await fetch(url, options);
        const data = await response.json();
      } catch (error) {
        console.error(error);
      }

      ```
    </CodeGroup>
  </Step>

  <Step title="Get the user to sign the challenge">
    You need to forward the challenge and associated information to the frontend (browser or app) to handle the signing operation using WebAuthn APIs.

    <CodeGroup>
      ```typescript Frontend TypeScript SDK theme={null}
      import { WebAuthnSigner } from '@dfns/sdk-browser'
      const webauthn = new WebAuthnSigner({ relyingParty: { id: 'acme.com', name: 'Acme' } })

      const challenge = "Object coming from the backend"

      const signedChallenge = await webauthn.sign(challenge) // this call will trigger the request for interacting with the passkey

      // Forward signedChallenge back to the backend
      ```

      ```typescript expandable Frontend direct API call theme={null}
      import { fromBase64Url, toBase64Url } from '@dfns/sdk/utils' // please refer to the code if you want to copy those functions
      import { Buffer } from 'buffer'

      const challenge = "Object coming from the backend"

      const response = await navigator.credentials.get({
            publicKey: {
              challenge: Buffer.from(challenge.challenge),
              allowCredentials: challenge.allowCredentials.webauthn.map(({ id, type }) => ({
                id: fromBase64Url(id).buffer as ArrayBuffer,
                type,
              })),
              rpId: this.conf.relyingParty.id,
              userVerification: challenge.userVerification,
              timeout: this.conf.timeout ?? DEFAULT_WAIT_TIMEOUT,
            },
          })

      const signedChallenge = {
            kind: 'Fido2',
            credentialAssertion: {
              credId: credential.id,
              clientData: toBase64Url(Buffer.from(assertion.clientDataJSON)),
              authenticatorData: toBase64Url(Buffer.from(assertion.authenticatorData)),
              signature: toBase64Url(Buffer.from(assertion.signature)),
              userHandle: assertion.userHandle ? toBase64Url(Buffer.from(assertion.userHandle)) : undefined,
            },
          }

      // Forward signedChallenge back to the backend
      ```
    </CodeGroup>
  </Step>

  <Step title="Request a User Action token">
    Use <Post>/auth/action</Post>. Refer to [Create User Action Signature](/api-reference/auth/create-user-action-signature) for endpoint details.

    Completes the user action signing process and provides a signing token that can be used to verify the user intended to perform the action.

    <CodeGroup>
      ```typescript Backend TypeScript SDK theme={null}
      const signedChallenge = "object coming back from the frontend"
      /*
      Requesting a token is hidden into
      the function used in the next step
      */
      ```

      ```python Backend Python SDK theme={null}
      signed_challenge = "object coming back from the frontend"
      # Requesting a token is hidden into
      # the function used in the next step
      ```

      ```typescript expandable Backend direct API call theme={null}
      const signedChallenge = "object coming back from the frontend"
      const url = 'https://api.dfns.io/auth/action';
      const options = {
        method: 'POST',
        headers: {Authorization: 'Bearer <token>', 'Content-Type': 'application/json'},
        body: JSON.stringify({
          challengeIdentifier:data["challengeIdentifier"], // data from the first step
          firstFactor: signedChallenge
        })
      };

      try {
        const response = await fetch(url, options);
        const data = await response.json();
        const userActionToken = data["userAction"] // token to use in the next step
      } catch (error) {
        console.error(error);
      }
      ```
    </CodeGroup>
  </Step>

  <Step title="Use the User Action token">
    Add the User Action token to the `X-DFNS-USERACTION` header of the original API call that requires user action signing.

    <CodeGroup>
      ```typescript Backend TypeScript SDK theme={null}
      const transfer = await dfnsClient.wallets.transferAssetComplete(payload, signedChallenge)
      ```

      ```python Backend Python SDK theme={null}
      wallet_id = "wa-12345-12345-12345678910"
      transfer = dfns_client.wallets.transfer_asset_complete(
          wallet_id,
          body=payload,
          signed_challenge={
              "challengeIdentifier": challenge["challengeIdentifier"],
              "firstFactor": signed_challenge
          }
      )
      ```

      ```typescript expandable Backend direct API call theme={null}
      const url = `https://api.dfns.io/wallets/wa-12345-12345-12345678910/transfers`;
      const options = {
        method: 'POST',
        headers: {
          Authorization: 'Bearer <token>',
          'X-DFNS-USERACTION': userActionToken,
          'Content-Type': 'application/json'
        },
        body: '{"kind":"Native","to":"0xe5a2ebc128e262ab1e3bd02bffbe16911adfbffb","amount":"1"}'
      };

      try {
        const response = await fetch(url, options);
        const data = await response.json();
        console.log(data);
      } catch (error) {
        console.error(error);
      }
      ```
    </CodeGroup>
  </Step>
</Steps>

## Asymmetric Keys signing flow

This flow is for machine-to-machine interactions: a backend signs the request using an asymmetric key, there is no signing request to the user. The backend can login as a [Service Account](/api-reference/auth/service-accounts) (machine user with its own identity), as a user using their [Personal Access Token](/api-reference/auth/personal-access-tokens). Just provide the right token as `authToken` for all the following API calls.

You should also have registered the public key when you created the Service Account or the user's Personal Access Token. The Private Key will be used to sign the challenges, make sure you use the private key linked to the `authToken` you are using!

<Steps>
  <Step title="Prepare your endpoint call payload">
    For starting a signing session you need to prepare the API call you intend to make eventually.

    As an example let's use [Transfer Asset](/api-reference/wallets/transfer-asset).

    * Method: `POST`
    * Path: `/wallets/wa-12345-12345-12345678910/transfers`
    * Payload: `{"kind": "Native", "to": "0xe5a2ebc128e262ab1e3bd02bffbe16911adfbffb", "amount": "100000"}`

    <CodeGroup>
      ```typescript Backend TypeScript SDK theme={null}
      import { DfnsApiClient } from '@dfns/sdk'
      import { AsymmetricKeySigner } from '@dfns/sdk-keysigner'

      const signer = new AsymmetricKeySigner({
        credId: 'X2ktMzhxaTEtZTF1bTgtOXY1cG9yY2tkZDe1dG1jYg', // Credential ID
        privateKey: CREDENTIAL_PRIVATE_KEY, // Credential private key
      })

      const dfnsClient = new DfnsApiClient({
        baseUrl: 'https://api.dfns.io', // base Url of DFNS API
        orgId: 'or-2ng9jv-80cfc-983pop0iauf2sv8r', // ID of the DFNS Organisation
        authToken: '...', // Service Account or PAT auth token
        signer,
      })

      const payload = {
          kind: "Native",
          to: "0xe5a2ebc128e262ab1e3bd02bffbe16911adfbffb",
          amount: "100000"
        }
      ```

      ```python Backend Python SDK theme={null}
      from dfns_sdk import DfnsClient, DfnsClientConfig, KeySigner

      signer = KeySigner(
          credential_id="X2ktMzhxaTEtZTF1bTgtOXY1cG9yY2tkZDe1dG1jYg",  # Credential ID
          private_key=CREDENTIAL_PRIVATE_KEY,  # Credential private key
          app_origin="https://app.dfns.io"
      )

      config = DfnsClientConfig(
          auth_token="...",  # Service Account or PAT auth token
          base_url="https://api.dfns.io",  # base Url of DFNS API
          signer=signer
      )

      dfns_client = DfnsClient(config)

      payload = {
          "kind": "Native",
          "to": "0xe5a2ebc128e262ab1e3bd02bffbe16911adfbffb",
          "amount": "100000"
      }
      ```

      ```typescript Backend direct API call theme={null}
      const payload = {
          kind: "Native",
          to: "0xe5a2ebc128e262ab1e3bd02bffbe16911adfbffb",
          amount: "100000"
        }

      const keyPrivateKey = "...private key..."
      ```
    </CodeGroup>
  </Step>

  <Step title="Request a User Action Challenge">
    Use <Post>/auth/action/init</Post>: [Create User Action Challenge](/api-reference/auth/create-user-action-challenge).

    This starts a user action signing session, returning a challenge that will be used to verify the user's intent to perform an action. You need to provide details about the intended call:

    <CodeGroup>
      ```typescript Backend TypeScript SDK theme={null}
      // This step is hidden when you use the SDK.
      ```

      ```python Backend Python SDK theme={null}
      # This step is hidden when you use the SDK.
      ```

      ```typescript expandable Backend direct API call theme={null}
      const url = 'https://api.dfns.io/auth/action/init';
      const options = {
        method: 'POST',
        headers: {
          Authorization: 'Bearer <token>',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      };

      try {
        const response = await fetch(url, options);
        const data = await response.json();
      } catch (error) {
        console.error(error);
      }

      ```
    </CodeGroup>
  </Step>

  <Step title="Sign the challenge">
    Use a crypto library or a KMS to sign the challenge.

    <CodeGroup>
      ```typescript Backend TypeScript SDK theme={null}
      // This step is hidden when you use the SDK.
      ```

      ```python Backend Python SDK theme={null}
      # This step is hidden when you use the SDK.
      ```

      ```typescript expandable Backend direct API call theme={null}
        // The data being signed includes information that is important for validating the request originated from a valid location.
        const clientData: Buffer = Buffer.from(
          JSON.stringify({
            type: 'key.get',
            challenge: challenge.challenge,
            origin: origin,
            crossOrigin: false,
          })
        )

        // Signing can be done locally or by calling an external signer (like AWS KMS).
        const signature = crypto.sign(
          undefined,
          clientData,
          keyPrivateKey
        )

        // Pass back the signature, and the data that was signed so both can be parsed and validated properly.
        const signedChallenge = {
          clientData: clientData.toString('base64url'),
          credId: challenge.allowCredentials.key[0].id,
          signature: signature.toString('base64url'),
        }
      ```
    </CodeGroup>
  </Step>

  <Step title="Request a User Action token">
    Use <Post>/auth/action</Post>. Refer to [Create User Action Signature](/api-reference/auth/create-user-action-signature) for endpoint details.

    Completes the user action signing process and provides a signing token that can be used to verify the user intended to perform the action.

    <CodeGroup>
      ```typescript Backend TypeScript SDK theme={null}
      // This step is hidden when you use the SDK.
      ```

      ```python Backend Python SDK theme={null}
      # This step is hidden when you use the SDK.
      ```

      ```typescript expandable Backend direct API call theme={null}
      const signedChallenge = "object coming back from the frontend"
      const url = 'https://api.dfns.io/auth/action';
      const options = {
        method: 'POST',
        headers: {Authorization: 'Bearer <token>', 'Content-Type': 'application/json'},
        body: JSON.stringify({
          challengeIdentifier:data["challengeIdentifier"], // data from the first step
          firstFactor: signedChallenge
        })
      };

      try {
        const response = await fetch(url, options);
        const data = await response.json();
        const userActionToken = data["userAction"] // token to use in the next step
      } catch (error) {
        console.error(error);
      }
      ```
    </CodeGroup>
  </Step>

  <Step title="Use the User Action token">
    Add the User Action token to the `X-DFNS-USERACTION` header of the original API call that requires user action signing.

    <CodeGroup>
      ```typescript Backend TypeScript SDK theme={null}
      const transfer = await dfnsClient.wallets.transferAsset(payload)
      ```

      ```python Backend Python SDK theme={null}
      wallet_id = "wa-12345-12345-12345678910"
      with dfns_client:
          transfer = dfns_client.wallets.transfer_asset(wallet_id, body=payload)
      ```

      ```typescript expandable Backend direct API call theme={null}
      const url = `https://api.dfns.io/wallets/wa-12345-12345-12345678910/transfers`;
      const options = {
        method: 'POST',
        headers: {
          Authorization: 'Bearer <token>',
          'X-DFNS-USERACTION': userActionToken,
          'Content-Type': 'application/json'
        },
        body: '{"kind":"Native","to":"0xe5a2ebc128e262ab1e3bd02bffbe16911adfbffb","amount":"1"}'
      };

      try {
        const response = await fetch(url, options);
        const data = await response.json();
        console.log(data);
      } catch (error) {
        console.error(error);
      }
      ```
    </CodeGroup>
  </Step>
</Steps>


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.