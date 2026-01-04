# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-01-04

### Added

#### Multi-Tenant Support
- **`getClient` option** for dynamic client resolution per request
- Support for serving multiple tenants with different Satim credentials
- Per-request client selection based on headers or request context
- Full test coverage for multi-tenant scenarios

#### Flexible Route Configuration
- **Individual route configuration** with `RouteConfig` interface
- Custom HTTP methods per route (GET/POST with security warnings for GET)
- Custom paths for each route (register, confirm, refund)
- Per-route middleware hooks (`preHandler`, `onSend`)
- Global middleware hooks that can be overridden per-route
- Selective route registration (enable only needed routes)

#### BigInt Amount Support
- Accept amounts as `number`, `string`, or `integer` types
- Support for amounts beyond JavaScript's safe integer range
- TypeBox schema integration for type-safe validation
- Proper conversion and handling of large monetary values

#### Centralized Error Handling
- New `error-handler.ts` module with comprehensive error mapping
- HTTP status codes mapped to SDK errors:
  - `ValidationError` → 400 Bad Request
  - `SatimApiError` → 502 Bad Gateway (includes `satimErrorCode`)
  - `HttpError` → 502 Bad Gateway
  - `TimeoutError` → 504 Gateway Timeout
- Exported `satimErrorHandler` for manual use
- Prevents leaking sensitive information in error responses
- Structured error response format

#### Security Enhancements
- Warning logs when GET method is used for routes
- CSRF protection documentation and examples
- Authentication middleware examples
- Security best practices section in README
- Multi-tenant isolation guidelines

#### Fastify v5 Support
- Compatibility with both Fastify v4 and v5
- Updated peer dependencies to `^4.0.0 || ^5.0.0`
- Tested against both versions

#### Documentation
- Comprehensive multi-tenant setup guide
- Advanced route configuration examples
- BigInt amount handling examples
- CSRF protection integration guide
- Error handling documentation
- Migrated from 3 to 4 configuration options

#### Testing
- 22 new test cases covering new features
- Multi-tenant client resolution tests
- Custom route configuration tests
- BigInt amount handling tests
- Error handling integration tests (8 new tests)
- Per-route hooks tests
- Selective route registration tests
- Total: 30 tests, all passing

### Changed

#### Breaking Changes
- **Error messages updated**: Configuration error now mentions `getClient` option
  - Old: `"You must provide one of: client, config, or fromEnv: true"`
  - New: `"You must provide one of: getClient, client, config, or fromEnv: true"`
- **Amount type changed to bigint**: All SDK method calls now use `bigint` for amounts
- **Route registration behavior**: When using object-based route config, routes must be explicitly enabled
  - Old: `routes: { prefix: '/payments' }` would register all routes
  - New: `routes: { prefix: '/payments', register: {}, confirm: {}, refund: {} }` required
- **Fastify plugin version**: Updated `fastify-plugin` from `^4.5.0` to `^5.1.0`

#### Dependencies
- Updated `@bakissation/satim` from `^1.0.0` to `^1.1.0`
- Added `@sinclair/typebox` `^0.34.46` for schema definitions
- Updated `fastify-plugin` to `^5.1.0`

#### Types
- `FastifySatimOptions` now includes `getClient`, `preHandler`, and `onSend`
- `FastifySatimRoutesOptions` restructured with per-route configuration
- New `RouteConfig` interface exported
- Module augmentation for Fastify remains unchanged

#### Documentation
- Complete rewrite of configuration section
- Updated all examples to show new features
- Added migration guide context in README
- Enhanced security section with practical examples

### Fixed
- Body schema validation no longer applied to GET requests (Fastify compatibility)
- Proper TypeScript type exports for all new interfaces
- BigInt conversion now uses `Math.trunc` instead of `Math.round` for precision

### Migration Guide

#### From v1.0 to v1.1

**1. Update Dependencies**
```bash
npm install @bakissation/fastify-satim@^1.1.0
```

**2. No Breaking Changes for Basic Usage**
If you're using basic configuration, no changes needed:
```typescript
// Still works in v1.1
await fastify.register(fastifySatim, { fromEnv: true });
await fastify.register(fastifySatim, { client: myClient });
await fastify.register(fastifySatim, { config: myConfig });
```

**3. Route Configuration Changes**
If using custom route prefix with object syntax, explicitly enable routes:
```typescript
// v1.0 - This registered all routes
routes: { prefix: '/payments' }

// v1.1 - Explicitly enable needed routes
routes: {
  prefix: '/payments',
  register: {},  // Enable register route
  confirm: {},   // Enable confirm route
  refund: {},    // Enable refund route
}
```

**4. Error Message Updates**
If you're checking error messages in tests, update to include `getClient`:
```typescript
// Update test assertions
'fastify-satim: You must provide one of: getClient, client, config, or fromEnv: true'
```

**5. Amount Handling (Internal)**
Amounts are now converted to `bigint` internally. This is transparent for most users, but if you're mocking the SDK, update your mocks:
```typescript
// v1.1 - Mock should expect bigint
mockClient.register = vi.fn().mockResolvedValue({...});
// Will be called with { amount: 5000n, ... }
```

**6. New Features to Explore**
- Multi-tenant support with `getClient`
- Per-route configuration with custom paths and hooks
- BigInt support for large amounts (use strings for values > Number.MAX_SAFE_INTEGER)

## [1.0.0] - 2025-01-XX

### Added
- Initial release
- Fastify v4 support
- Basic plugin registration with `client`, `config`, or `fromEnv`
- Optional convenience routes (`/register`, `/confirm`, `/refund`)
- TypeScript support with module augmentation
- `fastify.satim` decorator
- Route prefix configuration
- Basic error handling
- Environment variable configuration

[1.1.0]: https://github.com/bakissation/fastify-satim/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/bakissation/fastify-satim/releases/tag/v1.0.0
