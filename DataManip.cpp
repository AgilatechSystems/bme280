/**
 * \file DataManip.cpp
 *
 *  Created by Scott Erholm on 6/14/16.
 *  Copyright (c) 2016 Agilatech. All rights reserved.
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 */

#include "DataManip.h"

std::string DataManip::dataToString(int data) {
    return std::to_string(data);
}

std::string DataManip::dataToString(float data, int numDecimals) {
    int whole = floor(data);
    int large1 = round(data * pow(10, numDecimals));
    int large2 = round(whole * pow(10, numDecimals));
    int fraction = large1 - large2;
    
    return std::to_string(whole) + "." + std::to_string(fraction);
}

std::string DataManip::dataToString(bool data) {
    
    if (data) {
        return "true";
    }
    else {
        return "false";
    }
}

uint16_t DataManip::roundInt(float r) {
    return r + 0.5;
}
