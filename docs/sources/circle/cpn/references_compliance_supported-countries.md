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

# CPN supported countries

> Countries supported by the Circle Payments Network

The following table shows countries where Circle Payments Network is allowed to
operate. The country code is used in the
[`senderCountry` parameter](/api-reference/cpn/cpn-platform/create-quotes#body-sender-country)
in the CPN API. Note that the not all countries are currently supported by CPN.
Consult the preceding link for the full list of supported countries in the API
reference.

| Country | Country Code | Supported? |
| - | - | - |
| Afghanistan | AF | ❌ |
| Albania | AL | ✅ |
| Algeria | DZ | ✅ |
| American Samoa | AS | ✅ |
| Andorra | AD | ✅ |
| Angola | AO | ✅ |
| Anguilla | AI | ✅ |
| Antigua and Barbuda | AG | ✅ |
| Argentina | AR | ✅ |
| Armenia | AM | ✅ |
| Aruba | AW | ✅ |
| Australia | AU | ✅ |
| Austria | AT | ✅ |
| Azerbaijan | AZ | ✅ |
| Bahamas | BS | ✅ |
| Bahrain | BH | ✅ |
| Bangladesh | BD | ✅ |
| Barbados | BB | ✅ |
| Belarus | BY | ❌ |
| Belgium | BE | ✅ |
| Belize | BZ | ✅ |
| Benin | BJ | ✅ |
| Bermuda | BM | ✅ |
| Bhutan | BT | ✅ |
| Bolivia | BO | ✅ |
| Bonaire | BQ | ✅ |
| Bosnia and Herzegovina | BA | ✅ |
| Botswana | BW | ✅ |
| Bouvet Island | BV | ✅ |
| Brazil | BR | ✅ |
| British Indian Ocean Territory | IO | ✅ |
| Brunei Darussalam | BN | ✅ |
| Bulgaria | BG | ✅ |
| Burkina Faso | BF | ✅ |
| Burundi | BI | ✅ |
| Cabo Verde | CV | ✅ |
| Cambodia | KH | ✅ |
| Cameroon | CM | ✅ |
| Canada | CA | ✅ |
| Cayman Islands | KY | ✅ |
| Central African Republic | CF | ❌ |
| Chad | TD | ✅ |
| Chile | CL | ✅ |
| China | CN | ✅ |
| Christmas Island | CX | ✅ |
| Cocos (Keeling) Islands | CC | ✅ |
| Colombia | CO | ✅ |
| Comoros | KM | ✅ |
| Congo | CG | ✅ |
| Congo, Democratic Republic of the | CD | ❌ |
| Cook Islands | CK | ✅ |
| Costa Rica | CR | ✅ |
| Croatia | HR | ✅ |
| Cuba | CU | ❌ |
| Curacao | CW | ✅ |
| Cyprus | CY | ✅ |
| Czechia | CZ | ✅ |
| Cote d'Ivoire | CI | ✅ |
| Denmark | DK | ✅ |
| Djibouti | DJ | ✅ |
| Dominica | DM | ✅ |
| Dominican Republic | DO | ✅ |
| Ecuador | EC | ✅ |
| Egypt | EG | ✅ |
| El Salvador | SV | ✅ |
| Equatorial Guinea | GQ | ✅ |
| Eritrea | ER | ✅ |
| Estonia | EE | ✅ |
| Eswatini | SZ | ✅ |
| Ethiopia | ET | ✅ |
| Falkland Islands (Malvinas) | FK | ✅ |
| Faroe Islands | FO | ✅ |
| Fiji | FJ | ✅ |
| Finland | FI | ✅ |
| France | FR | ✅ |
| French Guiana | GF | ✅ |
| French Polynesia | PF | ✅ |
| French Southern Territories | TF | ✅ |
| Gabon | GA | ✅ |
| Gambia | GM | ✅ |
| Georgia | GE | ✅ |
| Germany | DE | ✅ |
| Ghana | GH | ✅ |
| Gibraltar | GI | ✅ |
| Greece | GR | ✅ |
| Greenland | GL | ✅ |
| Grenada | GD | ✅ |
| Guadeloupe | GP | ✅ |
| Guam | GU | ✅ |
| Guatemala | GT | ✅ |
| Guernsey | GG | ✅ |
| Guinea | GN | ✅ |
| Guinea-Bissau | GW | ❌ |
| Guyana | GY | ✅ |
| Haiti | HT | ✅ |
| Heard Island and McDonald Islands | HM | ✅ |
| Honduras | HN | ✅ |
| Hong Kong | HK | ✅ |
| Hungary | HU | ✅ |
| Iceland | IS | ✅ |
| India | IN | ✅ |
| Indonesia | ID | ✅ |
| Iran | IR | ❌ |
| Iraq | IQ | ❌ |
| Ireland | IE | ✅ |
| Isle of Man | IM | ✅ |
| Israel | IL | ✅ |
| Italy | IT | ✅ |
| Jamaica | JM | ✅ |
| Japan | JP | ✅ |
| Jersey | JE | ✅ |
| Jordan | JO | ✅ |
| Kazakhstan | KZ | ✅ |
| Kenya | KE | ✅ |
| Kiribati | KI | ✅ |
| Korea, Democratic People's Republic of | KP | ❌ |
| Korea, Republic of | KR | ✅ |
| Kuwait | KW | ✅ |
| Kyrgyzstan | KG | ✅ |
| Laos | LA | ❌ |
| Latvia | LV | ✅ |
| Lebanon | LB | ✅ |
| Lesotho | LS | ✅ |
| Liberia | LR | ✅ |
| Libya | LY | ❌ |
| Liechtenstein | LI | ✅ |
| Lithuania | LT | ✅ |
| Luxembourg | LU | ✅ |
| Macao | MO | ✅ |
| Madagascar | MG | ✅ |
| Malawi | MW | ✅ |
| Malaysia | MY | ✅ |
| Maldives | MV | ✅ |
| Mali | ML | ❌ |
| Malta | MT | ✅ |
| Marshall Islands | MH | ✅ |
| Martinique | MQ | ✅ |
| Mauritania | MR | ✅ |
| Mauritius | MU | ✅ |
| Mayotte | YT | ✅ |
| Mexico | MX | ✅ |
| Micronesia | FM | ✅ |
| Moldova | MD | ✅ |
| Monaco | MC | ✅ |
| Mongolia | MN | ✅ |
| Montenegro | ME | ✅ |
| Montserrat | MS | ✅ |
| Morocco | MA | ✅ |
| Mozambique | MZ | ✅ |
| Myanmar | MM | ❌ |
| Namibia | NA | ✅ |
| Nauru | NR | ✅ |
| Nepal | NP | ✅ |
| Netherlands | NL | ✅ |
| New Caledonia | NC | ✅ |
| New Zealand | NZ | ✅ |
| Nicaragua | NI | ✅ |
| Niger | NE | ✅ |
| Nigeria | NG | ✅ |
| Niue | NU | ✅ |
| Norfolk Island | NF | ✅ |
| Northern Mariana Islands | MP | ✅ |
| Norway | NO | ✅ |
| Oman | OM | ✅ |
| Pakistan | PK | ✅ |
| Palau | PW | ✅ |
| Palestine, State of | PS | ✅ |
| Panama | PA | ✅ |
| Papua New Guinea | PG | ✅ |
| Paraguay | PY | ✅ |
| Peru | PE | ✅ |
| Philippines | PH | ✅ |
| Pitcairn | PN | ✅ |
| Poland | PL | ✅ |
| Portugal | PT | ✅ |
| Puerto Rico | PR | ✅ |
| Qatar | QA | ✅ |
| Republic of North Macedonia | MK | ✅ |
| Romania | RO | ✅ |
| Russia | RU | ❌ |
| Rwanda | RW | ✅ |
| Reunion | RE | ✅ |
| Saint Barthélemy | BL | ✅ |
| Saint Helena, Ascension and Tristan da Cunha | SH | ✅ |
| Saint Kitts and Nevis | KN | ✅ |
| Saint Lucia | LC | ✅ |
| Saint Martin (French part) | MF | ✅ |
| Saint Pierre and Miquelon | PM | ✅ |
| Saint Vincent and the Grenadines | VC | ✅ |
| Samoa | WS | ✅ |
| San Marino | SM | ✅ |
| Sao Tome and Principe | ST | ✅ |
| Saudi Arabia | SA | ✅ |
| Senegal | SN | ✅ |
| Serbia | RS | ✅ |
| Seychelles | SC | ✅ |
| Sierra Leone | SL | ✅ |
| Singapore | SG | ✅ |
| Sint Maarten (Dutch part) | SX | ✅ |
| Slovakia | SK | ✅ |
| Slovenia | SI | ✅ |
| Solomon Islands | SB | ✅ |
| Somalia | SO | ❌ |
| South Africa | ZA | ✅ |
| South Georgia and the South Sandwich Islands | GS | ✅ |
| South Sudan | SS | ❌ |
| Spain | ES | ✅ |
| Sri Lanka | LK | ✅ |
| Sudan | SD | ❌ |
| Suriname | SR | ✅ |
| Svalbard and Jan Mayen | SJ | ✅ |
| Sweden | SE | ✅ |
| Switzerland | CH | ✅ |
| Syrian Arab Republic | SY | ❌ |
| Taiwan | TW | ✅ |
| Tajikistan | TJ | ✅ |
| Tanzania, United Republic of | TZ | ✅ |
| Thailand | TH | ✅ |
| Timor-Leste | TL | ✅ |
| Togo | TG | ✅ |
| Tokelau | TK | ✅ |
| Tonga | TO | ✅ |
| Trinidad and Tobago | TT | ✅ |
| Tunisia | TN | ✅ |
| Turkey | TR | ✅ |
| Turkmenistan | TM | ✅ |
| Turks and Caicos Islands | TC | ✅ |
| Tuvalu | TV | ✅ |
| Uganda | UG | ✅ |
| Ukraine | UA | ❌ |
| United Arab Emirates | AE | ✅ |
| United Kingdom | GB | ✅ |
| United States of America | US | ✅ |
| United States Minor Outlying Islands | UM | ✅ |
| Uruguay | UY | ✅ |
| Uzbekistan | UZ | ✅ |
| Vanuatu | VU | ✅ |
| Venezuela | VE | ❌ |
| Vietnam | VN | ✅ |
| Virgin Islands, British | VG | ✅ |
| Virgin Islands, U.S. | VI | ✅ |
| Wallis and Futuna | WF | ✅ |
| Western Sahara | EH | ✅ |
| Yemen | YE | ❌ |
| Zambia | ZM | ✅ |
| Zimbabwe | ZW | ✅ |
| Aland Islands | AX | ✅ |
