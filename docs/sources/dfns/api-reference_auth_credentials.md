> ## Documentation Index
> Fetch the complete documentation index at: https://docs.dfns.co/llms.txt
> Use this file to discover all available pages before exploring further.

# Credentials

> API endpoints to create, list, activate, deactivate, and manage user credentials such as passkeys, signing keys, and recovery credentials.

User Credentials are used to sign any API call that requires user signature. Most API requests (non-readonly requests mostly) require such a signature.

Credentials can be of different kinds (see below), but are essentially all a public/private keypair. The private part is only known and kept by the user. The public key is shared with DFNS, so DFNS can validate the signature produced by the private key.

## Credential kinds

* **`Fido2`** (Passkeys / WebAuthn). Recommended for human users. Uses the [WebAuthn standard](https://en.wikipedia.org/wiki/WebAuthn) to create and store passkeys on the user's device. Passkeys are tied to a domain name that must be [whitelisted](/guides/developers/webauthn-configuration#dashboard-configuration) in your DFNS dashboard.
* **`Key`**. A raw public/private keypair, primarily for [Service Accounts](/api-reference/auth/service-accounts). You generate and store the keypair yourself. See [Generate a Key Pair](/guides/developers/generate-a-key-pair).
* **`PasswordProtectedKey`**. Like a Key credential, but the private key is stored by DFNS in encrypted form. DFNS never has the password. Encryption and decryption must happen on the frontend so you never access the decrypted key. During login and signing, the API returns the `encryptedPrivateKey` for the user to decrypt locally.
* **`RecoveryKey`**. Like a Key credential, but designed for account recovery. The user safekeeps a human-readable recovery code. When used, all other credentials are invalidated. See [Implementing end-user recovery](/guides/developers/end-user-recovery).

Not all identity types support all credential kinds:

| Identity | WebAuthn (Fido2) | Key |
| - | - | - |
| User | Yes | Yes |
| PAT (Personal Access Token) | No | Yes |
| Service Account | No | Yes |

## Redundancy

Users can register multiple credentials, and this is recommended. If a user loses access to one credential (e.g. a lost phone), they can still authenticate with another. Register credentials on separate devices (e.g. laptop and a YubiKey) for resilience.

## Credential Signature Flow

Most API requests (non-readonly requests mostly) require the signature from a valid Credential owned by the User. The credential signature flow usually looks like:

1. User calls a first endpoint to get a challenge back (some cypher text that needs to be signed)
2. User sign the challenge using a valid credential
3. User calls a second endpoint to submit the signature

Different types of challenges that can be requested by a User:

* A Registration Challenge (to register the first user credential, when user registers)
* A Login Challenge (to login and get an auth token)
* A User Action Challenge (required by most non-readonly API calls)
* A Credential Challenge (used to create a new Credential)

## Credential Creation Flows

There are two possible flows to create a new Credential for a User. The flow you will choose depend on where the User is (which app), and whether he has access to his existing credential from this place.

### Regular flow

This flow requires the last call (registration of the new credential) to be signed by an existing valid credential. That means that the user needs to have an existing credential accessible from the place where he's adding a new credential.

1. Call [Create Credential Challenge](/api-reference/auth/create-credential-challenge) to get a "Credential challenge" back. This endpoint does not require a user-action-signature required, so no credential signature involved here.
2. Create a new credential locally, sign the above challenge with it.
3. Call [Create Credential](/api-reference/auth/create-credential) to complete. This endpoint requires a [User Action Flow](/api-reference/auth/signing-flows), so it involves signing first **with an existing valid credential** to get an user action token.

### Create Credential With Code flow

This flow requires the first call to be signed by an existing valid credential (creating the code). From then, the last steps can be performed without signature from a valid credential.

This flow is useful when you want a user to create a new Credential from an app which doesn't have access to the existing valid credential (since passkeys are tied to the domain name, they cannot be used "cross-domain", eg. a passkey registered on domain `www.app-1.com` cannot be used inside the app `www.app-2.com)`

1. In App 1, call [Create Credential Code](/api-reference/auth/create-credential-code) to get a one-time code. The code will only be valid for 1 minute. This endpoint requires a [User Action Flow](/api-reference/auth/signing-flows), so it involves signing first **with an existing valid credential** to get an user action token.
2. In App 2, call [Create Credential Challenge With Code](/api-reference/auth/create-credential-challenge-with-code) (passing the code from step 1) to get a "Credential challenge" back
3. In App 2, create a new credential locally, sign the above challenge with it.
4. In App 2, call [Create Credential With Code](/api-reference/auth/create-credential-with-code) to complete (passing the code from step 1). This endpoint does not require a user-action-signature required, so no credential signature involved here

This [demo video](https://www.loom.com/share/a8b3cbca4b934f659e2e37e676762b87?sid=6aa89bfa-ac59-4c87-897e-79085d916aa0) showcases this flow and how you could implement it in your product.

<iframe className="w-full aspect-video rounded-xl" src="https://www.loom.com/embed/a8b3cbca4b934f659e2e37e676762b87?sid=6aa89bfa-ac59-4c87-897e-79085d916aa0" title="Create Credential with Code flow demo" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />

## Key Creds vs WebauthN creds

`Key` credentials give extra flexibilty over `WebAuthn` to design signing to meet your needs. For example, you could choose to have a key without a passphrase (disabling MFA), to support scenarios where you don't want the user to have to interact with your application to sign a transaction. Or, as another example, you could build an integration with an authentication device that is not supported by WebAuthn.

## Security of Key Based Credentials

It is recommended that a user's credentials never leave their system or device. This ensures that the credentials cannot be phished and that you as a service provide never have access to use the key on behalf of the user.

If you are storing the key in the user's browser. We recommend using a Service Worker to perform all cryptographic operations in a secure context.

## Performing Actions on Behalf of your User

If you (your server) need to perform an action in a user's wallet on behalf of your user, we recommend creating a [Personal Access Token](/guides/developers/personal-access-token) in your user's account, rather than registering a credential (in your control) for your user. This allows the user to restrict the actions you are allowed to perform, and they can time-bound your access.

## Credential object


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.