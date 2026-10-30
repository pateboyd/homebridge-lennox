// Mocked HomeKit service tests. No S30 or Homebridge daemon required.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ThermostatAccessory } = require('../dist/accessories/thermostat');

const char = {
  Manufacturer: 'Manufacturer', Model: 'Model', SerialNumber: 'SerialNumber',
  Name: 'Name', CurrentTemperature: 'CurrentTemperature',
  CurrentHeatingCoolingState: { OFF: 0, HEAT: 1, COOL: 2 },
  TargetHeatingCoolingState: { OFF: 0, HEAT: 1, COOL: 2, AUTO: 3 },
  TargetTemperature: 'TargetTemperature',
  HeatingThresholdTemperature: 'HeatingThresholdTemperature',
  CoolingThresholdTemperature: 'CoolingThresholdTemperature',
  CurrentRelativeHumidity: 'CurrentRelativeHumidity',
  TemperatureDisplayUnits: { CELSIUS: 0, FAHRENHEIT: 1 },
};
class FakeCharacteristic {
  onGet(fn) { this.read = fn; return this; }
  onSet(fn) { this.write = fn; return this; }
  setProps(p) { this.props = p; return this; }
}
class FakeService {
  constructor() { this.characteristics = new Map(); }
  getCharacteristic(k) {
    if (!this.characteristics.has(k)) this.characteristics.set(k, new FakeCharacteristic());
    return this.characteristics.get(k);
  }
  setCharacteristic() { return this; }
  updateCharacteristic() { return this; }
  testCharacteristic(k) { return this.characteristics.has(k); }
  removeCharacteristic(value) {
    for (const [k, v] of this.characteristics) if (v === value) this.characteristics.delete(k);
    return this;
  }
}
function setup(singleSetpointMode) {
  const service = new FakeService();
  const information = new FakeService();
  const Service = { AccessoryInformation: 'AccessoryInformation', Thermostat: 'Thermostat' };
  const platform = {
    Service, Characteristic: char,
    log: { info() {}, debug() {}, warn() {}, error() {} },
  };
  const accessory = {
    getService(key) { return key === Service.AccessoryInformation ? information : service; },
    addService() { return service; },
  };
  const publishes = [];
  const zone = {
    id: 0, name: 'Test S30',
    temperatureC: 22, temperature: 72, humidity: 40, tempOperation: 'off',
    systemMode: 'heat and cool', heatingOption: true, coolingOption: true,
    sp: 72, spC: 22, hsp: 70, hspC: 21, csp: 75, cspC: 24,
    minHspC: 16, maxHspC: 30, minCspC: 16, maxCspC: 30,
    system: { singleSetpointMode, productType: 'S30', serialNumber: 'test', hspCCspCSeparation: 1.5 },
    registerOnUpdateCallback() {},
    async performSetpoint(update) { publishes.push(update); },
  };
  const thermostat = new ThermostatAccessory(platform, accessory, zone);
  return { thermostat, service, zone, publishes };
}

test('Perfect Temp exposes one target and publishes spC only', async () => {
  const {thermostat, service, zone, publishes} = setup(true);
  assert.equal(service.testCharacteristic(char.HeatingThresholdTemperature), false);
  assert.equal(service.testCharacteristic(char.CoolingThresholdTemperature), false);
  await thermostat.setTargetTemperature(23);
  assert.deepEqual(publishes, [{spC: 23}]);
  assert.equal(zone.system.singleSetpointMode, true);
});

test('HomeKit concurrent heat/cool writes publish together', async () => {
  const {thermostat, publishes} = setup(false);
  await Promise.all([
    thermostat.setHeatingThreshold(20.5),
    thermostat.setCoolingThreshold(24.5),
  ]);
  assert.deepEqual(publishes, [{hspC: 20.5, cspC: 24.5}]);
});

test('Temperature changes are clamped to S30 reported limits', async () => {
  const {thermostat, publishes, service} = setup(false);
  assert.equal(service.getCharacteristic(char.HeatingThresholdTemperature).props.minValue, 16);
  assert.equal(service.getCharacteristic(char.CoolingThresholdTemperature).props.maxValue, 30);
  await thermostat.setHeatingThreshold(35);
  assert.deepEqual(publishes, [{hspC: 30}]);
});

test('Generic Auto target shifts both thresholds without discarding range', async () => {
  const {thermostat, publishes} = setup(false);
  await thermostat.setTargetTemperature(23);
  assert.equal(publishes.length, 1);
  assert.equal(publishes[0].cspC - publishes[0].hspC, 3);
});
