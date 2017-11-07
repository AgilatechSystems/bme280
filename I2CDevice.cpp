
/**
 * \file I2CDevice.cpp
 *
 *  Created by Scott Erholm on 6/14/16.
 *  Copyright (c) 2016 Agilatech. All rights reserved.
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 */

#include"I2CDevice.h"

namespace i2cbus {
    
    /**
     * Default constructor
     */
    I2CDevice::I2CDevice() {
        this->file = -1;
    }
    
    /**
     * Constructor for the I2CDevice class. It requires the bus number and addr number. The constructor
     * opens a file handle to the I2C device, which is destroyed when the destructor is called
     * @param devfile The bus number. Usually 0 or 1 on the BBB
     * @param addr The addr ID on the bus.
     */
    I2CDevice::I2CDevice(std::string devfile, uint32_t addr) {
        this->devfile = devfile;
        this->addr = addr;
        this->file = -1;
        this->open();
    }
    
    /**
     * Closes the file on destruction, provided that it has not already been closed.
     */
    I2CDevice::~I2CDevice() {
        if(file!=-1) this->close();
    }
    
    /**
     * Provides a mechanism for setting the dev file, in case the object was constructed without one
     * @param devfile The /dev file. Usually something like /dev/i2c-1
     */
    void I2CDevice::setDevfile(std::string devfile) {
        this->devfile = devfile;
    }
    
    /**
     * Provides a mechanism for setting the address, in case the object was constructed without one
     * @param addr The /dev file. Usually something like 0x42
     */
    void I2CDevice::setAddr(uint32_t addr) {
        this->addr = addr;
    }

    /**
     * Open a connection to an I2C device
     * @return 1 on failure to open to the bus or device, 0 on success.
     */
    int I2CDevice::open() {
        
        if ((this->addr == 0) || (this->devfile == "")) {
            std::cerr << "I2CDevice: Insufficient information to open device. Missing dev file or address" << std::endl;
            return 1;
        }
        
        if((this->file=::open(this->devfile.c_str(), O_RDWR)) < 0){
            std::cerr << "I2CDevice: Failed to open the bus" << std::endl;
            return 1;
        }
        
        if(ioctl(this->file, I2C_SLAVE, this->addr) < 0){
            std::cerr << "I2CDevice: Failed to connect to the device" << std::endl;
            return 1;
        }
        
        return 0;
        
    }
    
    /**
     * Write a single byte value to a single register.
     * @param registerAddress The register address
     * @param value The value to be written to the register
     * @return 1 on failure to write, 0 on success.
     */
    int I2CDevice::writeRegister(uint32_t registerAddress, unsigned char value) {
        unsigned char buffer[2];
        buffer[0] = registerAddress;
        buffer[1] = value;
        if(::write(this->file, buffer, 2)!=2){
            std::cerr << "I2CDevice: Failed write to the device register" << std::endl;
            return 1;
        }
        return 0;
    }
    
    /**
     * Write a single value to the I2C device. Used to set up the device to read from a
     * particular address.
     * @param value the value to write to the device
     * @return 1 on failure to write, 0 on success.
     */
    int I2CDevice::write(unsigned char value){
        unsigned char buffer[1];
        buffer[0]=value;
        if (::write(this->file, buffer, 1)!=1){
            std::cerr << "I2CDevice: Failed to write to the device" << std::endl;
            return 1;
        }
        return 0;
    }
    
    /**
     * Read a single register value from the address on the device.
     * @param registerAddress the address to read from
     * @return the byte value at the register address.
     */
    unsigned char I2CDevice::readRegister(uint32_t registerAddress){
        this->write(registerAddress);
        unsigned char buffer[1];
        if(::read(this->file, buffer, 1)!=1){
            std::cerr << "I2CDevice: Failed to read in the value." << std::endl;
            return 1;
        }
        return buffer[0];
    }
    
    /**
     * Method to read a number of registers from a single device. This is much more efficient than
     * reading the registers individually. The from address is the starting address to read from, which
     * defaults to 0x00.
     * @param number the number of registers to read from the device
     * @param fromAddress the starting address to read from
     * @return a pointer of type unsigned char* that points to the first element in the block of registers
     */
    unsigned char* I2CDevice::readRegisters(uint32_t number, uint32_t fromAddress){
        this->write(fromAddress);
        unsigned char* data = new unsigned char[number];
        if(::read(this->file, data, number)!=(int)number){
            std::cerr << "I2CDevice: Failed to read in the full buffer." << std::endl;
            return NULL;
        }
        return data;
    }
    
    /**
     * Method to dump the registers to the standard output. It inserts a return character after every
     * 16 values and displays the results in hexadecimal to give a standard output using the HEX() macro
     * that is defined at the top of this file. The standard output will stay in hexadecimal format, hence
     * the call on the last like.
     * @param number the total number of registers to dump, defaults to 0xff
     */
    
    void I2CDevice::debugDumpRegisters(uint32_t number){
        std::cerr << "I2CDevice: Dumping Registers for Debug Purposes:" << std::endl;
        unsigned char *registers = this->readRegisters(number);
        for(int i=0; i<(int)number; i++){
            std::cerr << HEX(*(registers+i)) << " ";
            if (i%16==15) std::cout << std::endl;
        }
        std::cerr << std::dec;
    }
    
    /**
     * Close the file handles and sets a temporary state to -1.
     */
    void I2CDevice::close(){
        ::close(this->file);
        this->file = -1;
    }
    
} /* namespace 12cbus */
