
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
    { name: 'Gold (Detected)', r: 187, g: 171, b: 123, tolerance: 5 }, // New entry
    { name: 'Silver', r: 192, g: 192, b: 192, tolerance: 10 },
    { name: 'Beige (Body)', r: 200, g: 180, b: 150 } // More distinct beige
];

const targetPixel = { r: 187, g: 171, b: 123 }; // From the last detected band in Resistor-27-Ohm-5.jpg

console.log(`Distances from target RGB(${targetPixel.r},${targetPixel.g},${targetPixel.b}) to tolerance colors:`);

let minDist = Infinity;
let closestColor = null;

for (const color of RESISTOR_COLORS) {
    if (color.tolerance !== undefined) { // Filter for colors that have a tolerance property
        const dist = colorDistance(targetPixel, color);
        console.log(`- ${color.name}: ${dist.toFixed(2)}`);
        if (dist < minDist) {
            minDist = dist;
            closestColor = color;
        }
    }
}

console.log(`\nClosest tolerance color: ${closestColor.name} (Distance: ${minDist.toFixed(2)})`);
