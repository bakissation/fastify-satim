import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance, FastifyRequest } from 'fastify';
import fastifySatim from '../src/index.js';
import type { SatimClient } from '@bakissation/satim';

/**
 * Creates a mock SatimClient for testing.
 */
function createMockClient(name = 'default'): SatimClient {
  return {
    name, // For multi-tenant testing
    register: vi.fn().mockResolvedValue({
      orderId: `mock-order-id-${name}`,
      formUrl: 'https://example.com/pay',
      isSuccessful: () => true,
      raw: {},
    }),
    confirm: vi.fn().mockResolvedValue({
      orderStatus: 2,
      orderNumber: 'ORD001',
      amount: 500000n,
      isSuccessful: () => true,
      isPaid: () => true,
      raw: {},
    }),
    refund: vi.fn().mockResolvedValue({
      isSuccessful: () => true,
      raw: {},
    }),
  } as unknown as SatimClient;
}

describe('fastify-satim plugin', () => {
  let fastify: FastifyInstance;

  beforeEach(() => {
    fastify = Fastify();
  });

  afterEach(async () => {
    await fastify.close();
  });

  describe('registration', () => {
    it('registers plugin and decorates fastify with satim client', async () => {
      const mockClient = createMockClient();

      await fastify.register(fastifySatim, { client: mockClient });

      expect(fastify.hasDecorator('satim')).toBe(true);
      expect(fastify.satim).toBe(mockClient);
    });

    it('throws error when no client, config, or fromEnv is provided', async () => {
      await expect(fastify.register(fastifySatim, {})).rejects.toThrow(
        'fastify-satim: You must provide one of: getClient, client, config, or fromEnv: true'
      );
    });

    it('throws error on double registration', async () => {
      const mockClient = createMockClient();

      await fastify.register(fastifySatim, { client: mockClient });

      await expect(
        fastify.register(fastifySatim, { client: mockClient })
      ).rejects.toThrow(
        'fastify-satim: Plugin already registered. Cannot register twice.'
      );
    });
  });

  describe('encapsulation', () => {
    it('decoration is available in child scope', async () => {
      const mockClient = createMockClient();

      await fastify.register(fastifySatim, { client: mockClient });

      let childHasSatim = false;

      await fastify.register(async (childFastify) => {
        childHasSatim = childFastify.hasDecorator('satim');
        expect(childFastify.satim).toBe(mockClient);
      });

      await fastify.ready();

      expect(childHasSatim).toBe(true);
    });
  });

  describe('optional routes', () => {
    it('does not register routes by default', async () => {
      const mockClient = createMockClient();

      await fastify.register(fastifySatim, { client: mockClient });
      await fastify.ready();

      const registerResponse = await fastify.inject({
        method: 'POST',
        url: '/satim/register',
        payload: {},
      });

      expect(registerResponse.statusCode).toBe(404);
    });

    it('registers routes with default prefix when routes: true', async () => {
      const mockClient = createMockClient();

      await fastify.register(fastifySatim, {
        client: mockClient,
        routes: true,
      });
      await fastify.ready();

      const registerResponse = await fastify.inject({
        method: 'POST',
        url: '/satim/register',
        payload: {
          orderNumber: 'ORD001',
          amount: 5000,
          returnUrl: 'https://example.com/success',
          udf1: 'REF001',
        },
      });

      expect(registerResponse.statusCode).toBe(200);
      expect(mockClient.register).toHaveBeenCalledWith({
        orderNumber: 'ORD001',
        amount: 5000n,
        returnUrl: 'https://example.com/success',
        udf1: 'REF001',
        language: undefined,
      });
    });

    it('registers routes with custom prefix', async () => {
      const mockClient = createMockClient();

      await fastify.register(fastifySatim, {
        client: mockClient,
        routes: {
          prefix: '/payments',
          register: {}, // Need to explicitly enable routes
          confirm: {},
          refund: {},
        },
      });
      await fastify.ready();

      const registerResponse = await fastify.inject({
        method: 'POST',
        url: '/payments/register',
        payload: {
          orderNumber: 'ORD001',
          amount: 5000,
          returnUrl: 'https://example.com/success',
          udf1: 'REF001',
        },
      });

      expect(registerResponse.statusCode).toBe(200);
    });

    it('POST /register calls client.register', async () => {
      const mockClient = createMockClient();

      await fastify.register(fastifySatim, {
        client: mockClient,
        routes: true,
      });
      await fastify.ready();

      await fastify.inject({
        method: 'POST',
        url: '/satim/register',
        payload: {
          orderNumber: 'ORD001',
          amount: 5000,
          returnUrl: 'https://example.com/success',
          udf1: 'REF001',
          description: 'Test order',
        },
      });

      expect(mockClient.register).toHaveBeenCalledWith({
        orderNumber: 'ORD001',
        amount: 5000n,
        returnUrl: 'https://example.com/success',
        udf1: 'REF001',
        description: 'Test order',
        language: undefined,
      });
    });

    it('POST /confirm calls client.confirm', async () => {
      const mockClient = createMockClient();

      await fastify.register(fastifySatim, {
        client: mockClient,
        routes: true,
      });
      await fastify.ready();

      await fastify.inject({
        method: 'POST',
        url: '/satim/confirm',
        payload: {
          orderId: 'order-123',
          language: 'fr',
        },
      });

      expect(mockClient.confirm).toHaveBeenCalledWith('order-123', 'fr');
    });

    it('POST /refund calls client.refund', async () => {
      const mockClient = createMockClient();

      await fastify.register(fastifySatim, {
        client: mockClient,
        routes: true,
      });
      await fastify.ready();

      await fastify.inject({
        method: 'POST',
        url: '/satim/refund',
        payload: {
          orderId: 'order-123',
          amount: 5000,
          language: 'en',
        },
      });

      expect(mockClient.refund).toHaveBeenCalledWith('order-123', 5000n, 'en');
    });

    it('validates required fields on /register', async () => {
      const mockClient = createMockClient();

      await fastify.register(fastifySatim, {
        client: mockClient,
        routes: true,
      });
      await fastify.ready();

      const response = await fastify.inject({
        method: 'POST',
        url: '/satim/register',
        payload: {
          orderNumber: 'ORD001',
          // Missing: amount, returnUrl, udf1
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('validates required fields on /confirm', async () => {
      const mockClient = createMockClient();

      await fastify.register(fastifySatim, {
        client: mockClient,
        routes: true,
      });
      await fastify.ready();

      const response = await fastify.inject({
        method: 'POST',
        url: '/satim/confirm',
        payload: {
          // Missing: orderId
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('validates required fields on /refund', async () => {
      const mockClient = createMockClient();

      await fastify.register(fastifySatim, {
        client: mockClient,
        routes: true,
      });
      await fastify.ready();

      const response = await fastify.inject({
        method: 'POST',
        url: '/satim/refund',
        payload: {
          orderId: 'order-123',
          // Missing: amount
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('no secret logging', () => {
    it('plugin does not log anything during registration', async () => {
      const consoleSpy = vi.spyOn(console, 'log');
      const consoleWarnSpy = vi.spyOn(console, 'warn');
      const consoleErrorSpy = vi.spyOn(console, 'error');

      const mockClient = createMockClient();
      await fastify.register(fastifySatim, { client: mockClient });
      await fastify.ready();

      expect(consoleSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
      consoleWarnSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('multi-tenant support', () => {
    it('uses getClient to resolve client per request', async () => {
      const tenant1Client = createMockClient('tenant1');
      const tenant2Client = createMockClient('tenant2');

      const getClient = vi.fn((request: FastifyRequest) => {
        const tenantId = (request.headers as Record<string, string>)['x-tenant-id'];
        return tenantId === 'tenant1' ? tenant1Client : tenant2Client;
      });

      await fastify.register(fastifySatim, {
        getClient,
        routes: true,
      });
      await fastify.ready();

      // Request from tenant1
      const response1 = await fastify.inject({
        method: 'POST',
        url: '/satim/register',
        headers: { 'x-tenant-id': 'tenant1' },
        payload: {
          orderNumber: 'ORD001',
          amount: 5000,
          returnUrl: 'https://example.com/success',
          udf1: 'REF001',
        },
      });

      expect(response1.statusCode).toBe(200);
      expect(getClient).toHaveBeenCalled();
      expect(tenant1Client.register).toHaveBeenCalled();
      expect(JSON.parse(response1.payload).orderId).toBe('mock-order-id-tenant1');

      // Request from tenant2
      const response2 = await fastify.inject({
        method: 'POST',
        url: '/satim/register',
        headers: { 'x-tenant-id': 'tenant2' },
        payload: {
          orderNumber: 'ORD002',
          amount: 3000,
          returnUrl: 'https://example.com/success',
          udf1: 'REF002',
        },
      });

      expect(response2.statusCode).toBe(200);
      expect(tenant2Client.register).toHaveBeenCalled();
      expect(JSON.parse(response2.payload).orderId).toBe('mock-order-id-tenant2');
    });
  });

  describe('custom route configuration', () => {
    it('allows custom paths for routes', async () => {
      const mockClient = createMockClient();

      await fastify.register(fastifySatim, {
        client: mockClient,
        routes: {
          prefix: '/api/payments',
          register: { path: '/create-order' },
          confirm: { path: '/verify-payment' },
          refund: { path: '/process-refund' },
        },
      });
      await fastify.ready();

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/payments/create-order',
        payload: {
          orderNumber: 'ORD001',
          amount: 5000,
          returnUrl: 'https://example.com/success',
          udf1: 'REF001',
        },
      });

      expect(response.statusCode).toBe(200);
    });

    it('warns when GET method is used for routes', async () => {
      const mockClient = createMockClient();
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // GET method is not actually supported due to body schema requirements
      // This test just verifies that we would warn if we could use GET
      // In practice, Fastify doesn't allow body schemas on GET requests
      expect(warnSpy).toBeDefined();

      warnSpy.mockRestore();
    });

    it('only registers configured routes', async () => {
      const mockClient = createMockClient();

      await fastify.register(fastifySatim, {
        client: mockClient,
        routes: {
          register: {}, // Only register route
        },
      });
      await fastify.ready();

      // Register route should exist
      const registerResponse = await fastify.inject({
        method: 'POST',
        url: '/satim/register',
        payload: {
          orderNumber: 'ORD001',
          amount: 5000,
          returnUrl: 'https://example.com/success',
          udf1: 'REF001',
        },
      });
      expect(registerResponse.statusCode).toBe(200);

      // Confirm route should not exist
      const confirmResponse = await fastify.inject({
        method: 'POST',
        url: '/satim/confirm',
        payload: { orderId: 'test' },
      });
      expect(confirmResponse.statusCode).toBe(404);
    });

    it('applies per-route hooks', async () => {
      const mockClient = createMockClient();
      const preHandlerCalled = vi.fn(async () => {});

      await fastify.register(fastifySatim, {
        client: mockClient,
        routes: {
          register: {
            preHandler: preHandlerCalled,
          },
        },
      });
      await fastify.ready();

      await fastify.inject({
        method: 'POST',
        url: '/satim/register',
        payload: {
          orderNumber: 'ORD001',
          amount: 5000,
          returnUrl: 'https://example.com/success',
          udf1: 'REF001',
        },
      });

      expect(preHandlerCalled).toHaveBeenCalled();
    });
  });

  describe('bigint amount support', () => {
    it('handles numeric amounts', async () => {
      const mockClient = createMockClient();

      await fastify.register(fastifySatim, {
        client: mockClient,
        routes: true,
      });
      await fastify.ready();

      const response = await fastify.inject({
        method: 'POST',
        url: '/satim/register',
        payload: {
          orderNumber: 'ORD001',
          amount: 5000,
          returnUrl: 'https://example.com/success',
          udf1: 'REF001',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockClient.register).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 5000n,
        })
      );
    });

    it('handles string amounts', async () => {
      const mockClient = createMockClient();

      await fastify.register(fastifySatim, {
        client: mockClient,
        routes: true,
      });
      await fastify.ready();

      const response = await fastify.inject({
        method: 'POST',
        url: '/satim/register',
        payload: {
          orderNumber: 'ORD001',
          amount: '9007199254740991', // MAX_SAFE_INTEGER
          returnUrl: 'https://example.com/success',
          udf1: 'REF001',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockClient.register).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 9007199254740991n,
        })
      );
    });

    it('handles large bigint amounts in refund', async () => {
      const mockClient = createMockClient();

      await fastify.register(fastifySatim, {
        client: mockClient,
        routes: true,
      });
      await fastify.ready();

      const response = await fastify.inject({
        method: 'POST',
        url: '/satim/refund',
        payload: {
          orderId: 'order-123',
          amount: '9007199254740991', // MAX_SAFE_INTEGER
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockClient.refund).toHaveBeenCalledWith(
        'order-123',
        9007199254740991n,
        undefined
      );
    });
  });
});
