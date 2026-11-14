jest.mock('../logger.js', () => ({
  __esModule: true,
  default: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    http: jest.fn(),
  },
}));
jest.mock('../machines/index.js', () => {
  const machine = { toJSON: () => ({ id: 'id-1', name: 'RD5' }) };
  return {
    __esModule: true,
    default: new Map([['id-1', machine]]),
    listMachineData: () => [machine.toJSON()],
  };
});
jest.mock('../timeseries/performance.js', () => {
  class InvalidRangeError extends Error {}
  return { InvalidRangeError, getDepartmentPerformance: jest.fn() };
});
jest.mock('./socket.io.js', () => ({ emit: jest.fn() }));

async function setup(env: Record<string, string> = {}) {
  jest.resetModules();
  delete process.env.TOKEN;
  delete process.env.CORS_ORIGIN;
  Object.assign(process.env, env);
  const { default: logger } = await import('../logger.js');
  const { emit } = (await import('./socket.io.js')) as unknown as { emit: jest.Mock };
  const performance = (await import('../timeseries/performance.js')) as unknown as {
    InvalidRangeError: new (message: string) => Error;
    getDepartmentPerformance: jest.Mock;
  };
  const { default: app } = await import('./app.js');

  const post = (path: string, body?: unknown) =>
    app.request(path, {
      method: 'POST',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  return { app, emit, logger, post, ...performance };
}

describe('status API', () => {
  it('answers the health check', async () => {
    const { app } = await setup();
    const response = await app.request('/health');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  it('lists the machines in order', async () => {
    const { app } = await setup();
    const response = await app.request('/api/machines');
    expect(await response.json()).toEqual([{ id: 'id-1', name: 'RD5', index: 0 }]);
  });

  it('returns one machine, or 404 if there is no such machine', async () => {
    const { app } = await setup();
    expect(await (await app.request('/api/machine/id-1')).json()).toEqual({
      id: 'id-1',
      name: 'RD5',
    });
    expect((await app.request('/api/machine/nope')).status).toBe(404);
  });

  it('has no way to change machines', async () => {
    const { app, post } = await setup();
    expect((await post('/api/machine', { name: 'X' })).status).toBe(404);
    expect((await app.request('/api/machine/id-1', { method: 'PUT' })).status).toBe(404);
    expect((await app.request('/api/machine/id-1', { method: 'DELETE' })).status).toBe(404);
  });

  it('answers 500 without the details when something breaks', async () => {
    const { app, getDepartmentPerformance, logger } = await setup();
    getDepartmentPerformance.mockRejectedValue(new Error('influx token abc'));

    const response = await app.request('/api/stats/department-performance');

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Internal server error' });
    expect(logger.error).toHaveBeenCalled();
  });

  describe('browser access', () => {
    it('allows any origin when CORS_ORIGIN is not set', async () => {
      const { app } = await setup();
      const response = await app.request('/api/machines', { headers: { Origin: 'http://a.test' } });
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });

    it('allows only the origins in CORS_ORIGIN', async () => {
      const { app } = await setup({ CORS_ORIGIN: 'https://shop.test/, https://kiosk.test' });
      const from = (origin: string) =>
        app.request('/api/machines', { headers: { Origin: origin } });

      const allowed = await from('https://shop.test');
      expect(allowed.headers.get('Access-Control-Allow-Origin')).toBe('https://shop.test');
      const refused = await from('https://evil.test');
      expect(refused.headers.get('Access-Control-Allow-Origin')).toBeNull();
    });
  });

  describe('department performance', () => {
    it('passes the range on as dates', async () => {
      const { app, getDepartmentPerformance } = await setup();
      getDepartmentPerformance.mockResolvedValue([{ department: 'Mills', greenPercent: 50 }]);

      const response = await app.request(
        '/api/stats/department-performance?from=2026-03-02T11:00:00.000Z&to=2026-03-02T12:00:00.000Z',
      );

      expect(await response.json()).toEqual({
        performance: [{ department: 'Mills', greenPercent: 50 }],
      });
      expect(getDepartmentPerformance).toHaveBeenCalledWith({
        from: new Date('2026-03-02T11:00:00.000Z'),
        to: new Date('2026-03-02T12:00:00.000Z'),
      });
    });

    it('answers 400 for a date it cannot read', async () => {
      const { app, getDepartmentPerformance } = await setup();
      const response = await app.request('/api/stats/department-performance?from=yesterday');
      expect(response.status).toBe(400);
      expect(getDepartmentPerformance).not.toHaveBeenCalled();
    });

    it('answers 400 for a range that is not allowed', async () => {
      const { app, getDepartmentPerformance, InvalidRangeError } = await setup();
      getDepartmentPerformance.mockImplementation(() => {
        throw new InvalidRangeError('Invalid time range: it can be 31 days at most');
      });

      const response = await app.request('/api/stats/department-performance?from=2020-01-01');

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: 'Invalid time range: it can be 31 days at most',
      });
    });
  });

  describe('refresh', () => {
    it('tells the status boards to reload when given the token', async () => {
      const { emit, post } = await setup({ TOKEN: 'secret' });
      expect((await post('/api/refresh', { token: 'secret' })).status).toBe(204);
      expect(emit).toHaveBeenCalledWith('refresh');
    });

    it('refuses a wrong or missing token', async () => {
      const { emit, post } = await setup({ TOKEN: 'secret' });
      expect((await post('/api/refresh', { token: 'wrong' })).status).toBe(401);
      expect((await post('/api/refresh', {})).status).toBe(401);
      expect((await post('/api/refresh')).status).toBe(401);
      expect(emit).not.toHaveBeenCalled();
    });

    it('refuses everything when no token is configured', async () => {
      const { post } = await setup();
      expect((await post('/api/refresh', { token: '' })).status).toBe(401);
      expect((await post('/api/refresh', { token: 'undefined' })).status).toBe(401);
    });
  });
});
