import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import SMTPService from '../../services/smtp_service.js';
import AuditRoutes from './routes/audits.js';
import CustomerRoutes from './routes/customers.js';
import MaterialRoutes from './routes/materials.js';
import PartRoutes from './routes/parts.js';
import PrintRoutes from './routes/print.js';
import SupplierRoutes from './routes/suppliers.js';
import ToolRoutes from './routes/tools.js';
import VendorRoutes from './routes/vendors.js';

const router: Router = Router();
const uuid = uuidv4();

router.get('/', (_req, res, _next) => {
  res.status(200).json({ message: 'Welcome to the API' });
});

router.get('/version', (_req, res, next) => {
  try {
    res.status(200).send(uuid);
  } catch (e) {
    next(e);
  }
});

router.use(CustomerRoutes);
router.use(SupplierRoutes);
router.use(VendorRoutes);
router.use(ToolRoutes);
router.use(AuditRoutes);
router.use(PrintRoutes);
router.use(PartRoutes);
router.use(MaterialRoutes);

router.get('/mail/reorders', async (_req, res, next) => {
  try {
    await SMTPService.reorders();
    res.sendStatus(204);
  } catch (e) {
    next(e);
  }
});
export default router;
