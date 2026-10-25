import { NodeStreamableHTTPServerTransport } from '@modelcontextprotocol/node';
import { McpServer } from '@modelcontextprotocol/server';
import { Router } from 'express';
import { narrowKnownDevice, requireKnownDevice } from '../middleware/knownDevices.js';
import registerMaterialTools from './materials.js';

const router: Router = Router();

// Sent to the client when it connects, as guidance for the model using the tools.
const instructions = `Tools for the machine shop's material catalog: look up and add the bar stock and pieces the shop buys, record their prices (including past prices from old invoices), and read price history.

Materials
- "stock" is bar or tube priced per foot (costPerFoot); a "piece" is a pre-formed blank such as a molding or casting, priced per piece (costPerPiece). Use the cost field that matches the material's kind.
- Stock is identified by grade, shape and cross-section (diameter, or height and width, plus wall thickness for tube). Bar length and supplier don't identify it, since the price is per foot. A piece is identified by grade, form and name.
- Sizes are in inches. For metric stock, cross-section sizes are given and returned in millimeters (see crossSectionUnit); lengths are always inches.

Find before changing anything
- Use find_materials with the grade, shape and sizes. Sizes match within 0.01 in, closest first, and sizeDifference says how far off each result is (0 is exact).
- A near match may be the same material recorded slightly off, or a genuinely different size (a 0.120 in wall is not necessarily a 0.125 in wall). When it isn't clearly the same, ask the user.

Recording prices with update_material_cost
- A price taking effect now: omit effectiveAt.
- A past price: set effectiveAt to the invoice date. It goes into the history at that date and only becomes the current cost if it is newer than everything recorded. Invoices can be entered in any order.
- If the tool says the current cost isn't in the recorded history, ask the user whether this price should also become the current cost (updateCurrent: true) or only be history (false). Don't guess; the current cost is used for quoting.
- Repeating a call is safe: recorded: false means that price was already in effect then.

Adding materials with create_material
- Only after find_materials shows the material doesn't exist. The supplier must already exist; there is no tool to add one.
- Include the newest known price and its date (effectiveAt), then add older prices with update_material_cost.
- If it's refused as within 0.01 in of an existing material, show the user the candidates and pass confirmDistinct: true only once they confirm it's a different size.

Price history with get_material_cost_history
- Changes come oldest first; each price holds until the next change. costAtStart is the price at the start of the range and currentCost the price now. Prices from before the shop began tracking appear only if they were backfilled.

Reviewing for duplicates with list_materials
- It pages through every material, sorted so materials of nearly the same size sit together. Report suspected duplicates to the user; merging them is done in the shop app, not with these tools.`;

function createServer(deviceId: string): McpServer {
  const server = new McpServer({ name: 'shop-app', version: '1.0.0' }, { instructions });
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
