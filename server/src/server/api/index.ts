import { Router } from 'express';
import SupplierRoutes from './routes/suppliers';
import ToolRoutes from './routes/tools';
import VendorRoutes from './routes/vendors';

const router = Router();

router.get('/', (req, res, next) => {
  res.status(200).json({ message: 'Welcome to the API' });
});

router.use(SupplierRoutes);
router.use(VendorRoutes);
router.use(ToolRoutes);

export default router;
