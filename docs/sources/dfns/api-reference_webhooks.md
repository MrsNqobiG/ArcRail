> ## Documentation Index
> Fetch the complete documentation index at: https://docs.dfns.co/llms.txt
> Use this file to discover all available pages before exploring further.

# Webhooks Configuration

> Manage webhook subscriptions and learn about the events emitted by DFNS, including wallet, transfer, signature, and policy approval events.

export const Delete = props => {
  return <code style={{
    paddingLeft: 0,
    paddingTop: 0
  }}>
      <Badge color="red" size="sm">DEL</Badge>
      <span style={{
    marginLeft: '0.5em'
  }}>{props.children}</span>
    </code>;
};

export const Get = props => {
  return <code style={{
    paddingLeft: 0,
    paddingTop: 0
  }}>
      <Badge color="green" size="sm">GET</Badge>
      <span style={{
    marginLeft: '0.5em'
  }}>{props.children}</span>
    </code>;
};

export const Put = props => {
  return <code style={{
    paddingLeft: 0,
    paddingTop: 0
  }}>
      <span class="px-1 py-0.5 rounded-md text-[0.875em] leading-tight bg-yellow-400/20 dark:bg-yellow-400/20 text-yellow-700 dark:text-yellow-400">
        PUT
      </span>
      <span style={{
    marginLeft: '0.5em'
  }}>{props.children}</span>
    </code>;
};

export const Post = props => {
  return <code style={{
    paddingLeft: 0,
    paddingTop: 0
  }}>
      <Badge color="blue" size="sm">POST</Badge>
      <span style={{
    marginLeft: '0.5em'
  }}>{props.children}</span>
    </code>;
};

Stop polling our API and let us tell you when something important happens.

Webhooks allow you to receive real-time notifications about events that occur within your DFNS organization. Instead of constantly querying our API to check the status of a transaction or a policy, you can configure DFNS to send an HTTP `POST` request directly to your specified URL as soon as an event occurs.

This event-driven approach is more efficient and enables you to build responsive, automated workflows. For example, you can use webhooks to:

* Get instant notifications on the entire transaction lifecycle: `Created`, `Signed`, `Broadcasted`, `Confirmed`, or `Failed`.
* Trigger internal alerts when a policy requires your team's approval.
* Update a customer's order status in your database as soon as a payment is confirmed on-chain.

All webhook requests are signed so you can cryptographically verify that they originated from DFNS. This guide will walk you through how to set up, secure, and subscribe to webhook events.

## API reference

<Get>/webhooks</Get> [List Webhooks](/api-reference/webhooks/list-webhooks)

<Post>/webhooks</Post> [Create Webhook](/api-reference/webhooks/create-webhook)

<Get>/webhooks/\{webhookId}</Get> [Get Webhook](/api-reference/webhooks/get-webhook)

<Put>/webhooks/\{webhookId}</Put> [Update Webhook](/api-reference/webhooks/update-webhook)

<Delete>/webhooks/\{webhookId}</Delete> [Delete Webhook](/api-reference/webhooks/delete-webhook)

<Post>/webhooks/\{webhookId}/ping</Post> [Ping Webhook](/api-reference/webhooks/ping-webhook)

## Webhook object


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.