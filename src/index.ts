import type { FastifyInstance, FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';
import { createSatimClient, fromEnv } from '@bakissation/satim';
import type { SatimClient } from '@bakissation/satim';
import { satimRoutes } from './routes.js';
import type { FastifySatimOptions, FastifySatimRoutesOptions } from './types.js';

/**
 * Default route prefix for optional Satim routes.
 */
const DEFAULT_ROUTE_PREFIX = '/satim';

/**
 * Resolves the SatimClient from plugin options.
 *
 * Priority:
 * 1. Pre-created client instance
 * 2. Configuration object
 * 3. Environment variables (if fromEnv is true)
 */
function resolveClient(options: FastifySatimOptions): SatimClient {
  if (options.client) {
    return options.client;
  }

  if (options.config) {
    return createSatimClient(options.config);
  }

  if (options.fromEnv) {
    return createSatimClient(fromEnv());
  }

  throw new Error(
    'fastify-satim: You must provide one of: client, config, or fromEnv: true'
  );
}

/**
 * Resolves route options to determine prefix or disabled state.
 */
function resolveRoutesOptions(
  routes: FastifySatimOptions['routes']
): { enabled: false } | { enabled: true; prefix: string } {
  if (!routes) {
    return { enabled: false };
  }

  if (routes === true) {
    return { enabled: true, prefix: DEFAULT_ROUTE_PREFIX };
  }

  return {
    enabled: true,
    prefix: routes.prefix ?? DEFAULT_ROUTE_PREFIX,
  };
}

/**
 * Fastify plugin that integrates the Satim payment gateway SDK.
 *
 * After registration, access the SatimClient via `fastify.satim`.
 *
 * @example
 * ```typescript
 * import Fastify from 'fastify';
 * import fastifySatim from '@bakissation/fastify-satim';
 *
 * const fastify = Fastify();
 *
 * // Option 1: Load from environment variables
 * await fastify.register(fastifySatim, { fromEnv: true });
 *
 * // Option 2: Provide configuration
 * await fastify.register(fastifySatim, {
 *   config: {
 *     userName: 'merchant',
 *     password: 'secret',
 *     terminalId: 'E010XXXXXX',
 *     apiBaseUrl: 'https://test2.satim.dz/payment/rest',
 *   },
 * });
 *
 * // Use in routes
 * fastify.post('/checkout', async (request, reply) => {
 *   const response = await fastify.satim.register({
 *     orderNumber: 'ORD001',
 *     amount: 5000,
 *     returnUrl: 'https://example.com/success',
 *     udf1: 'REF001',
 *   });
 *   return response;
 * });
 * ```
 */
const fastifySatimPlugin: FastifyPluginCallback<FastifySatimOptions> = (
  fastify: FastifyInstance,
  options: FastifySatimOptions,
  done
) => {
  // Check for double registration
  if (fastify.hasDecorator('satim')) {
    done(
      new Error(
        'fastify-satim: Plugin already registered. Cannot register twice.'
      )
    );
    return;
  }

  let client: SatimClient;
  try {
    client = resolveClient(options);
  } catch (error) {
    done(error instanceof Error ? error : new Error(String(error)));
    return;
  }

  // Decorate the Fastify instance with the SatimClient
  fastify.decorate('satim', client);

  // Register optional routes if enabled
  const routesConfig = resolveRoutesOptions(options.routes);
  if (routesConfig.enabled) {
    fastify.register(satimRoutes, { prefix: routesConfig.prefix });
  }

  done();
};

/**
 * Fastify plugin for Satim payment gateway integration.
 *
 * Wraps the plugin with fastify-plugin to ensure proper encapsulation behavior.
 */
const fastifySatim = fp(fastifySatimPlugin, {
  fastify: '4.x',
  name: '@bakissation/fastify-satim',
});

export default fastifySatim;
export { fastifySatim };
export type { FastifySatimOptions, FastifySatimRoutesOptions };

// Re-export useful types from core SDK for convenience
export type {
  SatimClient,
  SatimConfig,
  RegisterOrderParams,
  RegisterOrderResponse,
  ConfirmOrderResponse,
  RefundOrderResponse,
} from '@bakissation/satim';
