import axios from 'axios';
import { Router } from 'express';
import { baseUrl } from '../../config.js';
import machines from '../../machines/index.js';
import { emit } from '../socket.io.js';
import MachineRoutes from './machine.js';
import StatsRoutes from './stats.js';

const router: Router = Router();

type MachineDashboardMetadata = Pick<
  MachineJobDashboardRow,
  | 'jobId'
  | 'jobNumber'
  | 'partId'
  | 'partNumber'
  | 'partDescription'
  | 'partHasIncompleteData'
  | 'partSummary'
>;

async function fetchMachineDashboardMetadata() {
  try {
    const { data } = await axios.get<MachineJobDashboardResponse>(
      `${baseUrl}/api/jobs/machine-dashboard`,
    );

    return new Map<string, MachineDashboardMetadata>(
      data.active.map((machine) => [
        machine.machineId,
        {
          jobId: machine.jobId ?? null,
          jobNumber: machine.jobNumber ?? null,
          partId: machine.partId ?? null,
          partNumber: machine.partNumber ?? null,
          partDescription: machine.partDescription ?? null,
          partHasIncompleteData: machine.partHasIncompleteData ?? false,
          partSummary: machine.partSummary,
        },
      ]),
    );
  } catch (error) {
    console.warn('Unable to load machine dashboard metadata.', error);
    return new Map<string, MachineDashboardMetadata>();
  }
}

router.get('/', (_req, res, _next) => {
  res.status(200).json({ message: 'Welcome to the API' });
});

router.use('/machine', MachineRoutes);
router.use('/stats', StatsRoutes);

router.get('/machines', async (_req, res, next) => {
  try {
    const machineDashboardMetadata = await fetchMachineDashboardMetadata();
    const response = [];
    let id = 0;
    for (const [, value] of machines) {
      const machine = value.getMachine();
      response.push({
        ...machine,
        ...machineDashboardMetadata.get(machine.id),
        index: id++,
      });
    }
    res.status(200).json(response);
  } catch (e) {
    next(e);
  }
});

router.post('/refresh', (req, res, _next) => {
  const { token } = req.body;
  if (!process.env.TOKEN || !token || token !== process.env.TOKEN) {
    res.sendStatus(401);
    return;
  }
  emit('refresh');
  res.sendStatus(204);
});

export default router;
