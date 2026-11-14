import _ from 'lodash';
import * as mqtt from 'mqtt';
import logger from '../../logger.js';
import { focasMachines as machines } from '../index.js';
import type { StateChanges } from '../Machine.js';
import type FocasMachine from './FocasMachine.js';
import mappings from './focas_mappings.js';

// The driver sends a sweep every 5s for each machine it has reached, including online: false once
// the machine is off. Silence therefore means the driver or its connection has failed.
const SWEEP_TIMEOUT_MS = 30000;
const SWEEP_CHECK_MS = 5000;

let client: mqtt.MqttClient;
let sweepCheck: NodeJS.Timeout | undefined;
let brokerConnected = false;
let stopping = false;
let lastBrokerError: string | null = null;
let watchingSince = 0;
const lastSweep = new Map<string, number>();
const machinesWithProductionCycleTimer = new Set<string>();
// Machines whose running cycle crossed an outage, so its time can't be trusted.
const interruptedCycles = new Set<string>();

/** Starts connecting and returns straight away, so a broker outage can't hold up app startup. */
export function connect(): void {
  if (!process.env.MQTT_URL) throw new Error('Missing MQTT_URL environment variable.');
  stopping = false;
  watchingSince = Date.now();
  client = mqtt.connect(process.env.MQTT_URL);

  client.on('connect', () => {
    brokerConnected = true;
    lastBrokerError = null;
    // Sweeps can't have arrived while disconnected, so give the driver a full timeout again.
    lastSweep.clear();
    watchingSince = Date.now();
    logger.info('Connected to MQTT broker');
    client.subscribe('fanuc/#', (err) => {
      if (err) logger.error(`Failed to subscribe to MQTT topics: ${err.message}`);
    });
  });

  // Fires again on every failed reconnect, so only act on the first one.
  client.on('close', () => {
    if (stopping || !brokerConnected) return;
    brokerConnected = false;
    logger.warn('Lost connection to the MQTT broker');
    for (const [location, machine] of machines) setOffline(location, machine);
  });

  client.on('error', (error) => {
    if (error.message === lastBrokerError) return;
    lastBrokerError = error.message;
    logger.error(`MQTT client error: ${error.message}`);
  });

  client.on('message', processMessage);

  sweepCheck = setInterval(checkSweeps, SWEEP_CHECK_MS);
}

export function disconnect() {
  // Shutting down isn't an outage: the state snapshot saved next must keep machines as they are.
  stopping = true;
  clearInterval(sweepCheck);
  if (client) {
    client.end();
  }
}

function checkSweeps() {
  const now = Date.now();
  for (const [location, machine] of machines) {
    if (!machine.getState().online) continue;
    const lastHeard = lastSweep.get(location) ?? watchingSince;
    if (now - lastHeard < SWEEP_TIMEOUT_MS) continue;
    logger.warn(`No sweep from ${location} for ${SWEEP_TIMEOUT_MS / 1000}s, marking it offline`);
    setOffline(location, machine);
  }
}

function setOffline(location: string, machine: FocasMachine) {
  if (machine.getStatus() === 'green') interruptedCycles.add(location);
  if (machine.getState().online) machine.update({ online: false });
}

function hasProductionCycleTimer(subtopic: string, location: string, value: unknown) {
  return (
    subtopic === 'production/1' &&
    location === 'state.data.timers.cycle_time_ms' &&
    value !== undefined
  );
}

export function processMessage(topic: string, message: Buffer) {
  // Extract the machine name from the mqtt topic
  const machineLocation = topic.split('/')[1];
  if (!machineLocation) return;

  // Ensure we have a registered machine
  const machine = machines.get(machineLocation);
  if (!machine) return;

  // Only process subtopics we have mapped, which saves parsing the many that aren't
  const subtopic = topic.split('/').slice(2).join('/');
  const mapping = mappings[subtopic];
  if (!mapping) return;

  // Try to parse the message buffer to JSON
  let data: unknown = {};
  try {
    data = JSON.parse(message.toString());
  } catch (_error) {
    // Do Nothing - Invalid JSON format
    return;
  }

  // A retained copy only arrives just after connecting, when the timeout restarts anyway, so it
  // can't keep a machine online once the driver has stopped.
  if (subtopic === 'sweep') lastSweep.set(machineLocation, Date.now());

  // Loop through the mapped values and see if any have changed. The values come from the driver
  // unchecked, so they can't be held to the state's types.
  const changes: Record<string, unknown> = {};
  const lastStateTs = machine.getState().lastStateTs;
  Object.keys(mapping).forEach((location) => {
    let value: any;
    // Try to get the nested value via the mapped subtopic
    try {
      value = get(data, location);
    } catch (error) {
      logger.error(`Error getting value for ${location} in subtopic ${subtopic}:`, error);
      return;
    }

    if (hasProductionCycleTimer(subtopic, location, value)) {
      machinesWithProductionCycleTimer.add(machineLocation);
    }

    if (value === undefined) return;

    // Compare the old property value to the new property value
    const prop = mapping[location] as keyof FocasState;
    const old = machine.getState()[prop];
    if (old === undefined) return;
    if (!_.isEqual(old, value)) {
      // If the current cycle time is smaller than previously seen
      // then a new part has been started and the old cycle time is considered the 'last' cycle time
      if (prop === 'cycle') {
        if (old > value) changes.lastCycle = old;
      }

      // If the execution mode has changed the push a new lastStateTs value
      if (prop === 'execution') {
        // An optional stop is a pause within the cycle, so the machine stays as it was
        if (value === 'OPTIONAL_STOP') return;
        changes.lastStateTs = new Date().toISOString();
      }

      // Time spent offline must not count towards the next wait or cycle
      if (prop === 'online' && value === true) {
        changes.lastStateTs = new Date().toISOString();
      }
      // Push the newly changed value
      changes[prop] = value;
    }
  });

  const previousStatus = machine.getStatus();

  // Update the machine if there are any changes
  if (Object.keys(changes).length) machine.update(changes as StateChanges<FocasState>);

  const currentStatus = machine.getStatus();

  if (previousStatus === 'green' && currentStatus === 'offline') {
    interruptedCycles.add(machineLocation);
  } else if (currentStatus !== 'green' && currentStatus !== 'offline') {
    const interrupted = interruptedCycles.delete(machineLocation);
    if (
      previousStatus === 'green' &&
      !interrupted &&
      !machinesWithProductionCycleTimer.has(machineLocation)
    ) {
      machine.update({ lastCycle: Date.now() - new Date(lastStateTs).valueOf() });
    }
  }
}

const get = (object: any, path: string, defaultValue?: any) =>
  path.split('.').reduce((o, p) => (o ? o[p] : defaultValue), object);
