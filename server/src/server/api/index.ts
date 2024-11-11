import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import ImageService from '../../database/lib/image';
import SMTPService from '../../services/smtp_service';
import AuditRoutes from './routes/audits';
import CustomerRoutes from './routes/customers';
import PartRoutes from './routes/parts';
import PrintRoutes from './routes/print';
import SupplierRoutes from './routes/suppliers';
import ToolRoutes from './routes/tools';
import VendorRoutes from './routes/vendors';
import uploader from './uploader';

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
router.use(PrintRoutes);
router.use(PartRoutes);

router.get('/mail/reorders', async (req, res, next) => {
  try {
    await SMTPService.reorders();
    res.sendStatus(204);
  } catch (e) {
    next(e);
  }
});

// Upload route
router.post('/upload', uploader.single('image'), async (req, res) => {
  try {
    await ImageService.save(req.file.filename, req.file.path, req.body.id, req.body.type);
    const imageUrl = `${process.env.BASE_URL}/img/${req.body.type}/${req.body.id}/${req.file.filename}`;
    res.json({ url: imageUrl });
  } catch (e) {
    next(e);
  } /**/
});

export default router;
