
// Logic copied from src/index.js to verify color behavior

const RESISTOR_COLORS = [
    { name: 'Black', r: 0, g: 0, b: 0, value: 0, multiplier: 1 },
    { name: 'Brown', r: 165, g: 42, b: 42, value: 1, multiplier: 10, tolerance: 1 },
    { name: 'Red', r: 255, g: 0, b: 0, value: 2, multiplier: 100, tolerance: 2 },
    { name: 'Orange', r: 255, g: 165, b: 0, value: 3, multiplier: 1000 },
    { name: 'Yellow', r: 255, g: 255, b: 0, value: 4, multiplier: 10000 },
    { name: 'Green', r: 0, g: 128, b: 0, value: 5, multiplier: 100000, tolerance: 0.5 },
    { name: 'Blue', r: 0, g: 0, b: 255, value: 6, multiplier: 1000000, tolerance: 0.25 },
    { name: 'Violet', r: 238, g: 130, b: 238, value: 7, multiplier: 10000000, tolerance: 0.1 },
    { name: 'Gray', r: 128, g: 128, b: 128, value: 8, multiplier: 100000000, tolerance: 0.05 },
    { name: 'White', r: 255, g: 255, b: 255, value: 9, multiplier: 1000000000 },
    { name: 'Gold', r: 255, g: 215, b: 0, multiplier: 0.1, tolerance: 5 },
    { name: 'Silver', r: 192, g: 192, b: 192, multiplier: 0.01, tolerance: 10 },
    { name: 'Beige (Body)', r: 245, g: 245, b: 220 }
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

function findClosestColor(pixel) {
    let minDist = Infinity;
    let closest = RESISTOR_COLORS[0];

    for (const color of RESISTOR_COLORS) {
        const dist = colorDistance(pixel, color);
        if (dist < minDist) {
            minDist = dist;
            closest = color;
        }
    }
    return { closest, dist: minDist };
}

// Colors to compare
const color1 = { r: 0x96, g: 0x69, b: 0x3C }; // #96693C
const color2 = { r: 0xA1, g: 0x75, b: 0x3E }; // #A1753E

// 1. Distance between the two colors
const dist = colorDistance(color1, color2);

// 2. Classification of each
const result1 = findClosestColor(color1);
const result2 = findClosestColor(color2);

console.log(`Color 1 (#96693C): Detected as ${result1.closest.name} (Dist: ${result1.dist.toFixed(2)})`);
console.log(`Color 2 (#A1753E): Detected as ${result2.closest.name} (Dist: ${result2.dist.toFixed(2)})`);
console.log(`Distance between Color 1 and Color 2: ${dist.toFixed(2)}`);

if (result1.closest.name === result2.closest.name) {
    console.log("-> The system considers them the SAME resistor color category.");
} else {
    console.log("-> The system considers them DIFFERENT resistor color categories.");
}
