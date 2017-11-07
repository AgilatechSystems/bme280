/**
 * \file Device.h
 *
 *  Created by Scott Erholm on 12/9/16.
 *  Copyright (c) 2016 Agilatech. All rights reserved.
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 */

#ifndef __Device__
#define __Device__

#include <iostream>
#include <fstream>
#include <termios.h>
#include <fcntl.h>
#include <string.h>
#include <unistd.h>
#include "DataManip.h"

#ifdef DEBUG
#  define DPRINT(x) do { std::cerr << x; std::cerr << std::endl; } while (0)
#else
#  define DPRINT(x) do {} while (0)
#endif

class Device {
    
public:
    Device();
    
    virtual std::string getVersion();
    virtual std::string getDeviceName();
    virtual std::string getDeviceType();
    virtual int getNumValues();
    virtual std::string getTypeAtIndex(int index);
    virtual std::string getNameAtIndex(int index);
    
    virtual bool isActive();
    virtual std::string getValueByName(std::string name);
    virtual std::string getValueAtIndex(int index) =0;
    
protected:
    
    virtual bool initialize() =0;
    
    static const std::string name;
    static const std::string type;
    
    static const std::string version;
    
    static const int numValues;
    
    static const std::string valueNames[];
    static const std::string valueTypes[];
    
    bool active = false;
    
};

#endif /* defined(__Device__) */
