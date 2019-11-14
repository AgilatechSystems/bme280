
module.exports = class Bme280 {
  constructor(options) {
    let opts = options || {};

    this.device = {};
    this.device.name = (opts.hasOwnProperty('name')) ? opts.name : 'Bme280';
    this.device.type = (opts.hasOwnProperty('type')) ? opts.type : 'sensor';
    this.device.active = false;
    this.device.interface = (opts.hasOwnProperty('interface')) ? opts.interface : 'i2c';
    this.device.bus = (opts.hasOwnProperty('bus')) ? opts.bus : 1;
    this.device.addr = (opts.hasOwnProperty('addr')) ? opts.addr : 0x76;
    this.device.device = (opts.hasOwnProperty('device')) ? opts.device : 0;
    
    this.device.elevation = (opts.hasOwnProperty('elevation')) ? Number(opts.elevation) : 0;
    this.device.mode = (opts.hasOwnProperty('mode')) ? opts.mode : 'forced';
    this.device.refresh = (opts.hasOwnProperty('refresh')) ? opts.refresh : 10000;
    this.device.version = require('./package.json').version;
    this.device.parameters = [
        { name: 'pressure', type: 'float', value: NaN },
        { name: 'temperature', type: 'float', value: NaN },
        { name: 'humidity', type: 'float', value: NaN }
    ];

    this.isStale = true;
    this.timer = null;
    this.mutex = false;

    if (this.device.interface == 'spi') {
      const spi = require('spi-device');
      this.bus = spi.openSync(this.device.bus, this.device.device);
    }
    else {
      const i2c = require('i2c-bus');
      this.bus = i2c.openSync(this.device.bus);
    }

    if (opts.hasOwnProperty('spiaddr') && (opts.spiaddr >= 0) && (opts.spiaddr < 8)) {
      this._init_multispi(opts); 
    }

    this._initialize();
  }

  deviceName() {
    return this.device.name;
  }

  deviceType() {
    return this.device.type;
  }

  deviceVersion() {
    return this.device.version;
  }

  deviceNumValues() {
    return this.device.parameters.length;
  }

  typeAtIndex(idx) {
    return this.device.parameters[idx].type;
  }

  nameAtIndex(idx) {
    return this.device.parameters[idx].name;
  }

  deviceActive() {
    return this.device.active;
  }

  getDataFromDevice() {

    return new Promise( (resolve, reject) => {
      if (!this.device.active) {
        reject("Device not active");
      }

      // the device is sleeping if it is in either sleep or forced mode, so we need
      // to wake it up before a measurement is taken by selecting forced mode
      if ((this.device.mode === 'sleep') || (this.device.mode === 'forced')) {
        this.setMode('forced');
      }

      // read the entire data block at once and pry out the values as we need them
      this._readRegisters(this.register.PRESSUREDATA, 8).then( buffer=> {
        this._setTemperature(Bme280.uint20(buffer[3], buffer[4], buffer[5]));
        this._setPressure(Bme280.uint20(buffer[0], buffer[1], buffer[2]));
        this._setHumidity(Bme280.uint16(buffer[6], buffer[7]));
        resolve();
      }).catch(err => {
        reject(err);
      });
    });
  }

  valueAtIndex(idx) {
    return new Promise ((resolve, reject) => {
      if (!this._isIdxInRange(idx)) {
        reject(`Bme280 Error: index ${idx} out of range`);
      }
      // no need to fetch all parameters from the device every single time someone
      // wants to access a single value.  So check to see if the data is stale...
      else if (this.isStale) {
        this.getDataFromDevice().then(() => {
          this._resetStaleTimer();
          resolve(this.device.parameters[idx].value);
        }).catch(err => {
          reject(err);
        });
      }
      else {
        resolve(this.device.parameters[idx].value);
      }
    });
  }

  getValueByName(name) {
    return new Promise((resolve, reject) => {
      const regexParam = /pressure|temperature|humidity/;
      if (!regexParam.test(name)) {
        reject(`getValueByName error : unknown parameter '${name}'`);
      }

      var idx;

      this.device.parameters.forEach((param, index) => {
        if (param.name === name) {
          idx = index;
        }
      });

      this.valueAtIndex(idx).then(val => {
        resolve(val);
      }).catch(err => {
        reject(err);
      });
    });
  }

  setMode(newMode) {

    const regexMode = /^sleep|forced|normal$/;
    if (regexMode.test(newMode)) {
      this.device.mode = newMode;
    }
    else {
      return;
    }

    const ctrl_meas = (this.sampling.X1 << 5) | (this.sampling.X1 << 3) | this.mode[this.device.mode];

    this._writeRegister(this.register.CONTROL, ctrl_meas).then(async () => {
      // wait until measurement has been completed, 
      // otherwise we would read the values from the last measurement
      while ((await this._readRegister(this.register.STATUS)) && 0b1000) {
        await this._sleep(4);
      }
    }).catch(err => {
      this._logError(`Could not set mode ${newMode}`);
    });
  }

  reset() {
    this.isStale = true;
    clearTimeout(this.timer);
    this.timer = null;

    this.device.parameters.forEach(param => {
      param.value = NaN;
    })

    this._initialize();
  }

  _initialize() {

    this.device.active = false;

    this._loadConstants();

    this._readChipId().then( async res => {
      // reset the device using soft-reset
      // this makes sure the IIR is off, etc.
      this._writeRegister(this.register.SOFTRESET, this.constant.RESET).then( async () => {
        // As per data sheet, startup time is 2 ms, so we'll double that
        await this._sleep(4);

        await this._setCalibration(); // read trimming parameters, see DS 4.2.2
        this._setSampling();
        
        // if chip is still reading calibraion, delay
        while (await this._isReadingCalibration()) {
          await this._sleep(112);
        }

        this.device.active = true;

      }).catch(err => {
        this._logError(err);
      });
    }).catch( err => {
      let errdev = `i2c device on bus ${this.device.bus} with address ${this.device.addr}`;
      if (this.device.interface == 'spi') {
        errdev = `spi device ${this.device.bus}.${this.device.device}`;
      }
      this._logError(`Could not initialize ${errdev} : ${err}`);
    });    
  }

  _init_multispi(opts) {
    this.device.multispi = true;
    this.gpio = require('onoff').Gpio;

    // The following options are only used to activate multiple SPI devices using a
    // 3-to-8 line decoder demultiplexer similar to the 74HC138. If only a single device
    // is being controlled by this module, then these options can be ignored.

    // The spiaddr is an address from 0-7 which is used by the demultiplexer to activate
    // the corresponding output, which in turn activates the sensor's chip select.
    this.device.spiaddr = opts.spiaddr;
    
    // The spiselect is a GPIO pin which acts as a hardware mutex. It must be set high to enable
    // any one of the multiple sensors. Because of this, before a sensor can be selected, it
    // first must check to see that this GPIO is low and then set it high to lock the mutex.
    if (opts.hasOwnProperty('spiselect') && (opts.spiselect > 0)) {
      this.device.spimutex = new this.gpio(opts.spiselect, 'out');

      // The spibits are used to address a single sensor. To do this, the GPIOs which
      // are physically connected to the demultiplexer chip must be defined here.
      if ((opts.hasOwnProperty('spibit0') && (opts.spibit0 > 0)) &&
          (opts.hasOwnProperty('spibit1') && (opts.spibit1 > 0)) &&
          (opts.hasOwnProperty('spibit2') && (opts.spibit2 > 0))) {
        this.device.spibit0 = new this.gpio(opts.spibit0, 'out');
        this.device.spibit1 = new this.gpio(opts.spibit1, 'out');
        this.device.spibit2 = new this.gpio(opts.spibit2, 'out');

        const exitHandler = (evtName) => {
          process.on(evtName, _ => {
            // this is a bit dangerous, but helps to avoid a stuck mutex
            if (this.mutex) {
              this.device.spimutex.writeSync(0);
            }
            process.exit(0);
          });
        }
        exitHandler('SIGINT');
        exitHandler('SIGTERM');
        exitHandler('SIGHUP');
      }
      else {
        this._logError('Multiplex SPI failed due to incompatible gpio spibit definition');
        this.device.multispi = false;
      }
    }
    else {
      this._logError('Multiplex SPI failed due to incompatible spiselect definition');
      this.device.multispi = false;
    }
  }

  _readChipId() {
    return new Promise((resolve, reject) => {
      this._readRegister(this.register.CHIPID).then(chipId => {
        if (chipId == this.constant.CHIP_ID) {
          resolve(true);
        }
        else {
          reject(`Unexpected chip ID ${chipId.toString(16)}`);
        }
      }).catch(err => {
        reject(err);
      });
    });
  }

  _writeRegister(addr, data) {

    return new Promise( (resolve, reject) => {
      if (this.device.interface == 'spi') {
        const message = [{
          sendBuffer: Buffer.alloc(2),
          byteLength: 2
        }];
  
        addr = addr & 0x7F;
        message[0].sendBuffer[0] = addr;
        message[0].sendBuffer[1] = data;
  
        this._selectspi().then(() => {
          this.bus.transfer(message, (err, mesg) => {
            this._deselectspi();
            if (err) {
              reject(err);
            }
            else {
              resolve();
            }
          });
        }).catch(err => {
          reject(`Could not select spi: ${err}`);
        });
      }
      else {
        this.bus.writeByte(this.device.addr, addr, data, (err) => {
          if (err) {
            reject(err);
          }
          else {
            resolve();
          }
        });
      }
    });
    
  }

  _readRegister(addr) {
    return new Promise( (resolve, reject) => {
      this._readRegisters(addr, 1).then(buf => {
        resolve(buf.readUInt8(0));
      }).catch( err => {
        reject(err);
      });
    });
  }

  _readRegisters(addr, len) {
    addr = addr | 0x80;
    return new Promise( (resolve, reject) => {
      if (this.device.interface == 'spi') {
        const message = [{
          sendBuffer: Buffer.alloc(len+1),
          receiveBuffer: Buffer.alloc(len+1),
          byteLength: len+1
        }];
  
        message[0].sendBuffer[0] = addr;
  
        this._selectspi().then(() => {
          this.bus.transfer(message, (err, mesg) => {
            this._deselectspi();
            if (err) {
              reject(err);
            }
            else {
              resolve(mesg[0].receiveBuffer.slice(1));
            }
          });
        }).catch(err => {
          reject(`Could not select spi: ${err}`);
        });
        
      }
      else {
        this.bus.readI2cBlock(this.device.addr, addr, len, Buffer.alloc(len), (err, bytesRead, buffer) => {
          if (err) {
            reject(err);
          }
          else {
            resolve(buffer);
          }
        });
      }
    });
  }

  _selectspi() {
    return new Promise(resolve => {

      if (this.device.multispi) {
        if (this.device.spimutex.readSync() == 0) {
          this._activatespi();
          resolve();
        }
        else {
          var locktime = setInterval( () => {
            if (this.device.spimutex.readSync() == 0) {
              this._activatespi();
              clearInterval(locktime);
              resolve();
            }
          }, 200);
        }
      }
      else {
        resolve();
      }
    });
  }

  _deselectspi() {
    if (this.device.multispi) {
      this.device.spimutex.writeSync(0);
      this.mutex = false;
    }
  }

  _activatespi() {
    this.device.spibit0.writeSync(this.device.spiaddr & 1);
    this.device.spibit1.writeSync(this.device.spiaddr >>> 1 & 1);
    this.device.spibit2.writeSync(this.device.spiaddr >>> 2 & 1);
    this.mutex = true;
    this.device.spimutex.writeSync(1);
  }

  _setPressure(adc_P) {
    let var1 = this.t_fine / 2 - 64000;
    let var2 = var1 * var1 * this.calibration.dig_P6 / 32768;
    var2 = var2 + var1 * this.calibration.dig_P5 * 2;
    var2 = var2 / 4 + this.calibration.dig_P4 * 65536;
    var1 = (this.calibration.dig_P3 * var1 * var1 / 524288 + this.calibration.dig_P2 * var1) / 524288;
    var1 = (1 + var1 / 32768) * this.calibration.dig_P1;

    // need to avoid division by zero
    if (var1 !== 0) {
      let p = 1048576 - adc_P;
      p = ((p - var2 / 4096) * 6250) / var1;
      var1 = this.calibration.dig_P9 * p * p / 2147483648;
      var2 = p * this.calibration.dig_P8 / 32768;
      p = (p + (var1 + var2 + this.calibration.dig_P7) / 16) / 100;

      if (this.device.elevation > 0) {
          p = this._seaLevelPressure(p);
      }

      this.device.parameters[0].value = Math.round(p * 100) / 100;
    }
    else {
      this.device.parameters[0].value = NaN; // uh oh, we must be in deep space
    }
  }

  _seaLevelPressure(pressure_mb) {
    return pressure_mb * Math.pow((1 - ((0.0065 * this.device.elevation) / (this.device.parameters[1].value + 0.0065 * this.device.elevation + 273.15))), -5.257);
  }

  _setTemperature(adc_T) {
      let var1 = ((((adc_T >> 3) - (this.calibration.dig_T1 << 1))) * this.calibration.dig_T2) >> 11;
      let var2 = (((((adc_T >> 4) - this.calibration.dig_T1) * ((adc_T >> 4) - this.calibration.dig_T1)) >> 12) * this.calibration.dig_T3) >> 14;
      this.t_fine = var1 + var2;

      // Temperature is pretty simple
      this.device.parameters[1].value = Math.round(((this.t_fine * 5 + 128) >> 8) / 10) / 10;
  }

  _setHumidity(adc_H) {
      let var1 = this.t_fine - 76800;
      var1 = (adc_H - (this.calibration.dig_H4 * 64 + this.calibration.dig_H5 / 16384 * var1)) *
          (this.calibration.dig_H2 / 65536 * (1 + this.calibration.dig_H6 / 67108864 * var1 * (1 + this.calibration.dig_H3 / 67108864 * var1)));
      var1 = var1 * (1 - this.calibration.dig_H1 * var1 / 524288);

      const hum = (var1 > 100) ? 100 : (var1 < 0 ? 0 : var1);
      this.device.parameters[2].value = Math.round(hum * 10) / 10;
  }

  _resetStaleTimer() {
    this.isStale = false;
    if (this.timer == null) {
      this.timer = setTimeout(() => {
          this.isStale = true;
          clearTimeout(this.timer);
          this.timer = null;
      }, this.device.refresh);
    }
  }

  _sleep(millis) {
    return new Promise(resolve => setTimeout(resolve, millis));
  }

  _logError(err) {
    console.error(`${this.device.name} ERROR: ${err}`);
  }

  _isIdxInRange(idx) {
    if ((idx < 0) || (idx >= this.device.parameters.length)) {
      return false;
    }
    return true;
  }

  async _setCalibration() {
    let buffer = await this._readRegisters(this.register.DIG_T1, 24);
    
    let h1 = await this._readRegister(this.register.DIG_H1);
    let h2_buf = await this._readRegisters(this.register.DIG_H2, 2);
    let h2 = Bme280.int16(h2_buf[1], h2_buf[0]);
    let h3 = await this._readRegister(this.register.DIG_H3);
    let h4 = await this._readRegister(this.register.DIG_H4);
    let h5 = await this._readRegister(this.register.DIG_H5);
    let h5_1 = await this._readRegister(this.register.DIG_H5 + 1);
    let h6 = await this._readRegister(this.register.DIG_H6);

    this.calibration = {
      dig_T1: Bme280.uint16(buffer[1], buffer[0]),
      dig_T2: Bme280.int16(buffer[3], buffer[2]),
      dig_T3: Bme280.int16(buffer[5], buffer[4]),

      dig_P1: Bme280.uint16(buffer[7], buffer[6]),
      dig_P2: Bme280.int16(buffer[9], buffer[8]),
      dig_P3: Bme280.int16(buffer[11], buffer[10]),
      dig_P4: Bme280.int16(buffer[13], buffer[12]),
      dig_P5: Bme280.int16(buffer[15], buffer[14]),
      dig_P6: Bme280.int16(buffer[17], buffer[16]),
      dig_P7: Bme280.int16(buffer[19], buffer[18]),
      dig_P8: Bme280.int16(buffer[21], buffer[20]),
      dig_P9: Bme280.int16(buffer[23], buffer[22]),

      dig_H1: h1,
      dig_H2: h2,
      dig_H3: h3,
      dig_H4: (h4 << 4) | (h5 & 0xF),
      dig_H5: (h5_1 << 4) | (h5 >> 4),
      dig_H6: h6
    }
  }

  _setSampling() {

    // TODO: allow sampling and standby parameters to be user-configured

    const ctrl_hum = this.sampling.X1;
    const config = (this.standby.MS_1000 << 5) | (this.filter.X1 << 3);

    //                 pressure sampling         temperature sampling
    const ctrl_meas = (this.sampling.X1 << 5) | (this.sampling.X1 << 3) | this.mode[this.device.mode];

    // you must make sure to also set register.CONTROL after setting the
    // CONTROLHUMID register, otherwise the values won't be applied (see DS 7.4.3)

    this._writeRegister(this.register.CONTROLHUMID, ctrl_hum).then( ()=> {
      this._writeRegister(this.register.CONFIG, config).then( () => {
        this._writeRegister(this.register.CONTROL, ctrl_meas).catch(err => {
          this._logError('setSampling register.CONTROL error');
        });
      }).catch(err => {
        this._logError('setSampling register.CONFIG error');
      });
    }).catch(err => {
      this._logError('setSampling register.CONTROLHUMID error');
    });    
  }

  _isReadingCalibration() {
    return new Promise(resolve => {
      this._readRegister(this.register.STATUS).then(async status => {
        resolve((status & 1));
      });
    });
  }
  
  _loadConstants() {
    this.register = {
      DIG_T1: 0x88, //Bme280_TEMP_PRESS_CALIB_DATA_ADDR
      DIG_T2: 0x8A,
      DIG_T3: 0x8C,

      DIG_P1: 0x8E,
      DIG_P2: 0x90,
      DIG_P3: 0x92,
      DIG_P4: 0x94,
      DIG_P5: 0x96,
      DIG_P6: 0x98,
      DIG_P7: 0x9A,
      DIG_P8: 0x9C,
      DIG_P9: 0x9E,

      DIG_H1: 0xA1,
      DIG_H2: 0xE1, //Bme280_HUMIDITY_CALIB_DATA_ADDR
      DIG_H3: 0xE3,
      DIG_H4: 0xE4,
      DIG_H5: 0xE5,
      DIG_H6: 0xE7,

      CHIPID: 0xD0,
      VERSION: 0xD1,
      SOFTRESET: 0xE0,

      CAL26: 0xE1,  // R calibration stored in 0xE1-0xF0

      CONTROLHUMID: 0xF2, //Bme280_CTRL_HUM_ADDR
      STATUS: 0XF3,
      CONTROL: 0xF4, //Bme280_PWR_CTRL_ADDR  Bme280_CTRL_MEAS_ADDR
      CONFIG: 0xF5, //Bme280_CONFIG_ADDR
      PRESSUREDATA: 0xF7, //Bme280_DATA_ADDR
      TEMPDATA: 0xFA, // 0xF7 to 0xFE is burst for temp, pres, and hum
      HUMIDDATA: 0xFD
    }

    this.sampling = {
      NONE: 0b000,
      X1: 0b001,
      X2: 0b010,
      X4: 0b011,
      X8: 0b100,
      X16: 0b101
    };

    this.mode = {
      sleep: 0b00,
      forced: 0b01,
      normal: 0b11
    };

    this.filter = {
      OFF: 0b000,
      X2: 0b001,
      X4: 0b010,
      X8: 0b011,
      X16: 0b100
    };

    // inactive duration (standby time) in normal mode
    this.standby = {
      MS_0_5: 0b000, // 000 = 0.5 ms
      MS_62_5: 0b001, // 001 = 62.5 ms
      MS_125: 0b010, // 010 = 125 ms
      MS_250: 0b011, // 011 = 250 ms
      MS_500: 0b100, // 100 = 500 ms
      MS_1000: 0b101, // 101 = 1000 ms
      MS_10: 0b110, // 110 = 10 ms
      MS_20: 0b111  // 111 = 20 ms
    };

    this.constant = {
      CHIP_ID: 0x60,
      RESET: 0xB6
    }  
  }

  static int16(msb, lsb) {
    let val = Bme280.uint16(msb, lsb);
    return val > 32767 ? (val - 65536) : val;
  }

  static uint16(msb, lsb) {
    return msb << 8 | lsb;
  }

  static uint20(msb, lsb, xlsb) {
    return ((msb << 8 | lsb) << 8 | xlsb) >> 4;
  }
}