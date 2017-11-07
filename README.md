##Node addon for hardware BME280 sensor

#####This addon should work on any Linux platform, and has been thoroughly tested on BBB

###Install

```
npm install @agilatech/bme280
```
OR
```
git clone https://github.com/Agilatech/bme280.git
node-gyp configure build
```

###Usage
#####Load the module and create an instance
```
const addon = require('@agilatech/bme280');

// create an instance on the /dev/i2c-1 I2C device file
const bme280 = new addon.Bme280('/dev/i2c-1');
```
Unless you're at sea level, specify elevation in a second argument
```
// The second optional constructor argument is station elevation.
const bme280 = new addon.Bme280('/dev/i2c-1', 1250);
```
Device address can be specified in the third argument
```
// Usually the device is found at 0x76, so that is the default.
// You can change it if you think you should.
const bme280 = new addon.Bme280('/dev/i2c-1', 1250, 0x77);
```
#####Get basic device info
```
const name = bme280.deviceName();  // returns string with name of device
const type = bme280.deviceType();  // returns string with type of device
const version = bme280.deviceVersion(); // returns this software version
const active = bme280.deviceActive(); // true if active, false if inactive
const numVals =  bme280.deviceNumValues(); // returns the number of paramters sensed
```
####Get parameter info and values
Sensed parameter values are at separate indicies.  The reasoning here is to support a generic sensor platform.
```
// pressure is at index 0
const paramName0 = bme280.nameAtIndex(0);
const paramType0 = bme280.typeAtIndex(0);
const paramVal0  = bme280.valueAtIndexSync(0);
```
```
// temperature is at index 1
const paramName1 = bme280.nameAtIndex(1);
const paramType1 = bme280.typeAtIndex(1);
const paramVal1  = bme280.valueAtIndexSync(1);
```
```
// humidity is at index 2
const paramName2 = bme280.nameAtIndex(2);
const paramType2 = bme280.typeAtIndex(2);
const paramVal2  = bme280.valueAtIndexSync(2);
```
If the device is not active, or if any paramter is disabled, the return value will be "none".


####Asynchronous value collection is also available for all indicies.
```
bme280.valueAtIndex(0, function(err, val) {
    if (err) {
        console.log(err);
    }
    else {
        console.log(`Asynchronous call return: ${val}`);
    }
});
```

###Operation Notes
This driver is specific to the BME280 pressure, temperature, and humidity sensor manufactured by Bosch. This **is NOT**
for the similar BMP280 and will not work with that.

It will output pressure in hPa (hectopascal, equal to millibar), temperature in °C, and humidity in percentage relative humidity %RH.
The measured pressure range is from 300hPa to 1100hPa, while the measured temperature range is from -40°C to +85°C.

Atmospheric pressure is directly related to elevation (altitude), so this software compensates for elevation and
reports the result as if the sensor were at sea level. This removes the effect of station elevation on the reported
pressure. For this reason it is very important to specify the station elevation in the addon constructor.  Failure
to specify elevation will default to 0, thus returning "none" or a wildly inaccurate pressure value for elevations
above sea level.

It is expected that this sensor will be used on the surface of the earth, subjected to the normal variations of
pressure caused by weather and air movements.  As such, any pressure results outside the extreme record variations
encounted on the planet will be discarded as anomalies (1090 mbar < p < 850 mbar).  An anomalous reading is returned
as "none".  Note that failure to supply a valid elevation may result in an anomalous reading, thereby returning
"none" even when the sensor and driver are working properly.

### Improvements Roadmap
This driver is missing several features which could improve its functionality.  These are planned for future releases:
1. Allow SPI interface, since the hardware supports both I2C and SPI
2. Support operational modes "Sleep" and "Forced Read" (on demand read, rather than cycled read/sleep)
3. Ability to select parameter fluctuation filtering coefficients
4. Altimeter function

###Dependencies
* node-gyp is used to configure and build the driver


###Copyright
Copyright © 2017 Agilatech. All Rights Reserved.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

