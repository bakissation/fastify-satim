import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';

/**
 * Error type guards and handlers for Satim SDK errors.
 */

/**
 * Checks if an error is a ValidationError from the SDK.
 */
function isValidationError(error: unknown): error is Error & { name: 'ValidationError' } {
  return error instanceof Error && error.name === 'ValidationError';
}

/**
 * Checks if an error is a SatimApiError from the SDK.
 */
function isSatimApiError(
  error: unknown
): error is Error & { name: 'SatimApiError'; errorCode?: string; errorMessage?: string } {
  return error instanceof Error && error.name === 'SatimApiError';
}

/**
 * Checks if an error is an HttpError from the SDK.
 */
function isHttpError(
  error: unknown
): error is Error & { name: 'HttpError'; statusCode?: number }  {
  return error instanceof Error && error.name === 'HttpError';
}

/**
 * Checks if an error is a TimeoutError from the SDK.
 */
function isTimeoutError(error: unknown): error is Error & { name: 'TimeoutError' } {
  return error instanceof Error && error.name === 'TimeoutError';
}

/**
 * Centralized error handler for Satim SDK errors.
 *
 * Maps SDK errors to appropriate HTTP responses:
 * - ValidationError -> 400 Bad Request
 * - SatimApiError -> 502 Bad Gateway (with satimErrorCode and message)
 * - HttpError -> 502 Bad Gateway (or original status code)
 * - TimeoutError -> 504 Gateway Timeout
 * - Other errors -> 500 Internal Server Error
 *
 * IMPORTANT: Does not leak sensitive data in error responses.
 */
export function handleSatimError(
  error: FastifyError | Error,
  _request: FastifyRequest,
  reply: FastifyReply
): void {
  // ValidationError: Client sent invalid data
  if (isValidationError(error)) {
    reply.status(400).send({
      error: 'Bad Request',
      message: error.message,
      statusCode: 400,
    });
    return;
  }

  // SatimApiError: Satim gateway returned an error
  if (isSatimApiError(error)) {
    reply.status(502).send({
      error: 'Bad Gateway',
      message: error.errorMessage || error.message,
      satimErrorCode: error.errorCode,
      statusCode: 502,
    });
    return;
  }

  // HttpError: HTTP request to Satim failed
  if (isHttpError(error)) {
    const statusCode = error.statusCode && error.statusCode >= 500 ? error.statusCode : 502;
    reply.status(statusCode).send({
      error: 'Bad Gateway',
      message: 'Failed to communicate with payment gateway',
      statusCode,
    });
    return;
  }

  // TimeoutError: Request to Satim timed out
  if (isTimeoutError(error)) {
    reply.status(504).send({
      error: 'Gateway Timeout',
      message: 'Payment gateway request timed out',
      statusCode: 504,
    });
    return;
  }

  // Fastify validation error (JSON schema)
  if ('validation' in error) {
    reply.status(400).send({
      error: 'Bad Request',
      message: error.message,
      validation: error.validation,
      statusCode: 400,
    });
    return;
  }

  // Generic error: Don't leak internal details
  const statusCode = 'statusCode' in error && typeof error.statusCode === 'number'
    ? error.statusCode
    : 500;

  reply.status(statusCode).send({
    error: statusCode === 500 ? 'Internal Server Error' : error.message,
    message: statusCode === 500 ? 'An unexpected error occurred' : error.message,
    statusCode,
  });
}

/**
 * Type-safe error handler that can be used with fastify.setErrorHandler.
 */
export const satimErrorHandler = handleSatimError;
