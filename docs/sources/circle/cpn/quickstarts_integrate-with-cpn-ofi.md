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

# Integrate with CPN as an OFI

> Request, lock, and fulfill a USDC payment quote as an OFI using CPN. Covers Transactions V2 on EVM blockchains and Solana signing.

Complete this quickstart to request, lock, and fulfill your first USDC payment
quote as an OFI using CPN. Examples use Transactions V2 on EVM blockchains.
Solana follows the same overall flow with differences in the signing process.

<Note>
  This quickstart uses **Circle Wallets** and **Circle On/Off-Ramps** as
  examples; CPN does not require them. If you use your own wallet and USDC, see
  [Bring your own wallet for CPN](/cpn/concepts/wallets/bring-your-own-wallet)
  and [Wallet provider
  compatibility](/cpn/references/blockchains/wallet-provider-compatibility). For
  Circle setup, follow the how-tos under Prerequisites.
</Note>

## Prerequisites

Before you begin this quickstart, ensure you have:

* API keys created in
  [CPN Console → Developer → API Keys](https://cpn.circle.com/signin) with
  access to **CPN** and **Programmable Wallets**. If you fund USDC through
  Circle APIs for this exercise, you also need a key authorized for those
  **Circle APIs** endpoints.
* Completed operational wallet setup for the quickstart:
  * Follow how to
    [Set Up a Circle Wallet for CPN Payments](/cpn/guides/wallets/setup-circle-wallet-for-cpn-payments),
    **or** use your own wallet that meets
    [Wallet provider compatibility](/cpn/references/blockchains/wallet-provider-compatibility).
  * You need the **wallet ID** of an EOA on the correct chain (`ETH-SEPOLIA`
    when using testnet).
* Funded the operational wallet with enough **USDC**. For sandbox you can use
  the [Circle faucet](https://faucet.circle.com). For a guided Circle
  fiat-to-wallet path, follow how to
  [Set Up Circle On/Off-Ramps for CPN Payments](/cpn/guides/circle-liquidity/setup-circle-on-off-ramps-for-cpn-payments).
* Python installed on your development machine
  * The latest `jwcrypto`, `web3`, `eth_utils`, `hexbytes`, and `eth_abi`
    libraries are installed with the `pip` package manager
* cURL installed on your development machine
* Granted a USDC allowance to the `Permit2` contract. See how to
  [Grant USDC allowance to Permit2](/cpn/guides/transactions/grant-usdc-allowance-to-permit2)
  for more information.
* (Optional) a
  [configured webhook notification endpoint](/api-reference/webhook-endpoints)

This quickstart provides API requests in cURL format, along with example
responses.

<Note>
  The base URL for all API endpoints is `https://api.circle.com/v1/cpn` for both
  sandbox and production environments. The API determines if a request is for
  testnet or mainnet based on the key used to authenticate the request.
</Note>

## Part 1: Request a quote

Request quotes for a USDC to MX payment with the SPEI payment method. Request
quotes with the [create a quote](/api-reference/cpn/cpn-platform/create-quotes)
endpoint, providing the source currency and destination amount. You must specify
`transactionVersion` as `VERSION_2`. The endpoint returns a list of quotes from
various BFIs with the rate, expiration time, USDC settlement window, and unique
ID.

The `senderType` and `recipientType` you request the quote with also determine
the quote's [payment use case](/cpn/concepts/quotes#payment-use-case). You can't
set the use case on the quote, and the quote response doesn't return it, so keep
track of the types you requested. When you create the payment in Part 2.3, you
must send the `useCase` that matches:

| `senderType` | `recipientType` | `useCase` |
| - | - | - |
| `BUSINESS` | `BUSINESS` | `B2B` |
| `BUSINESS` | `INDIVIDUAL` | `B2C` |
| `INDIVIDUAL` | `BUSINESS` | `C2B` |
| `INDIVIDUAL` | `INDIVIDUAL` | `C2C` |

A payment that sends any other value is rejected with error code
[`290211`](/api-reference/cpn/error-codes). This quickstart uses `INDIVIDUAL`
for both types, so its payment sends `C2C`.

<Note>
  Quote lifetime depends on the corridor and can be shorter than 30 seconds. On
  testnet, USDC to MXN quotes over SPEI expire about 29 seconds after
  `createDate`, while USDC to USD wire quotes last closer to a minute. Don't
  assume a fixed minimum lifetime: save the quote `id`, read `quoteExpireDate`
  from the response, and treat that timestamp as the deadline. The window is
  tight enough that you need to automate the quote-to-payment sequence rather
  than running the calls by hand. If a quote expires before you create the
  payment, the payment creation endpoint returns an error, so request a new
  quote and restart from Part 1.
</Note>

```shell theme={null}
curl --request POST \
  --url https://api.circle.com/v1/cpn/quotes \
  --header 'Accept: application/json' \
  --header 'Authorization: Bearer ${YOUR_API_KEY}' \
  --header 'Content-Type: application/json' \
  --data '
{
    "paymentMethodType": "SPEI",
    "senderCountry": "US",
    "destinationCountry": "MX",
    "sourceAmount": {
        "currency": "USDC"
    },
    "destinationAmount": {
        "amount": "200",
        "currency": "MXN"
    },
    "blockchain": "ETH-SEPOLIA",
    "senderType": "INDIVIDUAL",
    "recipientType": "INDIVIDUAL",
    "transactionVersion": "VERSION_2"
}
'
```

**Response**

```json theme={null}
{
  "data": [
    {
      "id": "2792f4a6-f1bd-4435-b681-1da309122159",
      "paymentMethodType": "SPEI",
      "blockchain": "ETH-SEPOLIA",
      "senderCountry": "US",
      "destinationCountry": "MX",
      "createDate": "2025-09-24T00:01:13.532073875Z",
      "quoteExpireDate": "2025-09-24T00:01:42.502094Z",
      "cryptoFundsSettlementExpireDate": "2025-09-24T01:01:12.502097Z",
      "sourceAmount": {
        "amount": "15.000000",
        "currency": "USDC"
      },
      "destinationAmount": {
        "amount": "252.91",
        "currency": "MXN"
      },
      "fiatSettlementTime": {
        "min": "0",
        "max": "5",
        "unit": "MINUTES"
      },
      "exchangeRate": {
        "rate": "16.860667",
        "pair": "USDC/MXN"
      },
      "fees": {
        "totalAmount": {
          "amount": "1.568971",
          "currency": "USDC"
        },
        "breakdown": [
          {
            "type": "TAX_FEE",
            "amount": {
              "amount": "0.234663",
              "currency": "USDC"
            }
          },
          {
            "type": "BFI_TRANSACTION_FEE",
            "amount": {
              "amount": "0.138037",
              "currency": "USDC"
            }
          },
          {
            "type": "CIRCLE_SERVICE_FEE",
            "amount": {
              "amount": "0.000000",
              "currency": "USDC"
            }
          },
          {
            "type": "BLOCKCHAIN_GAS_FEE",
            "amount": {
              "amount": "1.196271",
              "currency": "USDC"
            }
          }
        ]
      },
      "senderType": "INDIVIDUAL",
      "recipientType": "INDIVIDUAL",
      "certificate": {
        // certificate object
      },
      "quoteOptions": {
        "isFirstParty": false
      },
      "transactionVersion": "VERSION_2"
    }
  ]
}
```

## Part 2: Create a payment

Use the API to get the requirements for a payment, accept the quote, and create
a payment.

### 2.1. Get payment requirements

Call the
[`/payments/requirements`](/api-reference/cpn/cpn-platform/get-payment-requirements)
endpoint with the quote ID to get the requirements for a payment. The endpoint
returns an object describing the required fields for the compliance check. The
`optional` field for each parameter defines if the parameter must be included in
the response constructed in the next step.

```shell theme={null}
curl -H "Authorization: Bearer ${YOUR_API_KEY}" \
  -X GET "https://api.circle.com/v1/cpn/payments/requirements?quoteId=${QUOTE_ID}"
```

**Response**

```json theme={null}
{
  "data": {
    "travelRule": [
      {
        "name": "ORIGINATOR_FINANCIAL_INSTITUTION_NAME",
        "type": "TEXT",
        "optional": false
      },
      {
        "name": "ORIGINATOR_FINANCIAL_INSTITUTION_ADDRESS",
        "type": "ADDRESS",
        "optional": false
      },
      {
        "name": "ORIGINATOR_FINANCIAL_INSTITUTION_ID",
        "type": "TEXT",
        "optional": true
      },
      {
        "name": "ORIGINATOR_NAME",
        "type": "TEXT",
        "optional": false
      },
      {
        "name": "ORIGINATOR_ACCOUNT_NUMBER",
        "type": "TEXT",
        "optional": false
      },
      {
        "name": "ORIGINATOR_ADDRESS",
        "type": "ADDRESS",
        "optional": false
      },
      {
        "name": "BENEFICIARY_NAME",
        "type": "TEXT",
        "optional": false
      },
      {
        "name": "BENEFICIARY_ADDRESS",
        "type": "ADDRESS",
        "optional": false
      },
      {
        "name": "ORIGINATOR_DATE_OF_BIRTH",
        "type": "TEXT",
        "optional": true
      },
      {
        "name": "ORIGINATOR_NATIONALITY",
        "type": "TEXT",
        "optional": true
      },
      {
        "name": "ORIGINATOR_NATIONAL_IDENTIFICATION_NUMBER",
        "type": "TEXT",
        "optional": true
      },
      {
        "name": "BENEFICIARY_DATE_OF_BIRTH",
        "type": "TEXT",
        "optional": true
      },
      {
        "name": "BENEFICIARY_NATIONALITY",
        "type": "TEXT",
        "optional": true
      },
      {
        "name": "BENEFICIARY_NATIONAL_IDENTIFICATION_NUMBER",
        "type": "TEXT",
        "optional": false
      },
      {
        "name": "BENEFICIARY_PHONE_NUMBER",
        "type": "TEXT",
        "optional": true
      },
      {
        "name": "BENEFICIARY_EMAIL",
        "type": "TEXT",
        "optional": true
      }
    ],
    "beneficiaryAccount": [
      {
        "name": "CLABE",
        "type": "TEXT",
        "optional": false
      }
    ]
  }
}
```

### 2.2. Encrypt the required fields

Construct a JSON object with the information requested in the previous step. For
each schema, the properties that you must include are outlined by the `optional`
field. Encrypt the object with the `jwk` certificate provided in the quote
response.

The correct format for travel rule data and beneficiary account data is a JSON
array of objects where each object contains two properties: `name` and `value`.
You can review an example of each field in how to
[Encrypt Travel Rule Data](/cpn/guides/payments/encrypt-travel-rule-beneficiary-data#step-4-prepare-the-payload).

Create a file called `cpn_encryption.py` and put the following code in it,
replacing the `requirements_response_json` parameter with the contents of the
response from the previous step, and the `certificate_json` parameter with the
`jwk` from the quote response. When you run the script, it outputs the encrypted
beneficiary and travel rule data to the console.

```python Python theme={null}
"""
CPN Requirements Encryption Quickstart

This script demonstrates how to:
1. Parse the Requirements response
2. Generate realistic test data matching the fields
3. Encrypt data using JWE for CPN API integration

Usage:
1. Replace certificate_json with your JWK from Quote response
2. Replace requirements_response_json with your Requirements response
3. Run the script to get encrypted data for creating payment API requests
"""

import json
import os
import base64
import random
from typing import Dict, Any, Optional, List
from jwcrypto import jwk, jwe

# ========================================
# Test Data Lists for Realistic Generation
# ========================================

FIRST_NAMES = [
    "James", "John", "Robert", "Michael", "William", "David", "Joseph", "Thomas",
    "Charles", "Mary", "Patricia", "Jennifer", "Linda", "Elizabeth", "Barbara",
    "Susan", "Jessica", "Sarah", "Karen", "Nancy"
]

LAST_NAMES = [
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
    "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson",
    "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin"
]

STREET_TYPES = ["St", "Ave", "Blvd", "Rd", "Ln", "Dr", "Way", "Circle", "Court"]
STREET_NAMES = [
    "Main", "Oak", "Maple", "Cedar", "Pine", "Elm", "Washington", "Lake", "Hill",
    "River", "Valley", "Park", "Spring", "Market", "Church", "Bridge", "Highland"
]

CITIES = [
    "New York", "Los Angeles", "Chicago", "Houston", "Phoenix", "Philadelphia",
    "San Antonio", "San Diego", "Dallas", "San Jose", "Austin", "Jacksonville",
    "Fort Worth", "Columbus", "San Francisco", "Charlotte", "Indianapolis",
    "Seattle", "Denver", "Washington"
]

# ========================================
# Helper Functions
# ========================================

def generate_random_name() -> str:
    """Generate a random realistic name."""
    return f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"

def generate_random_address() -> Dict[str, str]:
    """Generate a random realistic address."""
    street_number = str(random.randint(1, 9999))
    street_name = random.choice(STREET_NAMES)
    street_type = random.choice(STREET_TYPES)
    return {
        "street": f"{street_number} {street_name} {street_type}",
        "city": random.choice(CITIES),
        "country": "US",
        "postalCode": f"{random.randint(10000, 99999)}"
    }

def random_string(length: int = 12) -> str:
    """Generate a random string of given length."""
    return base64.b64encode(os.urandom(length)).decode()[:length]

def get_originator_name(case: Optional[str] = None) -> str:
    """Get the originator name based on test case."""
    if case == 'rfi-failed':
        return "Failed"
    return "Alice Johnson"  # Default for success case

# ========================================
# Core Data Generation
# ========================================

def generate_group_data(fields: List[Dict[str, Any]], originator_name: str) -> List[Dict[str, Any]]:
    """
    Generate test data matching Requirements fields as an array of {name, value}.

    Args:
        fields: List of field objects from Requirements
        originator_name: Name to use for originator fields

    Returns:
        List[{"name": str, "value": Any}] for required fields
    """
    items: List[Dict[str, Any]] = []

    for field in fields:
        name = field["name"]
        field_type = field["type"].upper()
        optional = field.get("optional", False)

        if optional:
            continue  # only include required fields

        # Address fields
        if field_type == "ADDRESS" or "ADDRESS" in name.upper():
            items.append({"name": name, "value": generate_random_address()})

        # Text fields
        elif field_type == "TEXT":
            if "NAME" in name.upper():
                if "ORIGINATOR" in name.upper():
                    items.append({"name": name, "value": originator_name})
                else:
                    items.append({"name": name, "value": generate_random_name()})
            elif "CLABE" in name.upper():
                items.append({"name": name, "value": ''.join(str(random.randint(0, 9)) for _ in range(18))})
            elif "ACCOUNT" in name.upper():
                items.append({"name": name, "value": ''.join(str(random.randint(0, 9)) for _ in range(12))})
            elif "DATE" in name.upper() or "BIRTH" in name.upper():
                year = random.randint(1970, 2000)
                month = random.randint(1, 12)
                day = random.randint(1, 28)
                items.append({"name": name, "value": f"{year:04d}-{month:02d}-{day:02d}"})
            elif "EMAIL" in name.upper():
                items.append({"name": name, "value": f"{random_string(8)}@example.com"})
            else:
                items.append({"name": name, "value": random_string(12)})

    return items

# ========================================
# Encryption
# ========================================

def encrypt_data(data: Any, jwk_data: Dict[str, Any]) -> str:
    """
    Encrypt data using JWE with provided JWK.

    Args:
        data: Data to encrypt (will be JSON serialized)
        jwk_data: JWK from certificate

    Returns:
        Encrypted JWE string
    """
    recipient_key = jwk.JWK(**jwk_data)
    jwe_obj = jwe.JWE(
        plaintext=json.dumps(data).encode(),
        protected=json.dumps({"alg": "ECDH-ES+A128KW", "enc": "A128GCM"})
    )
    jwe_obj.add_recipient(recipient_key)
    return jwe_obj.serialize(True)

# ========================================
# Configuration - Replace with your data
# ========================================

# Certificate JWK - copy from Quote response
# e.g. {"kty":"EC","crv":"P-256","kid":"263...5762","x":"Ydj...2Y","y":"n621...i8"}
certificate_json = '''certificate_json'''

# Requirements response - copy from Requirements API
# e.g. {"data": {"travelRule": [...], "beneficiaryAccount": [...]}}
requirements_response_json = '''requirements_response_json'''

# ========================================
# Main Execution
# ========================================

if __name__ == "__main__":
    # Parse configuration
    certificate = json.loads(certificate_json)
    required_fields = json.loads(requirements_response_json)

    # Extract field arrays
    travel_rule_fields = required_fields['data']['travelRule']
    beneficiary_account_fields = required_fields['data']['beneficiaryAccount']

    # Generate test data (array of {name, value})
    test_data = {
        "travelRuleData": generate_group_data(travel_rule_fields, get_originator_name()),
        "beneficiaryAccountData": generate_group_data(beneficiary_account_fields, get_originator_name())
    }

    # Create encrypted data (encrypt arrays directly)
    travel_rule_encrypted = encrypt_data(test_data["travelRuleData"], certificate)
    beneficiary_account_encrypted = encrypt_data(test_data["beneficiaryAccountData"], certificate)

    # Output encrypted data ready for API
    print(f"Travel Rule encryptedData: {travel_rule_encrypted}\n")
    print(f"Beneficiary Account encryptedData: {beneficiary_account_encrypted}")
```

### 2.3. Create a payment

After the quote is accepted, create a payment by calling the
[`/payments`](/api-reference/cpn/cpn-platform/create-payment) endpoint. You need
to provide the quote ID, encrypted sender and receiver information, and a
`refundAddress`. The endpoint returns a unique payment ID and the initial status
of the payment.

The `refundAddress` is the wallet address that receives the funds if the payment
fails. It must be on the same blockchain as `senderAddress` but can be a
different wallet address.

Send the `useCase` that your quote's `senderType` and `recipientType` imply, as
described in [Part 1](#part-1-request-a-quote). The quote in this quickstart
uses `INDIVIDUAL` for both, so the payment sends `C2C`.

<Note>
  You must create the payment before the quote expires. If the quote has
  expired, request a new quote and restart from Part 1. Once the payment is
  created, save the payment `id` and `expireDate`. You must complete the onchain
  transaction before the payment expires.
</Note>

```bash Shell theme={null}
curl --request POST \
  --url https://api.circle.com/v1/cpn/payments \
  --header 'Accept: application/json' \
  --header 'Authorization: Bearer ${YOUR_API_KEY}' \
  --header 'Content-type: application/json' \
  --data '
{
  "idempotencyKey" : "${randomUUID}",
  "quoteId" : "${cpn_ofi_quote_id}",
  "beneficiaryAccountData" : "${encrypted_beneficiary_data}",
  "travelRuleData" : "${encrypted_travel_rule_data}",
  "senderAddress" : "${YOUR_WALLET_ADDRESS}",
  "refundAddress" : "${YOUR_WALLET_ADDRESS}",
  "blockchain" : "ETH-SEPOLIA",
  "reasonForPayment" : "PMT001",
  "customerRefId" : "123c7442-e843-4afa-bfad-35f50636d35b",
  "refCode" : "7b479c5a-3684-4423-9fc6-f7c890c0e816",
  "useCase" : "C2C"
}
'
```

**Response**

```json JSON theme={null}
{
  "data": {
    "id": "07dbe320-6bcb-475b-8d21-17b57263cd3e",
    "quoteId": "922a06cd-ff1e-4ee4-840e-54006893fd1a",
    "blockchain": "ETH-SEPOLIA",
    "paymentMethodType": "SPEI",
    "sourceAmount": {
      "amount": "10.000000",
      "currency": "USDC"
    },
    "destinationAmount": {
      "amount": "200.23",
      "currency": "MXN"
    },
    "status": "CRYPTO_FUNDS_PENDING",
    "refCode": "7b479c5a-3684-4423-9fc6-f7c890c0e816",
    "customerRefId": "123c7442-e843-4afa-bfad-35f50636d35b",
    "useCase": "C2C",
    "expireDate": "2025-03-31T20:59:21.211547Z",
    "createDate": "2025-03-31T18:59:30.183044Z",
    "fees": {
      "totalAmount": {
        "amount": "0.170000",
        "currency": "USDC"
      },
      "breakdown": [
        {
          "type": "TAX_FEE",
          "amount": {
            "amount": "0.070000",
            "currency": "USDC"
          }
        },
        {
          "type": "BFI_TRANSACTION_FEE",
          "amount": {
            "amount": "0.100000",
            "currency": "USDC"
          }
        }
      ]
    },
    "fiatSettlementTime": {
      "min": "1",
      "max": "12",
      "unit": "HOURS"
    },
    "rfis": [],
    "onChainTransactions": []
  }
}
```

## Part 3: Create a transaction

Use the API to create a blockchain transaction to transfer USDC. Sign the
transaction locally, and use the API to broadcast it to the blockchain.

<Note>
  This quickstart uses Circle Wallets (or your equivalent operational wallet) as
  the originator wallet. Use the wallet ID from the
  [prerequisites](#prerequisites) section, including any funding you completed
  via the Circle Wallet or Circle On/Off-Ramps how-tos.
</Note>

### 3.1. Initiate the onchain transaction

Initiate the onchain funds transfer by calling the
[create transaction V2](/api-reference/cpn/cpn-platform/create-transaction-v2)
endpoint with the payment ID from the previous step, and other
transaction-related parameters. The endpoint returns an unsigned onchain
transaction object and a transaction ID.

```shell theme={null}
curl --request POST \
  --url https://api.circle.com/v2/cpn/payments/:paymentId/transactions \
  --header 'Accept: application/json' \
  --header 'Authorization: Bearer ${YOUR_API_KEY}' \
  --header 'Content-Type: application/json' \
  --data '
{
  "idempotencyKey" : "${RANDOM_UUID}"
}
'
```

**Response**

```json theme={null}
{
  "data": {
    "id": "dbc27d23-cd4f-447e-855e-349cb2853d23",
    "status": "CREATED",
    "paymentId": "49d4231e-6c4f-319e-946d-ed8c8bab5abc",
    "expireDate": "2025-09-08T20:02:06.651391Z",
    "blockchain": "ETH-SEPOLIA",
    "senderAddress": "0x57414adbBbc4BBA36f1dE26b2dc1648b28ae7799",
    "destinationAddress": "0xc75c3e371d617b3e60db1b6f3fa2f0689562e5a7",
    "amount": {
      "amount": "15.000000",
      "currency": "USDC"
    },
    "messageType": "PAYMENT_SETTLEMENT_CONTRACT_V1_0_PAYMENT_INTENT",
    "messageToBeSigned": {
      "domain": {
        "name": "Permit2",
        "chainId": "11155111",
        "verifyingContract": "0x000000000022D473030F116dDEE9F6B43aC78BA3"
      },
      "message": {
        "permitted": {
          "token": "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
          "amount": "14174474"
        },
        "spender": "0xe2B17D0C1736dc7C462ABc4233C91BDb9F27DD1d",
        "nonce": "25668617285137697861288274946631174355105919960416755114569514179393151588120",
        "deadline": "1757362866",
        "witness": {
          "from": "0x57414adbBbc4BBA36f1dE26b2dc1648b28ae7799",
          "to": "0xc75c3e371d617b3e60db1b6f3fa2f0689562e5a7",
          "value": 14174474,
          "validAfter": "1757358106",
          "validBefore": "1757361726",
          "nonce": "0x38bfec2b230187932870d575132e8ae1f83b34c10e3bf6d64c377f0c13245718",
          "beneficiary": "0x4f1c3a0359A7fAd8Fa8E9E872F7C06dAd97C91Fd",
          "maxFee": "0",
          "attester": "0x768919ef04853b5fd444ccff48cea154768a0291",
          "requirePayeeSign": false
        }
      },
      "primaryType": "PermitWitnessTransferFrom",
      "types": {
        "EIP712Domain": [
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "chainId",
            "type": "uint256"
          },
          {
            "name": "verifyingContract",
            "type": "address"
          }
        ],
        "PermitWitnessTransferFrom": [
          {
            "name": "permitted",
            "type": "TokenPermissions"
          },
          {
            "name": "spender",
            "type": "address"
          },
          {
            "name": "nonce",
            "type": "uint256"
          },
          {
            "name": "deadline",
            "type": "uint256"
          },
          {
            "name": "witness",
            "type": "PaymentIntent"
          }
        ],
        "TokenPermissions": [
          {
            "name": "token",
            "type": "address"
          },
          {
            "name": "amount",
            "type": "uint256"
          }
        ],
        "PaymentIntent": [
          {
            "name": "from",
            "type": "address"
          },
          {
            "name": "to",
            "type": "address"
          },
          {
            "name": "value",
            "type": "uint256"
          },
          {
            "name": "validAfter",
            "type": "uint256"
          },
          {
            "name": "validBefore",
            "type": "uint256"
          },
          {
            "name": "nonce",
            "type": "bytes32"
          },
          {
            "name": "beneficiary",
            "type": "address"
          },
          {
            "name": "maxFee",
            "type": "uint256"
          },
          {
            "name": "requirePayeeSign",
            "type": "bool"
          },
          {
            "name": "attester",
            "type": "address"
          }
        ]
      }
    },
    "metadata": {}
  }
}
```

### 3.2 Sign the onchain transaction

<Note>
  The following steps are for EVM blockchains. For Solana, you would follow a
  similar process with some differences in the signing. Refer to how to [Create
  an Onchain Transaction](/cpn/guides/transactions/create-an-onchain-txn) for
  more information.
</Note>

Using the
[`/sign/typedData`](/api-reference/wallets/developer-controlled-wallets/sign-typed-data)
endpoint, input the `messageToBeSigned` object from the previous step along with
your entity secret and wallet ID. The transaction parameter should be
[stringified](https://jsonformatter.org/json-stringify-online) from the
`messageToBeSigned` field from the transaction response.

```bash Shell theme={null}
curl --request POST \
  --url https://api.circle.com/v1/w3s/developer/sign/typedData \
  --header 'Accept: application/json' \
  --header 'authorization: Bearer ${YOUR_API_KEY}' \
  --header 'Content-Type: application/json' \
  --data '
{
  "entitySecretCiphertext": "qXnnGgbsU5lBUGiW9kp2/ltuvSSWW4qJ4/9VKuQT7wd6+ge2y7xqYnEc0pHbqLuj+YBDaPMfRUl1X+K1hbyiPTRVjCqHD5x3DyLtj8eTG/GmIimYfXOveXIJjsT95T8bI9uJ9kxygYAQbNev6wX993OYTYZ8D2PfVLUV3BicTSiClqhgSLW1Nh0qJ+TK0p2rOHs2HZkGA/WTv4SQv+uq//wEbUWFmrrD/ToTSuv3tMQvluCMYDF9xO/F6EoQwmP/XJCpPihGZuvrweTnhHbNWe5suvSSKpB+8Yo6f24ttNtCwvHrLBVaF6U9EZrCRpCydHJuuVBf5j7AD0JPC2DPFAG2p/Upq/KdzF1r8GJ4j2SsFLyzQEAw3ZAl623UiB/F3Szu2T/fYeF0rkfNt6tYKqmCmhvlzvn8BBkgIXsdcoEmNsf4x7b7UwPk9EloTibF4MhkGIW7jDHWWXlL3gKpGzMug+A2bIYdwUtqQ+u65pDi4+o+tuEH8MtM9Mmt3YaP2Zr40wj/uMnRv53hc+Apzsvh6UIsmliK2ldPyfXg77eDEzU7E228al/jIi2YQacQLNAAV870v3iKFB0PeWiUNtVlUdnqXmZkMA/bmg4TOo05ROGJWkfPVFWUNoocyEvCfEasj0ZflfbO8W2Q0M9BqhqjU/WHEBrYnF65ytY0A+8=",
  "data": "{\"domain\":{\"chainId\":\"11155111\",\"name\":\"USDC\",\"verifyingContract\":\"0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238\",\"version\":\"2\"},\"message\":{\"from\":\"0x39fd73b03a01c6230b5e0d946e1960d79db44fd8\",\"nonce\":\"0x854f1f66cb7cb0e266e17a3715c24c8dae1eb540c4eb00a7a1b39f4bfa9bcf09\",\"to\":\"0x6734b39043f1029f8d5f1b6948d5417b75a72cf8\",\"validAfter\":\"1743522751\",\"validBefore\":\"1743530842\",\"value\":\"10000000\"},\"primaryType\":\"TransferWithAuthorization\",\"types\":{\"EIP712Domain\":[{\"name\":\"name\",\"type\":\"string\"},{\"name\":\"version\",\"type\":\"string\"},{\"name\":\"chainId\",\"type\":\"uint256\"},{\"name\":\"verifyingContract\",\"type\":\"address\"}],\"TransferWithAuthorization\":[{\"name\":\"from\",\"type\":\"address\"},{\"name\":\"to\",\"type\":\"address\"},{\"name\":\"value\",\"type\":\"uint256\"},{\"name\":\"validAfter\",\"type\":\"uint256\"},{\"name\":\"validBefore\",\"type\":\"uint256\"},{\"name\":\"nonce\",\"type\":\"bytes32\"}]}}",
  "walletId": "${YOUR_CIRCLE_WALLET_ID}"
}
'
```

**Response**

```json JSON theme={null}
{
  "signature": "0x905d70de3f1d9e86b982f6aee2755807fcd50a11cd9035bf47845c856be920fc3b7af8d06bf953bfdecdcea4cc9250aeaeb178b50116774d6bfab37bcc3757621c"
}
```

### 3.3. Submit the signed transaction

Use the
[`/v2/cpn/payments/{paymentId}/transactions/{transactionId}/submit`](/api-reference/cpn/cpn-platform/submit-transaction-v2)
endpoint to submit the transaction to be broadcast to the blockchain. You should
submit the EIP-712 typed data signature you obtained from the `/sign/typedData`
endpoint in [step 3.2.](#3-2-sign-the-onchain-transaction) as
`signedTransaction`.

```bash Shell theme={null}
curl --request POST \
  --url https://api.circle.com/v2/cpn/payments/:paymentId/transactions/:transactionId/submit \
  --header 'Accept: application/json' \
  --header 'Authorization: Bearer ${YOUR_API_KEY}' \
  --header 'Content-type: application/json' \
  --data '
{
  "signedTransaction": "0x12b5fb72e99f9bb0300d2eb66a6d89dd5a667f43669893cf14bfcc390754dcb61b69f92cba598ec83a184e11c97e3bb9964a2bfd7a09688eee63f586ad9ccae21c"
}
'
```

**Response**

```json JSON theme={null}
{
  "data": {
    "id": "5cae9e1c-f3e3-44e5-ac36-d78f4ff9c56e",
    "status": "PENDING",
    "paymentId": "2b2b314a-0c06-39bb-b111-506f56599a17",
    "expireDate": "2025-11-12T00:08:42.000875Z",
    "blockchain": "ETH-SEPOLIA",
    "senderAddress": "0x57414adbBbc4BBA36f1dE26b2dc1648b28ae7799",
    "destinationAddress": "0xded12af48fb343b446bcbe739c5211636896362b",
    "amount": {
      "amount": "11.948672",
      "currency": "USDC"
    },
    "messageType": "PAYMENT_SETTLEMENT_CONTRACT_V1_0_PAYMENT_INTENT",
    "messageToBeSigned": {
      "domain": {
        "name": "Permit2",
        "chainId": "11155111",
        "verifyingContract": "0x000000000022D473030F116dDEE9F6B43aC78BA3"
      },
      "message": {
        "permitted": {
          "token": "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
          "amount": "11948672"
        },
        "spender": "0x8ea7239f185CC32AB1Ff698f1b1A3aAB615D6d2c",
        "nonce": "55519981872451242578307489093459806523820915276389791540432104685160022674073",
        "deadline": "1762907262",
        "witness": {
          "from": "0x57414adbBbc4BBA36f1dE26b2dc1648b28ae7799",
          "to": "0xded12af48fb343b446bcbe739c5211636896362b",
          "value": 11048874,
          "validAfter": "1762901905",
          "validBefore": "1762906122",
          "nonce": "0x7abf323679377bff4d064e663e44b7064985eab99693dec4a9e8a9f941a80a99",
          "beneficiary": "0x8049E74C07A6BAdc8ddeB7C3530Ab9Af30037211",
          "maxFee": "899798",
          "attester": "0xcf9e077c75ce6bd22f48163e559d20b10708ae85",
          "requirePayeeSign": false
        }
      },
      "primaryType": "PermitWitnessTransferFrom",
      "types": {
        "EIP712Domain": [
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "chainId",
            "type": "uint256"
          },
          {
            "name": "verifyingContract",
            "type": "address"
          }
        ],
        "PermitWitnessTransferFrom": [
          {
            "name": "permitted",
            "type": "TokenPermissions"
          },
          {
            "name": "spender",
            "type": "address"
          },
          {
            "name": "nonce",
            "type": "uint256"
          },
          {
            "name": "deadline",
            "type": "uint256"
          },
          {
            "name": "witness",
            "type": "PaymentIntent"
          }
        ],
        "TokenPermissions": [
          {
            "name": "token",
            "type": "address"
          },
          {
            "name": "amount",
            "type": "uint256"
          }
        ],
        "PaymentIntent": [
          {
            "name": "from",
            "type": "address"
          },
          {
            "name": "to",
            "type": "address"
          },
          {
            "name": "value",
            "type": "uint256"
          },
          {
            "name": "validAfter",
            "type": "uint256"
          },
          {
            "name": "validBefore",
            "type": "uint256"
          },
          {
            "name": "nonce",
            "type": "bytes32"
          },
          {
            "name": "beneficiary",
            "type": "address"
          },
          {
            "name": "maxFee",
            "type": "uint256"
          },
          {
            "name": "requirePayeeSign",
            "type": "bool"
          },
          {
            "name": "attester",
            "type": "address"
          }
        ]
      }
    },
    "encodedMessageToBeSigned": "0xabc6f65eb8b2c264ae486b7244e9ca887cd0f8bd29422f651042665c14974ef3",
    "metadata": {},
    "version": "VERSION_2"
  }
}
```

<Note>
  `transactionHash` will be provided after transaction is in `COMPLETED` status.
  You can monitor for the transactions webhook events to get the
  `transactionHash`.
</Note>

Once the onchain transaction is confirmed by the BFI, the BFI initiates a fiat
payout to the recipient. As the fiat payout progresses, the OFI is notified by
[webhook notifications](/api-reference/webhooks).
