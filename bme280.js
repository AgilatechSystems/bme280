const i2c = require('i2c-bus');

module.exports = class Bme280 {
    constructor(options) {
        let opts = options || {};

        this.device = {};
        this.device.name = (opts.hasOwnProperty('name')) ? opts.name : 'Bme280';
        this.device.type = (opts.hasOwnProperty('type')) ? opts.type : 'sensor';
        this.device.active = false;
        this.device.bus = (opts.hasOwnProperty('bus')) ? opts.bus : 1;
        this.device.addr = (opts.hasOwnProperty('addr')) ? opts.addr : 0x76;
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

        this.bus = i2c.openSync(this.device.bus);

        this.initialize((err) => {
            if (!err) {
                this.device.active = true;
            }
            else {
                this.logError(err);
            }
        });
    }

    async initialize(cb) {

        this.loadConstants();

        var tryCount = 0;
        while (!this.readChipId()) {
            await this.sleep(50);
            tryCount++;
            this.logError(`No valid chip ID response on register ${this.register.CHIPID}`);
            if (tryCount > 3) {
                cb(`Could not initialize device on bus ${this.device.bus} at address ${this.device.addr}`);
                return;
            }
        }

        // reset the device using soft-reset
        // this makes sure the IIR is off, etc.
        this.bus.writeByteSync(this.device.addr, this.register.SOFTRESET, this.constant.RESET);

        // As per data sheet, startup time is 2 ms, so we'll double that
        await this.sleep(4);

        this.setCalibration(); // read trimming parameters, see DS 4.2.2
        this.setSampling();

        // if chip is still reading calibraion, delay
        while (this.isReadingCalibration()) {
            await this.sleep(56);
        }

        cb();
    }

    readChipId() {
        try {
            const chipId = this.bus.readByteSync(this.device.addr, this.register.CHIPID);
            if (chipId !== this.constant.CHIP_ID) {
                this.logError(`Unexpected chip ID ${chipID.toString(16)}`);
                return false;
            }

            return true;
        }
        catch (err) {
            return false;
        }
    }

    reset() {
        this.device.active = false;
        this.isStale = true;
        clearTimeout(this.timer);
        this.timer = null;

        this.device.parameters.forEach(param => {
            param.value = NaN;
        })

        this.initialize((err) => {
            if (!err) {
                this.device.active = true;
            }
            else {
                this.logError(err);
            }
        });
    }

    async setMode(newMode) {

        const regexMode = /^sleep|forced|normal$/;
        if (regexMode.test(newMode)) {
            this.device.mode = newMode;
        }
        else {
            return;
        }

        // supress the UnhandledPromise warnings
        try {
            const ctrl_meas = (this.sampling.X4 << 5) | (this.sampling.X4 << 3) | this.mode[this.device.mode];
            this.bus.writeByteSync(this.device.addr, this.register.CONTROL, ctrl_meas);

            // wait until measurement has been completed, 
            // otherwise we would read the values from the last measurement
            while (this.bus.readByteSync(this.device.addr, this.register.STATUS) & 0b1000) {
                await this.sleep(1);
            }
        }
        catch (e) {
            // not going to do anything about this
            this.logError('Did not setMode successfully');
        }
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

    valueAtIndex(idx, callback) {
        if (!this.isIdxInRange(idx)) {
            callback(`Bme280 Error: index ${idx} out of range`, null);
        }

        // no need to fetch all parameters from the device every single time someone
        // wants to access a single value.  So check to see if the data is stale...
        else if (this.isStale) {
            this.getDataFromDevice((err) => {
                if (!err) {
                    this.resetStaleTimer();
                    callback(null, this.device.parameters[idx].value);
                }
                else {
                    callback(err, NaN);
                }
            });
        }
        else {
            callback(null, this.device.parameters[idx].value);
        }
    }

    valueAtIndexSync(idx) {
        if (!this.isIdxInRange(idx)) {
            this.logError(`Bme280 Error: index ${idx} out of range`);
            return NaN;
        }
        else if (this.isStale) {
            this.resetStaleTimer();
            this.getDataFromDeviceSync();
        }
        return this.device.parameters[idx].value;
    }

    getDataFromDevice(callback) {
        if (!this.device.active) {
            callback("Device not active");
            return;
        }

        // the device is sleeping if it is in either sleep or forced mode, so we need
        // to wake it up before a measurement is taken by selecting forced mode
        if ((this.device.mode === 'sleep') || (this.device.mode === 'forced')) {
            this.setMode('forced');
        }

        // read the entire data block at once and pry out the values as we need them
        this.bus.readI2cBlock(this.device.addr, this.register.PRESSUREDATA, 8, new Buffer(8), (err, bytesRead, buffer) => {

            if (err) {
                callback(err);
            }
            else {
                this.setTemperature(Bme280.uint20(buffer[3], buffer[4], buffer[5]));
                this.setPressure(Bme280.uint20(buffer[0], buffer[1], buffer[2]));
                this.setHumidity(Bme280.uint16(buffer[6], buffer[7]));
                callback();
            }
        });
    }

    getDataFromDeviceSync() {
        if (!this.device.active) {
            this.logError("Device not active");
            return false;
        }

        if ((this.device.mode === 'sleep') || (this.device.mode === 'forced')) {
            this.setMode('forced');
        }

        var buffer = new Buffer(8);
        this.bus.readI2cBlockSync(this.device.addr, this.register.PRESSUREDATA, 8, buffer);
        this.setTemperature(Bme280.uint20(buffer[3], buffer[4], buffer[5]));
        this.setPressure(Bme280.uint20(buffer[0], buffer[1], buffer[2]));
        this.setHumidity(Bme280.uint16(buffer[6], buffer[7]));
        return true;
    }

    setPressure(adc_P) {
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
                p = this.seaLevelPressure(p);
            }

            this.device.parameters[0].value = Math.round(p * 100) / 100;
        }
        else {
            this.device.parameters[0].value = NaN; // uh oh, we must be in deep space
        }
    }

    seaLevelPressure(pressure_mb) {
        return pressure_mb * Math.pow((1 - ((0.0065 * this.device.elevation) / (this.device.parameters[1].value + 0.0065 * this.device.elevation + 273.15))), -5.257);
    }

    setTemperature(adc_T) {
        let var1 = ((((adc_T >> 3) - (this.calibration.dig_T1 << 1))) * this.calibration.dig_T2) >> 11;
        let var2 = (((((adc_T >> 4) - this.calibration.dig_T1) * ((adc_T >> 4) - this.calibration.dig_T1)) >> 12) * this.calibration.dig_T3) >> 14;
        this.t_fine = var1 + var2;

        // Temperature is pretty simple
        this.device.parameters[1].value = Math.round(((this.t_fine * 5 + 128) >> 8) / 10) / 10;
    }

    setHumidity(adc_H) {
        let var1 = this.t_fine - 76800;
        var1 = (adc_H - (this.calibration.dig_H4 * 64 + this.calibration.dig_H5 / 16384 * var1)) *
            (this.calibration.dig_H2 / 65536 * (1 + this.calibration.dig_H6 / 67108864 * var1 * (1 + this.calibration.dig_H3 / 67108864 * var1)));
        var1 = var1 * (1 - this.calibration.dig_H1 * var1 / 524288);

        const hum = (var1 > 100) ? 100 : (var1 < 0 ? 0 : var1);
        this.device.parameters[2].value = Math.round(hum * 10) / 10;
    }

    resetStaleTimer() {
        this.isStale = false;
        if (this.timer == null) {
            this.timer = setTimeout(() => {
                this.isStale = true;
                clearTimeout(this.timer);
                this.timer = null;
            }, this.device.refresh);
        }
    }

    sleep(millis) {
        return new Promise(resolve => setTimeout(resolve, millis));
    }

    logError(err) {
        console.error(`${this.device.name} ERROR: ${err}`);
    }

    isIdxInRange(idx) {
        if ((idx < 0) || (idx >= this.device.parameters.length)) {
            return false;
        }
        return true;
    }

    setCalibration() {
        let buffer = new Buffer(24);
        this.bus.readI2cBlockSync(this.device.addr, this.register.DIG_T1, 24, buffer);

        let h1 = this.bus.readByteSync(this.device.addr, this.register.DIG_H1);
        let h2 = this.bus.readWordSync(this.device.addr, this.register.DIG_H2);
        let h3 = this.bus.readByteSync(this.device.addr, this.register.DIG_H3);
        let h4 = this.bus.readByteSync(this.device.addr, this.register.DIG_H4);
        let h5 = this.bus.readByteSync(this.device.addr, this.register.DIG_H5);
        let h5_1 = this.bus.readByteSync(this.device.addr, this.register.DIG_H5 + 1);
        let h6 = this.bus.readByteSync(this.device.addr, this.register.DIG_H6);

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

    setSampling() {

        // TODO: allow sampling and standby parameters to be user-configured

        const ctrl_hum = this.sampling.X4;
        const config = (this.standby.MS_250 << 5) | (this.filter.X4 << 3);

        //                 pressure sampling         temperature sampling
        const ctrl_meas = (this.sampling.X4 << 5) | (this.sampling.X4 << 3) | this.mode[this.device.mode];

        // you must make sure to also set REGISTER_CONTROL after setting the
        // CONTROLHUMID register, otherwise the values won't be applied (see DS 7.4.3)

        this.bus.writeByteSync(this.device.addr, this.register.CONTROLHUMID, ctrl_hum);
        this.bus.writeByteSync(this.device.addr, this.register.CONFIG, config);
        this.bus.writeByteSync(this.device.addr, this.register.CONTROL, ctrl_meas);
    }

    isReadingCalibration() {
        return ((this.bus.readByteSync(this.device.addr, this.register.STATUS) & 1) != 0) ? true : false;
    }

    loadConstants() {
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