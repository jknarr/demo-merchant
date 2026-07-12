# Jimporium Demo Merchant

Jimporium is a React storefront and Cloudflare Worker that demonstrates a
merchant-side Universal Commerce Protocol (UCP) `2026-04-08` integration. It
supports both its ordinary website checkout and an independently hosted
conversational shopping agent.

## Responsibilities

The merchant owns:

- catalog data and authoritative server-side pricing;
- UCP discovery, catalog, checkout, completion, and order resources;
- payment-handler registration and dispatch by `handler_id`;
- its Paze private key and Paze credential verification/decryption;
- order creation and the redacted payment-evidence demo.

The conversational flow submits payment only through the standard UCP
`POST /checkout-sessions/{id}/complete` operation. No Paze-specific merchant
endpoint is required. The existing `/api/orders` route serves the ordinary
storefront checkout and uses the same internal verifier registry.

The Paze browser implementation is loaded dynamically from the handler URL in
the merchant profile. This repository has no build-time dependency on the
handler repository and can be cloned and deployed independently.

## Local development

Requirements:

- Node.js 20 or newer
- A Paze sandbox client/profile and matching merchant decryption key
- The independently hosted Paze browser-handler module

Install dependencies and create local configuration:

```bash
npm install
cp .dev.vars.example .dev.vars
```

Start Jimporium:

```bash
npm run dev -- --host 127.0.0.1
```

The storefront and UCP REST service are available at
`http://127.0.0.1:5173`.

## Validation

```bash
npm run validate
```

This runs TypeScript/Vite builds, ESLint, and the merchant-owned Paze
verification/decryption test. The test generates an ephemeral key pair and does
not depend on files or secrets outside this repository.

## Deployment notes

The demo currently stores checkout sessions and orders in memory. Production
deployment requires durable expiring storage, authenticated UCP requests,
idempotency persistence, access control for payment evidence, and real payment
authorization after Paze credential verification.

Deploy the Worker with:

```bash
npm run deploy
```

The deployed Worker reads its public Paze configuration from `wrangler.json`:

- `PAZE_CLIENT_ID`
- `PAZE_PROFILE_ID`
- `PAZE_HANDLER_MODULE_URL`
- `PUBLIC_BASE_URL`

`PAZE_MERCHANT_PRIVATE_KEY` is a Cloudflare Worker secret and must never be
placed in `wrangler.json`. Upload it separately with:

```bash
npx wrangler secret put PAZE_MERCHANT_PRIVATE_KEY < /path/to/private-key.pem
```
