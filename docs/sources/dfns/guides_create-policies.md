> ## Documentation Index
> Fetch the complete documentation index at: https://docs.dfns.co/llms.txt
> Use this file to discover all available pages before exploring further.

# Create policies

> Replicate your internal approval and risk controls in DFNS by configuring policies for transfers, signing, permissions, and policy changes.

export const Youtube = props => {
  return <iframe className="w-full aspect-video rounded-xl" src={`https://www.youtube.com/embed/${props.videoId}`} title="YouTube video player" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen>
      </iframe>;
};

<Youtube videoId="IICkUb4ZmL4" />

Policies are a programmable set of safeguards behind all actions on the DFNS infrastructure. You can configure them to validate actions taken in your organization. For more details, please read the dedicated section: [policy-engine](/core-concepts/policies)

<Tip>
  **Pro tip: initial policies you should create**

  We recommend setting up three initial Policies in order to lock down your organization:

  1. **Permission Assignment:** requiring quorum approval before assigning permissions to any user. This way a rogue admin cannot create fake users with elevated permissions by himself.
  2. **Permission Modification:** ensure permission sets cannot be modified without quorum approval, to prevent a rogue actor to elevate existing roles by whitelisting extra actions.
  3. **Policy Modification:** a policy preventing to change policies. That's to make sure your established policies stay in place and a quorum approval is required for modifications.
     Those are actually the first 3 options available when you follow the policy creation flow on the dashboard.
</Tip>

In this example, we are going to control transactions whitelisting specific recipient addresses, and requiring approvals for others.

<Steps>
  <Step title="Create a new Policy">
    On the dashboard, head to `Org > Policies` (direct link: [https://app.dfns.io/policies](https://app.dfns.io/policies)) and click ➕ Create Policy. The wizard opens on the **Name** step: give your policy a descriptive name, then click "Continue".

    <Frame>
      <img src="https://mintcdn.com/dfns-6d8c7466/k4PlkpvHXsR9GGmT/images/auto/creating-policies-1.png?fit=max&auto=format&n=k4PlkpvHXsR9GGmT&q=85&s=b6eee316afda60385f60cf94999428a5" alt="Policies page with the Create Policy button highlighted" width="2688" height="1672" data-path="images/auto/creating-policies-1.png" />
    </Frame>
  </Step>

  <Step title="Select the targeted activity">
    What should the policy apply on? For our example, select "Wallet usage (transfer, transaction, signature)". You can leave the optional "Entity Filter" step empty to apply the policy to all wallets.

    <Frame>
      <img src="https://mintcdn.com/dfns-6d8c7466/k4PlkpvHXsR9GGmT/images/auto/creating-policies-2.png?fit=max&auto=format&n=k4PlkpvHXsR9GGmT&q=85&s=d5a4a87324dfe0d63fc330dce15582b1" alt="Policy wizard Activity step with Wallet usage highlighted" width="2688" height="1672" data-path="images/auto/creating-policies-2.png" />
    </Frame>
  </Step>

  <Step title="Select the criteria to evaluate">
    In which case should the policy trigger? For our example, select "Transaction recipient whitelist", then click "Add Addresses" and paste the whitelisted destination wallet address. All transactions to this wallet address will go through, while all others will trigger the policy.

    <Frame>
      <img src="https://mintcdn.com/dfns-6d8c7466/k4PlkpvHXsR9GGmT/images/auto/creating-policies-3.png?fit=max&auto=format&n=k4PlkpvHXsR9GGmT&q=85&s=71043c662a653057fa2ba6b2f081ca03" alt="Policy wizard Rule step with a whitelisted address configured" width="2688" height="2232" data-path="images/auto/creating-policies-3.png" />
    </Frame>
  </Step>

  <Step title="Select the action to take">
    When a transaction triggers the policy filters, then there are different actions you can take. In our case, we'll request approval from another employee. Select "Request Approval", name the approval group, and set the quorum (the number of approvals required, here 1). By default all employees can approve; you can narrow this to specific employees in the "Add Employee" field.

    <Info>
      The user triggering the action can never approve it himself. Make sure the approvers are not the same users who will issue the requests!
    </Info>

    <Frame>
      <img src="https://mintcdn.com/dfns-6d8c7466/k4PlkpvHXsR9GGmT/images/auto/creating-policies-4.png?fit=max&auto=format&n=k4PlkpvHXsR9GGmT&q=85&s=0620567b770d8e944834b2e17873bea1" alt="Policy wizard Action step with Request Approval and an approval group" width="2688" height="2032" data-path="images/auto/creating-policies-4.png" />
    </Frame>
  </Step>

  <Step title="Finish the configuration">
    Continue to the **Summary** step, review the policy, then click Save and 🔑 sign the request with your passkey.

    <Frame>
      <img src="https://mintcdn.com/dfns-6d8c7466/k4PlkpvHXsR9GGmT/images/auto/creating-policies-5.png?fit=max&auto=format&n=k4PlkpvHXsR9GGmT&q=85&s=0cb1846673a7c569065e0f16fb53ce89" alt="Policy wizard Summary step with the Save button highlighted" width="2688" height="1672" data-path="images/auto/creating-policies-5.png" />
    </Frame>
  </Step>
</Steps>

<Check>
  You've created a policy requiring approval from your coworker on transaction requests, except transfers to the designated wallet. Refine these rules and add as many as you need to match your internal policies and safeguards.
</Check>


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.