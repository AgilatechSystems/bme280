
const driver = require('../bme280');

// for i2c interface, simply remove the 'device' and 'interface' options
// and make sure the bus is the correct one. (Your elevation is prolly different too)
const options = {
    name: 'env_sensor_0',
    elevation: 1750, 
    mode: 'normal', 
    bus: 1, 
    device: 0, 
    interface: 'spi'
};

const hardware = new driver(options);

const startup = function() {
    // give er three tries
    var tries = 0;

    // takes just a bit of time to startup
    var waiting = setTimeout(function wait() {
        if (hardware.deviceActive()) {
            clearTimeout(waiting);
            test();
        }
        else {
            tries++;
            if (tries > 3) {
                clearTimeout(waiting);
                console.log("Device did not activate");
                process.exit(1);
            }
            else {
                waiting = setTimeout(wait, 100);
            }
        }
    }, 100);
}

const test = function() { 

    console.log("\nStarting test ...");

    var output = {
        data: {
            names: [],
            types: []
        }
    }

    output['name'] = hardware.deviceName();
    output['type'] = hardware.deviceType();
    output['version'] = hardware.deviceVersion();
    output['active'] = hardware.deviceActive();
        
    for (var i = 0; i < hardware.deviceNumValues(); i++) {
        output.data.names.push(hardware.nameAtIndex(i));
        output.data.types.push(hardware.typeAtIndex(i));
    }

    hardware.getDataFromDevice().then(() => {
        console.log("\nReceived callback from getDataFromDevice. device object: ");
        console.log(hardware.device);
        console.log("\n");        
    }).catch(err => {
	    console.log(err);
    });

    console.log("\nDevice and parameter info:");
    console.log(JSON.stringify(output, null, 2));

    for (var i = 0; i < hardware.deviceNumValues(); i++) {
        hardware.valueAtIndex(i).then( val => {
            console.log(`Asynchronous call return: ${val}`);
        }).catch(err => {
            console.log(`Error : ${err}`);
        });
    }

    setTimeout(() => {
        hardware.reset();
        console.log('\nPerformed a reset, now testing again. (ctrl-c to quit this merry-go-round)');
        startup();  
    }, 4000);
}

startup();
