import type { Request, Response } from 'express';
import client from 'prom-client';

const METRIC_PREFIX = 'shop_app_server_';
const METRIC_LABELS = ['method', 'route', 'status'] as const;
const DEVICE_REQUEST_LABELS = ['device_display_name'] as const;
const SOCKET_CONNECTION_LABELS = ['device_display_name'] as const;
const STATIC_ASSET_ROUTE_PREFIXES = ['/images', '/documents', '/downloads'] as const;

export const metricsRegistry = new client.Registry();

metricsRegistry.setDefaultLabels({
  app: 'shop-app-server',
});

client.collectDefaultMetrics({
  prefix: METRIC_PREFIX,
  register: metricsRegistry,
});

export const httpRequests = new client.Counter({
  name: `${METRIC_PREFIX}http_requests_total`,
  help: 'Total HTTP requests handled by the server.',
  labelNames: [...METRIC_LABELS],
  registers: [metricsRegistry],
});

export const httpRequestDuration = new client.Histogram({
  name: `${METRIC_PREFIX}http_request_duration_seconds`,
  help: 'HTTP request duration in seconds.',
  labelNames: [...METRIC_LABELS],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [metricsRegistry],
});

export const activeHttpRequests = new client.Gauge({
  name: `${METRIC_PREFIX}http_requests_in_flight`,
  help: 'Current number of in-flight HTTP requests.',
  registers: [metricsRegistry],
});

export const httpRequestsByDevice = new client.Counter({
  name: `${METRIC_PREFIX}http_requests_by_device_total`,
  help: 'Total authenticated HTTP requests grouped by device display name.',
  labelNames: [...DEVICE_REQUEST_LABELS],
  registers: [metricsRegistry],
});

export const activeWebSocketConnections = new client.Gauge({
  name: `${METRIC_PREFIX}websocket_connections_active`,
  help: 'Current number of active websocket connections.',
  registers: [metricsRegistry],
});

export const webSocketConnectionsTotal = new client.Counter({
  name: `${METRIC_PREFIX}websocket_connections_total`,
  help: 'Total websocket connections grouped by resolved device display name.',
  labelNames: [...SOCKET_CONNECTION_LABELS],
  registers: [metricsRegistry],
});

type RequestMetricLabels = {
  method: string;
  route: string;
  status: string;
};

export function getNormalizedRequestPath(req: Pick<Request, 'baseUrl' | 'path'>) {
  return `${req.baseUrl || ''}${req.path || ''}` || '/';
}

export function shouldTrackRequest(req: Pick<Request, 'baseUrl' | 'path'>) {
  const normalizedPath = getNormalizedRequestPath(req);

  if (normalizedPath === '/metrics' || normalizedPath === '/health') {
    return false;
  }

  if (normalizedPath === '/favicon.ico' || normalizedPath.startsWith('/favicon')) {
    return false;
  }

  if (normalizedPath === '/images' || normalizedPath.startsWith('/images/')) {
    return false;
  }

  if (normalizedPath === '/assets' || normalizedPath.startsWith('/assets/')) {
    return false;
  }

  return true;
}

export function resolveMetricRoute(req: Request, res: Response) {
  if (res.statusCode === 404) {
    return 'unmatched';
  }

  const normalizedPath = getNormalizedRequestPath(req);

  const routePath = req.route?.path;

  if (typeof routePath === 'string') {
    return `${req.baseUrl || ''}${routePath}` || routePath;
  }

  if (Array.isArray(routePath)) {
    return `${req.baseUrl || ''}${routePath[0]}`;
  }

  if (req.path === '/health') {
    return '/health';
  }

  for (const prefix of STATIC_ASSET_ROUTE_PREFIXES) {
    if (normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`)) {
      return `${prefix}/*`;
    }
  }

  if (req.baseUrl) {
    return `${req.baseUrl}${req.path === '/' ? '' : req.path}`;
  }

  if (req.path === '/' || req.path.startsWith('/assets/')) {
    return 'frontend';
  }

  return 'unknown';
}

export function buildRequestMetricLabels(req: Request, res: Response): RequestMetricLabels {
  return {
    method: req.method,
    route: resolveMetricRoute(req, res),
    status: String(res.statusCode),
  };
}

export function getRequestDeviceDisplayName(req: Request) {
  const displayName = req.device?.displayName?.trim();

  return displayName || null;
}

export function normalizeSocketDeviceDisplayName(displayName: string | null | undefined) {
  const normalized = displayName?.trim();

  return normalized || 'unknown';
}
