const getPixels = require('get-pixels');
const util = require('util');

// Promisify get-pixels for use with async/await
const getPixelsAsync = util.promisify(getPixels);


// --- COPIED FROM SRC/INDEX.JS ---
// These functions are copied here to create a self-contained script
// for debugging the edge detection logic without the Cloudflare Worker environment.

const RESISTOR_COLORS = [
    { name: 'Black', r: 0, g: 0, b: 0, value: 0 },
    { name: 'Black', r: 50, g: 50, b: 50, value: 0 }, // Darker grey for black
    { name: 'Brown', r: 153, g: 102, b: 51, value: 1, tolerance: 1 }, // #996633
    { name: 'Red', r: 255, g: 0, b: 0, value: 2, tolerance: 2 },     // #FF0000
    { name: 'Red', r: 170, g: 0, b: 0, value: 2, tolerance: 2 },     // Darker Red
    { name: 'Orange', r: 255, g: 153, b: 0, value: 3 },             // #FF9900
    { name: 'Yellow', r: 255, g: 255, b: 0, value: 4 },             // #FFFF00
    { name: 'Green', r: 0, g: 255, b: 0, value: 5, tolerance: 0.5 },// #00FF00
    { name: 'Blue', r: 0, g: 0, b: 255, value: 6, tolerance: 0.25 }, // #0000FF
    { name: 'Violet', r: 128, g: 0, b: 128, value: 7, tolerance: 0.1 },// A darker, more common violet
    { name: 'Gray', r: 204, g: 204, b: 204, value: 8, tolerance: 0.05 },// #CCCCCC
    { name: 'White', r: 255, g: 255, b: 255, value: 9 },            // #FFFFFF
    { name: 'Gold', r: 218, g: 165, b: 32, tolerance: 5 },
    { name: 'Silver', r: 192, g: 192, b: 192, tolerance: 10 },
    { name: 'Beige (Body)', r: 200, g: 180, b: 150 } // More distinct beige
];

function rgbToLab(r, g, b) {
    r /= 255, g /= 255, b /= 255;
    r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
    g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
    b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;
    let x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) * 100;
    let y = (r * 0.2126729 + g * 0.7151522 + b * 0.0721750) * 100;
    let z = (r * 0.0193339 + g * 0.1191920 + b * 0.9503041) * 100;
    x /= 95.047, y /= 100, z /= 108.883;
    x = x > 0.008856 ? Math.pow(x, 1 / 3) : (7.787 * x) + 16 / 116;
    y = y > 0.008856 ? Math.pow(y, 1 / 3) : (7.787 * y) + 16 / 116;
    z = z > 0.008856 ? Math.pow(z, 1 / 3) : (7.787 * z) + 16 / 116;
    return { l: (116 * y) - 16, a: 500 * (x - y), b: 200 * (y - z) };
}

function colorDistance(c1, c2) {
    const lab1 = rgbToLab(c1.r, c1.g, c1.b);
    const lab2 = rgbToLab(c2.r, c2.g, c2.b);
    return Math.sqrt(Math.pow(lab1.l - lab2.l, 2) + Math.pow(lab1.a - lab2.a, 2) + Math.pow(lab1.b - lab2.b, 2));
}

function findClosestColor(pixel, customColors = []) {
    let minDist = Infinity;
    let closest = RESISTOR_COLORS[0];
    let debugDistances = {};

    if (customColors && Array.isArray(customColors)) {
        for (const color of customColors) {
            const dist = colorDistance(pixel, color);
            const biasedDist = dist * 0.5;
            if (biasedDist < minDist) {
                minDist = biasedDist;
                closest = color;
            }
        }
    }

    for (const color of RESISTOR_COLORS) {
        const dist = colorDistance(pixel, color);
        
        if (['Gold', 'Beige (Body)', 'Brown', 'Red', 'Violet'].includes(color.name)) {
            debugDistances[color.name] = dist.toFixed(2);
        }

        if (dist < minDist) {
            minDist = dist;
            closest = color;
        }
    }

    // console.log(`[DEBUG findClosestColor] Input RGB(${pixel.r},${pixel.g},${pixel.b}) -> Dist to Gold: ${debugDistances['Gold']}, Dist to Beige: ${debugDistances['Beige (Body)']}, Dist to Brown: ${debugDistances['Brown']}. Picked: ${closest.name} (Dist: ${minDist.toFixed(2)})`);

    return closest;
}

function calculateResistorValue(bands) {
    if (!bands || bands.length < 3) return null;

    let colorObjsFull = bands.map(band => {
        const name = band.colorName;
        const matches = RESISTOR_COLORS.filter(c => c.name === name);
        return matches.length > 0 ? matches[0] : null;
    }).filter(obj => obj !== null);

    if (colorObjsFull.length < 3) {
        return "Not enough bands";
    }

    let resistance = 0;
    let tolerance = 20; 
    let digits = [];
    let multiplierObj = null;
    let toleranceObj = null;

    let processingBands = [...colorObjsFull]; 

    const possibleToleranceColors = ['Gold', 'Silver', 'Brown', 'Red'];
    if (processingBands.length >= 4) { 
        const lastBand = processingBands[processingBands.length - 1];
        if (lastBand.tolerance !== undefined && possibleToleranceColors.includes(lastBand.name)) {
            toleranceObj = lastBand;
            processingBands.pop(); 
        }
    }
    
    // Find dominant color to exclude as body color
    const colorCounts = {};
    processingBands.forEach(band => {
        colorCounts[band.name] = (colorCounts[band.name] || 0) + 1;
    });
    const dominantColorEntry = Object.entries(colorCounts).sort((a,b) => b[1] - a[1])[0];
    const dominantColor = dominantColorEntry ? dominantColorEntry[0] : null;
    
    let validBandsForValue = [];
    if (dominantColor) {
        validBandsForValue = processingBands.filter(band => band.name !== dominantColor);
    } else {
        validBandsForValue = processingBands;
    }


    if (validBandsForValue.length < 2) {
        return "Not enough bands for value";
    }

    if (validBandsForValue.length === 3) { 
        digits = [validBandsForValue[0], validBandsForValue[1]];
        multiplierObj = validBandsForValue[2];
    } else if (validBandsForValue.length === 4) { 
        digits = [validBandsForValue[0], validBandsForValue[1], validBandsForValue[2]];
        multiplierObj = validBandsForValue[3];
    } else if (validBandsForValue.length === 2) {
        digits = [validBandsForValue[0], validBandsForValue[1]];
        multiplierObj = processingBands.find(b => b.value !== undefined && b.name !== validBandsForValue[0].name && b.name !== validBandsForValue[1].name);
    }
    else {
        return "Complex/Unknown";
    }

    let digitValue = 0;
    if (digits.some(d => d.value === undefined)) {
        return "Unknown Colors"; 
    }
    
    if (digits.length === 2) {
        digitValue = digits[0].value * 10 + digits[1].value;
    } else if (digits.length === 3) {
        digitValue = digits[0].value * 100 + digits[1].value * 10 + digits[2].value;
    }

    if (multiplierObj && multiplierObj.value !== undefined) {
        resistance = digitValue * Math.pow(10, multiplierObj.value);
    } else if (multiplierObj && multiplierObj.name === 'Gold') {
        resistance = digitValue * 0.1;
    } else if (multiplierObj && multiplierObj.name === 'Silver') {
        resistance = digitValue * 0.01;
    } else {
        return "Unknown Multiplier";
    }

    if (toleranceObj && toleranceObj.tolerance !== undefined) {
        tolerance = toleranceObj.tolerance;
    }

    return formatResistance(resistance) + ` ±${tolerance}%`;
}


function formatResistance(ohms) {
    if (ohms >= 1000000) return (ohms / 1000000).toFixed(1).replace(/\.0$/, '') + 'MΩ';
    if (ohms >= 1000) return (ohms / 1000).toFixed(1).replace(/\.0$/, '') + 'kΩ';
    return ohms + 'Ω';
}

function averageColor(colors) {
    if (colors.length === 0) return { r: 0, g: 0, b: 0 };
    const sum = colors.reduce((acc, c) => ({ r: acc.r + c.r, g: acc.g + c.g, b: acc.b + c.b }), { r: 0, g: 0, b: 0 });
    return { r: Math.round(sum.r / colors.length), g: Math.round(sum.g / colors.length), b: Math.round(sum.b / colors.length) };
}

function extractEdgeBands(pixels, width, height, edges, customColors = []) {
    if (pixels.length === 0 || width === 0 || height === 0) return [];

    const averagedLine = [];
    for (let x = 0; x < width; x++) {
        let sumR = 0, sumG = 0, sumB = 0;
        let count = 0;
        for (let y = 0; y < height; y++) {
            const idx = y * width + x;
            if (pixels[idx]) {
                sumR += pixels[idx].r;
                sumG += pixels[idx].g;
                sumB += pixels[idx].b;
                count++;
            }
        }
        if (count > 0) {
            averagedLine.push({
                r: Math.round(sumR / count),
                g: Math.round(sumG / count),
                b: Math.round(sumB / count),
                x: x
            });
        } else {
            averagedLine.push({ r: 0, g: 0, b: 0, x: x });
        }
    }
    
    const segments = [];
    if (averagedLine.length === 0) return [];

    let currentSegment = {
        start_x: averagedLine[0].x,
        end_x: averagedLine[0].x,
        pixels: [averagedLine[0]]
    };

    const colorChangeThreshold = 10;
    for (let i = 1; i < averagedLine.length; i++) {
        const prevColor = averagedLine[i-1];
        const currentColor = averagedLine[i];
        
        const dist = colorDistance(prevColor, currentColor);

        if (dist > colorChangeThreshold) {
            segments.push(currentSegment);
            currentSegment = {
                start_x: currentColor.x,
                end_x: currentColor.x,
                pixels: [currentColor]
            };
        } else {
            currentSegment.end_x = currentColor.x;
            currentSegment.pixels.push(currentColor);
        }
    }
    segments.push(currentSegment);

    const finalBands = [];
    const minBandWidth = 10;

    segments.forEach(seg => {
        const avgColor = averageColor(seg.pixels);
        const l = rgbToLab(avgColor.r, avgColor.g, avgColor.b).l;

        if (seg.end_x - seg.start_x + 1 < minBandWidth) {
            return;
        }
        
        if (l < 10 || l > 98) {
            return;
        }

        const resistorColor = findClosestColor(avgColor, customColors);
        
        finalBands.push({
            x: Math.round((seg.start_x + seg.end_x) / 2),
            colorName: resistorColor.name,
        });
    });

    return finalBands.sort((a, b) => a.x - b.x);
}


// --- TEST RUNNER (using get-pixels) ---

async function runEdgeDetectionTest(imagePath) {
    console.log(`Loading image: ${imagePath}`);
    try {
        const ndarray = await getPixelsAsync(imagePath);
        
        const width = ndarray.shape[0];
        const height = ndarray.shape[1];
        const channels = ndarray.shape[2];
        
        console.log(`Image loaded: width=${width}, height=${height}, channels=${channels}`);

        const cropYStart = Math.floor(height / 2) - 30;
        const cropHeight = 60;
        const cropYEnd = cropYStart + cropHeight;

        const croppedPixels = [];
        for (let y = cropYStart; y < cropYEnd; y++) {
            for (let x = 0; x < width; x++) {
                const r = ndarray.get(x, y, 0);
                const g = ndarray.get(x, y, 1);
                const b = ndarray.get(x, y, 2);
                croppedPixels.push({ r, g, b });
            }
        }
        
        const croppedWidth = width;
        const croppedHeight = cropHeight;
        console.log(`Image cropped in-memory to: width=${croppedWidth}, height=${croppedHeight}`);

        console.log('\n--- Running Edge Detection Logic ---');
        
        const customColors = [];
        
        // Note: The 'edges' parameter is no longer used by the new extractEdgeBands function
        const bands = extractEdgeBands(croppedPixels, croppedWidth, croppedHeight, [], customColors);
        
        console.log(`\nExtracted ${bands.length} bands:`);
        bands.forEach(band => {
            console.log(`- Band at x=${band.x}: ${band.colorName}`);
        });

        const detectedBandNames = bands.map(b => b.colorName);
        
        console.log(`\nFinal band sequence for calculation: [${detectedBandNames.join(', ')}]`);

        const resistorValue = calculateResistorValue(bands);

        console.log('\n--- RESULT ---');
        console.log('Detected Bands:', detectedBandNames);
        console.log('Estimated Resistance:', resistorValue || 'Calculation Failed');
        console.log('--------------');

    } catch (error) {
        console.error('An error occurred during the test:', error);
    }
}

// --- Main Execution ---
const testImage = 'Resistor-27-Ohm-5.jpg'; 
runEdgeDetectionTest(testImage);
