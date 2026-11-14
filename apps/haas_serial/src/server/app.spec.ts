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
jest.mock('../serial_service.js', () => ({
  ...jest.requireActual('../serial_service.js'),
  readStatus: jest.fn(),
}));

const KEY = 'test-key';
const URL = 'http://10.30.1.57:5000';
const STATUS = [['MODE', 'MEM']];

async function setup(env: Record<string, string> = {}) {
  jest.resetModules();
  delete process.env.HAAS_SERIAL_ALLOWED_HOSTS;
  Object.assign(process.env, { HAAS_SERIAL_API_KEY: KEY, ...env });
  const { default: logger } = await import('../logger.js');
  const serial = (await import('../serial_service.js')) as unknown as {
    readStatus: jest.Mock;
    SerialError: new (status: number, message: string) => Error;
  };
  const { default: app } = await import('./app.js');
  serial.readStatus.mockResolvedValue(STATUS);

  /** Asks for a machine's status, by default with the key and a JSON body. */
  const post = (body?: unknown, { key = KEY as string | null, path = '/api/serial/status' } = {}) =>
    app.request(path, {
      method: 'POST',
      headers: {
        ...(key === null ? {} : { 'x-api-key': key }),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  return { app, logger, post, ...serial };
}

describe('haas serial API', () => {
  it('answers the health check without a key', async () => {
    const { app } = await setup();
    const response = await app.request('/health');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  it('answers 404 as JSON for a path it does not have', async () => {
    const { app } = await setup();
    const response = await app.request('/nothing');
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Not found' });
  });

  describe('request log', () => {
    it('leaves out health checks and the polls of machines', async () => {
      const { app, logger, post, readStatus, SerialError } = await setup();
      (logger.http as jest.Mock).mockClear();

      await app.request('/health');
      await post({ url: URL });
      await post({ url: URL }, { path: '/api/serial/status/H%201' });
      readStatus.mockRejectedValue(new SerialError(503, 'connect ECONNREFUSED'));
      await post({ url: URL });

      expect(logger.http).not.toHaveBeenCalled();
    });

    it('keeps requests that were refused or went wrong', async () => {
      const { app, logger, post, readStatus } = await setup();
      (logger.http as jest.Mock).mockClear();

      await post({ url: URL }, { key: 'wrong' });
      await post({});
      await app.request('/nothing');
      readStatus.mockRejectedValue(new Error('unexpected'));
      await post({ url: URL });

      expect(logger.http).toHaveBeenCalledTimes(4);
    });
  });

  describe('API key', () => {
    it('is required', async () => {
      const { post, readStatus } = await setup();
      const response = await post({ url: URL }, { key: null });
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: 'Missing or invalid API key' });
      expect(readStatus).not.toHaveBeenCalled();
    });

    it('must be the right one', async () => {
      const { post } = await setup();
      expect((await post({ url: URL }, { key: 'wrong' })).status).toBe(401);
    });

    it('refuses everything when none is configured', async () => {
      const { post } = await setup({ HAAS_SERIAL_API_KEY: '' });
      expect((await post({ url: URL }, { key: '' })).status).toBe(401);
    });
  });

  describe('reading a machine', () => {
    it('reads the host and port in the url and returns the status', async () => {
      const { post, readStatus } = await setup();

      const response = await post({ url: URL });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ data: STATUS });
      expect(readStatus).toHaveBeenCalledWith({ host: '10.30.1.57', port: 5000 });
    });

    it('takes the machine name in the path', async () => {
      const { post, readStatus } = await setup();
      const response = await post({ url: URL }, { path: '/api/serial/status/H%201' });
      expect(response.status).toBe(200);
      expect(readStatus).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['no body', undefined],
      ['no url', {}],
      ['a url that is not a string', { url: 5 }],
      ['a url that is not a URL', { url: 'vf2' }],
      ['a url without a port', { url: 'http://10.30.1.57' }],
    ])('answers 400 for %s', async (_case, body) => {
      const { post, readStatus } = await setup();

      const response = await post(body);

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: 'Request body needs a url with a host and port',
      });
      expect(readStatus).not.toHaveBeenCalled();
    });

    it('answers 400 for a body that is not JSON', async () => {
      const { app, readStatus } = await setup();
      const response = await app.request('/api/serial/status', {
        method: 'POST',
        headers: { 'x-api-key': KEY, 'Content-Type': 'application/json' },
        body: '{url:',
      });
      expect(response.status).toBe(400);
      expect(response.headers.get('Content-Type')).toContain('application/json');
      expect(readStatus).not.toHaveBeenCalled();
    });
  });

  describe('allowed hosts', () => {
    it('refuses a host that is not listed', async () => {
      const { post, readStatus } = await setup({ HAAS_SERIAL_ALLOWED_HOSTS: '10.30.1.0/24' });

      const response = await post({ url: 'http://169.254.169.254:8080' });

      expect(response.status).toBe(403);
      expect(readStatus).not.toHaveBeenCalled();
    });

    it('reads a host that is listed', async () => {
      const { post } = await setup({ HAAS_SERIAL_ALLOWED_HOSTS: '10.30.1.0/24' });
      expect((await post({ url: URL })).status).toBe(200);
    });
  });

  describe('when the machine cannot be read', () => {
    it.each([
      [503, 'connect ECONNREFUSED 10.30.1.57:5000'],
      [504, 'No reply to Q104 within 1000ms'],
      [502, 'Connection closed before the reply to Q104'],
    ])('answers %i with the reason', async (status, message) => {
      const { post, readStatus, SerialError } = await setup();
      readStatus.mockRejectedValue(new SerialError(status, message));

      const response = await post({ url: URL });

      expect(response.status).toBe(status);
      expect(await response.json()).toEqual({ error: message });
    });

    it('answers 500 without the details for anything unexpected', async () => {
      const { logger, post, readStatus } = await setup();
      readStatus.mockRejectedValue(new Error('secret detail'));

      const response = await post({ url: URL });

      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: 'Internal server error' });
      expect(logger.error).toHaveBeenCalled();
    });
  });
});
