/**
 * \file Bme280Drv.h
 *
 *  Created by Scott Erholm on 10-30-2017.
 *  Copyright (c) 2017 Agilatech. All rights reserved.
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 */

#ifndef __Bme280Drv__
#define __Bme280Drv__

#include <iostream>
#include <fstream>
#include <termios.h>
#include <fcntl.h>
#include <string.h>
#include <unistd.h>
#include "I2CDevice.h"
#include "Device.h"
#include "DataManip.h"

// Registers
enum
{
    BME280_REGISTER_DIG_T1              = 0x88, //BME280_TEMP_PRESS_CALIB_DATA_ADDR
    BME280_REGISTER_DIG_T2              = 0x8A,
    BME280_REGISTER_DIG_T3              = 0x8C,
    
    BME280_REGISTER_DIG_P1              = 0x8E,
    BME280_REGISTER_DIG_P2              = 0x90,
    BME280_REGISTER_DIG_P3              = 0x92,
    BME280_REGISTER_DIG_P4              = 0x94,
    BME280_REGISTER_DIG_P5              = 0x96,
    BME280_REGISTER_DIG_P6              = 0x98,
    BME280_REGISTER_DIG_P7              = 0x9A,
    BME280_REGISTER_DIG_P8              = 0x9C,
    BME280_REGISTER_DIG_P9              = 0x9E,
    
    BME280_REGISTER_DIG_H1              = 0xA1,
    BME280_REGISTER_DIG_H2              = 0xE1, //BME280_HUMIDITY_CALIB_DATA_ADDR
    BME280_REGISTER_DIG_H3              = 0xE3,
    BME280_REGISTER_DIG_H4              = 0xE4,
    BME280_REGISTER_DIG_H5              = 0xE5,
    BME280_REGISTER_DIG_H6              = 0xE7,
    
    BME280_REGISTER_CHIPID             = 0xD0,
    BME280_REGISTER_VERSION            = 0xD1,
    BME280_REGISTER_SOFTRESET          = 0xE0,
    
    BME280_REGISTER_CAL26              = 0xE1,  // R calibration stored in 0xE1-0xF0
    
    BME280_REGISTER_CONTROLHUMID       = 0xF2, //BME280_CTRL_HUM_ADDR
    BME280_REGISTER_STATUS             = 0XF3,
    BME280_REGISTER_CONTROL            = 0xF4, //BME280_PWR_CTRL_ADDR  BME280_CTRL_MEAS_ADDR
    BME280_REGISTER_CONFIG             = 0xF5, //BME280_CONFIG_ADDR
    BME280_REGISTER_PRESSUREDATA       = 0xF7, //BME280_DATA_ADDR
    BME280_REGISTER_TEMPDATA           = 0xFA, // 0xF7 to 0xFE is burst for temp, pres, and hum
    BME280_REGISTER_HUMIDDATA          = 0xFD
};

// Calibration data
typedef struct
{
    uint16_t dig_T1;
    int16_t  dig_T2;
    int16_t  dig_T3;
    
    uint16_t dig_P1;
    int16_t  dig_P2;
    int16_t  dig_P3;
    int16_t  dig_P4;
    int16_t  dig_P5;
    int16_t  dig_P6;
    int16_t  dig_P7;
    int16_t  dig_P8;
    int16_t  dig_P9;
    
    uint8_t  dig_H1;
    int16_t  dig_H2;
    uint8_t  dig_H3;
    int16_t  dig_H4;
    int16_t  dig_H5;
    int8_t   dig_H6;
} bme280_calib_data;

class Bme280Drv : public i2cbus::I2CDevice, public Device {
    
public:
    
    enum sensor_sampling {
        SAMPLING_NONE = 0b000,
        SAMPLING_X1   = 0b001,
        SAMPLING_X2   = 0b010,
        SAMPLING_X4   = 0b011,
        SAMPLING_X8   = 0b100,
        SAMPLING_X16  = 0b101
    };
    
    enum sensor_mode {
        MODE_SLEEP  = 0b00,
        MODE_FORCED = 0b01,
        MODE_NORMAL = 0b11
    };
    
    enum sensor_filter {
        FILTER_OFF = 0b000,
        FILTER_X2  = 0b001,
        FILTER_X4  = 0b010,
        FILTER_X8  = 0b011,
        FILTER_X16 = 0b100
    };
    
    // standby durations in ms
    enum standby_duration {
        STANDBY_MS_0_5  = 0b000,
        STANDBY_MS_62_5 = 0b001,
        STANDBY_MS_125  = 0b010,
        STANDBY_MS_250  = 0b011,
        STANDBY_MS_500  = 0b100,
        STANDBY_MS_1000 = 0b101,
        STANDBY_MS_10   = 0b110,
        STANDBY_MS_20   = 0b111
    };
    
    Bme280Drv(std::string devfile);
    Bme280Drv(std::string devfile, int altitude);
    Bme280Drv(std::string devfile, int altitude, uint32_t addr);
    
    virtual std::string getValueAtIndex(int index);
    
    static const int NUM_VALUES = 3;
    
protected:
    
    virtual bool initialize();
    virtual std::string readValue0();
    virtual std::string readValue1();
    virtual std::string readValue2();
    
private:
    
    // Create an array of read functions, so that multiple functions can be easily called
    typedef std::string(Bme280Drv::*readValueType)();
    readValueType readFunction[NUM_VALUES] = { &Bme280Drv::readValue0, &Bme280Drv::readValue1, &Bme280Drv::readValue2 };
    
    void setSampling(sensor_mode mode              = MODE_NORMAL,
                     sensor_sampling tempSampling  = SAMPLING_X16,
                     sensor_sampling pressSampling = SAMPLING_X16,
                     sensor_sampling humSampling   = SAMPLING_X16,
                     sensor_filter filter          = FILTER_OFF,
                     standby_duration duration     = STANDBY_MS_0_5
                     );
    
    void takeForcedMeasurement();
    
    void readCoefficients(void);
    
    bool isReadingCalibration(void);
    
    void calcTFine(void);
    
    float pressureToAltitude(float seaLevel, float atmospheric, float temp);
    float seaLevelForAltitude(float altitude, float atmospheric, float temp);
    float seaLevelPressure(float pressure_mb);
    
    uint16_t read16(uint8_t registerAddress);
    
    uint16_t read16_LE(uint8_t registerAddress);
    
    int16_t readS16(uint8_t registerAddress);
    
    int16_t readS16_LE(uint8_t registerAddress);
    
    uint32_t read24(uint8_t registerAddress);
    
    uint16_t combineRegisters(unsigned char msb, unsigned char lsb);
    
    int32_t   t_fine;
    
    int stationAltitude;
    
    bme280_calib_data bme280_calib;
    
    // The config register
    struct config {
        // inactive duration (standby time) in normal mode
        // 000 = 0.5 ms
        // 001 = 62.5 ms
        // 010 = 125 ms
        // 011 = 250 ms
        // 100 = 500 ms
        // 101 = 1000 ms
        // 110 = 10 ms
        // 111 = 20 ms
        unsigned int t_sb : 3;
        
        // filter settings
        // 000 = filter off
        // 001 = 2x filter
        // 010 = 4x filter
        // 011 = 8x filter
        // 100 and above = 16x filter
        unsigned int filter : 3;
        
        unsigned int get() {
            return (t_sb << 5) | (filter << 3);
        }
    };
    config configReg;
    
    
    // The ctrl_meas register
    struct ctrl_meas {
        // temperature oversampling
        // 000 = skipped
        // 001 = x1
        // 010 = x2
        // 011 = x4
        // 100 = x8
        // 101 and above = x16
        unsigned int osrs_t : 3;
        
        // pressure oversampling
        // 000 = skipped
        // 001 = x1
        // 010 = x2
        // 011 = x4
        // 100 = x8
        // 101 and above = x16
        unsigned int osrs_p : 3;
        
        // device mode
        // 00       = sleep
        // 01 or 10 = forced
        // 11       = normal
        unsigned int mode : 2;
        
        unsigned int get() {
            return (osrs_t << 5) | (osrs_p << 3) | mode;
        }
    };
    ctrl_meas measReg;
    
    
    // The ctrl_hum register
    struct ctrl_hum {
        // unused - don't set
        unsigned int none : 5;
        
        // pressure oversampling
        // 000 = skipped
        // 001 = x1
        // 010 = x2
        // 011 = x4
        // 100 = x8
        // 101 and above = x16
        unsigned int osrs_h : 3;
        
        unsigned int get() {
            return (osrs_h);
        }
    };
    ctrl_hum humReg;
        
};

#endif /* defined(__Bme280Drv__) */
