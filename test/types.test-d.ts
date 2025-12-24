/**
 * Type-level tests for @bakissation/fastify-satim.
 *
 * These tests verify that TypeScript types are correctly defined and
 * the FastifyInstance augmentation works as expected.
 *
 * Run with: npx tsc --noEmit test/types.test-d.ts
 */

import Fastify from 'fastify';
import fastifySatim from '../src/index.js';
import type { FastifySatimOptions, SatimClient } from '../src/index.js';

// Test: Plugin options types
const optionsWithClient: FastifySatimOptions = {
  client: {} as SatimClient,
};

const optionsWithConfig: FastifySatimOptions = {
  config: {
    userName: 'test',
    password: 'test',
    terminalId: 'E010XXXXXX',
    apiBaseUrl: 'https://test.satim.dz/payment/rest',
  },
};

const optionsWithEnv: FastifySatimOptions = {
  fromEnv: true,
};

const optionsWithRoutes: FastifySatimOptions = {
  fromEnv: true,
  routes: true,
};

const optionsWithRoutePrefix: FastifySatimOptions = {
  fromEnv: true,
  routes: { prefix: '/payments' },
};

// Test: FastifyInstance augmentation
async function testFastifyAugmentation() {
  const fastify = Fastify();

  await fastify.register(fastifySatim, { fromEnv: true });

  // These should compile without errors
  const client: SatimClient = fastify.satim;

  // Test that client methods are available
  const registerResponse = await fastify.satim.register({
    orderNumber: 'ORD001',
    amount: 5000,
    returnUrl: 'https://example.com/success',
    udf1: 'REF001',
  });

  const confirmResponse = await fastify.satim.confirm('order-id');
  const refundResponse = await fastify.satim.refund('order-id', 5000);

  // Verify response types have expected methods
  registerResponse.isSuccessful();
  confirmResponse.isSuccessful();
  confirmResponse.isPaid();
  refundResponse.isSuccessful();
}

// Test: Child scope inheritance
async function testChildScope() {
  const fastify = Fastify();

  await fastify.register(fastifySatim, { fromEnv: true });

  await fastify.register(async (childFastify) => {
    // satim should be available in child scope
    const client: SatimClient = childFastify.satim;
    await childFastify.satim.confirm('order-id');
  });
}

// Prevent unused variable warnings
void optionsWithClient;
void optionsWithConfig;
void optionsWithEnv;
void optionsWithRoutes;
void optionsWithRoutePrefix;
void testFastifyAugmentation;
void testChildScope;
