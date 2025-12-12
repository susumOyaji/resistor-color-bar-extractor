export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        // Serve API
        if (request.method === 'POST') {
            if (url.pathname === '/api/detect-edges') {
                return handleEdgeDetection(request, env);
            }
            if (url.pathname === '/api/learn') {
                return handleLearn(request, env);
            }
            if (url.pathname === '/api/learn-from-value') {
                return handleLearnFromValue(request, env);
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
        const name = band.name || band;
        colorCounts[name] = (colorCounts[name] || 0) + 1;
    });
    const dominantColorEntry = Object.entries(colorCounts).sort((a, b) => b[1] - a[1])[0];
    if (dominantColorEntry && dominantColorEntry[1] > 1) {
        return dominantColorEntry[0];
    }
    return null;
}

// --- Main API Handlers ---

async function handleLearn(request, env) {
    try {
        const { detectedColor, correctColorName } = await request.json();
        if (!detectedColor || !correctColorName) {
            return new Response('Invalid learning data', { status: 400 });
        }
        let definitions = await env.LEARNING_STORE.get("custom_colors", { type: "json" }) || [];
        const existingIndex = definitions.findIndex(def =>
            def.r === detectedColor.r && def.g === detectedColor.g && def.b === detectedColor.b
        );
        const newDefinition = {
            name: correctColorName,
            r: detectedColor.r,
            g: detectedColor.g,
            b: detectedColor.b,
        };
        if (existingIndex > -1) {
            definitions[existingIndex] = newDefinition;
        } else {
            definitions.push(newDefinition);
        }
        await env.LEARNING_STORE.put("custom_colors", JSON.stringify(definitions));
        return new Response(JSON.stringify({ success: true, message: `Learned rule for ${correctColorName}` }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e) {
        console.error(`[handleLearn] Error: ${e.message}`);
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}

// --- Analysis & Calculation Logic ---

const RESISTOR_COLORS = [
    { name: 'Black',  r: 0,   g: 0,   b: 0,   value: 0, multiplier: 1 },
    { name: 'Brown',  r: 165, g: 42,  b: 42,  value: 1, multiplier: 10, tolerance: 1 },
    { name: 'Red',    r: 255, g: 0,   b: 0,   value: 2, multiplier: 100, tolerance: 2 },
    { name: 'Orange', r: 255, g: 165, b: 0,   value: 3, multiplier: 1000 },
    { name: 'Yellow', r: 255, g: 255, b: 0,   value: 4, multiplier: 10000 },
    { name: 'Green',  r: 0,   g: 128, b: 0,   value: 5, multiplier: 100000, tolerance: 0.5 },
    { name: 'Blue',   r: 0,   g: 0,   b: 255, value: 6, multiplier: 1000000, tolerance: 0.25 },
    { name: 'Violet', r: 238, g: 130, b: 238, value: 7, multiplier: 10000000, tolerance: 0.1 },
    { name: 'Gray',   r: 128, g: 128, b: 128, value: 8, multiplier: 100000000, tolerance: 0.05 },
    { name: 'White',  r: 255, g: 255, b: 255, value: 9, multiplier: 1000000000 },
    { name: 'Gold',   r: 255, g: 215, b: 0,   multiplier: 0.1, tolerance: 5 },
    { name: 'Silver', r: 192, g: 192, b: 192, multiplier: 0.01, tolerance: 10 },
    { name: 'Beige (Body)', r: 245, g: 245, b: 220 }
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
    if (!bands || bands.length < 3 || bands.length > 6) return null;

    const colorObjs = bands.map(name => RESISTOR_COLORS.find(c => c.name === name)).filter(Boolean);

    if (colorObjs.length !== bands.length) {
        return "Unknown color in sequence";
    }

    let digits = [], multiplierObj, toleranceObj;
    
    switch (colorObjs.length) {
        case 3:
            // Digit, Digit, Multiplier
            digits = colorObjs.slice(0, 2);
            multiplierObj = colorObjs[2];
            break;
        case 4:
            // Digit, Digit, Multiplier, Tolerance
            digits = colorObjs.slice(0, 2);
            multiplierObj = colorObjs[2];
            toleranceObj = colorObjs[3];
            break;
        case 5:
            // Digit, Digit, Digit, Multiplier, Tolerance
            digits = colorObjs.slice(0, 3);
            multiplierObj = colorObjs[3];
            toleranceObj = colorObjs[4];
            break;
        case 6:
            // Digit, Digit, Digit, Multiplier, Tolerance, TempCo (TempCo ignored for now)
            digits = colorObjs.slice(0, 3);
            multiplierObj = colorObjs[3];
            toleranceObj = colorObjs[4];
            break;
        default:
            return "Unsupported band count";
    }

    if (digits.some(d => d.value === undefined) || !multiplierObj || multiplierObj.multiplier === undefined) {
        return "Invalid band sequence for calculation";
    }

    const digitValue = parseInt(digits.map(d => d.value).join(''), 10);
    const resistance = digitValue * multiplierObj.multiplier;
    const tolerance = (toleranceObj && toleranceObj.tolerance !== undefined) ? toleranceObj.tolerance : 20; // Default 20%

    return formatResistance(resistance) + ` ±${tolerance}%`;
}

function formatResistance(ohms) {
    if (ohms >= 1000000) return (ohms / 1000000).toFixed(1).replace(/\.0$/, '') + 'MΩ';
    if (ohms >= 1000) return (ohms / 1000).toFixed(1).replace(/\.0$/, '') + 'kΩ';
    return ohms + 'Ω';
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

function extractBands(pixels, width, height, customColors = [], threshold = 10) {
    if (pixels.length === 0 || width === 0 || height === 0) return [];
    const averagedLine = [];
    for (let x = 0; x < width; x++) {
        let sumR = 0, sumG = 0, sumB = 0, count = 0;
        for (let y = 0; y < height; y++) {
            const idx = y * width + x;
            if (pixels[idx]) {
                sumR += pixels[idx].r; sumG += pixels[idx].g; sumB += pixels[idx].b;
                count++;
            }
        }
        if (count > 0) averagedLine.push({ r: Math.round(sumR / count), g: Math.round(sumG / count), b: Math.round(sumB / count), x: x });
        else averagedLine.push({ r: 0, g: 0, b: 0, x: x });
    }
    
    const segments = [];
    if (averagedLine.length === 0) return [];

    let currentSegment = { start_x: averagedLine[0].x, end_x: averagedLine[0].x, pixels: [averagedLine[0]] };
    const colorChangeThreshold = threshold; // Use the passed-in threshold
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
        if (seg.end_x - seg.start_x + 1 < minBandWidth || l < 10 || l > 98) return;
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

function toleranceToColorName(tolerance) {
    const toleranceValue = parseFloat(tolerance);
    const mapping = [
        { name: 'Gold', tolerance: 5 },
        { name: 'Silver', tolerance: 10 },
        { name: 'Brown', tolerance: 1 },
        { name: 'Red', tolerance: 2 },
        { name: 'Green', tolerance: 0.5 },
        { name: 'Blue', tolerance: 0.25 },
        { name: 'Violet', tolerance: 0.1 },
    ];
    const match = mapping.find(m => m.tolerance === toleranceValue);
    // Return null for "None" (20%) or if no match is found
    return match ? match.name : null;
}

async function handleLearnFromValue(request, env) {
    try {
        const { detectedBands, correctValue, correctTolerance } = await request.json();

        if (!detectedBands || !Array.isArray(detectedBands) || detectedBands.length === 0 || !correctValue) {
            return new Response(JSON.stringify({ error: 'Invalid input data. Detected bands and a correct value are required.' }), { status: 400 });
        }

        const ohms = parseResistance(correctValue);
        if (ohms === null) return new Response(JSON.stringify({ error: 'Invalid resistance value format.' }), { status: 400 });
        
        let correctColorSequence = resistanceToColors(ohms);
        if (correctColorSequence.length === 0) return new Response(JSON.stringify({ error: 'Could not determine a valid color sequence for the given resistance value.' }), { status: 400 });
        
        if (correctTolerance) {
            const toleranceColor = toleranceToColorName(correctTolerance);
            if (toleranceColor) {
                correctColorSequence.push(toleranceColor);
            }
        }
        
        let significantDetectedBands = [...detectedBands];

        // New Filtering Logic: If more bands are detected than expected,
        // assume the widest bands are the resistor body and remove them.
        if (significantDetectedBands.length > correctColorSequence.length) {
            const bandsToRemove = significantDetectedBands.length - correctColorSequence.length;
            
            // Sort by width descending (widest first)
            significantDetectedBands.sort((a, b) => b.width - a.width);
            
            // Remove the widest bands
            significantDetectedBands.splice(0, bandsToRemove);

            // Restore original order by sorting by x-coordinate
            significantDetectedBands.sort((a, b) => a.x - b.x);
        }

        if (significantDetectedBands.length !== correctColorSequence.length) {
            return new Response(JSON.stringify({ error: `Band mismatch: Detected ${significantDetectedBands.length} significant bands, but the correct value corresponds to ${correctColorSequence.length} bands.` }), { status: 400 });
        }

        const newRules = new Map();
        for (let i = 0; i < correctColorSequence.length; i++) {
            const detectedBand = significantDetectedBands[i];
            const correctColorName = correctColorSequence[i];
            const rgbKey = `${detectedBand.rgb.r},${detectedBand.rgb.g},${detectedBand.rgb.b}`;
            newRules.set(rgbKey, { name: correctColorName, r: detectedBand.rgb.r, g: detectedBand.rgb.g, b: detectedBand.rgb.b });
        }
        
        let existingRules = await env.LEARNING_STORE.get("custom_colors", { type: "json" }) || [];
        const rulesMap = new Map(existingRules.map(rule => [`${rule.r},${rule.g},${rule.b}`, rule]));
        newRules.forEach((rule, key) => rulesMap.set(key, rule));
        const updatedRules = Array.from(rulesMap.values());
        await env.LEARNING_STORE.put("custom_colors", JSON.stringify(updatedRules));

        return new Response(JSON.stringify({ success: true, message: `Successfully learned ${newRules.size} new color rules.`, learnedRules: Array.from(newRules.values()) }), { headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
        console.error(`[handleLearnFromValue] Error: ${e.message}`, e.stack);
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}

function parseResistance(valueStr) {
    if (!valueStr) return null;
    const str = String(valueStr).trim().toUpperCase();
    const multiplier = str.slice(-1);
    let value = parseFloat(str);
    if (isNaN(value)) return null;
    if (multiplier === 'K') value *= 1000;
    else if (multiplier === 'M') value *= 1000000;
    return value;
}

function resistanceToColors(ohms) {
    if (ohms < 10) {
        console.error(`Cannot convert value ${ohms}Ω (less than 10) to a standard 4-band code.`);
        return [];
    }
    const colorMap = [ { name: 'Black', value: 0 }, { name: 'Brown', value: 1 }, { name: 'Red', value: 2 }, { name: 'Orange', value: 3 }, { name: 'Yellow', value: 4 }, { name: 'Green', value: 5 }, { name: 'Blue', value: 6 }, { name: 'Violet', value: 7 }, { name: 'Gray', value: 8 }, { name: 'White', value: 9 } ];
    const exponent = Math.floor(Math.log10(ohms));
    const firstTwoDigits = Math.round(ohms / Math.pow(10, exponent - 1));
    if (firstTwoDigits < 10 || firstTwoDigits > 99) {
        console.error(`Could not extract two significant digits from ${ohms}Ω.`);
        return [];
    }
    const firstDigit = Math.floor(firstTwoDigits / 10);
    const secondDigit = firstTwoDigits % 10;
    const multiplierValue = exponent - 1;
    const firstBand = colorMap.find(c => c.value === firstDigit);
    const secondBand = colorMap.find(c => c.value === secondDigit);
    const multiplierBand = colorMap.find(c => c.value === multiplierValue);
    if (firstBand && secondBand && multiplierBand) {
        const reconstructedValue = (firstBand.value * 10 + secondBand.value) * Math.pow(10, multiplierBand.value);
        if (Math.abs(reconstructedValue - ohms) / ohms < 0.01) {
            return [firstBand.name, secondBand.name, multiplierBand.name];
        }
    }
    console.error(`Could not convert ${ohms}Ω to a standard 4-band color code.`);
    return [];
}

async function handleEdgeDetection(request, env) {
    try {
        const { pixels, width, height, threshold = 10 } = await request.json();
        const customColors = await env.LEARNING_STORE.get("custom_colors", { type: "json" }) || [];
        if (!pixels || !Array.isArray(pixels) || !width || !height) {
            return new Response('Invalid data', { status: 400 });
        }
        
        const bands = extractBands(pixels, width, height, customColors, threshold);
        
        let bandsForCalc = [...bands];
        // Heuristic for general display: if more than 4 bands are found,
        // assume the widest is the body and remove it.
        if (bandsForCalc.length > 4) {
            bandsForCalc.sort((a, b) => b.width - a.width); // Widest first
            bandsForCalc.splice(0, 1); // Remove the widest
            bandsForCalc.sort((a, b) => a.x - b.x); // Restore order
        }
        
        const filteredBandNames = bandsForCalc.map(b => b.colorName);
        const resistorValue = calculateResistorValue(filteredBandNames);
        
        return new Response(JSON.stringify({ 
            success: true, 
            bands: bands, // Return original bands for UI
            detected_bands: bands.map(b => b.colorName), // Original names for UI
            resistor_value: resistorValue 
        }), { headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
        console.error(`[handleEdgeDetection] Error: ${e.message}`);
        return new Response(JSON.stringify({ error: e.message, stack: e.stack }), { status: 500 });
    }
}
