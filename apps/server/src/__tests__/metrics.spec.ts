import type { Request, Response } from 'express';
import { buildRequestMetricLabels, resolveMetricRoute, shouldTrackRequest } from '../metrics.js';

function createRequest(overrides: Partial<Request> = {}) {
  return {
    method: 'GET',
    path: '/',
    baseUrl: '',
    route: undefined,
    ...overrides,
  } as Request;
}

function createResponse(statusCode = 200) {
  return { statusCode } as Response;
}

describe('metrics helpers', () => {
  it('skips tracking the scrape endpoint', () => {
    expect(shouldTrackRequest('/metrics')).toBe(false);
    expect(shouldTrackRequest('/health')).toBe(true);
  });

  it('uses the matched route pattern for API endpoints', () => {
    const req = createRequest({
      path: '/507f1f77bcf86cd799439011',
      baseUrl: '/api/parts',
      route: { path: '/:id' } as Request['route'],
    });

    expect(resolveMetricRoute(req, createResponse())).toBe('/api/parts/:id');
  });

  it('collapses static file requests to stable buckets', () => {
    const req = createRequest({ path: '/images/abc123.png' });

    expect(resolveMetricRoute(req, createResponse())).toBe('/images/*');
  });

  it('labels unmatched requests without using raw URLs', () => {
    const req = createRequest({ path: '/api/parts/does-not-exist' });

    expect(resolveMetricRoute(req, createResponse(404))).toBe('unmatched');
  });

  it('builds request labels from request and response state', () => {
    const req = createRequest({
      method: 'POST',
      baseUrl: '/api/customers',
      path: '/create',
      route: { path: '/create' } as Request['route'],
    });

    expect(buildRequestMetricLabels(req, createResponse(201))).toEqual({
      method: 'POST',
      route: '/api/customers/create',
      status: '201',
    });
  });
});
