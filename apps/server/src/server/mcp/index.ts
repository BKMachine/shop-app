import { NodeStreamableHTTPServerTransport } from '@modelcontextprotocol/node';
import { McpServer } from '@modelcontextprotocol/server';
import { Router } from 'express';
import { narrowKnownDevice, requireKnownDevice } from '../middleware/knownDevices.js';
import registerMaterialTools from './materials.js';

const router: Router = Router();

function createServer(deviceId: string): McpServer {
  const server = new McpServer({ name: 'shop-app', version: '1.0.0' });
  registerMaterialTools(server, deviceId);
  return server;
}

// Stateless: every request gets its own server and transport, so tool calls are audited as the
// device that authenticated that request.
router.post('/', requireKnownDevice, async (req, res, next) => {
  narrowKnownDevice(req);

  try {
    const server = createServer(req.deviceId);
    const transport = new NodeStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (e) {
    next(e);
  }
});

router.all('/', (_req, res) => {
  res
    .status(405)
    .set('Allow', 'POST')
    .json({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed.' }, id: null });
});

export default router;
