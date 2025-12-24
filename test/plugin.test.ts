import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import fastifySatim from '../src/index.js';
import type { SatimClient } from '@bakissation/satim';

/**
 * Creates a mock SatimClient for testing.
 */
function createMockClient(): SatimClient {
  return {
    register: vi.fn().mockResolvedValue({
      orderId: 'mock-order-id',
      formUrl: 'https://example.com/pay',
      isSuccessful: () => true,
      raw: {},
    }),
    confirm: vi.fn().mockResolvedValue({
      orderStatus: 2,
      orderNumber: 'ORD001',
      amount: 500000,
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
        'fastify-satim: You must provide one of: client, config, or fromEnv: true'
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
        amount: 5000,
        returnUrl: 'https://example.com/success',
        udf1: 'REF001',
      });
    });

    it('registers routes with custom prefix', async () => {
      const mockClient = createMockClient();

      await fastify.register(fastifySatim, {
        client: mockClient,
        routes: { prefix: '/payments' },
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
        amount: 5000,
        returnUrl: 'https://example.com/success',
        udf1: 'REF001',
        description: 'Test order',
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

      expect(mockClient.refund).toHaveBeenCalledWith('order-123', 5000, 'en');
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
});
