> ## Documentation Index
> Fetch the complete documentation index at: https://docs.dfns.co/llms.txt
> Use this file to discover all available pages before exploring further.

# API Reference

> Complete API reference for DFNS, including authentication, wallets, keys, transfers, policies, webhooks, and per-network signing endpoints.

<img class="dfnsHero" src="https://mintcdn.com/dfns-6d8c7466/nK-LFGxQwVjg0flm/images/APIReferenceHero.png?fit=max&auto=format&n=nK-LFGxQwVjg0flm&q=85&s=92bb1c56cc9e2ebdc58ace885a7a5508" alt="API Reference" noZoom width="2560" height="720" data-path="images/APIReferenceHero.png" />

## Core objects

Make sure you go through our [core objects documentation](/api-reference/core-objects) to understand the key entities you'll be working with.

## Authentication

This is a key aspect of working with the DFNS API. You'll need to include a token in the headers of your requests to authenticate to all APIs, but also to sign change-inducing requests. See the [API Authorization](/api-reference/auth) documentation for more details.

We use passkeys to replace passwords, you can read all about it in our [credentials documentation](/api-reference/auth/credentials).

## API format & HTTP headers

To ensure correct processing of API calls, please follow these conventions

| Header | Value |
| - | - |
| *Content-type* | `application/json` |
| *User-agent* | `<must not be empty>` |


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.