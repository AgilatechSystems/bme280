const Bme280 = require('../bme280');

// options common to all sensors
const options = {
  interface: 'spi',
  bus: 1,
  device: 0,
  mode: 'normal',
  refresh: 1000,
  elevation: 1750,
  spiselect: 48,
  spibit0: 49,
  spibit1: 117,
  spibit2: 115
}

let sensorOpts = [];
let sensorHardware = [];
let numSensors = 1;
if (typeof process.argv[2] != 'undefined') {
  numSensors = process.argv[2];
}
for (var sen = 0; sen < numSensors; sen++) {
  sensorOpts[sen] = Object.assign({}, options);
  sensorOpts[sen].spiaddr = sen;
  sensorOpts[sen].name = 'EnvSensor' + sen;
  sensorHardware[sen] = new Bme280(sensorOpts[sen]);
}

for (sen = 0; sen < numSensors; sen++) {
  repeat(sensorHardware[sen]);
}

function repeat(sensor) {
  startup(sensor).then( () => {
    setInterval(() => {
      measure(sensor);  
    }, 4000);
  }).catch(err => {
    console.error(err);
  });
}

function measure(sensor) {
  sensor.getDataFromDevice().then(() => {
    console.log(`\nOutput from ${sensor.deviceName()}`);
    for (var i = 0; i < sensor.deviceNumValues(); i++) {
      console.log(sensor.device.parameters[i]);
    }
  }).catch( err => {
      console.error(`Error from sensor ${sensor.deviceName()} : ${err}`);
  });
}

function startup(sensor) {
  return new Promise((resolve, reject) => {
    var tries = 0;

    // takes just a bit of time to startup
    var waiting = setTimeout(function wait() {
      if (sensor.deviceActive()) {
        console.log(`Sensor ${sensor.deviceName()} activated`);
        clearTimeout(waiting);
        resolve();
      }
      else {
        tries++;
        console.log(`Sensor ${sensor.deviceName()} try ${tries}`);
        if (tries > 10) { // give er ten tries
          clearTimeout(waiting);
          reject("Device did not activate");
        }
        else {
          waiting = setTimeout(wait, 100);
        }
      }
    }, 100);
  });
}

