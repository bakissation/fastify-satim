import type { FastifyRequest, preHandlerHookHandler, onSendHookHandler } from 'fastify';
import type { SatimClient, SatimConfig } from '@bakissation/satim';

/**
 * Configuration for individual route (method and path).
 */
export interface RouteConfig {
  /**
   * HTTP method for the route.
   * @default 'POST'
   */
  method?: 'POST' | 'GET';

  /**
   * Custom path for the route (without prefix).
   * @default '/register', '/confirm', or '/refund'
   */
  path?: string;

  /**
   * Optional preHandler hooks for this specific route.
   */
  preHandler?: preHandlerHookHandler | preHandlerHookHandler[];

  /**
   * Optional onSend hooks for this specific route.
   */
  onSend?: onSendHookHandler | onSendHookHandler[];
}

/**
 * Routes configuration options.
 */
export interface FastifySatimRoutesOptions {
  /**
   * Route prefix for the Satim routes.
   * @default '/satim'
   */
  prefix?: string;

  /**
   * Configuration for the register route.
   * If not provided, the route will not be registered.
   */
  register?: RouteConfig;

  /**
   * Configuration for the confirm route.
   * If not provided, the route will not be registered.
   */
  confirm?: RouteConfig;

  /**
   * Configuration for the refund route.
   * If not provided, the route will not be registered.
   */
  refund?: RouteConfig;
}

/**
 * Plugin options for @bakissation/fastify-satim.
 *
 * You can provide configuration in one of four ways:
 * 1. Pass a `getClient` function for multi-tenant support (recommended for multi-tenant)
 * 2. Pass a pre-created `client` instance
 * 3. Pass `config` to create a new client
 * 4. Set `fromEnv: true` to load config from environment variables
 */
export interface FastifySatimOptions {
  /**
   * Function to resolve SatimClient per request (multi-tenant support).
   * This takes precedence over `client`, `config`, and `fromEnv`.
   *
   * @example
   * ```typescript
   * getClient: (request) => {
   *   const tenantId = request.headers['x-tenant-id'];
   *   return getTenantClient(tenantId);
   * }
   * ```
   */
  getClient?: (request: FastifyRequest) => SatimClient | Promise<SatimClient>;

  /**
   * Pre-created SatimClient instance.
   * If provided, `config` and `fromEnv` are ignored.
   * Ignored if `getClient` is provided.
   */
  client?: SatimClient;

  /**
   * Configuration for creating a new SatimClient.
   * Ignored if `client` or `getClient` is provided.
   */
  config?: SatimConfig;

  /**
   * Load configuration from environment variables using the core SDK's fromEnv() helper.
   * Ignored if `client`, `config`, or `getClient` is provided.
   * @default false
   */
  fromEnv?: boolean;

  /**
   * Enable optional convenience routes.
   * - `false` (default): No routes registered
   * - `true`: Register routes with default configuration (all routes enabled, POST method, default paths)
   * - `FastifySatimRoutesOptions`: Configure routes individually
   */
  routes?: boolean | FastifySatimRoutesOptions;

  /**
   * Global preHandler hooks applied to all registered routes.
   * Per-route hooks in `routes` configuration will override these.
   */
  preHandler?: preHandlerHookHandler | preHandlerHookHandler[];

  /**
   * Global onSend hooks applied to all registered routes.
   * Per-route hooks in `routes` configuration will override these.
   */
  onSend?: onSendHookHandler | onSendHookHandler[];
}

declare module 'fastify' {
  interface FastifyInstance {
    satim: SatimClient;
  }
}
