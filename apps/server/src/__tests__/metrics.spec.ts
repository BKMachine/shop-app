import type { Request, Response } from 'express';
import {
  buildRequestMetricLabels,
  getNormalizedRequestPath,
  getRequestDeviceDisplayName,
  normalizeSocketDeviceDisplayName,
  resolveMetricRoute,
  shouldTrackRequest,
} from '../metrics.js';

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
  it('normalizes mounted request paths for metrics decisions', () => {
    expect(getNormalizedRequestPath(createRequest())).toBe('/');
    expect(
      getNormalizedRequestPath(createRequest({ baseUrl: '/images', path: '/abc123.png' })),
    ).toBe('/images/abc123.png');
  });

  it('skips tracking metrics, health, static assets, and favicon requests', () => {
    expect(shouldTrackRequest(createRequest({ path: '/metrics' }))).toBe(false);
    expect(shouldTrackRequest(createRequest({ path: '/health' }))).toBe(false);
    expect(
      shouldTrackRequest(createRequest({ baseUrl: '/images', path: '/parts/123/abc.png' })),
    ).toBe(false);
    expect(shouldTrackRequest(createRequest({ path: '/assets/app.js' }))).toBe(false);
    expect(shouldTrackRequest(createRequest({ path: '/favicon.ico' }))).toBe(false);
    expect(shouldTrackRequest(createRequest({ baseUrl: '/api', path: '/parts/123' }))).toBe(true);
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
    const req = createRequest({
      baseUrl: '/images',
      path: '/abc123.png',
    });

    expect(resolveMetricRoute(req, createResponse())).toBe('/images/*');
  });

  it('collapses mounted document and download requests to stable buckets', () => {
    expect(
      resolveMetricRoute(
        createRequest({
          baseUrl: '/documents',
          path: '/packing-slip.pdf',
        }),
        createResponse(),
      ),
    ).toBe('/documents/*');

    expect(
      resolveMetricRoute(
        createRequest({
          baseUrl: '/downloads',
          path: '/export.csv',
        }),
        createResponse(),
      ),
    ).toBe('/downloads/*');
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

  it('returns the authenticated device display name for request grouping', () => {
    const req = createRequest({
      device: { displayName: 'Front Desk Tablet' } as Request['device'],
    });

    expect(getRequestDeviceDisplayName(req)).toBe('Front Desk Tablet');
  });

  it('normalizes missing websocket device display names to a stable label', () => {
    expect(normalizeSocketDeviceDisplayName('  Shipping Kiosk  ')).toBe('Shipping Kiosk');
    expect(normalizeSocketDeviceDisplayName('   ')).toBe('unknown');
    expect(normalizeSocketDeviceDisplayName(undefined)).toBe('unknown');
  });
});
