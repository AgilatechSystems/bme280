/**
 * \file Bme280Drv.cpp
 *
 *  Created by Scott Erholm on 10-30-2017.
 *  Copyright (c) 2017 Agilatech. All rights reserved.
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 */

#include "Bme280Drv.h"

const std::string Device::name = "BME280";
const std::string Device::type = "sensor";

const int Device::numValues = Bme280Drv::NUM_VALUES;

const std::string Device::valueNames[numValues] = {"pressure", "temperature", "humidity"};
const std::string Device::valueTypes[numValues] = {"float", "float", "float"};

Bme280Drv::Bme280Drv(std::string devfile):i2cbus::I2CDevice(devfile,0x76) {
    
    if (initialize()) {
        this->active = true;
        this->stationAltitude = 0;
    }
    else {
        std::cerr << name << " did not initialize. " << name << " is inactive" << std::endl;
    }
    
}

Bme280Drv::Bme280Drv(std::string devfile, int altitude):i2cbus::I2CDevice(devfile,0x76) {
    
    if (initialize()) {
        this->active = true;
        this->stationAltitude = altitude;
    }
    else {
        std::cerr << name << " did not initialize. " << name << " is inactive" << std::endl;
    }
    
}

Bme280Drv::Bme280Drv(std::string devfile, int altitude, uint32_t addr):i2cbus::I2CDevice(devfile,addr) {
    
    if (initialize()) {
        this->active = true;
        this->stationAltitude = altitude;
    }
    else {
        std::cerr << name << " did not initialize. " << name << " is inactive" << std::endl;
    }
    
}

std::string Bme280Drv::getValueAtIndex(int index) {
    
    if (!this->active) {
        return "none";
    }
    
    if (index < numValues) {
        return (this->*readFunction[index])();
    }
    else {
        return "none";
    }
}

bool Bme280Drv::initialize() {
    
    // check if sensor, i.e. the chip ID is correct
    if (readRegister(BME280_REGISTER_CHIPID) != 0x60) {
        return false;
    }
    
    // reset the device using soft-reset
    // this makes sure the IIR is off, etc.
    writeRegister(BME280_REGISTER_SOFTRESET, 0xB6);
    
    // As per data sheet, startup time is 2 ms.
    usleep(2000);
    
    // if chip is still reading calibration, delay
    while (isReadingCalibration()) {
        usleep(1000);
    }
    
    readCoefficients(); // read trimming parameters, see DS 4.2.2
    
    setSampling(); // use defaults
    
    this->calcTFine();
    
    usleep(100000);
    
    return true;
}

void Bme280Drv::setSampling(sensor_mode mode,
                            sensor_sampling   tempSampling,
                            sensor_sampling   pressSampling,
                            sensor_sampling   humSampling,
                            sensor_filter     filter,
                            standby_duration  duration) {
    
    this->measReg.mode     = mode;
    
    this->measReg.osrs_t   = tempSampling;
    this->measReg.osrs_p   = pressSampling;
    this->humReg.osrs_h    = humSampling;
    
    this->configReg.filter = filter;
    this->configReg.t_sb   = duration;
    
    
    // you must make sure to also set REGISTER_CONTROL after setting the
    // CONTROLHUMID register, otherwise the values won't be applied (see DS 7.4.3)
    writeRegister(BME280_REGISTER_CONTROLHUMID, this->humReg.get());
    writeRegister(BME280_REGISTER_CONFIG, this->configReg.get());
    writeRegister(BME280_REGISTER_CONTROL, this->measReg.get());
}

void Bme280Drv::takeForcedMeasurement() {
    // If we are in forced mode, the BME sensor goes back to sleep after each
    // measurement and we need to set it to forced mode once at this point, so
    // it will take the next measurement and then return to sleep again.
    // In normal mode simply does new measurements periodically.
    if (this->measReg.mode == MODE_FORCED) {
        // set to forced mode, i.e. "take next measurement"
        writeRegister(BME280_REGISTER_CONTROL, this->measReg.get());
        // wait until measurement has been completed, otherwise we would read
        // the values from the last measurement
        while (readRegister(BME280_REGISTER_STATUS) & 0x08) {
            usleep(1000);
        }
    }
}

void Bme280Drv::readCoefficients(void) {
    this->bme280_calib.dig_T1 = read16_LE(BME280_REGISTER_DIG_T1);
    this->bme280_calib.dig_T2 = readS16_LE(BME280_REGISTER_DIG_T2);
    this->bme280_calib.dig_T3 = readS16_LE(BME280_REGISTER_DIG_T3);
    
    this->bme280_calib.dig_P1 = read16_LE(BME280_REGISTER_DIG_P1);
    this->bme280_calib.dig_P2 = readS16_LE(BME280_REGISTER_DIG_P2);
    this->bme280_calib.dig_P3 = readS16_LE(BME280_REGISTER_DIG_P3);
    this->bme280_calib.dig_P4 = readS16_LE(BME280_REGISTER_DIG_P4);
    this->bme280_calib.dig_P5 = readS16_LE(BME280_REGISTER_DIG_P5);
    this->bme280_calib.dig_P6 = readS16_LE(BME280_REGISTER_DIG_P6);
    this->bme280_calib.dig_P7 = readS16_LE(BME280_REGISTER_DIG_P7);
    this->bme280_calib.dig_P8 = readS16_LE(BME280_REGISTER_DIG_P8);
    this->bme280_calib.dig_P9 = readS16_LE(BME280_REGISTER_DIG_P9);
    
    this->bme280_calib.dig_H1 = readRegister(BME280_REGISTER_DIG_H1);
    this->bme280_calib.dig_H2 = readS16_LE(BME280_REGISTER_DIG_H2);
    this->bme280_calib.dig_H3 = readRegister(BME280_REGISTER_DIG_H3);
    this->bme280_calib.dig_H4 = (readRegister(BME280_REGISTER_DIG_H4) << 4) | (readRegister(BME280_REGISTER_DIG_H4+1) & 0xF);
    this->bme280_calib.dig_H5 = (readRegister(BME280_REGISTER_DIG_H5+1) << 4) | (readRegister(BME280_REGISTER_DIG_H5) >> 4);
    this->bme280_calib.dig_H6 = (int8_t)readRegister(BME280_REGISTER_DIG_H6);
}

bool Bme280Drv::isReadingCalibration(void) {
    uint8_t const rStatus = readRegister(BME280_REGISTER_STATUS);
    
    return (rStatus & (1 << 0)) != 0;
}

// Pressure
std::string Bme280Drv::readValue0() {
    
    if (!this->active) {
        return "none";
    }
    
    int64_t var1, var2, p;
    
    this->calcTFine(); // must be done first to get this->t_fine
    
    int32_t adc_P = this->read24(BME280_REGISTER_PRESSUREDATA);
    
    if (adc_P == 0x800000) {// value in case pressure measurement was disabled
        return "none";
    }
    
    adc_P >>= 4;
    
    var1 = ((int64_t)this->t_fine) - 128000;
    var2 = var1 * var1 * (int64_t)this->bme280_calib.dig_P6;
    var2 = var2 + ((var1*(int64_t)this->bme280_calib.dig_P5)<<17);
    var2 = var2 + (((int64_t)this->bme280_calib.dig_P4)<<35);
    var1 = ((var1 * var1 * (int64_t)this->bme280_calib.dig_P3)>>8) +
    ((var1 * (int64_t)this->bme280_calib.dig_P2)<<12);
    var1 = (((((int64_t)1)<<47)+var1))*((int64_t)this->bme280_calib.dig_P1)>>33;
    
    if (var1 == 0) {
        return "0"; // avoid exception caused by division by zero
    }
    
    p = 1048576 - adc_P;
    p = (((p<<31) - var2)*3125) / var1;
    var1 = (((int64_t)this->bme280_calib.dig_P9) * (p>>13) * (p>>13)) >> 25;
    var2 = (((int64_t)this->bme280_calib.dig_P8) * p) >> 19;
    
    p = ((p + var1 + var2) >> 8) + (((int64_t)this->bme280_calib.dig_P7)<<4);
    // p is Pa as unsigned 32 bit integer in Q24.8 format (24 integer bits and 8 fractional bits).
    // p value of “24674867” represents 24674867/256 = 96386.2 Pa = 963.862 hPa
    
    float p_adj = p/256;
    
    // Get the pressure adjusted for altitude
    p_adj = this->seaLevelPressure(p_adj/100);  // div by 100 to represent in hPa
    
    // If the data is not valid, just return none
    if ((p_adj < 850) || (p_adj > 1090)) {
        return "none";
    }
    
    // return 2 decimal places, cause pressure needs that precision
    return DataManip::dataToString(p_adj, 2);
}

// Temperature
std::string Bme280Drv::readValue1() {
    
    if (!this->active) {
        return "none";
    }
    
    this->calcTFine();
    
    float temp = (this->t_fine * 5 + 128) >> 8;
    temp /= 100;
    
    return DataManip::dataToString(temp, 1);  /// 1 decimal place enough, yes?
}

// Humidity
std::string Bme280Drv::readValue2() {
    
    if (!this->active) {
        return "none";
    }
    
    this->calcTFine(); // must be done first to get this->t_fine
    
    int32_t adc_H = read16(BME280_REGISTER_HUMIDDATA);
    
    if (adc_H == 0x8000) {// value in case humidity measurement was disabled
        return "none";
    }
    
    int32_t v_x1_u32r;
    
    v_x1_u32r = (this->t_fine - ((int32_t)76800));
    
    // wow, is this c++ or lisp?
    v_x1_u32r = (((((adc_H << 14) - (((int32_t)this->bme280_calib.dig_H4) << 20) -
                    (((int32_t)this->bme280_calib.dig_H5) * v_x1_u32r)) + ((int32_t)16384)) >> 15) *
                 (((((((v_x1_u32r * ((int32_t)this->bme280_calib.dig_H6)) >> 10) *
                      (((v_x1_u32r * ((int32_t)this->bme280_calib.dig_H3)) >> 11) + ((int32_t)32768))) >> 10) +
                    ((int32_t)2097152)) * ((int32_t)this->bme280_calib.dig_H2) + 8192) >> 14));
    
    v_x1_u32r = (v_x1_u32r - (((((v_x1_u32r >> 15) * (v_x1_u32r >> 15)) >> 7) *
                               ((int32_t)this->bme280_calib.dig_H1)) >> 4));
    
    v_x1_u32r = (v_x1_u32r < 0) ? 0 : v_x1_u32r;
    v_x1_u32r = (v_x1_u32r > 419430400) ? 419430400 : v_x1_u32r;
    
    // v_x1_u32r is %RH as unsigned 32 bit integer in Q22. 10 format (22 integer and 10 fractional bits).
    // v_x1_u32r>>12 value of “47445” represents 47445/1024 = 46. 333 %RH
    
    float h = (v_x1_u32r>>12) / 1024.0;
    
    return DataManip::dataToString(h, 1);
}

void Bme280Drv::calcTFine(void) {
    int32_t var1, var2;
    
    // get the raw reading
    int32_t adc_T = read24(BME280_REGISTER_TEMPDATA);
    
    adc_T >>= 4;
    
    var1 = ((((adc_T>>3) - ((int32_t)this->bme280_calib.dig_T1 <<1))) *
            ((int32_t)this->bme280_calib.dig_T2)) >> 11;
    
    var2 = (((((adc_T>>4) - ((int32_t)this->bme280_calib.dig_T1)) *
              ((adc_T>>4) - ((int32_t)this->bme280_calib.dig_T1))) >> 12) *
            ((int32_t)this->bme280_calib.dig_T3)) >> 14;
    
    this->t_fine = var1 + var2;
}

float Bme280Drv::pressureToAltitude(float seaLevel, float atmospheric, float temp) {
    /* Hyposometric formula:                      */
    /*                                            */
    /*     ((P0/P)^(1/5.257) - 1) * (T + 273.15)  */
    /* h = -------------------------------------  */
    /*                   0.0065                   */
    /*                                            */
    /* where: h   = height (in meters)            */
    /*        P0  = sea-level pressure (in hPa)   */
    /*        P   = atmospheric pressure (in hPa) */
    /*        T   = temperature (in deg C)           */
    
    return (((float)pow((seaLevel/atmospheric), 0.190223F) - 1.0F)
            * (temp + 273.15F)) / 0.0065F;
}

float Bme280Drv::seaLevelForAltitude(float altitude, float atmospheric, float temp) {
    /* Hyposometric formula:                      */
    /*                                            */
    /* P0=((((h*0.0065)/(T + 273.15F))+1)^(^/0.190223F))*P */
    /*                                            */
    /* where: h   = height (in meters)            */
    /*        P0  = sea-level pressure (in hPa)   */
    /*        P   = atmospheric pressure (in hPa) */
    /*        T   = temperature (in deg C)           */
    
    return (float)pow((((altitude*0.0065)/(temp + 273.15F))+1), (1.0/0.190223F))*atmospheric;
}

float Bme280Drv::seaLevelPressure(float pressure_mb) {
    return (pressure_mb - 0.3) * pow( (1.0 + ((8.42288 / 100000.0) * (this->stationAltitude / pow((pressure_mb - 0.3), 0.190284) ) )) , (1.0/0.190284));
}

uint16_t Bme280Drv::read16(uint8_t registerAddress) {
    uint16_t result;
    result = combineRegisters(readRegister(registerAddress), readRegister(registerAddress+1));
    return result;
}

uint16_t Bme280Drv::read16_LE(uint8_t registerAddress) {
    uint16_t temp = read16(registerAddress);
    return (temp >> 8) | (temp << 8);
}

int16_t Bme280Drv::readS16(uint8_t registerAddress) {
    int16_t result;
    result = (int16_t)combineRegisters(readRegister(registerAddress), readRegister(registerAddress+1));
    return result;
}

int16_t Bme280Drv::readS16_LE(uint8_t registerAddress) {
    return (int16_t)read16_LE(registerAddress);
}

uint32_t Bme280Drv::read24(uint8_t registerAddress) {
    uint32_t value;
    
    unsigned char* threebytes = readRegisters(3, registerAddress);
    
    value = threebytes[0];
    value <<= 8;
    value |= threebytes[1];
    value <<= 8;
    value |= threebytes[2];
    
    return value;
}

/**
 * Method to combine two 8-bit registers into a single short, which is 16-bits on the BBB.
 *  It shifts the MSB 8-bits to the left and then ORs the result with the LSB.
 */
uint16_t Bme280Drv::combineRegisters(unsigned char msb, unsigned char lsb) {
    //shift the MSB right by 8 bits and OR with LSB
    return ((uint16_t)msb<<8)|(uint16_t)lsb;
}







