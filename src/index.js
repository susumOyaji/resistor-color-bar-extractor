
export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        // Serve API
        if (request.method === 'POST') {
            if (url.pathname === '/api/analyze') {
                return handleAnalysis(request);
            }
            if (url.pathname === '/api/scan') {
                return handleScan(request);
            }
            if (url.pathname === '/api/extract-colors') {
                return handleExtractColors(request);
            }
            if (url.pathname === '/api/detect-edges') {
                return handleEdgeDetection(request);
            }
        }

        // Serve static assets from 'public' directory
        return env.ASSETS.fetch(request);
    },
};

// --- Helper Functions ---

function findDominantColor(bands) {
    if (!bands || bands.length === 0) return null;
    const colorCounts = {};
    bands.forEach(band => {
        colorCounts[band.name] = (colorCounts[band.name] || 0) + 1;
    });
    const dominantColorEntry = Object.entries(colorCounts).sort((a, b) => b[1] - a[1])[0];
    return dominantColorEntry ? dominantColorEntry[0] : null;
}

// --- Main API Handlers ---

async function handleAnalysis(request) {
    // This is a placeholder for the original 'analyze' endpoint.
    // It can be updated to use the new logic if needed.
    return new Response(JSON.stringify({ message: "'analyze' endpoint not fully implemented with new logic." }), {
        headers: { 'Content-Type': 'application/json' }
    });
}

async function handleScan(request) {
    try {
        const { slices, customColors } = await request.json();

        if (!slices || !Array.isArray(slices)) {
            return new Response('Invalid data', { status: 400 });
        }

        const sliceResults = slices.map(slicePixels => {
            const bands = extractBands(slicePixels, slicePixels.length, 1, customColors);
            return {
                colors: bands.map(b => ({
                    r: b.rgb.r,
                    g: b.rgb.g,
                    b: b.rgb.b,
                    name: b.colorName,
                    hex: rgbToHex(b.rgb.r, b.rgb.g, b.rgb.b),
                    count: b.width
                })),
                detected_bands: bands.map(b => b.colorName)
            };
        });

        // Aggregate results to find the most common sequence of value bands
        const allBandSequences = sliceResults.map(res => {
            const colorObjs = res.detected_bands.map(name => RESISTOR_COLORS.find(c => c.name === name)).filter(Boolean);
            const dominantColor = findDominantColor(colorObjs);
            return colorObjs.filter(band => band.name !== dominantColor).map(band => band.name);
        });

        const sequenceCounts = {};
        allBandSequences.forEach(seq => {
            if (seq.length >= 3) {
                const key = seq.join(',');
                sequenceCounts[key] = (sequenceCounts[key] || 0) + 1;
            }
        });
        
        let bestSequence = [];
        if (Object.keys(sequenceCounts).length > 0) {
             const [topSequence] = Object.entries(sequenceCounts).sort((a,b) => b[1] - a[1])[0];
             bestSequence = topSequence.split(',');
        }

        const resistorValue = calculateResistorValue(bestSequence);

        return new Response(JSON.stringify({
            slices: sliceResults,
            detected_bands: bestSequence,
            resistor_value: resistorValue
        }), { headers: { 'Content-Type': 'application/json' } });

    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}

async function handleExtractColors(request) {
    // This is a placeholder for the original 'extract-colors' endpoint.
    return new Response(JSON.stringify({ message: "'extract-colors' endpoint not fully implemented with new logic." }), {
        headers: { 'Content-Type': 'application/json' }
    });
}


// --- Analysis Logic (Copied and adapted from test_edge_detection.js) ---

const RESISTOR_COLORS = [
    { name: 'Black', r: 0, g: 0, b: 0, value: 0 },
    { name: 'Black', r: 50, g: 50, b: 50, value: 0 }, // Darker grey for black
    { name: 'Brown', r: 153, g: 102, b: 51, value: 1, tolerance: 1 }, // #996633
    { name: 'Red', r: 255, g: 0, b: 0, value: 2, tolerance: 2 },     // #FF0000
    { name: 'Red', r: 170, g: 0, b: 0, value: 2, tolerance: 2 },     // Darker Red
    { name: 'Red', r: 170, g: 70, b: 0, value: 2, tolerance: 2 },    // Brownish Red / Orange Red
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

function findClosestColor(pixel, customColors = []) {
    let minDist = Infinity;
    let closest = RESISTOR_COLORS[0];
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
        if (dist < minDist) {
            minDist = dist;
            closest = color;
        }
    }
    return closest;
}

function calculateResistorValue(bands) {
    if (!bands || bands.length < 3) return null;

    let colorObjsFull = bands.map(bandName => {
        const matches = RESISTOR_COLORS.filter(c => c.name === bandName);
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

    const possibleToleranceColors = ['Gold', 'Silver', 'Brown', 'Red', 'Green', 'Blue', 'Violet'];
    if (processingBands.length >= 4) { 
        const lastBand = processingBands[processingBands.length - 1];
        if (lastBand.tolerance !== undefined && possibleToleranceColors.includes(lastBand.name)) {
            toleranceObj = lastBand;
            processingBands.pop(); 
        }
    }
    
    if (processingBands.length === 3) { 
        digits = [processingBands[0], processingBands[1]];
        multiplierObj = processingBands[2];
    } else if (processingBands.length === 4) { 
        digits = [processingBands[0], processingBands[1], processingBands[2]];
        multiplierObj = processingBands[3];
    } else {
        return "Complex/Unknown";
    }

    if (digits.some(d => d.value === undefined) || !multiplierObj) {
        return "Unknown Colors"; 
    }
    
    let digitValue = 0;
    if (digits.length === 2) {
        digitValue = digits[0].value * 10 + digits[1].value;
    } else if (digits.length === 3) {
        digitValue = digits[0].value * 100 + digits[1].value * 10 + digits[2].value;
    }

    if (multiplierObj.value !== undefined) {
        resistance = digitValue * Math.pow(10, multiplierObj.value);
    } else if (multiplierObj.name === 'Gold') {
        resistance = digitValue * 0.1;
    } else if (multiplierObj.name === 'Silver') {
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

function rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
}


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

function averageColor(colors) {
    if (colors.length === 0) return { r: 0, g: 0, b: 0 };
    const sum = colors.reduce((acc, c) => ({ r: acc.r + c.r, g: acc.g + c.g, b: acc.b + c.b }), { r: 0, g: 0, b: 0 });
    return { r: Math.round(sum.r / colors.length), g: Math.round(sum.g / colors.length), b: Math.round(sum.b / colors.length) };
}

function extractBands(pixels, width, height, customColors = []) {
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
            averagedLine.push({ r: Math.round(sumR / count), g: Math.round(sumG / count), b: Math.round(sumB / count), x: x });
        } else {
            averagedLine.push({ r: 0, g: 0, b: 0, x: x });
        }
    }
    
    const segments = [];
    if (averagedLine.length === 0) return [];

    let currentSegment = { start_x: averagedLine[0].x, end_x: averagedLine[0].x, pixels: [averagedLine[0]] };
    const colorChangeThreshold = 10;
    for (let i = 1; i < averagedLine.length; i++) {
        const prevColor = averagedLine[i-1];
        const currentColor = averagedLine[i];
        
        if (colorDistance(prevColor, currentColor) > colorChangeThreshold) {
            segments.push(currentSegment);
            currentSegment = { start_x: currentColor.x, end_x: currentColor.x, pixels: [currentColor] };
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
            rgb: avgColor,
            l: l,
            width: seg.end_x - seg.start_x + 1,
        });
    });

    return finalBands.sort((a, b) => a.x - b.x);
}


async function handleEdgeDetection(request) {
    try {
        const { pixels, width, height, customColors } = await request.json();
        if (!pixels || !Array.isArray(pixels) || !width || !height) {
            return new Response('Invalid data', { status: 400 });
        }
        
        const bands = extractBands(pixels, width, height, customColors);
        const bandNames = bands.map(b => b.colorName);
        const resistorValue = calculateResistorValue(bandNames);

        return new Response(JSON.stringify({
            success: true,
            bands: bands,
            detected_bands: bandNames,
            resistor_value: resistorValue
        }), { headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
        console.error(`[handleEdgeDetection] Error: ${e.message}`);
        return new Response(JSON.stringify({ error: e.message, stack: e.stack }), { status: 500 });
    }
}
