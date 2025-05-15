import _ from 'lodash';
import * as mqtt from 'mqtt';
import logger from '../../logger.js';
import { focasMachines as machines } from '../index.js';
import mappings from './focas_mappings.js';

let client: mqtt.MqttClient;
const machineLocationsManualCycleCalc = ['rd4', 'rd5'];

export function connect(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!process.env.MQTT_URL) throw new Error('Missing MQTT_URL environment variable.');
    client = mqtt.connect(process.env.MQTT_URL);

    client.on('connect', () => {
      logger.info('Connected to MQTT broker');
      client.subscribe('fanuc/#', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    client.on('disconnect', () => {
      logger.warn('Disconnected from the MQTT broker');
    });

    client.on('message', processMessage);
  });
}

export function disconnect() {
  if (client) {
    client.end();
  }
}

export function processMessage(topic: string, message: Buffer) {
  // Extract the machine name from the mqtt topic
  const machineLocation = topic.split('/')[1];
  if (!machineLocation) return;

  // Ensure we have a registered machine
  const machine = machines.get(machineLocation);
  if (!machine) return;

  // Try to parse the message buffer to JSON
  let data: any = {};
  try {
    data = JSON.parse(message.toString());
  } catch (e) {
    return;
  }

  // Extract the subtopic from the mqtt topic
  const subtopic = topic.split('/').slice(2).join('/');
  // Only process subtopics we have mapped
  if (!mappings[subtopic]) return;

  // Loop through the mapped subtopics and see if any data values have changed
  const changes: Changes = new Map();
  const lastStateTs = machine.getState().lastStateTs;
  Object.keys(mappings[subtopic]).forEach((location) => {
    let value: any;
    // Try to get the nested value via the mapped subtopic
    try {
      value = get(data, location);
    } catch (e) {
      return;
    }
    if (value === undefined) return;

    // Compare the old property value to the new property value
    const mapping = mappings[subtopic];
    if (!mapping) return;
    const prop = mapping[location] as keyof FocasState;
    const state = machine.getState() as FocasState;
    const old = state[prop];
    if (old === undefined) return;
    if (!_.isEqual(old, value)) {
      // If the current cycle time is smaller than previously seen
      // then a new part has been started and the old cycle time is considered the 'last' cycle time
      if (prop === 'cycle') {
        if (old > value) changes.set('lastCycle', old);
      }

      // If the execution mode has changed the push a new lastStateTs value
      if (prop === 'execution') {
        if (value === 'OPTIONAL_STOP') return;
        changes.set('lastStateTs', new Date().toISOString());
      }
      // Push the newly changed value
      changes.set(prop, value);
    }
  });

  const previousStatus = machine.getStatus();

  // Update machine status if there are any changes
  if (changes.size) {
    machine.setState(changes);
    machine.updateStatus();
  }

  const currentStatus = machine.getStatus();

  if (machineLocationsManualCycleCalc.includes(machineLocation)) {
    if (previousStatus === 'green' && currentStatus !== 'green') {
      const lastCycle: Changes = new Map();
      lastCycle.set('lastCycle', new Date().valueOf() - new Date(lastStateTs).valueOf());
      machine.setState(lastCycle);
    }
  }

  if (previousStatus === 'yellow' && currentStatus !== 'yellow') {
    const lastOperatorTime: Changes = new Map();
    lastOperatorTime.set(
      'lastOperatorTime',
      new Date().valueOf() - new Date(lastStateTs).valueOf(),
    );
    machine.setState(lastOperatorTime);
  }
}

const get = (object: any, path: string, defaultValue?: any) =>
  path.split('.').reduce((o, p) => (o ? o[p] : defaultValue), object);
