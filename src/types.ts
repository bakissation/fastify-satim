import type { SatimClient, SatimConfig } from '@bakissation/satim';

/**
 * Routes configuration options.
 */
export interface FastifySatimRoutesOptions {
  /**
   * Route prefix for the Satim routes.
   * @default '/satim'
   */
  prefix?: string;
}

/**
 * Plugin options for @bakissation/fastify-satim.
 *
 * You can provide configuration in one of three ways:
 * 1. Pass a pre-created `client` instance
 * 2. Pass `config` to create a new client
 * 3. Set `fromEnv: true` to load config from environment variables
 */
export interface FastifySatimOptions {
  /**
   * Pre-created SatimClient instance.
   * If provided, `config` and `fromEnv` are ignored.
   */
  client?: SatimClient;

  /**
   * Configuration for creating a new SatimClient.
   * Ignored if `client` is provided.
   */
  config?: SatimConfig;

  /**
   * Load configuration from environment variables using the core SDK's fromEnv() helper.
   * Ignored if `client` or `config` is provided.
   * @default false
   */
  fromEnv?: boolean;

  /**
   * Enable optional convenience routes.
   * - `false` (default): No routes registered
   * - `true`: Register routes with default prefix '/satim'
   * - `{ prefix: string }`: Register routes with custom prefix
   */
  routes?: boolean | FastifySatimRoutesOptions;
}

declare module 'fastify' {
  interface FastifyInstance {
    satim: SatimClient;
  }
}
