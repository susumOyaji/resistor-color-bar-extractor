
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
        }

        return new Response('Not Found', { status: 404 });
    },
};

async function handleAnalysis(request) {
    try {
        const { pixels } = await request.json();

        if (!pixels || !Array.isArray(pixels)) {
            return new Response('Invalid data', { status: 400 });
        }

        const bands = analyzePixels(pixels);

        return new Response(JSON.stringify({
            success: true,
            bands: bands,
            totalPixels: pixels.length
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}

async function handleScan(request) {
    try {
        const { slices } = await request.json();

        if (!slices || !Array.isArray(slices)) {
            return new Response('Invalid data', { status: 400 });
        }

        const sliceResults = slices.map(slicePixels => {
            // Use improved analyzePixels that detects actual colors and preserves position
            const bands = analyzePixels(slicePixels);

            // Map to format expected by frontend for visualization
            const colors = bands.map(b => ({
                r: b.rgb.r,
                g: b.rgb.g,
                b: b.rgb.b,
                name: b.colorName,
                hex: rgbToHex(b.rgb.r, b.rgb.g, b.rgb.b),
                count: b.width
            }));

            // Identify the dominant color (likely body color) by width
            let dominantBand = null;
            if (bands.length > 0) {
                dominantBand = bands.reduce((prev, current) => (prev.width > current.width) ? prev : current);
            }

            // Extract just the valid resistor band names for logic
            const validBands = bands
                .filter(b => {
                    // Exclude the dominant color (most pixels) as it is likely the resistor body
                    // Ensure we don't remove everything if only 1 band is found
                    if (bands.length > 1 && b === dominantBand) return false;
                    return b.colorName !== 'Beige (Body)';
                })
                .map(b => b.colorName);

            return {
                colors: colors,
                detected_bands: validBands
            };
        });

        // Aggregate results to find the most common sequence
        const detectedBands = aggregateBands(sliceResults);
        const resistorValue = calculateResistorValue(detectedBands);

        return new Response(JSON.stringify({
            slices: sliceResults,
            detected_bands: detectedBands,
            resistor_value: resistorValue
        }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}

// --- Analysis Logic ---

const RESISTOR_COLORS = [
    { name: 'Black', r: 0, g: 0, b: 0, value: 0 },
    { name: 'Brown', r: 139, g: 69, b: 19, value: 1, tolerance: 1 },
    { name: 'Red', r: 255, g: 0, b: 0, value: 2, tolerance: 2 },
    { name: 'Orange', r: 255, g: 165, b: 0, value: 3 },
    { name: 'Yellow', r: 225, g: 191, b: 5, value: 4 },
    { name: 'Green', r: 0, g: 128, b: 0, value: 5, tolerance: 0.5 },
    { name: 'Blue', r: 0, g: 0, b: 255, value: 6, tolerance: 0.25 },
    { name: 'Violet', r: 154, g: 71, b: 160, value: 7, tolerance: 0.1 },
    { name: 'Gray', r: 128, g: 128, b: 128, value: 8, tolerance: 0.05 },
    { name: 'White', r: 255, g: 255, b: 255, value: 9 },
    { name: 'Gold', r: 218, g: 165, b: 32, tolerance: 5 },
    { name: 'Silver', r: 192, g: 192, b: 192, tolerance: 10 },
    { name: 'Beige (Body)', r: 225, g: 204, b: 153 } // Adjusted Beige
];

function analyzePixels(pixels) {
    const segments = [];
    let currentSegment = null;

    // 1. Group pixels by actual color similarity (not forcing resistor colors yet)
    // Use a threshold for grouping similar colors
    const colorThreshold = 30; // RGB distance threshold for grouping

    for (const pixel of pixels) {
        if (!currentSegment) {
            currentSegment = {
                r: pixel.r,
                g: pixel.g,
                b: pixel.b,
                count: 1,
                sumR: pixel.r,
                sumG: pixel.g,
                sumB: pixel.b
            };
        } else {
            // Check if this pixel is similar to current segment
            const dist = Math.sqrt(
                Math.pow(pixel.r - currentSegment.r, 2) +
                Math.pow(pixel.g - currentSegment.g, 2) +
                Math.pow(pixel.b - currentSegment.b, 2)
            );

            if (dist < colorThreshold) {
                // Add to current segment and update average color
                currentSegment.count++;
                currentSegment.sumR += pixel.r;
                currentSegment.sumG += pixel.g;
                currentSegment.sumB += pixel.b;
                currentSegment.r = Math.round(currentSegment.sumR / currentSegment.count);
                currentSegment.g = Math.round(currentSegment.sumG / currentSegment.count);
                currentSegment.b = Math.round(currentSegment.sumB / currentSegment.count);
            } else {
                // Start new segment
                segments.push(currentSegment);
                currentSegment = {
                    r: pixel.r,
                    g: pixel.g,
                    b: pixel.b,
                    count: 1,
                    sumR: pixel.r,
                    sumG: pixel.g,
                    sumB: pixel.b
                };
            }
        }
    }
    if (currentSegment) segments.push(currentSegment);

    // 2. Filter Noise
    const width = pixels.length;
    const threshold = width * 0.015; // 1.5% threshold
    const filtered = segments.filter(s => s.count > threshold);

    // 3. Map each segment to nearest resistor color (preserving order)
    return filtered.map(s => {
        const resistorColor = findClosestResistorColor({ r: s.r, g: s.g, b: s.b });
        return {
            colorName: resistorColor.name,
            rgb: { r: s.r, g: s.g, b: s.b }, // Keep actual detected color
            width: s.count
        };
    });
}

function findClosestColor(pixel) {
    let minDist = Infinity;
    let closest = RESISTOR_COLORS[0];

    for (const color of RESISTOR_COLORS) {
        // Simple Euclidean distance
        // Could be improved with Lab color space, but RGB is fast
        const dist = Math.sqrt(
            Math.pow(pixel.r - color.r, 2) +
            Math.pow(pixel.g - color.g, 2) +
            Math.pow(pixel.b - color.b, 2)
        );
        if (dist < minDist) {
            minDist = dist;
            closest = color;
        }
    }
    return closest;
}

// Helper function to map any color to nearest resistor color
function findClosestResistorColor(pixel) {
    return findClosestColor(pixel);
}

function aggregateBands(sliceResults) {
    // Count occurrence of each band sequence
    const sequenceCounts = {};

    for (const res of sliceResults) {
        if (res.detected_bands.length >= 3) { // Minimum 3 bands for valid resistor
            const key = res.detected_bands.join(',');
            sequenceCounts[key] = (sequenceCounts[key] || 0) + 1;
        }
    }

    // Find most common sequence
    let maxCount = 0;
    let bestSequence = [];

    for (const [seq, count] of Object.entries(sequenceCounts)) {
        if (count > maxCount) {
            maxCount = count;
            bestSequence = seq.split(',');
        }
    }

    return bestSequence;
}

function calculateResistorValue(bands) {
    if (!bands || bands.length < 3) return null;

    // Map names back to color objects
    const colorObjs = bands.map(name => RESISTOR_COLORS.find(c => c.name === name));

    // Filter out undefined (shouldn't happen)
    if (colorObjs.some(c => !c)) return "Unknown Colors";

    let resistance = 0;
    let tolerance = 20; // Default 20% if no band

    // 4-band resistor (Digit, Digit, Multiplier, Tolerance)
    // 5-band resistor (Digit, Digit, Digit, Multiplier, Tolerance)

    // Heuristic: If last band is Gold/Silver, it's likely tolerance
    const lastBand = colorObjs[colorObjs.length - 1];
    const isTolerance = ['Gold', 'Silver'].includes(lastBand.name);

    if (bands.length === 3) {
        // D, D, M
        resistance = (colorObjs[0].value * 10 + colorObjs[1].value) * Math.pow(10, colorObjs[2].value);
    } else if (bands.length === 4) {
        // D, D, M, T
        resistance = (colorObjs[0].value * 10 + colorObjs[1].value) * Math.pow(10, colorObjs[2].value);
        if (lastBand.tolerance) tolerance = lastBand.tolerance;
    } else if (bands.length === 5) {
        // D, D, D, M, T
        resistance = (colorObjs[0].value * 100 + colorObjs[1].value * 10 + colorObjs[2].value) * Math.pow(10, colorObjs[3].value);
        if (lastBand.tolerance) tolerance = lastBand.tolerance;
    } else {
        return "Complex/Unknown";
    }

    return formatResistance(resistance) + ` ±${tolerance}%`;
}

function formatResistance(ohms) {
    if (ohms >= 1000000) {
        return (ohms / 1000000).toFixed(1).replace(/\.0$/, '') + 'MΩ';
    }
    if (ohms >= 1000) {
        return (ohms / 1000).toFixed(1).replace(/\.0$/, '') + 'kΩ';
    }
    return ohms + 'Ω';
}

function rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
}

// --- General Color Extraction (K-means) ---

async function handleExtractColors(request) {
    try {
        const { pixels, colorCount } = await request.json();

        if (!pixels || !Array.isArray(pixels)) {
            return new Response('Invalid data', { status: 400 });
        }

        const k = colorCount || 5;
        const dominantColors = extractDominantColors(pixels, k);

        return new Response(JSON.stringify({
            success: true,
            colors: dominantColors,
            totalPixels: pixels.length
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}

function extractDominantColors(pixels, k) {
    // Simple K-means clustering for color extraction
    const maxIterations = 10;

    // Initialize centroids randomly
    let centroids = [];
    const step = Math.floor(pixels.length / k);
    for (let i = 0; i < k; i++) {
        const idx = Math.min(i * step, pixels.length - 1);
        centroids.push({ ...pixels[idx] });
    }

    // K-means iterations
    for (let iter = 0; iter < maxIterations; iter++) {
        // Assign pixels to nearest centroid
        const clusters = Array.from({ length: k }, () => []);

        for (const pixel of pixels) {
            let minDist = Infinity;
            let closestIdx = 0;

            for (let i = 0; i < k; i++) {
                const dist = colorDistance(pixel, centroids[i]);
                if (dist < minDist) {
                    minDist = dist;
                    closestIdx = i;
                }
            }

            clusters[closestIdx].push(pixel);
        }

        // Update centroids
        let changed = false;
        for (let i = 0; i < k; i++) {
            if (clusters[i].length === 0) continue;

            const newCentroid = {
                r: Math.round(clusters[i].reduce((sum, p) => sum + p.r, 0) / clusters[i].length),
                g: Math.round(clusters[i].reduce((sum, p) => sum + p.g, 0) / clusters[i].length),
                b: Math.round(clusters[i].reduce((sum, p) => sum + p.b, 0) / clusters[i].length)
            };

            if (colorDistance(newCentroid, centroids[i]) > 1) {
                changed = true;
            }
            centroids[i] = newCentroid;
        }

        if (!changed) break;
    }

    // Count pixels per cluster
    const clusters = Array.from({ length: k }, () => []);
    for (const pixel of pixels) {
        let minDist = Infinity;
        let closestIdx = 0;

        for (let i = 0; i < k; i++) {
            const dist = colorDistance(pixel, centroids[i]);
            if (dist < minDist) {
                minDist = dist;
                closestIdx = i;
            }
        }

        clusters[closestIdx].push(pixel);
    }

    // Return colors sorted by frequency
    return centroids
        .map((color, i) => ({
            r: color.r,
            g: color.g,
            b: color.b,
            count: clusters[i].length,
            hex: rgbToHex(color.r, color.g, color.b)
        }))
        .filter(c => c.count > 0)
        .sort((a, b) => b.count - a.count);
}

function colorDistance(c1, c2) {
    return Math.sqrt(
        Math.pow(c1.r - c2.r, 2) +
        Math.pow(c1.g - c2.g, 2) +
        Math.pow(c1.b - c2.b, 2)
    );
}

