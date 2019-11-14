const chai = require('chai');
const bme280 = require('../bme280');
const expect = chai.expect;
var Bme280;

describe('BME280', function() {
  before(function(done) {
    
    //Bme280 = new bme280(); // i2c bus 1, addr 0x76, sea level
    Bme280 = new bme280({bus: 2, elevation: 1000}); // i2c bus 2, 1000m (3,300 ft) above sea level
    //Bme280 = new bme280({interface: 'spi', bus: 1, device: 0}); // spi bus 1.0

    // takes just a wee bit of time to startup
    var waiting = setTimeout(function wait() {
      if (Bme280.deviceActive()) {
          clearTimeout(waiting);
          done();
      }
      else {
          waiting = setTimeout(wait, 50);
      }
    }, 50);

  });

  it ('should activate the sensor device', function() {
    expect(Bme280.deviceActive()).to.be.true;
  });

  it ('should set basic device info', function() {
    const ver = require('../package').version;
    expect(Bme280.deviceName()).to.equal('Bme280');
    expect(Bme280.deviceType()).to.equal('sensor');
    expect(Bme280.deviceVersion()).to.equal(ver);
  });

  it ('should have three parameters', function() {
    expect(Bme280.deviceNumValues()).to.equal(3);
  });

  it ('should set parameter names', function() {
    expect(Bme280.nameAtIndex(0)).to.equal('pressure');
    expect(Bme280.nameAtIndex(1)).to.equal('temperature');
    expect(Bme280.nameAtIndex(2)).to.equal('humidity');
  });

  it ('should set parameter types', function() {
    for (let i = 0; i < Bme280.deviceNumValues(); i++) {
      expect(Bme280.typeAtIndex(i)).to.equal('float');
    }
  });

  it ('should asynchronously get data from the sensor device without error', function() {
    Bme280.getDataFromDevice().then(function() {
      expect();
    });
  });

  it ('should have collected a valid pressure', function(){
    expect(Bme280.device.parameters[0].value).to.be.within(300, 1100);
  });

  it ('should have collected a valid temperature', function(){
    expect(Bme280.device.parameters[1].value).to.be.within(-40, 85);
  });

  it ('should have collected a valid humidity', function(){
    expect(Bme280.device.parameters[2].value).to.be.within(0, 100);
  });

  it ('should asyncronously collect pressure value', function() {
    Bme280.valueAtIndex(0).then(function(val) {
      expect(val).to.be.within(300, 1100);
    });
  });

  it ('should asyncronously collect temperature value', function() {
    Bme280.valueAtIndex(1).then(function(val) {
      expect(val).to.be.within(-40, 85);
    });
  });

  it ('should asyncronously collect humidity value', function() {
    Bme280.valueAtIndex(2).then(function(val) {
      expect(val).to.be.within(0, 100);
    });
  });

  it ('should asyncronously error if an out-of-bounds index is requested', function() {
    Bme280.valueAtIndex(4).then(function(val) {
      expect();
    }).catch(function(err) {
      expect(err).to.equal('Bme280 Error: index 4 out of range');
    });
  });

  it ('should be able to set the device mode to normal', function() {
    Bme280.setMode('normal');
    expect(Bme280.device.mode).to.be.equal('normal');
  });

  it ('should adjust barometric pressure according to elevation', async function() {
    const seaLevelPressure = await Bme280.valueAtIndex(0);

    // have to artificially make the current values stale
    Bme280.isStale = true;

    // and now make us jump 1500 meters and take a new reading
    Bme280.device.elevation = 1500;
    const elevationPressure = await Bme280.valueAtIndex(0);

    // the pressure is always asjusted higher for an elevation
    expect(seaLevelPressure).to.be.lessThan(elevationPressure);
  });

});