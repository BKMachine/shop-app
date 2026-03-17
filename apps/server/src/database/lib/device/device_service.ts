import Device from './device_model.js';

async function findDeviceById(deviceId: string): Promise<DeviceDoc | null> {
  return Device.findOne({ deviceId }).exec();
}

function updateDevice(deviceId: string, update: Partial<DeviceDoc>): void {
  void Device.updateOne({ deviceId }, { $set: update }).exec();
}

async function addDevice(data: Partial<DeviceDoc>): Promise<DeviceDoc> {
  const device = new Device(data);
  await device.save();
  return device;
}

export default {
  findDeviceById,
  updateDevice,
  addDevice,
};
