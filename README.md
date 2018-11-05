## Driver for BME280 sensor

##### This driver should work on any Linux platform, and has been thoroughly tested on BBB and RPi

### Install
```
npm install @agilatech/bme280
```

### Usage
##### Load the module and create an instance
```
const Bme280 = require('@agilatech/bme280');
const bme280 = new Bme280();
// creates an driver with all default options, including i2c-1 bus at 0x76 address, 
// and forced mode at sea level operation

if (bme280.isActive()) {
    bme280.getDataFromDevice((err) => {
        if (!err) {
            const pressure    = bme280.device.parameters[0].value;
            const tempurature = bme280.device.parameters[1].value;
            const humidity    = bme280.device.parameters[2].value;
        }
    });
}
```

**Options**
```
Bme280([options])
```
The constructor can be supplied with options to specify certain driver characteristics. The options object allows the following parameters:
* bus : The number of the I2C bus. The number 1 indicates '/dev/i2c-1'. Defaults to 1.
* addr : The device address on the bus. Defaults to 0x76
* name : The name given to this particular driver instance. Defaults to 'Bme280'.
* type : The type given to this particular driver instance. Defaults to 'sensor'.
* elevation : The elevation in meters of the sensor. Used to adjust absolute pressure relative to sea-level. Defaults to 0 (sea level).
* mode : The device can be placed in one of three modes, sleep, forced, or normal. 'normal' takes a reading periodically, while 'forced' requires a poll event to take a measurement.  Defaults to 'forced', as that is the most efficient and typical for weather measurement.
* refresh: A time period in milliseconds during which a new reading will not be requested from the hardware device. Defaults to 10000 (10 seconds).


Most options are fairly self-explanitory, but these require further explanation:

##### elevation
Atmospheric pressure is directly related to elevation (altitude), so this software compensates for elevation and reports the result as if the sensor were at sea level. This removes the effect of station elevation on the reported pressure. For this reason it is very important to specify the station elevation (metres) in the options argument.  Failure to specify elevation will default to 0, thus returning a wildly inaccurate pressure value for elevations above sea level.

##### mode
'sleep' allows the hardware to consume almost no power, but requires the device to be placed into 'forced' or 'normal' mode before a measurement can be taken. In 'normal' mode, the device takes measurement and then goes into standby for 250ms before another measument is taken. In forced mode, the device takes a messurment, and then goes into sleep mode. The device must be put back into forced mode before another measusment can be taken. In practice, this driver automatically handles sleep and forced modes, and so this parameter can safely be ignored unless power usage needs to be strictly controlled.

##### refresh
Since all three measurements are taken at the same time, it does not make much sense to request a humidity value, and then 0.5 seconds later request a temperature value. For this reason, the refresh option allows for a time period for which the hardware device itself will not be polled for new values. This makes sense particularly in a weather station application, where the pressure, temperature, and humidty do not channge very often.

### Get basice device info
```
const name = bme280.deviceName();  // returns string with name of device
const type = bme280.deviceType();  // returns string with type of device
const version = bme280.deviceVersion(); // returns this driver software version
const active = bme280.deviceActive(); // true if initialized and acgtive, false if inactive
const numVals =  bme280.deviceNumValues(); // returns the number of paramters sensed
```

### Take measurement and load results in device object
```
Bme280.getDataFromDevice(callback)
```
Asyncronously polls the device, stores the results in the device parameters object, and then calls the optional callback. The given callback function takes an error paramter through which to report errors.  Upon completion, the device object may be examined for new values.

```
Bme280.getDataFromDeviceSync()
```
Synchronously polls the device, stores the results in the device parameters object, returning true on success and false on failure.

#### device object
The Bme280.device object contains basic information about the device itself, and also the 'parameters' array. The 'parameters' array contains the name, data type, and current value of each parameter for the device.
```
Bme280.device.parameters[0] = {
    name: 'pressure',
    type: 'float',
    value: <current pressure in hPa>
    }

Bme280.device.parameters[1] = {
    name: 'temperature',
    type: 'float',
    value: <current temperature in ˚C>
    }
    
Bme280.device.parameters[2] = {
    name: 'humidity',
    type: 'float',
    value: <current humidity in %RH>
    }
```


### Get individual parameter values by index
Asynchronously:
```
bme280.valueAtIndex(index, (err, value) => {
    if (!err) {
        val = value;
    }
});
```
Synchronously:
```
val = bme280.getValueAtIndexSync(index);
// returns NaN if upon error
```

### Setting the device mode
```
bme280.setMode(mode)
```
Valid mode strings are _sleep_, _forced_, or _normal_.


### Startup time
The constructor initializes the hardware device, but this takes some time. Usually less than 50ms is required for startup, and during this time other operations will fail.  Therefore, it is a best practice to check 'deviceActive()' returns true before initiating any measurement.


### Reset
The device is reset on startup, and it is not normally necessary to reset the device after this time.  However, a function has been provided:
```
bme280.reset()
```
Will reset the device, and initialize. Normal startup time delay applies.


### Operation Notes
This driver is specific to the BME280 pressure, temperature, and humidity sensor manufactured by Bosch. This **is NOT** for the similar BMP280 and will not work with that.

It will output pressure in hPa (hectopascal, equal to millibar), temperature in °C, and humidity in percentage relative humidity %RH. The measured pressure range is from 300hPa to 1100hPa, while the measured temperature range is from -40°C to +85°C.

Atmospheric pressure is directly related to elevation (altitude), so this software compensates for elevation and reports the result as if the sensor were at sea level. This removes the effect of station elevation on the reported pressure. For this reason it is very important to specify the station elevation (metres) in the addon constructor.  Failure to specify elevation will default to 0, thus returning wildly inaccurate pressure value for elevations above sea level.

Certain device operational parameters have been hardcoded into the driver. These were chosen to be most useful for a weather station application. They include x4 sampling, x4 filtering, and a normal mode standby of 250ms.

### Improvements Roadmap
This driver is missing several features which could improve its functionality.  These are planned for future releases:
1. Allow SPI interface, since the hardware supports both I2C and SPI
2. Ability to select sampling, filtering, and standby time in the options
4. Altimeter function

### Dependencies
* i2c-bus is used to communicate with the device on the i2c bus


### Copyright
Copyright © 2017-2018 Agilatech. All Rights Reserved.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
