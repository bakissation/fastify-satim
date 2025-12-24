import type { FastifyInstance, FastifyPluginCallback } from 'fastify';
import type { SatimLanguage, RegisterOrderParams } from '@bakissation/satim';

/**
 * JSON Schema for register order request body.
 */
const registerBodySchema = {
  type: 'object',
  required: ['orderNumber', 'amount', 'returnUrl', 'udf1'],
  properties: {
    orderNumber: { type: 'string' },
    amount: { type: 'number' },
    returnUrl: { type: 'string' },
    failUrl: { type: 'string' },
    description: { type: 'string' },
    udf1: { type: 'string' },
    udf2: { type: 'string' },
    udf3: { type: 'string' },
    udf4: { type: 'string' },
    udf5: { type: 'string' },
    language: { type: 'string' },
    currency: { type: 'string' },
    fundingTypeIndicator: { type: 'string' },
  },
} as const;

/**
 * JSON Schema for confirm order request body.
 */
const confirmBodySchema = {
  type: 'object',
  required: ['orderId'],
  properties: {
    orderId: { type: 'string' },
    language: { type: 'string' },
  },
} as const;

/**
 * JSON Schema for refund order request body.
 */
const refundBodySchema = {
  type: 'object',
  required: ['orderId', 'amount'],
  properties: {
    orderId: { type: 'string' },
    amount: { type: 'number' },
    language: { type: 'string' },
  },
} as const;

interface RegisterBody {
  orderNumber: string;
  amount: number;
  returnUrl: string;
  failUrl?: string;
  description?: string;
  udf1: string;
  udf2?: string;
  udf3?: string;
  udf4?: string;
  udf5?: string;
  language?: SatimLanguage;
  currency?: string;
  fundingTypeIndicator?: string;
}

interface ConfirmBody {
  orderId: string;
  language?: SatimLanguage;
}

interface RefundBody {
  orderId: string;
  amount: number;
  language?: SatimLanguage;
}

/**
 * Registers optional Satim routes on the Fastify instance.
 * These routes provide a thin HTTP wrapper around the SatimClient methods.
 */
export const satimRoutes: FastifyPluginCallback = (
  fastify: FastifyInstance,
  _opts,
  done
) => {
  /**
   * POST /register
   * Creates a new payment order.
   */
  fastify.post<{ Body: RegisterBody }>(
    '/register',
    {
      schema: {
        body: registerBodySchema,
      },
    },
    async (request, reply) => {
      const response = await fastify.satim.register(request.body as RegisterOrderParams);
      return reply.send(response);
    }
  );

  /**
   * POST /confirm
   * Confirms a payment after customer redirect.
   */
  fastify.post<{ Body: ConfirmBody }>(
    '/confirm',
    {
      schema: {
        body: confirmBodySchema,
      },
    },
    async (request, reply) => {
      const { orderId, language } = request.body;
      const response = await fastify.satim.confirm(orderId, language);
      return reply.send(response);
    }
  );

  /**
   * POST /refund
   * Refunds a completed transaction.
   */
  fastify.post<{ Body: RefundBody }>(
    '/refund',
    {
      schema: {
        body: refundBodySchema,
      },
    },
    async (request, reply) => {
      const { orderId, amount, language } = request.body;
      const response = await fastify.satim.refund(orderId, amount, language);
      return reply.send(response);
    }
  );

  done();
};
