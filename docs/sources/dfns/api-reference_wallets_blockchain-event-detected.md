> ## Documentation Index
> Fetch the complete documentation index at: https://docs.dfns.co/llms.txt
> Use this file to discover all available pages before exploring further.

# Blockchain event detected

> A wallet event has been confirmed on chain (e.g.: a deposit). The `blockchainEvent.kind` field identifies the type of asset transfer and varies by network and asset (for example `NativeTransfer`, `Erc20Transfer`, `UtxoTransfer`, `SplTransfer`, `Trc20Transfer`); see the full list of event kinds per chain in the [webhook events reference](https://docs.dfns.co/api-reference/webhook-events). The confirmation delay per network is listed [here](https://docs.dfns.co/networks).



## OpenAPI

````yaml /openapi.yaml webhook wallet.blockchainevent.detected
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
paths: {}

````

This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.