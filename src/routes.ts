import type { FastifyInstance, FastifyPluginCallback, FastifyRequest, preHandlerHookHandler, onSendHookHandler } from 'fastify';
import { Type, type Static } from '@sinclair/typebox';
import type { SatimClient, SatimLanguage, RegisterOrderParams } from '@bakissation/satim';
import type { FastifySatimRoutesOptions, RouteConfig } from './types.js';

/**
 * TypeBox schemas for route request bodies.
 * Supports bigint amounts (number, string, or integer).
 */

// Schema for register order request
const RegisterBodySchema = Type.Object({
  orderNumber: Type.String(),
  amount: Type.Union([Type.Number(), Type.String(), Type.Integer()]),
  returnUrl: Type.String(),
  failUrl: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
  udf1: Type.String(),
  udf2: Type.Optional(Type.String()),
  udf3: Type.Optional(Type.String()),
  udf4: Type.Optional(Type.String()),
  udf5: Type.Optional(Type.String()),
  language: Type.Optional(Type.String()),
  currency: Type.Optional(Type.String()),
  fundingTypeIndicator: Type.Optional(Type.String()),
});

// Schema for confirm order request
const ConfirmBodySchema = Type.Object({
  orderId: Type.String(),
  language: Type.Optional(Type.String()),
});

// Schema for refund order request
const RefundBodySchema = Type.Object({
  orderId: Type.String(),
  amount: Type.Union([Type.Number(), Type.String(), Type.Integer()]),
  language: Type.Optional(Type.String()),
});

// TypeScript types extracted from schemas
type RegisterBody = Static<typeof RegisterBodySchema>;
type ConfirmBody = Static<typeof ConfirmBodySchema>;
type RefundBody = Static<typeof RefundBodySchema>;

/**
 * Options passed to the routes plugin.
 */
interface SatimRoutesPluginOptions {
  routesConfig: FastifySatimRoutesOptions;
  getClient?: (request: FastifyRequest) => SatimClient | Promise<SatimClient>;
  globalPreHandler?: preHandlerHookHandler | preHandlerHookHandler[];
  globalOnSend?: onSendHookHandler | onSendHookHandler[];
}

/**
 * Resolves the SatimClient for a request.
 * Uses getClient if provided, otherwise falls back to fastify.satim.
 */
async function resolveClientForRequest(
  fastify: FastifyInstance,
  request: FastifyRequest,
  getClient?: (request: FastifyRequest) => SatimClient | Promise<SatimClient>
): Promise<SatimClient> {
  if (getClient) {
    return await getClient(request);
  }

  if (!fastify.satim) {
    throw new Error('fastify-satim: No client available. Configure client or getClient.');
  }

  return fastify.satim;
}

/**
 * Normalizes amount to bigint (handles number, string, or bigint).
 */
function normalizeAmount(amount: number | string | bigint): bigint {
  if (typeof amount === 'bigint') {
    return amount;
  }
  if (typeof amount === 'string') {
    return BigInt(amount);
  }
  // Convert number to bigint (truncate decimals)
  return BigInt(Math.trunc(amount));
}

/**
 * Merges global and per-route hooks.
 */
function mergeHooks<T>(
  globalHooks: T | T[] | undefined,
  routeHooks: T | T[] | undefined
): T | T[] | undefined {
  if (routeHooks !== undefined) {
    return routeHooks;
  }
  return globalHooks;
}

/**
 * Registers optional Satim routes on the Fastify instance with dynamic configuration.
 */
export const satimRoutes: FastifyPluginCallback<SatimRoutesPluginOptions> = (
  fastify: FastifyInstance,
  opts,
  done
) => {
  const { routesConfig, getClient, globalPreHandler, globalOnSend } = opts;

  // Warn if GET method is used for any route
  const warnIfGetMethod = (routeName: string, config?: RouteConfig) => {
    if (config?.method === 'GET') {
      fastify.log.warn(
        `fastify-satim: Route "${routeName}" is configured to use GET method. ` +
        `All routes should default to POST and be protected by authentication and CSRF tokens. ` +
        `See documentation for security best practices.`
      );
    }
  };

  // Register /register route
  if (routesConfig.register) {
    const config = routesConfig.register;
    const method = config.method ?? 'POST';
    const path = config.path ?? '/register';

    warnIfGetMethod('register', config);

    fastify.route({
      method,
      url: path,
      schema: method === 'POST' ? { body: RegisterBodySchema } : undefined,
      preHandler: mergeHooks(globalPreHandler, config.preHandler),
      onSend: mergeHooks(globalOnSend, config.onSend),
      handler: async (request, reply) => {
        const body = request.body as RegisterBody;
        const client = await resolveClientForRequest(fastify, request, getClient);

        const params: RegisterOrderParams = {
          ...body,
          amount: normalizeAmount(body.amount),
          language: body.language as SatimLanguage | undefined,
        };

        const response = await client.register(params);
        return reply.send(response);
      },
    });
  }

  // Register /confirm route
  if (routesConfig.confirm) {
    const config = routesConfig.confirm;
    const method = config.method ?? 'POST';
    const path = config.path ?? '/confirm';

    warnIfGetMethod('confirm', config);

    fastify.route({
      method,
      url: path,
      schema: method === 'POST' ? { body: ConfirmBodySchema } : undefined,
      preHandler: mergeHooks(globalPreHandler, config.preHandler),
      onSend: mergeHooks(globalOnSend, config.onSend),
      handler: async (request, reply) => {
        const { orderId, language } = request.body as ConfirmBody;
        const client = await resolveClientForRequest(fastify, request, getClient);

        const response = await client.confirm(orderId, language as SatimLanguage | undefined);
        return reply.send(response);
      },
    });
  }

  // Register /refund route
  if (routesConfig.refund) {
    const config = routesConfig.refund;
    const method = config.method ?? 'POST';
    const path = config.path ?? '/refund';

    warnIfGetMethod('refund', config);

    fastify.route({
      method,
      url: path,
      schema: method === 'POST' ? { body: RefundBodySchema } : undefined,
      preHandler: mergeHooks(globalPreHandler, config.preHandler),
      onSend: mergeHooks(globalOnSend, config.onSend),
      handler: async (request, reply) => {
        const { orderId, amount, language } = request.body as RefundBody;
        const client = await resolveClientForRequest(fastify, request, getClient);

        const response = await client.refund(
          orderId,
          normalizeAmount(amount),
          language as SatimLanguage | undefined
        );
        return reply.send(response);
      },
    });
  }

  done();
};
