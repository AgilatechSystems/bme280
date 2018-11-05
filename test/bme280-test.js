const chai = require('chai');
const bme280 = require('../bme280');
const expect = chai.expect;
var Bme280;

describe('BME280', function() {
  before(function(done) {
    
    Bme280 = new bme280();

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

  it ('should asynchronously get data from the sensor device without error', function(done) {
    Bme280.getDataFromDevice(function(err) {
      if (err) done (err);
      else done();
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

  it ('should synchronously get data from the sensor device without error', function() {
    Bme280.getDataFromDeviceSync();
    expect(Bme280.device.parameters[0].value).to.be.within(300, 1100);
    expect(Bme280.device.parameters[1].value).to.be.within(-40, 85);
    expect(Bme280.device.parameters[2].value).to.be.within(0, 100);
  });

  it ('should asyncronously collect pressure value', function(done){
    Bme280.valueAtIndex(0, function(err, value) {
      if (err) {
        done(err);
      }
      else {
        expect(value).to.be.within(300, 1100);
        done();
      }
    });
  });

  it ('should asyncronously collect temperature value', function(done){
    Bme280.valueAtIndex(1, function(err, value) {
      if (err) {
        done(err);
      }
      else {
        expect(value).to.be.within(-40, 85);
        done();
      }
    });
  });

  it ('should asyncronously collect humidity value', function(done){
    Bme280.valueAtIndex(2, function(err, value) {
      if (err) {
        done(err);
      }
      else {
        expect(value).to.be.within(0, 100);
        done();
      }
    });
  });

  it ('should synchronously collect pressure value', function() {
    expect(Bme280.valueAtIndexSync(0)).to.be.within(300, 1100);
  });

  it ('should synchronously collect temperature value', function() {
    expect(Bme280.device.parameters[1].value).to.be.within(-40, 85);
  });

  it ('should synchronously collect humidity value', function() {
    expect(Bme280.device.parameters[2].value).to.be.within(0, 100);
  });

  it ('should asyncronously error if an out-of-bounds index is requested', function(done) {
    Bme280.valueAtIndex(4, function(err, value) {
      if (err) {
        done();
      }
      else {
        done('Error: out-of-bounds index was not rejected');
      }
    });
  })

  it ('should synchronously error if an out-of-bounds index is requested', function(){
    expect(Bme280.valueAtIndexSync(-1)).to.be.NaN;
  }); 

  it ('should be able to set the device mode to normal', function() {
    Bme280.setMode('normal');
    expect(Bme280.device.mode).to.be.equal('normal');
  });

  it ('should adjust barometric pressure according to elevation', function() {
    const seaLevelPressure = Bme280.valueAtIndexSync(0);

    // have to artificially make the current values stale
    Bme280.isStale = true;

    // and now make us jump 1000 meters and take a new reading
    Bme280.device.elevation = 1000;
    const elevationPressure = Bme280.valueAtIndexSync(0);

    // the pressure is always asjusted higher for an elevation
    expect(seaLevelPressure).to.be.lessThan(elevationPressure);
  });
});