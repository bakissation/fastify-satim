# @bakissation/fastify-satim

Fastify plugin for the [Satim (SATIM-IPAY)](https://github.com/bakissation/satim) payment gateway SDK.

## Requirements

- **Node.js >= 18**
- **Fastify v4** (v4.0.0 or higher)

> **Note:** Fastify v5 requires Node.js 20+. This plugin targets Fastify v4 to maintain Node.js 18 compatibility. Fastify v5 support will be added in a future release.

## Installation

```bash
npm install @bakissation/fastify-satim
```

The core SDK `@bakissation/satim` is included as a dependency.

## Quick Start

```typescript
import Fastify from 'fastify';
import fastifySatim from '@bakissation/fastify-satim';

const fastify = Fastify();

// Register the plugin (see Configuration section for options)
await fastify.register(fastifySatim, { fromEnv: true });

// Use in your routes
fastify.post('/checkout', async (request, reply) => {
  const response = await fastify.satim.register({
    orderNumber: 'ORD001',
    amount: 5000, // 5000 DZD
    returnUrl: 'https://yoursite.com/payment/success',
    failUrl: 'https://yoursite.com/payment/fail',
    udf1: 'INV001',
  });

  if (response.isSuccessful()) {
    return { redirectUrl: response.formUrl };
  }

  return reply.status(400).send({ error: 'Failed to create order' });
});

fastify.post('/payment/callback', async (request, reply) => {
  const { orderId } = request.body as { orderId: string };

  const response = await fastify.satim.confirm(orderId);

  if (response.isPaid()) {
    // Payment successful - fulfill the order
    return { status: 'paid', orderNumber: response.orderNumber };
  }

  return { status: 'failed' };
});

await fastify.listen({ port: 3000 });
```

## Configuration

The plugin accepts three ways to configure the Satim client:

### Option 1: Environment Variables (Recommended)

Set up your environment variables and use `fromEnv: true`:

```bash
# Required
SATIM_USERNAME=your_merchant_username
SATIM_PASSWORD=your_merchant_password
SATIM_TERMINAL_ID=E010XXXXXX
SATIM_API_URL=https://test2.satim.dz/payment/rest
```

```typescript
await fastify.register(fastifySatim, { fromEnv: true });
```

### Option 2: Configuration Object

Pass the configuration directly:

```typescript
await fastify.register(fastifySatim, {
  config: {
    userName: 'your_username',
    password: 'your_password',
    terminalId: 'E010XXXXXX',
    apiBaseUrl: 'https://test2.satim.dz/payment/rest',
    language: 'fr',
    currency: '012',
  },
});
```

### Option 3: Pre-created Client

For advanced use cases, create the client yourself:

```typescript
import { createSatimClient } from '@bakissation/satim';

const client = createSatimClient({
  userName: 'your_username',
  password: 'your_password',
  terminalId: 'E010XXXXXX',
  apiBaseUrl: 'https://test2.satim.dz/payment/rest',
  logger: {
    enableDevLogging: false,
    level: 'warn',
  },
});

await fastify.register(fastifySatim, { client });
```

## API

After registering the plugin, the `SatimClient` is available as `fastify.satim`:

### `fastify.satim.register(params)`

Creates a new payment order.

```typescript
const response = await fastify.satim.register({
  orderNumber: 'ORD001',     // Required: unique order ID (max 10 chars)
  amount: 5000,               // Required: amount in DZD (min 50 DZD)
  returnUrl: 'https://...',   // Required: success redirect URL
  failUrl: 'https://...',     // Optional: failure redirect URL
  udf1: 'REF001',            // Required: your reference
});

if (response.isSuccessful()) {
  console.log('Redirect to:', response.formUrl);
}
```

### `fastify.satim.confirm(orderId, language?)`

Confirms a payment after customer redirect.

```typescript
const response = await fastify.satim.confirm(orderId);

if (response.isPaid()) {
  console.log('Payment successful!');
  console.log('Amount:', response.amount);
}
```

### `fastify.satim.refund(orderId, amount, language?)`

Refunds a completed transaction.

```typescript
const response = await fastify.satim.refund(orderId, 5000);

if (response.isSuccessful()) {
  console.log('Refund processed');
}
```

## Optional Routes

For quick prototyping or simple integrations, you can enable built-in routes:

```typescript
// Enable with default prefix '/satim'
await fastify.register(fastifySatim, {
  fromEnv: true,
  routes: true,
});

// Or with custom prefix
await fastify.register(fastifySatim, {
  fromEnv: true,
  routes: { prefix: '/payments' },
});
```

This registers the following routes:

| Method | Path | Description |
|--------|------|-------------|
| POST | `{prefix}/register` | Create a new payment order |
| POST | `{prefix}/confirm` | Confirm a payment |
| POST | `{prefix}/refund` | Refund a transaction |

### Route Request Bodies

**POST /register**
```json
{
  "orderNumber": "ORD001",
  "amount": 5000,
  "returnUrl": "https://example.com/success",
  "udf1": "REF001",
  "failUrl": "https://example.com/fail",
  "description": "Order description"
}
```

**POST /confirm**
```json
{
  "orderId": "order-id-from-register",
  "language": "fr"
}
```

**POST /refund**
```json
{
  "orderId": "order-id",
  "amount": 5000,
  "language": "fr"
}
```

> **Note:** These routes are convenience endpoints for simple use cases. For production applications, you'll likely want to implement your own routes with proper authentication, validation, and business logic.

## TypeScript

The plugin includes full TypeScript support with module augmentation:

```typescript
import Fastify from 'fastify';
import fastifySatim from '@bakissation/fastify-satim';
import type { SatimClient } from '@bakissation/fastify-satim';

const fastify = Fastify();
await fastify.register(fastifySatim, { fromEnv: true });

// TypeScript knows about fastify.satim
const client: SatimClient = fastify.satim;
```

### Exported Types

```typescript
import type {
  FastifySatimOptions,
  FastifySatimRoutesOptions,
  SatimClient,
  SatimConfig,
  RegisterOrderParams,
  RegisterOrderResponse,
  ConfirmOrderResponse,
  RefundOrderResponse,
} from '@bakissation/fastify-satim';
```

## Encapsulation

This plugin uses `fastify-plugin` to ensure the `satim` decorator is available in all scopes:

```typescript
await fastify.register(fastifySatim, { fromEnv: true });

// Available in the root scope
fastify.satim.register({ ... });

// Also available in child scopes
fastify.register(async (childFastify) => {
  childFastify.satim.confirm('order-id');
});
```

## Error Handling

The plugin throws an error if:

1. No configuration is provided (neither `client`, `config`, nor `fromEnv: true`)
2. The plugin is registered twice on the same instance

```typescript
// This will throw
await fastify.register(fastifySatim, {}); // Missing configuration

// This will also throw
await fastify.register(fastifySatim, { fromEnv: true });
await fastify.register(fastifySatim, { fromEnv: true }); // Double registration
```

For SDK-specific errors (validation, HTTP, API errors), see the [@bakissation/satim documentation](https://github.com/bakissation/satim).

## Security

- **No secret logging:** The plugin itself does not log any information. Logging behavior is controlled by the core SDK's configuration.
- **Credentials in environment variables:** Always use environment variables for sensitive data in production.
- **Server-side confirmation:** Always call `confirm()` server-side, never trust client-side callbacks.

## License

MIT - Abdelbaki Berkati

## See Also

- [@bakissation/satim](https://github.com/bakissation/satim) - Core SDK documentation
- [Fastify Plugins Guide](https://fastify.dev/docs/latest/Reference/Plugins/)
