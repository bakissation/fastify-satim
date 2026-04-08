# @bakissation/fastify-satim

Fastify plugin for the [Satim (SATIM-IPAY)](https://github.com/bakissation/satim) payment gateway SDK.

## Requirements

- **Node.js >= 18**
- **Fastify v4 or v5** (v4.0.0 or higher, v5.0.0 or higher)

> **Note:** This plugin supports both Fastify v4 and v5. Fastify v5 requires Node.js 20+.

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

The plugin accepts four ways to configure the Satim client:

### Option 1: Multi-Tenant with getClient (Recommended for Multi-Tenant)

For applications serving multiple tenants with different Satim credentials:

```typescript
import { createSatimClient } from '@bakissation/satim';

// Store clients per tenant (example using a Map)
const tenantClients = new Map();

await fastify.register(fastifySatim, {
  getClient: (request) => {
    const tenantId = request.headers['x-tenant-id'];

    // Return cached client or create new one
    if (!tenantClients.has(tenantId)) {
      const client = createSatimClient({
        userName: getTenantConfig(tenantId).userName,
        password: getTenantConfig(tenantId).password,
        terminalId: getTenantConfig(tenantId).terminalId,
        apiBaseUrl: 'https://test2.satim.dz/payment/rest',
      });
      tenantClients.set(tenantId, client);
    }

    return tenantClients.get(tenantId);
  },
  routes: true,
});
```

When `getClient` is provided, it takes precedence over all other configuration methods.

### Option 2: Environment Variables (Recommended for Single-Tenant)

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

### Option 3: Configuration Object

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

### Option 4: Pre-created Client

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

For quick prototyping or simple integrations, you can enable built-in routes with flexible configuration:

### Basic Route Configuration

```typescript
// Enable all routes with defaults (POST method, default paths)
await fastify.register(fastifySatim, {
  fromEnv: true,
  routes: true,
});

// Custom prefix for all routes
await fastify.register(fastifySatim, {
  fromEnv: true,
  routes: { prefix: '/api/payments' },
});
```

### Advanced Route Configuration

Configure each route individually with custom paths, methods, and hooks:

```typescript
await fastify.register(fastifySatim, {
  fromEnv: true,
  routes: {
    prefix: '/api/payments',

    // Only enable specific routes
    register: {
      path: '/create-order', // Custom path
      method: 'POST',        // HTTP method (default: POST)
      preHandler: async (request, reply) => {
        // Route-specific authentication
        if (!request.headers.authorization) {
          throw new Error('Unauthorized');
        }
      },
    },

    confirm: {
      path: '/verify',
      // Per-route hooks
      onSend: async (request, reply, payload) => {
        // Log successful confirmations
        console.log('Payment confirmed:', payload);
        return payload;
      },
    },

    // Omit 'refund' to not register the refund route
  },

  // Global hooks applied to all registered routes (can be overridden per-route)
  preHandler: async (request, reply) => {
    // Global authentication logic
  },
});
```

### Available Routes

When enabled, the following routes are registered:

| Route Key | Default Path | Default Method | Description |
|-----------|--------------|----------------|-------------|
| `register` | `/register` | POST | Create a new payment order |
| `confirm` | `/confirm` | POST | Confirm a payment |
| `refund` | `/refund` | POST | Refund a transaction |

**Note:** Only routes explicitly configured will be registered. If you provide a routes object with only `register`, only the register route will be available.

### Route Request Bodies

All routes accept bigint amounts as numbers, strings, or integers for handling large values.

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

**Large amount example (using string):**
```json
{
  "orderNumber": "ORD002",
  "amount": "999999999999999999",
  "returnUrl": "https://example.com/success",
  "udf1": "REF002"
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

**Refund with large amount (using string):**
```json
{
  "orderId": "order-id",
  "amount": "999999999999999999",
  "language": "fr"
}
```

> **Note:** These routes are convenience endpoints for simple use cases. For production applications, you should implement your own routes with proper authentication, CSRF protection, validation, and business logic. See the Security section below.

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
  RouteConfig,
  SatimClient,
  SatimConfig,
  RegisterOrderParams,
  RegisterOrderResponse,
  ConfirmOrderResponse,
  RefundOrderResponse,
} from '@bakissation/fastify-satim';

// Also export the error handler
import { satimErrorHandler } from '@bakissation/fastify-satim';
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

### Authentication and CSRF Protection

**IMPORTANT:** All payment routes should be protected by authentication and CSRF tokens. The plugin will log a warning if you configure any route to use GET method.

#### Integrating CSRF Protection

Use `@fastify/csrf-protection` to secure your payment routes:

```bash
npm install @fastify/csrf-protection
```

```typescript
import csrf from '@fastify/csrf-protection';

await fastify.register(csrf);

await fastify.register(fastifySatim, {
  fromEnv: true,
  routes: {
    register: {
      preHandler: fastify.csrfProtection, // CSRF protection
    },
    confirm: {
      preHandler: [
        // Multiple hooks: authentication + CSRF
        async (request, reply) => {
          // Verify user authentication
          if (!request.user) {
            throw new Error('Unauthorized');
          }
        },
        fastify.csrfProtection,
      ],
    },
  },
});
```

#### Authentication Example

```typescript
await fastify.register(fastifySatim, {
  fromEnv: true,
  // Global authentication for all payment routes
  preHandler: async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      reply.code(401).send({ error: 'Unauthorized' });
      return;
    }

    try {
      request.user = await verifyToken(token);
    } catch (error) {
      reply.code(401).send({ error: 'Invalid token' });
      return;
    }
  },
  routes: true,
});
```

### Error Handling

The plugin includes centralized error handling that:

- Maps SDK errors to appropriate HTTP status codes
- Prevents leaking sensitive data in error responses
- Provides structured error responses

**Error Response Format:**

```typescript
// ValidationError (400 Bad Request)
{
  "error": "Bad Request",
  "message": "Invalid amount: must be at least 50 DZD",
  "statusCode": 400
}

// SatimApiError (502 Bad Gateway)
{
  "error": "Bad Gateway",
  "message": "Insufficient funds",
  "satimErrorCode": "INSUFFICIENT_FUNDS",
  "statusCode": 502
}

// TimeoutError (504 Gateway Timeout)
{
  "error": "Gateway Timeout",
  "message": "Payment gateway request timed out",
  "statusCode": 504
}
```

You can also use the error handler directly:

```typescript
import { satimErrorHandler } from '@bakissation/fastify-satim';

// Apply to specific routes
fastify.setErrorHandler(satimErrorHandler);
```

### Best Practices

- **No secret logging:** The plugin does not log credentials or sensitive data. Logging behavior is controlled by the core SDK's configuration.
- **Environment variables:** Always use environment variables for credentials in production.
- **Server-side confirmation:** Always call `confirm()` server-side after payment. Never trust client-side callbacks alone.
- **HTTPS only:** Always use HTTPS in production to protect credentials and payment data in transit.
- **Rate limiting:** Implement rate limiting on payment routes to prevent abuse.
- **Validation:** Validate all order data before creating payments (amount limits, order uniqueness, etc.).
- **Idempotency:** Use unique `orderNumber` values to prevent duplicate payments.
- **Multi-tenant isolation:** When using `getClient`, ensure proper tenant isolation to prevent credential leakage between tenants.

## Author

**Abdelbaki Berkati** — [berkati.xyz](https://berkati.xyz) · [@bakissation](https://github.com/bakissation)

[Read the case study →](https://berkati.xyz/case-studies/fastify-satim-plugin/)

## License

MIT

## See Also

- [@bakissation/satim](https://github.com/bakissation/satim) - Core SDK documentation
- [Fastify Plugins Guide](https://fastify.dev/docs/latest/Reference/Plugins/)
