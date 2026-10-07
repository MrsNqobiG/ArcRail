/**
 * TEST SUPPORT (not a money path). Recorded DFNS bodies derived from the
 * archived DFNS documentation examples (docs/sources/dfns/, MANIFEST 2026-10-06).
 * Each fixture names its source example and every change made to it. No token,
 * key or secret appears here: challenge identifiers and user-action tokens are
 * generated at test time by the fakes.
 */

/**
 * Get Wallet example [DF:get-wallet `example`], with `network` changed from
 * `Ethereum` to `ArcTestnet` (our only network) and the id made pattern-valid
 * (the example's `x` placeholders are lower-case letters, so it already is).
 */
export function walletFixture(over: Readonly<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: 'wa-1f04s-lqc9q-xxxxxxxxxxxxxxxx',
    network: 'ArcTestnet',
    address: '0x00e3495cf6af59008f22ffaf32d4c92ac33dac47',
    name: 'trading hot wallet',
    signingKey: {
      id: 'key-6ece3-9l565-xxxxxxxxxxxxxxxx',
      scheme: 'ECDSA',
      curve: 'secp256k1',
      publicKey: 'e2375c8c9e87bfcd0be8f29d76c818cabacd51584f72cb2222d49a13b036d84d3d',
    },
    status: 'Active',
    dateCreated: '2023-04-14T20:41:28.715Z',
    custodial: true,
    tags: [],
    ...over,
  };
}

/**
 * Estimate Fees, "EVM EIP-1559" schema [DF:fees], with the documented `example`
 * values of `maxPriorityFeePerGas` ('1500000000'), `maxFeePerGas`
 * ('1626000000000') and `baseFeePerGas` ('1000000000'). `blockNumber` has NO
 * documented example (the schema gives only `type: number`,
 * estimate-fees.md:263–264): 65130478 is our own arbitrary value, kept a JSON
 * number as the schema says. The decoder never reads it.
 */
export function feesFixture(standardMaxFeePerGas = '1626000000000', network = 'ArcTestnet'): Record<string, unknown> {
  const tier = (max: string): Record<string, string> => ({ maxPriorityFeePerGas: '1500000000', maxFeePerGas: max });
  return {
    kind: 'Eip1559',
    network,
    blockNumber: 65130478,
    slow: tier('1626000000000'),
    standard: tier(standardMaxFeePerGas),
    fast: tier('1626000000000'),
    baseFeePerGas: '1000000000',
  };
}

/**
 * Get Wallet Assets [DF:assets]. The two asset rows are the balances guide's
 * example (docs/sources/dfns/guides_developers_displaying-balances.md), with:
 * `symbol` `ETH` → `USDC` (Arc's native token is USDC, C-10); the Erc20
 * `contract` changed from Ethereum's USDC to Arc's USDC ERC-20 (C-12); a float
 * `quotes.USD` added to each row, which the decoder must never read. `walletId`
 * and `network` are added because the schema requires them.
 */
export function walletAssetsFixture(walletId = 'wa-1f04s-lqc9q-xxxxxxxxxxxxxxxx', over: Readonly<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    walletId,
    network: 'ArcTestnet',
    assets: [
      { kind: 'Native', symbol: 'USDC', balance: '1500000000000000000', decimals: 18, verified: true, quotes: { USD: 0.9998 } },
      { kind: 'Erc20', contract: '0x3600000000000000000000000000000000000000', symbol: 'USDC', balance: '1000000', decimals: 6, verified: true, quotes: { USD: 0.9998 } },
    ],
    ...over,
  };
}

/**
 * The `wallet.transfer.requested` webhook example's `data.transferRequest`
 * [DF:events], with: `network` `EthereumSepolia` → `ArcTestnet`; ids taken from
 * the TransferRequest schema `example` values [DF:transfer] so they match the
 * id patterns; the optional `requester.tokenId` dropped (only `userId` is required); the required
 * `metadata` added with a float `quotes.USD`, which
 * the decoder must never read.
 */
export function transferFixture(over: Readonly<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: 'xfr-20g4k-nsdpo-mg6arrifgvid4orn',
    walletId: 'wa-5pfuu-9euek-h0odgb6snva8ph3k',
    network: 'ArcTestnet',
    requester: { userId: 'us-6b58p-r53sr-rlrd3l5cj3uc4ome' },
    requestBody: { kind: 'Native', to: '0xb282dc7cde21717f18337a596e91ded00b79b25f', amount: '1000000000' },
    metadata: { asset: { quotes: { USD: 0.9998 } } },
    dateRequested: '2023-05-08T19:14:25.568Z',
    status: 'Pending',
    ...over,
  };
}

/**
 * The `wallet.transfer.requested` webhook event example [DF:events] as raw text.
 * The archived example has a trailing comma after `timestampSent` (invalid JSON,
 * a documentation defect); it is removed here. `timestampSent` is the example's
 * 1701684144 unless overridden.
 */
export function webhookEventText(over: Readonly<Record<string, unknown>> = {}, transfer: Record<string, unknown> = transferFixture()): string {
  return JSON.stringify({
    id: 'wh-xxx-xxxxxxx',
    kind: 'wallet.transfer.requested',
    date: '2023-12-04T10:02:22.280Z',
    data: { transferRequest: transfer },
    status: '200',
    timestampSent: 1701684144,
    ...over,
  });
}

/** `timestampSent` of the archived webhook example [DF:events]. */
export const EXAMPLE_TIMESTAMP_SENT = 1701684144n;

/** DFNS error body shape [DF:errors "Example"], with the given status and message. */
export function errorBody(status: number, message: string): string {
  return JSON.stringify({ error: { id: '2038837570328299032', status, message, details: {} } });
}
