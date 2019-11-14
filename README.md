## Driver for BME280 sensor

### This single driver can use either the I2C or the SPI bus to communicate with the sensor.

##### This driver should work on any Linux platform, and has been thoroughly tested on BBB and RPi

### Install
```
npm install @agilatech/bme280
```

### Usage
##### Example 1 - Create an instance without options to accept all defaults
```
const Bme280 = require('@agilatech/bme280');
const bme280 = new Bme280();
// creates an driver with all default options, including i2c-1 bus at 0x76 address, 
// and forced mode at sea level operation

if (bme280.isActive()) {
    bme280.getDataFromDevice().then(() => {
        const pressure    = bme280.device.parameters[0].value;
        const tempurature = bme280.device.parameters[1].value;
        const humidity    = bme280.device.parameters[2].value;
    }).catch(err => {
        console.error(err);
    });
}


```
##### Example 2 - Pass an `{options}` object to specify characteristics and behavior
```
const Bme280 = require('@agilatech/bme280');
const options = {
    interface: 'spi',
    bus: 2,
    elevation: 1750
}
const bme280 = new Bme280(options);

bme280.getValueByName('temperature').then(val => {
    console.log(`Current temperature is ${val}`);
}).catch(err => {
    console.error(err);
});
```


**Options** `Bme280({[options]})`

The constructor can be supplied with an options object to specify certain driver characteristics. The options object allows the following parameters:

* interface : The interface to use, either i2c or spi. Defaults to i2c.
* bus : The number of either the I2C bus or the SPI major bus number. Defaults to 1.
* addr : The I2C device address on the bus. Defaults to 0x76.
* device : The SPI device number. Defaults to 0.
* name : The name given to this particular driver instance. Defaults to 'Bme280'.
* type : The type given to this particular driver instance. Defaults to 'sensor'.
* elevation : The elevation in meters of the sensor. Used to adjust absolute pressure relative to sea-level. Defaults to 0 (sea level).
* mode : The device can be placed in one of three modes, sleep, forced, or normal. 'normal' takes a reading periodically, while 'forced' requires a poll event to take a measurement.  Defaults to 'forced', as that is the most efficient and typical for weather measurement.
* refresh: A time period in milliseconds during which a new reading will not be requested from the hardware device. Defaults to 10000 (10 seconds).


Most options are fairly self-explanitory, but these require further explanation:

__elevation__ : Atmospheric pressure is directly related to elevation (altitude), so this software compensates for elevation and reports the result as if the sensor were at sea level. This removes the effect of station elevation on the reported pressure. For this reason it is very important to specify the station elevation (metres) in the options argument.  Failure to specify elevation will default to 0, thus returning a wildly inaccurate pressure value for elevations above sea level.

__mode__ : 'sleep' allows the hardware to consume almost no power, but requires the device to be placed into 'forced' or 'normal' mode before a measurement can be taken. In 'normal' mode, the device takes measurement and then goes into standby for 250ms before another measument is taken. In forced mode, the device takes a messurment, and then goes into sleep mode. The device must be put back into forced mode before another measusment can be taken. In practice, this driver automatically handles sleep and forced modes, and so this parameter can safely be ignored unless power usage needs to be strictly controlled.

__refresh__ : Since all three measurements are taken at the same time, it does not make much sense to request a humidity value, and then 0.5 seconds later request a temperature value. For this reason, the refresh option allows for a time period for which the hardware device itself will not be polled for new values. This makes sense particularly in a weather station application, where the pressure, temperature, and humidty do not channge very often.

### Get basice device info
```
const name = bme280.deviceName();  // returns string with name of device
const type = bme280.deviceType();  // returns string with type of device
const version = bme280.deviceVersion(); // returns this driver software version
const active = bme280.deviceActive(); // true if initialized and acgtive, false if inactive
const numVals =  bme280.deviceNumValues(); // returns the number of paramters sensed
```

### Take measurement and load results in `device` object
```
bme280.getDataFromDevice()
```
Returns a promise. Asyncronously polls the device, stores the results in the `device` parameters object, and then resolves or rejects. When the promise resolves, the `device` object may be examined for new values. Promise rejects if an error is encountered, so your code should catch a rejection.


### Access information directly through the `device` object
The Bme280.device object contains basic information about the device itself, and also the 'parameters' array. The 'parameters' array contains the name, data type, and current value of each parameter for the device.

```
console.log(bme280.device.parameters[0]);
// expected output: { name: 'pressure', type: 'float', value: <current pressure in hPa> }

console.log(bme280.device.parameters[1]);
// expected output: { name: 'temperature', type: 'float', value: <current temperature in ˚C> }
    
console.log(bme280.device.parameters[2]);
// expected output: { name: 'humidity', type: 'float', value: <current humidity in %RH> }
```


### Get individual parameter values by index
```
bme280.valueAtIndex(index).then(value =>{
    console.log(value);
}).catch(err => {
    console.error(err);
});
```


### Get individual parameter values by parameter name
```
bme280.getValueByName('humidity').then(value => {
    console.log(`Current humidity is ${value}`);
}).catch(err => {
    console.error(err);
});
```
Please note the string given as the `<parameter name>` **must** be one of _pressure_, _humidity_, or _temperature_.


### Setting the device mode
```
bme280.setMode(mode)
```
Valid mode strings are _sleep_, _forced_, or _normal_.


### Startup time
The constructor initializes the hardware device, but this takes some time. Usually less than 50ms is required for startup, and during this time other operations will fail.  Therefore, it is a best practice to check `bme280.deviceActive()` returns true before initiating any measurement.


### Reset
The device is reset on startup, and it is not normally necessary to reset the device after this time.  However, a function has been provided: `bme280.reset()`. Will reset the device, and initialize. Normal startup time delay applies.


### Simultaneous multiple SPI devices are supported
This driver contains support for multiple SPI devices on the same bus at the same time. For this to work, only one sensor is allowed to have an active chip select signal at a time, which is accomplished by using exclusive selection hardware in the form of a demultiplexer chip.  A 3-to-8 line decoder demultiplexer such as the 74HC138 takes three inputs and demultiplexes them such that only one of 8 outputs is selected low. In this manner, it can be used to chip select any one of up to 8 sensors. In addition, "enable" inputs allow all outputs to be enabled or disabled all at once. These enable inputs are used to provide a harware mutex as well as allow for the use of the bus's own chip select signal.

In order to use this feature, the proper hardware signal lines must be constructed along with a demultiplexer chip. It is beyond the scope of this documentation to fully explain this, but 3 GIPO outputs are used to provide the spibit0..3 signals and a further GPIO is used to supply the spiselect enable signal. The spi bus CS is used as the other enable signal. The sensor's CS input is connected to one of the demultiplexer outputs, shown here as CS0..7. Finally, the MOSI, MISO, and CLK lines for all devices are connected in parallel.

![Multispi Logic Diagram](https://agilatech.com/images/docs/multispi_logic.png)

The software driver then must just define the GPIOs used, and the address.  These are given as options alongside the other options passed to the constructor:

* spiaddr : The "address" from 0..7 of the sensor device. Defaults to 0.
* spiselect: The GPIO number of the enable/select input.
* spibit0: The GPIO number of the SPI bit 0. This can be thought of as bit 0 of the spiaddr.
* spibit1: The GPIO number of the SPI bit 1. This can be thought of as bit 1 of the spiaddr.
* spibit2: The GPIO number of the SPI bit 2. This can be thought of as bit 2 of the spiaddr.

The driver takes care of handling the mutex such that only one SPI sensor is communicating at a time, but does so in a transparent manner. Once the hardware connections are made and the correct definitions are provided via the options, the operation is seamless and transparent to upstream modules. Additionally, these options have no effect on I2C or single-SPI operations.


### Operation Notes
This driver is specific to the BME280 pressure, temperature, and humidity sensor manufactured by Bosch. This **is NOT** for the similar BMP280 and will not work with that.

It will output pressure in hPa (hectopascal, equal to millibar), temperature in °C, and humidity in percentage relative humidity %RH. The measured pressure range is from 300hPa to 1100hPa, while the measured temperature range is from -40°C to +85°C.

Atmospheric pressure is directly related to elevation (altitude), so this software compensates for elevation and reports the result as if the sensor were at sea level. This removes the effect of station elevation on the reported pressure. For this reason it is very important to specify the station elevation (metres) in the addon constructor.  Failure to specify elevation will default to 0, thus returning wildly inaccurate pressure value for elevations above sea level.

Certain device operational parameters have been hardcoded into the driver. These were chosen to be most useful for a weather station application. They include x4 sampling, x4 filtering, and a normal mode standby of 250ms.

### Improvements Roadmap
This driver is missing several features which could improve its functionality.  These are planned for future releases:
1. Ability to select sampling, filtering, and standby time in the options
2. Altimeter function

### Dependencies
* i2c-bus is used to communicate with the device on the I2C bus
* spi-device is used to communication with the device on the SPI bus
* onoff is used to control GPIOs if multiple SPI deivces are used at the same time

### Further technical information
Dr. Derek Molloy is an Associate Professor in the School of Electronic Engineering, Faculty of Engineering & Computing at Dublin City University. He has written several excellent books, created many videos, and maintains an excellent Web site covering the subjects of embedded systems and single board computers. Please refer to his materials for further education about the use of a decoder demultiplexer as used here for multiple SPI devices. To learn more, visit his site at [derekmolloy.ie](http://derekmolloy.ie), and seriously consider [buying his book](http://www.amazon.com/Exploring-BeagleBone-Techniques-Building-Embedded/dp/1118935128?&linkCode=wey&tag=der0d8-20) and [Exploring Beaglebone](http://exploringbeaglebone.com).


### Copyright
Copyright © 2017-2019 Agilatech. All Rights Reserved.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
