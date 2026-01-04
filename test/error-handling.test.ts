import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import fastifySatim from '../src/index.js';
import { handleSatimError } from '../src/error-handler.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

describe('error handling', () => {
  let fastify: FastifyInstance;

  beforeEach(() => {
    fastify = Fastify();
  });

  afterEach(async () => {
    await fastify.close();
  });

  describe('handleSatimError', () => {
    it('handles ValidationError with 400 status', async () => {
      const error = new Error('Invalid amount');
      error.name = 'ValidationError';

      const mockRequest = {} as FastifyRequest;
      const mockReply = {
        status: vi.fn().mockReturnThis(),
        send: vi.fn(),
      } as unknown as FastifyReply;

      handleSatimError(error, mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Bad Request',
        message: 'Invalid amount',
        statusCode: 400,
      });
    });

    it('handles SatimApiError with 502 status', async () => {
      const error = new Error('Payment failed') as Error & {
        name: string;
        errorCode?: string;
        errorMessage?: string;
      };
      error.name = 'SatimApiError';
      error.errorCode = 'INSUFFICIENT_FUNDS';
      error.errorMessage = 'Insufficient funds';

      const mockRequest = {} as FastifyRequest;
      const mockReply = {
        status: vi.fn().mockReturnThis(),
        send: vi.fn(),
      } as unknown as FastifyReply;

      handleSatimError(error, mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(502);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Bad Gateway',
        message: 'Insufficient funds',
        satimErrorCode: 'INSUFFICIENT_FUNDS',
        statusCode: 502,
      });
    });

    it('handles HttpError with 502 status', async () => {
      const error = new Error('Network error') as Error & {
        name: string;
        statusCode?: number;
      };
      error.name = 'HttpError';
      error.statusCode = 503;

      const mockRequest = {} as FastifyRequest;
      const mockReply = {
        status: vi.fn().mockReturnThis(),
        send: vi.fn(),
      } as unknown as FastifyReply;

      handleSatimError(error, mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(503);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Bad Gateway',
        message: 'Failed to communicate with payment gateway',
        statusCode: 503,
      });
    });

    it('handles TimeoutError with 504 status', async () => {
      const error = new Error('Request timed out');
      error.name = 'TimeoutError';

      const mockRequest = {} as FastifyRequest;
      const mockReply = {
        status: vi.fn().mockReturnThis(),
        send: vi.fn(),
      } as unknown as FastifyReply;

      handleSatimError(error, mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(504);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Gateway Timeout',
        message: 'Payment gateway request timed out',
        statusCode: 504,
      });
    });

    it('handles Fastify validation errors with 400 status', async () => {
      const error = new Error('Validation failed') as Error & {
        validation?: unknown[];
      };
      error.validation = [{ message: 'required field missing' }];

      const mockRequest = {} as FastifyRequest;
      const mockReply = {
        status: vi.fn().mockReturnThis(),
        send: vi.fn(),
      } as unknown as FastifyReply;

      handleSatimError(error, mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Bad Request',
        message: 'Validation failed',
        validation: [{ message: 'required field missing' }],
        statusCode: 400,
      });
    });

    it('handles generic errors with 500 status', async () => {
      const error = new Error('Something went wrong');

      const mockRequest = {} as FastifyRequest;
      const mockReply = {
        status: vi.fn().mockReturnThis(),
        send: vi.fn(),
      } as unknown as FastifyReply;

      handleSatimError(error, mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred',
        statusCode: 500,
      });
    });

    it('does not leak sensitive information in error messages', async () => {
      const error = new Error('Database password: secret123');

      const mockRequest = {} as FastifyRequest;
      const mockReply = {
        status: vi.fn().mockReturnThis(),
        send: vi.fn(),
      } as unknown as FastifyReply;

      handleSatimError(error, mockRequest, mockReply);

      const sentData = (mockReply.send as ReturnType<typeof vi.fn>).mock
        .calls[0][0];
      expect(sentData.message).toBe('An unexpected error occurred');
      expect(sentData.message).not.toContain('secret123');
    });
  });

  describe('error handler integration', () => {
    it('uses centralized error handler in routes', async () => {
      const mockClient = {
        register: vi.fn().mockRejectedValue(
          Object.assign(new Error('API Error'), {
            name: 'SatimApiError',
            errorCode: 'INVALID_ORDER',
          })
        ),
      };

      await fastify.register(fastifySatim, {
        client: mockClient as any,
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

      expect(response.statusCode).toBe(502);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe('Bad Gateway');
      expect(body.satimErrorCode).toBe('INVALID_ORDER');
    });
  });
});
