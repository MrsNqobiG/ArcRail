## §2 Mission

Enable Arc Network as an **additional settlement rail** on our existing core banking system, so that the bank and its merchant clients can receive, hold, send and settle in **USD stablecoins (USDC first)** on Arc. Design the asset model so other Arc assets can be added later through configuration plus review, not rewrites.

**The existing CBS remains the system of record** for customers, KYC/KYB, accounts, balances, fees, AML case management and the general ledger. You build an **Arc Rail Adapter**: a separate bounded context that talks to Arc on one side and to the CBS through an **anti-corruption layer** on the other.

**Out of scope:** rebuilding onboarding/KYC, the core ledger, card acquiring, earned-wage access, accounting features, the ARC token, any custom smart contract (unless an ADR is approved at G1), and **anything on Arc mainnet**.
