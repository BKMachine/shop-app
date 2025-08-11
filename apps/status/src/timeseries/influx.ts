import { InfluxDB, type WriteApi } from '@influxdata/influxdb-client';
import { BucketsAPI, HealthAPI, MeAPI, OrgsAPI } from '@influxdata/influxdb-client-apis';
import logger from '../logger.js';
import { storeMachineStatus } from './machineStatus.js';
import { storePerformance } from './performance.js';

const url = process.env.INFLUX_URL || 'http://localhost:8086';
const token = process.env.INFLUX_TOKEN || '';
const org = process.env.INFLUX_ORG || 'my-org';
const bucket = process.env.INFLUX_BUCKET || 'my-bucket';

let writeApi: WriteApi;
let statusTimer: NodeJS.Timeout;
let performanceTimer: NodeJS.Timeout;

export async function connect(): Promise<void> {
  const { influx } = await preflightInflux({ url, token, orgName: org, bucketName: bucket });
  logger.info(`Connected to InfluxDB at ${url} with org "${org}" and bucket "${bucket}"`);
  writeApi = influx.getWriteApi(org, bucket, 'ms');
  writeApi.useDefaultTags({ dev: process.env.NODE_ENV !== 'production' ? 'dev' : 'prod' });
  statusTimer = setInterval(() => {
    storeMachineStatus(writeApi);
  }, 1000 * 15);
  performanceTimer = setInterval(() => {
    storePerformance(writeApi);
  }, 1000 * 60);
}

export async function disconnect(): Promise<void> {
  if (statusTimer) clearInterval(statusTimer);
  if (performanceTimer) clearInterval(performanceTimer);
  if (writeApi)
    await writeApi.close().catch(() => {
      // Do Noting
    });
}

export async function preflightInflux({
  url,
  token,
  orgName,
  bucketName,
}: {
  url: string;
  token: string;
  orgName: string;
  bucketName: string;
}) {
  const influx = new InfluxDB({ url, token });

  // 1) Server reachable?
  const health = await new HealthAPI(influx).getHealth();
  if (health.status !== 'pass') {
    throw new Error(`InfluxDB not healthy: ${health.status} ${health.message ?? ''}`);
  }

  // 2) Token valid? (401/403 here means bad token/permissions)
  const me = await new MeAPI(influx).getMe();

  // 3) Resolve org id (if you only have the org name)
  const orgs = await new OrgsAPI(influx).getOrgs({ org: orgName });
  const org = orgs.orgs?.find((o) => o.name === orgName);
  if (!org?.id) throw new Error(`Org not found: ${orgName}`);

  // 4) Bucket exists?
  const buckets = await new BucketsAPI(influx).getBuckets({ orgID: org.id, name: bucketName });
  const bucket = buckets.buckets?.find((b) => b.name === bucketName);
  if (!bucket?.id) throw new Error(`Bucket not found in org "${orgName}": ${bucketName}`);

  return { influx, org, bucket, me };
}
