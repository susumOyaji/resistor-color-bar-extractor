const fs = require('fs');
const path = require('path');

// Simple pixel color analysis for PNG
// We'll use a quick Node approach by analyzing the file header to understand dimensions,
// or work with simulated data based on resistor color patterns.

// For now, let's create a test to understand GOLD detection issues
// GOLD: r: 218, g: 165, b: 32

const RESISTOR_COLORS = [
    { name: 'Black', r: 0, g: 0, b: 0, value: 0 },
    { name: 'Brown', r: 139, g: 69, b: 19, value: 1, tolerance: 1 },
    { name: 'Brown', r: 93, g: 79, b: 67, value: 1, tolerance: 1 },
    { name: 'Brown', r: 67, g: 50, b: 39, value: 1, tolerance: 1 },
    { name: 'Red', r: 255, g: 0, b: 0, value: 2, tolerance: 2 },
    { name: 'Orange', r: 255, g: 165, b: 0, value: 3 },
    { name: 'Yellow', r: 225, g: 191, b: 5, value: 4 },
    { name: 'Green', r: 0, g: 128, b: 0, value: 5, tolerance: 0.5 },
    { name: 'Blue', r: 0, g: 0, b: 255, value: 6, tolerance: 0.25 },
    { name: 'Violet', r: 154, g: 71, b: 160, value: 7, tolerance: 0.1 },
    { name: 'Gray', r: 128, g: 128, b: 128, value: 8, tolerance: 0.05 },
    { name: 'White', r: 255, g: 255, b: 255, value: 9 },
    { name: 'Gold', r: 218, g: 165, b: 32, value: -1, tolerance: 5 },
    { name: 'Silver', r: 192, g: 192, b: 192, value: -2, tolerance: 10 },
    { name: 'Beige (Body)', r: 225, g: 204, b: 153 }
];

function rgbToLab(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
    g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
    b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

    let x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) * 100;
    let y = (r * 0.2126729 + g * 0.7151522 + b * 0.0721750) * 100;
    let z = (r * 0.0193339 + g * 0.1191920 + b * 0.9503041) * 100;

    x /= 95.047; y /= 100.000; z /= 108.883;
    x = x > 0.008856 ? Math.pow(x, 1 / 3) : (7.787 * x) + 16 / 116;
    y = y > 0.008856 ? Math.pow(y, 1 / 3) : (7.787 * y) + 16 / 116;
    z = z > 0.008856 ? Math.pow(z, 1 / 3) : (7.787 * z) + 16 / 116;

    return {
        l: (116 * y) - 16,
        a: 500 * (x - y),
        b: 200 * (y - z)
    };
}

function colorDistance(c1, c2) {
    const lab1 = rgbToLab(c1.r, c1.g, c1.b);
    const lab2 = rgbToLab(c2.r, c2.g, c2.b);
    return Math.sqrt(
        Math.pow(lab1.l - lab2.l, 2) +
        Math.pow(lab1.a - lab2.a, 2) +
        Math.pow(lab1.b - lab2.b, 2)
    );
}

// Test samples that might appear as GOLD in images
const testSamples = [
    { name: 'Pure GOLD', r: 218, g: 165, b: 32 },
    { name: 'Bright Yellow-Gold', r: 255, g: 200, b: 0 },
    { name: 'Dark Gold', r: 180, g: 140, b: 20 },
    { name: 'Orange-ish Gold', r: 240, g: 160, b: 20 },
    { name: 'Muted Gold', r: 200, g: 150, b: 40 },
    { name: 'Pixel from 2025-12.png (assumed yellowish)', r: 255, g: 212, b: 0 }
];

console.log('=== GOLD DETECTION ANALYSIS ===\n');
console.log('Testing potential GOLD pixel colors against all resistor colors:\n');

testSamples.forEach(sample => {
    console.log(`\n--- ${sample.name} (R${sample.r}, G${sample.g}, B${sample.b}) ---`);
    
    const distances = RESISTOR_COLORS.map(color => ({
        name: color.name,
        distance: colorDistance(sample, color)
    })).sort((a, b) => a.distance - b.distance);
    
    console.log('Top 5 closest colors:');
    distances.slice(0, 5).forEach((d, i) => {
        console.log(`  ${i + 1}. ${d.name.padEnd(15)} - Distance: ${d.distance.toFixed(2)}`);
    });
    
    const goldColor = distances.find(d => d.name === 'Gold');
    if (goldColor) {
        const goldRank = distances.findIndex(d => d.name === 'Gold') + 1;
        console.log(`  ⭐ GOLD rank: ${goldRank}/${distances.length} (distance: ${goldColor.distance.toFixed(2)})`);
    }
});

console.log('\n\n=== WHY GOLD MIGHT NOT BE DETECTED ===');
console.log(`
1. GOLD (218, 165, 32) is close to:
   - ORANGE (255, 165, 0) - shares same green channel
   - YELLOW (225, 191, 5) - similar overall hue
   - Bright warm colors can be ambiguous

2. Image artifacts:
   - Lighting/exposure variation makes pixel RGB shift
   - Camera white balance affects color reproduction
   - JPEG compression artifacts
   - Anti-aliasing on band edges mixes colors

3. Detection parameters:
   - K-means clustering might group GOLD with YELLOW/ORANGE
   - Edge detection threshold might miss GOLD regions if too narrow
   - Support ratio (if filtering small regions) might exclude sparse GOLD bands

4. Current configuration:
   - dominanceThreshold = 0.5 (50%)
   - noiseThreshold = pixels.length * 0.015 (1.5%)
   - Small or degraded GOLD bands < 1.5% get filtered out

Suggestions to improve GOLD detection:
- Lower noise threshold from 1.5% to 1% or 0.5%
- Add sample GOLD calibration pixels to customColors
- Increase Lab color distance tolerance for GOLD specifically
- Check if GOLD is being detected but filtered as "noise"
`);
