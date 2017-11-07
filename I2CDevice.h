/**
 * \file I2CDevice.h
 *
 *  Created by Scott Erholm on 6/14/16.
 *  Copyright (c) 2016 Agilatech. All rights reserved.
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 */

#ifndef __I2CDevice__
#define __I2CDevice__

#include <iostream>
#include <sstream>
#include <string>
#include <fcntl.h>
#include <iomanip>
#include <stdio.h>
#include <unistd.h>
#include <sys/ioctl.h>
#include <linux/i2c-dev.h>

// linux/i2c-dev.h provided by i2c-tools contains the symbols defined in linux/i2c.h
// This is not the norm, but some distros like OpenSuSe do it that way.
// For everyone else, we will include linux/i2c.h if a well-known symbol is not defined.
#ifndef I2C_FUNC_I2C
#include <linux/i2c.h>
#endif

#define HEX(x) std::setw(2) << std::setfill('0') << std::hex << (int)(x)

namespace i2cbus {
    
    /**
     * @class I2CDevice
     * @brief Generic I2C Device class that can be used to connect to any type of I2C device and read or write to its registers
     */
    class I2CDevice {
        
    public:
        I2CDevice();
        I2CDevice(std::string devfile, uint32_t addr);
        ~I2CDevice();
        
        void setDevfile(std::string devfile);
        void setAddr(uint32_t addr);
        int open();
        int write(unsigned char value);
        unsigned char readRegister(uint32_t registerAddress);
        unsigned char* readRegisters(uint32_t number, uint32_t fromAddress=0);
        int writeRegister(uint32_t registerAddress, unsigned char value);
        void debugDumpRegisters(uint32_t number = 0xff);
        void close();
        
    protected:
        std::string devfile = "";
        uint32_t addr = 0;
        int file;
    };
    
} /* namespace i2cbus */

#endif /* __I2CDevice__ */
