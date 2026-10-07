> ## Documentation Index
> Fetch the complete documentation index at: https://docs.dfns.co/llms.txt
> Use this file to discover all available pages before exploring further.

# Display balances

> How to fetch, convert, and display token balances from DFNS wallets, including decimal handling, USD price quotes, net-worth (portfolio value) valuation, and caching tips.

When you call [Get Wallet Assets](/api-reference/wallets/get-wallet-assets), balances are returned in their smallest unit (wei, satoshi, etc.) as strings:

```json theme={null}
{
  "assets": [
    {
      "kind": "Native",
      "symbol": "ETH",
      "balance": "1500000000000000000",
      "decimals": 18,
      "verified": true
    },
    {
      "kind": "Erc20",
      "contract": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      "symbol": "USDC",
      "balance": "1000000",
      "decimals": 6,
      "verified": true
    }
  ]
}
```

To display a human-readable balance, divide by `10^decimals`. Always use the `decimals` value from the API response. Different tokens use different values (ETH uses 18, USDC uses 6, WBTC uses 8, etc.).

<Warning>
  Never use floating point numbers for balance calculations. Use `BigInt` in TypeScript or `Decimal` in Python to avoid precision loss.
</Warning>

## Converting for display

<CodeGroup>
  ```typescript TypeScript theme={null}
  function formatBalance(balance: string, decimals: number): string {
    const raw = BigInt(balance)
    const divisor = 10n ** BigInt(decimals)

    const wholePart = raw / divisor
    const fractionalPart = raw % divisor

    const fractionalStr = fractionalPart.toString().padStart(decimals, '0')
    const trimmed = fractionalStr.replace(/0+$/, '')

    return trimmed ? `${wholePart}.${trimmed}` : wholePart.toString()
  }

  formatBalance('1500000000000000000', 18) // "1.5"
  formatBalance('1000000', 6)              // "1"
  formatBalance('123456789', 6)            // "123.456789"
  ```

  ```go Go theme={null}
  import "math/big"

  func formatBalance(balance string, decimals int) string {
      raw := new(big.Int)
      raw.SetString(balance, 10)

      divisor := new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(decimals)), nil)

      whole := new(big.Int).Div(raw, divisor)
      remainder := new(big.Int).Mod(raw, divisor)

      if remainder.Sign() == 0 {
          return whole.String()
      }

      fracStr := fmt.Sprintf("%0*s", decimals, remainder.String())
      fracStr = strings.TrimRight(fracStr, "0")
      return whole.String() + "." + fracStr
  }

  formatBalance("1500000000000000000", 18) // "1.5"
  formatBalance("1000000", 6)              // "1"
  formatBalance("123456789", 6)            // "123.456789"
  ```

  ```python Python theme={null}
  from decimal import Decimal

  def format_balance(balance: str, decimals: int) -> str:
      raw = Decimal(balance)
      divisor = Decimal(10 ** decimals)
      return str((raw / divisor).normalize())

  format_balance('1500000000000000000', 18)  # "1.5"
  format_balance('1000000', 6)               # "1"
  format_balance('123456789', 6)             # "123.456789"
  ```

  ```java Java theme={null}
  import java.math.BigDecimal;
  import java.math.BigInteger;

  static String formatBalance(String balance, int decimals) {
      BigDecimal raw = new BigDecimal(new BigInteger(balance));
      BigDecimal divisor = BigDecimal.TEN.pow(decimals);
      return raw.divide(divisor).stripTrailingZeros().toPlainString();
  }

  formatBalance("1500000000000000000", 18); // "1.5"
  formatBalance("1000000", 6);              // "1"
  formatBalance("123456789", 6);            // "123.456789"
  ```
</CodeGroup>

If you're using a web3 library, `formatUnits` does the same thing:

```typescript theme={null}
import { formatUnits } from 'ethers'

formatUnits('1500000000000000000', 18) // "1.5"
```

```typescript theme={null}
import { formatUnits } from 'viem'

formatUnits(1500000000000000000n, 18) // "1.5"
```

## Converting back to raw

When sending a transaction, convert user input back to the smallest unit:

<CodeGroup>
  ```typescript TypeScript theme={null}
  function parseBalance(amount: string, decimals: number): string {
    const [whole, fraction = ''] = amount.split('.')
    const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals)
    return BigInt(whole + paddedFraction).toString()
  }

  parseBalance('0.5', 18) // "500000000000000000"
  ```

  ```go Go theme={null}
  import "math/big"

  func parseBalance(amount string, decimals int) string {
      rat := new(big.Rat)
      rat.SetString(amount)

      multiplier := new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(decimals)), nil)
      rat.Mul(rat, new(big.Rat).SetInt(multiplier))

      return rat.FloatString(0)
  }

  parseBalance("0.5", 18) // "500000000000000000"
  ```

  ```python Python theme={null}
  from decimal import Decimal

  def parse_balance(amount: str, decimals: int) -> str:
      return str(int(Decimal(amount) * Decimal(10 ** decimals)))

  parse_balance('0.5', 18)  # "500000000000000000"
  ```

  ```java Java theme={null}
  import java.math.BigDecimal;

  static String parseBalance(String amount, int decimals) {
      BigDecimal value = new BigDecimal(amount);
      BigDecimal multiplier = BigDecimal.TEN.pow(decimals);
      return value.multiply(multiplier).toBigInteger().toString();
  }

  parseBalance("0.5", 18); // "500000000000000000"
  ```
</CodeGroup>

## USD prices and net worth

[Get Wallet Assets](/api-reference/wallets/get-wallet-assets) can also return the USD market price of each asset and the total fiat value of the wallet, so you don't need a third-party price oracle (Chainlink, CoinGecko, etc.) for standard held-asset valuation.

* Each asset carries a `quotes` object (`assets[].quotes.USD`) with its current USD price.
* Call the endpoint with `?netWorth=true` to also get a top-level `netWorth.USD` field — the summed USD value of all holdings.

```json theme={null}
{
  "assets": [
    {
      "symbol": "USDC",
      "balance": "1000000",
      "decimals": 6,
      "quotes": { "USD": 1.0 }
    }
  ],
  "netWorth": { "USD": 1.0 }
}
```

This is per-wallet held-asset valuation, not a standalone arbitrary-token price-feed API.

## Balance freshness

[Get Wallet Assets](/api-reference/wallets/get-wallet-assets) returns the latest balance recorded by the DFNS indexer, not a live read from the chain. The indexer follows the chain with a short delay, so a just-confirmed deposit usually appears within seconds, but can take a few minutes on busy networks. There is no read-side cache to bust: polling more frequently will not surface a balance the indexer has not yet recorded.

For crediting a specific deposit, use the `value` field in the `wallet.blockchainevent.detected` [webhook](/guides/developers/transaction-monitoring) rather than differencing two Get Wallet Assets reads. Each webhook carries the exact amount for that event; sequential balance reads can both reflect the latest on-chain total and miss intermediate movements when events arrive in bursts.

## Related

<CardGroup cols={2}>
  <Card title="Get Wallet Assets" icon="coins" href="/api-reference/wallets/get-wallet-assets">
    API reference for retrieving balances
  </Card>

  <Card title="Transfer Asset" icon="paper-plane" href="/api-reference/wallets/transfer-asset">
    API reference for transfers
  </Card>
</CardGroup>


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.