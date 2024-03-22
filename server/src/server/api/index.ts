import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import DymoService from '../../services/dymo_service';
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

router.post('/print', async (req, res, next) => {
  const { text } = req.body;
  if (!text) {
    res.sendStatus(400);
    return;
  }
  try {
    const imageData = await DymoService(text);
    res.status(200).send(imageData);
  } catch (e) {
    next(e);
  }
});

export default router;
