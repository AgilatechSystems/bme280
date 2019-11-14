const Bme280 = require('../bme280');

// options common to all sensors
const options = {
  interface: 'spi',
  bus: 1,
  device: 0,
  mode: 'normal',
  elevation: 1750
}

// options for sensor 0 
var env0 = Object.assign({}, options);
env0.name = 'EnvSensor0';

// instantiate the two sensors
const sensor0 = new Bme280(env0);

// fire it off
repeat(sensor0);

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
    sensor.getValueByName('temperature').then( val=> {
      console.log(`\nCalling getValueByName('temperature') returns: ${val}`);
    }).catch(err => {
      console.error(err);
    });
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

