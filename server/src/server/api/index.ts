import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import DymoService from '../../services/dymo_service';
import SMTPService from '../../services/smtp_service';
import AuditRoutes from './routes/audits';
import CustomerRoutes from './routes/customers';
import SupplierRoutes from './routes/suppliers';
import ToolRoutes from './routes/tools';
import VendorRoutes from './routes/vendors';

const router = Router();
const uuid = uuidv4();

router.get('/', (req, res, next) => {
  res.status(200).json({ message: 'Welcome to the API' });
});

router.get('/version', (req, res, next) => {
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

router.post('/print/location', async (req, res, next) => {
  const { loc, pos }: PrintLocationBody = req.body;
  if (!loc || !pos) {
    res.sendStatus(400);
    return;
  }
  try {
    await DymoService.printLocationLabel({ loc, pos });
    res.sendStatus(204);
  } catch (e) {
    next(e);
  }
});

router.get('/mail/reorders', async (req, res, next) => {
  try {
    await SMTPService.reorders();
    res.sendStatus(204);
  } catch (e) {
    next(e);
  }
});
export default router;
