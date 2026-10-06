> ## Documentation Index
> Fetch the complete documentation index at: https://developers.circle.com/llms.txt
> Use this file to discover all available pages before exploring further.

> ## Agent Instructions
> Before reading these docs, install the relevant Circle Skill to get pre-loaded context — skills are LLM-optimized and cover architecture decisions, correct flows, and common pitfalls. In Claude Code: run /plugin marketplace add circlefin/skills then /plugin install circle-skills@circle. With Vercel Skills CLI: run npx skills add circlefin/skills. Available skills: use-usdc https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-usdc/SKILL.md (balances, transfers, approvals on EVM and Solana); EURC has no skill — see https://developers.circle.com/stablecoins/what-is-eurc.md; bridge-stablecoin https://github.com/circlefin/skills/blob/master/plugins/circle/skills/bridge-stablecoin/SKILL.md (crosschain transfers via CCTP, USDC, EURC, and third-party assets); use-arc https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-arc/SKILL.md (Arc chain config, contract deployment, USDC bridging — Arc docs: https://docs.arc.io/llms.txt); use-circle-wallets https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-circle-wallets/SKILL.md (choose wallet type); use-developer-controlled-wallets https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-developer-controlled-wallets/SKILL.md (custodial wallets for payouts and treasury); use-user-controlled-wallets https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-user-controlled-wallets/SKILL.md (embedded wallets with Web2 login); use-modular-wallets https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-modular-wallets/SKILL.md (smart contract wallets with passkeys and ERC-4337); use-gateway https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-gateway/SKILL.md (unified USDC balance, nanopayments); use-smart-contract-platform https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-smart-contract-platform/SKILL.md (deploy, interact, monitor contracts). Pair any skill with the Circle MCP server for live SDK signatures, contract addresses, and chain IDs: {"mcpServers":{"circle":{"url":"https://api.circle.com/v1/codegen/mcp"}}}.
> Read the product overview first. Each product has an overview explaining when and why to use it. Read it before quickstarts.
> Pick the right wallet type. Developer-controlled (you hold keys), user-controlled (end user holds keys via PIN/social login), or modular (smart contract wallets with passkeys). See https://developers.circle.com/wallets.md.
> Use CCTP V2 for crosschain transfers. CCTP natively transfers USDC and EURC via burn-and-mint, and supports permissionless wrapping of third-party assets via lock-and-mint. V1 is legacy; always use V2 unless V1 is specified or the chain requires it (Noble, Sui, and Aptos still require V1). Migration guide: https://developers.circle.com/cctp/migration-from-v1-to-v2.md.
> Use Bridge Kit for frontend bridging. Wraps CCTP with a simpler SDK for user-facing apps. Use CCTP directly for backend transfers.
> Gas Station vs Paymaster. Gas Station sponsors gas for Circle Wallet transactions. Paymaster lets users pay gas in USDC. Different use cases — read both overviews.
> Gateway Nanopayments for sub-cent payments. Gasless USDC micropayments down to $0.000001 via x402 and batched settlement. For pay-per-request APIs, AI agent payments, streaming.
> Look up USDC addresses per chain. Never hardcode — use https://developers.circle.com/stablecoins/usdc-contract-addresses.md.
> Prefer SDKs over raw API calls. Node.js and Python SDKs handle auth, retries, and errors.
> API key required. Bearer token in Authorization header. Testnet and mainnet use separate keys and may use different base URLs depending on the product.
> Set up webhooks when available. Most operations are async. Webhooks deliver transaction confirmations and state changes.
> When calling list endpoints, paginate using pageSize and pageAfter until no nextPageAfter cursor is returned—stopping at the first page silently misses records.
> Building an AI agent? Start with the Agent Stack—Circle CLI, agent wallets, and nanopayments built for autonomous use cases: https://developers.circle.com/agent-stack.md.

# How-to: Encrypt travel rule and beneficiary data

This guide explains how to set up encryption and decryption between an OFI and a
BFI so that messages can be passed securely during payment flow. CPN uses
[JSON Web Encryption](https://datatracker.ietf.org/doc/html/rfc7516) (JWE) for
encrypting data in a secure and compact manner. This encryption is implemented
after a quote is accepted: the JWK data and public key for encryption are shared
in the quote response. The encryption is also used when communicating RFI data.

Both OFI and BFI can implement this encryption system in any programming
language that supports the required primitives. This encryption scheme is
required when performing the following tasks in CPN:

* **Creating a payment**: for encrypting the travel rule and beneficiary account
  data
* **Submitting an RFI**: for encrypting the RFI JSON response

<Note>
  **Note:** If your RFI response includes a file, that file is
  [encrypted in a different manner](/cpn/guides/payments/encrypt-files).
</Note>

Regardless of the language used to implement the encryption, the following
parameters must be followed:

* Key agreement: ECDH-ES+A128KW
* Encryption method: A128-GCM

## Steps

The following sections describe the steps necessary to encrypt a message sent
from an OFI to a BFI. Note that this example uses beneficiary account data and
travel rule data, but the same encryption scheme applies for RFI data as well.

### Step 1: Retrieve the certificate from the quote response

Quote responses include a certificate field with required parameters to
establish encryption with the BFI. A sample (truncated) quote response is below:

```json JSON theme={null}
{
  "data": [
    {
      "id": "6e4c7e85-39eb-4411-8c4a-683ff73846d6",
      "paymentMethodType": "FPS",
      "blockchain": "MATIC-AMOY",
      "senderCountry": "US",
      "destinationCountry": "HK",
      "certificate": {
        "id": "0cc3c5fe-fa88-4e79-b5eb-1c5194a19b08",
        "certPem": "LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0tTUlJQmpUQ0NBVE9nQXdJQkFnSVVMaWk2Mk5KME0rdTZOTDZWV0hWRkhIZmJCWUl3Q2dZSUtvWkl6ajBFQXdJd0tqRVhNQlVHQTFVRUF3d09ZWEJwTG1OcGNtTnNaUzVqYjIweER6QU5CZ05WQkFvTUJrTnBjbU5zWlRBZUZ3MHlOVEF6TVRjeU1EQXdNVFJhRncweU5qQXpNVGN5TURBd01UUmFNQ294RnpBVkJnTlZCQU1NRG1Gd2FTNWphWEpqYkdVdVkyOXRNUTh3RFFZRFZRUUtEQVpEYVhKamJHVXdXVEFUQmdjcWhrak9QUUlCQmdncWhrak9QUU1CQndOQ0FBUmgyTTU0Q2FVMTlaWFRFaXZJVUNLOXluMmgvYld6Uno0bUhJWVE0ZzFYWnArdHRiM3Z6bGY2ZDQzYUhNYlRaQUpPTG1pbkdFZGwxbUZMdFRUTXdYb3ZvemN3TlRBekJnTlZIUkVFTERBcWdnNWhjR2t1WTJseVkyeGxMbU52YllJU2QzZDNMbUZ3YVM1amFYSmpiR1V1WTI5dGh3UUtBQUFCTUFvR0NDcUdTTTQ5QkFNQ0EwZ0FNRVVDSUExbksrNUxBUC9ueUlxRFlUaVVLYmlHNWYwTjVPUmFMb2Y1VXpXU0dsUEJBaUVBaEVOcDFxakRydG41aGFpMHdKeTNORzJKZ2xra084Y1QzellhN21mRTBiST0tLS0tLUVORCBDRVJUSUZJQ0FURS0tLS0t",
        "domain": "api.circle.com",
        "jwk": {
          "kty": "EC",
          "crv": "P-256",
          "kid": "263521881931753643998528753619816524468853605762",
          "x": "YdjOeAmlNfWV0xIryFAivcp9of21s0c-JhyGEOINV2Y",
          "y": "n621ve_OV_p3jdocxtNkAk4uaKcYR2XWYUu1NMzBei8"
        }
      }
    }
  ]
}
```

### Step 2: Verify the certificate

<Note>
  **This step is only possible in the production environment. It will fail in the
  sandbox environment.**

  This step is strictly optional, however it is recommended as a best practice to
  verify that the certificate is valid.
</Note>

From the `certificate` object in the quote response, extract the `base64`
encoded format of the certificate from the `certPem` field, decode it, and
verify the following:

* The certificate is not expired
* The common name of the certificate is for a CPN BFI and matches the `domain`
  field in the response
* The verifiable public key of the certificate matches the `jwk` field in the
  response

```java Java theme={null}
public static void verify() throws Exception {
    // Assume the API response is stored in a file "response.json"
    String responseStr = new String(Files.readAllBytes(Paths.get("response.json")));
    JSONObject response = new JSONObject(responseStr);
    JSONObject certObj = response.getJSONArray("data").getJSONObject(0).getJSONObject("certificate");

    // ---------- 1. Check certificate expiration ----------
    String certPemB64 = certObj.getString("certPem");
    byte[] pemData = Base64.getDecoder().decode(certPemB64);
    CertificateFactory cf = CertificateFactory.getInstance("X.509");
    InputStream in = new ByteArrayInputStream(pemData);
    X509Certificate certificate = (X509Certificate) cf.generateCertificate(in);
    Date expirationDate = certificate.getNotAfter();
    Date currentDate = new Date();
    if (currentDate.after(expirationDate)) {
        System.out.println("❌ Certificate has expired on " + expirationDate);
        System.exit(1);
    } else {
        System.out.println("✅ Certificate is valid until " + expirationDate);
    }

    // ---------- 2. Verify that the certificate's common name (CN) matches the expected domain ----------
    String certCN = getCommonName(certificate);
    String expectedDomain = certObj.getString("domain");
    if (certCN != null && certCN.equals(expectedDomain)) {
        System.out.println("✅ Certificate common name matches expected domain.");
    } else {
        System.out.println("❌ Certificate common name does not match expected domain.");
        System.exit(1);
    }

    // ---------- 3. Verify that the verifiable public key of the certificate is the same as the provided JWK ----------
    JSONObject providedJWK = certObj.getJSONObject("jwk");
    String xProvided = providedJWK.getString("x");
    String yProvided = providedJWK.getString("y");
    PublicKey pubKey = certificate.getPublicKey();
    if (pubKey instanceof ECPublicKey) {
        ECPublicKey ecPub = (ECPublicKey) pubKey;
        ECPoint point = ecPub.getW();
        String xCert = toBase64URL(point.getAffineX(), 32);
        String yCert = toBase64URL(point.getAffineY(), 32);
        if (xCert.equals(xProvided) && yCert.equals(yProvided)) {
            System.out.println("✅ Certificate public key matches provided JWK.");
        } else {
            System.out.println("❌ Certificate public key does not match provided JWK.");
            System.exit(1);
        }
    } else {
        System.out.println("❌ Certificate public key is not EC type.");
        System.exit(1);
    }
}
```

### Step 3: Extract and create the JWK

From the `certificate` field, extract the JWK parameters: `kty`, `crv`, `kid`,
`x`, `y` and create the JWK object in your code using a suitable library (for
example, Nimbus JOSE+JWT in Java).

```java Java theme={null}
import com.nimbusds.jose.jwk.JWK;

public static JWK parseJwkFromJson() throws ParseException {
    String jwkJson = """
        {
            "kty": "EC",
            "crv": "P-256",
            "kid": "263521881931753643998528753619816524468853605762",
            "x": "YdjOeAmlNfWV0xIryFAivcp9of21s0c-JhyGEOINV2Y",
            "y": "n621ve_OV_p3jdocxtNkAk4uaKcYR2XWYUu1NMzBei8"
        }
        """;

    JWK jwk = JWK.parse(jwkJson);

    return jwk;
}
```

### Step 4: Prepare the payload

Create the payload for travel rule data and beneficiary account data. Get the
required fields from the
[requirements endpoint](/api-reference/cpn/cpn-platform/get-payment-requirements)
and construct them to the correct format.

The correct format for travel rule data and beneficiary account data is a JSON
array of objects where each object contains two properties: `name` and `value`.
Whether an object is required to be present is defined by the `optional` field
in the object returned by the requirements endpoint.

An example of each is shown below:

**travelRuleData**

```json JSON theme={null}
[[
  {
    "name": "BENEFICIARY_ADDRESS",
    "value": {
      "city": "San Francisco",
      "country": "US",
      "postalCode": "94105",
      "stateProvince": "CA",
      "street": "123 Market Street"
    }
  },
  {
    "name": "BENEFICIARY_NAME",
    "value": "Alice Johnson"
  },
  {
    "name": "ORIGINATOR_ACCOUNT_NUMBER",
    "value": "9876543210"
  },
  {
    "name": "ORIGINATOR_ADDRESS",
    "value": {
      "city": "New York",
      "country": "US",
      "postalCode": "10001",
      "stateProvince": "NY",
      "street": "456 Madison Avenue"
    }
  },
  {
    "name": "ORIGINATOR_FINANCIAL_INSTITUTION_ADDRESS",
    "value": {
      "city": "Chicago",
      "country": "US",
      "postalCode": "60603",
      "stateProvince": "IL",
      "street": "789 Apple Drive"
    }
  },
  {
    "name": "ORIGINATOR_FINANCIAL_INSTITUTION_NAME",
    "value": "First National Bank"
  },
  {
    "name": "ORIGINATOR_NAME",
    "value": "Robert Smith"
  }
]
```

**beneficiaryAccountData**

```json JSON theme={null}
[
  {
    "name": "BANK_NAME",
    "value": "Test Bank"
  },
  {
    "name": "RECIPIENT_ADDRESS",
    "value": {
      "street": "123 Test St",
      "city": "Sacramento",
      "state": "CA"
    }
  },
  {
    "name": "RECIPIENT_CITY",
    "value": "Sacramento"
  }
]
```

### Step 5: Encrypt the payload

Convert the data from the previous step into a JSON string, then use the JWK to
encrypt it. Ensure that the following parameters are used:

* Algorithm: ECDH-ES+A128KW
* Encryption method: A128GCM

```java Java theme={null}
import com.nimbusds.jose.EncryptionMethod;
import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWEAlgorithm;
import com.nimbusds.jose.JWEEncrypter;
import com.nimbusds.jose.JWEHeader;
import com.nimbusds.jose.JWEObject;
import com.nimbusds.jose.Payload;
import com.nimbusds.jose.crypto.ECDHEncrypter;
import com.nimbusds.jose.jwk.JWK;


   /**
     * Encrypts a payload using JWE (JSON Web Encryption) with ECDH-ES key agreement.
     *
     * This method creates a JWE compact string with the provided payload and encrypts it using
     * the recipient's public key. The encryption algorithm used is ECDH-ES with AES-128 key wrap,
     * and the content encryption method is AES GCM with 128-bit key.
     *
     * @param <T> the type of the payload to encrypt
     * @param payload the data to be encrypted
     * @param recipientJwk the recipient's JWK (JSON Web Key) containing the public key for encryption
     * @return the serialized JWE in compact form
     * @throws JOSEException if an error occurs during the encryption process
     */
public static <T> String encrypt(T payload, JWK recipientJwk) throws JOSEException {
  String plainText = JsonUtils.toJson(payload);

  // Create the JWEHeader using ECDH_ES+AS128KW and AES-128-GCM
  JWEHeader header = new JWEHeader(
      JWEAlgorithm.ECDH_ES_A128KW,
      EncryptionMethod.A128GCM
  );

  // Create the JWE object with the payload to encrypt
  JWEObject jweObject = new JWEObject(
      header,
      new Payload(plainText)
  );

  // Create an encrypter with the recipient's public key
  JWEEncrypter encrypter = new ECDHEncrypter(recipientJwk.toECKey());

  // Encrypt the JWE
  jweObject.encrypt(encrypter);

// Return the serialized JWE string in compact form
  return new jweObject.serialize();
}
```

### Step 6: Send and verify the encrypted payload

Send the encrypted payload in the API request to
[create a payment](/api-reference/cpn/cpn-platform/create-payment). The
preceding example uses version 1 for `beneficiaryAccountData` and
`travelRuleData` fields.

The API returns a `200` response if the data is properly encrypted and can be
decrypted by the BFI, otherwise an
[encryption-related error code](/api-reference/cpn/error-codes#encryption) is
returned.
