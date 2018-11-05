
const driver = require('../bme280');

var hardware = new driver({elevation: 1750, mode: 'normal'});

const startup = function() {
    // takes just a bit of time to startup
    var waiting = setTimeout(function wait() {
        if (hardware.deviceActive()) {
            clearTimeout(waiting);
            test();
        }
        else {
            waiting = setTimeout(wait, 100);
        }
    }, 100);
}

const test = function() { 

    console.log("\nStarting test ...");

    hardware.getDataFromDevice((err) => {
        if (!err) {
            console.log("\nReceived callback from getDataFromDevice. device object:");
            console.log(hardware.device);
        }
    });

    var output = {
        data: {
            names: [],
            types: [],
            values: []
        }
    }

    output['name'] = hardware.deviceName();
    output['type'] = hardware.deviceType();
    output['version'] = hardware.deviceVersion();
    output['active'] = hardware.deviceActive();
        
    for (var i = 0; i < hardware.deviceNumValues(); i++) {
        output.data.names.push(hardware.nameAtIndex(i));
        output.data.types.push(hardware.typeAtIndex(i));
        output.data.values.push(hardware.valueAtIndexSync(i));
    }

    console.log("\nData retrieval via valueAtIndexSync method:");
    console.log(JSON.stringify(output, null, 2));

    console.log("\nGet each value asynchronously:");
    for (var i = 0; i < hardware.deviceNumValues(); i++) {
        hardware.valueAtIndex(i, function(err, val) {
            console.log(`Asynchronous call return ${i}: ${val}`);
        });
    }

    setTimeout(() => {
        hardware.reset();
        console.log('\nPerformed a reset, now testing again. (ctrl-c to quit this merry-go-round)');
        startup();  
    }, 4000);
}

startup();
