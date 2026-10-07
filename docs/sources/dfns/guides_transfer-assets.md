> ## Documentation Index
> Fetch the complete documentation index at: https://docs.dfns.co/llms.txt
> Use this file to discover all available pages before exploring further.

# Transfer assets

> Make a one-off transfer from the DFNS dashboard, or use the transfer API for automated, high-volume, or policy-gated payment flows.

<Note>
  This guide covers transfers from a **wallet**. To move funds held in a **vault**, see [Manage vaults](/guides/manage-vaults) — vault transfers draw from the vault's available balance and follow its quarantine and locked-balance accounting.
</Note>

### Prerequisites

Before you begin, make sure you have the following:

* You are logged into your DFNS account.
* You have a wallet with a sufficient balance of the asset you wish to transfer.
* You know the recipient's wallet address.

<Steps>
  <Step title="Navigate to your source wallet">
    From the main menu on the left, click on the **Wallets** tab. This will display a list of all the wallets in your organization.

    Find and click on the wallet you want to send the asset **from**. This will take you to the wallet's detail page, showing its balances and transaction history.

    <Frame>
      <img src="https://mintcdn.com/dfns-6d8c7466/WTg7j5j7BK29dmnl/images/auto/transferring-assets-1.png?fit=max&auto=format&n=WTg7j5j7BK29dmnl&q=85&s=612148aab83256350d0b14d03a860118" alt="Wallet detail page with the asset Send button highlighted" width="2688" height="1952" data-path="images/auto/transferring-assets-1.png" />
    </Frame>
  </Step>

  <Step title="Initiate the transfer">
    In the assets list, find the asset you want to transfer and click the **Send** button. This will open the transfer modal where you will enter the transaction details.

    Fill in the following fields carefully:

    * **To**: Paste the destination wallet address. Always double-check that the address is correct and corresponds to the correct blockchain network.
    * **Amount**: Enter the amount of the asset you wish to transfer.
    * **Pay the fees with another wallet**: You can chose to use our [Fee Sponsor](/features/fee-sponsors) feature for that transfer. In such case, select the sponsor.

    **Review carefully** to ensure the asset, amount, and recipient address are all correct.

    When you are ready, click **Transfer**.

    <Frame>
      <img src="https://mintcdn.com/dfns-6d8c7466/WTg7j5j7BK29dmnl/images/auto/transferring-assets-2.png?fit=max&auto=format&n=WTg7j5j7BK29dmnl&q=85&s=1a9a879c5ea22fdf6caf818408359d81" alt="Transfer modal with recipient address and amount filled in, Transfer button highlighted" width="2688" height="1672" data-path="images/auto/transferring-assets-2.png" />
    </Frame>

    <Warning>
      **Important**

      Transactions on the blockchain are irreversible. Once confirmed, you cannot cancel or reverse the transfer.
    </Warning>
  </Step>

  <Step title="Wait for policy approval (if applicable)">
    If your organization has security policies in place (e.g., requiring a manager's approval for transactions over a certain amount), your transfer will be placed in a **Pending** state.
  </Step>

  <Step title="Monitor your transaction">
    You can then see your transfer at the top of the list. The status will update in real-time, moving from

    ```mermaid theme={null}
    flowchart LR
      P["Pending Approval\n(someone needs to approve your transfer)"]
      E["Executing"]
      B["Broadcasted"]
      C["Confirmed"]

      P --> E --> B --> C

      style P fill:#fff3cd,stroke:#f0ad4e
      style E fill:#d1ecf1,stroke:#17a2b8
      style B fill:#cfe2ff,stroke:#0d6efd
      style C fill:#d4edda,stroke:#198754
    ```
  </Step>
</Steps>


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.