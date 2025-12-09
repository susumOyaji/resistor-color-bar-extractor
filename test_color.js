
const RESISTOR_COLORS = [
    { name: 'Black', r: 0, g: 0, b: 0, value: 0 },
    { name: 'Brown', r: 139, g: 69, b: 19, value: 1, tolerance: 1 },
    { name: 'Brown', r: 93, g: 79, b: 67, value: 1, tolerance: 1 }, // #5D4F43
    { name: 'Brown', r: 67, g: 50, b: 39, value: 1, tolerance: 1 }, // #433227
    { name: 'Red', r: 255, g: 0, b: 0, value: 2, tolerance: 2 },
    { name: 'Orange', r: 255, g: 165, b: 0, value: 3 },
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

    return { l: (116 * y) - 16, a: 500 * (x - y), b: 200 * (y - z) };
}

function colorDistance(c1, c2) {
    const lab1 = rgbToLab(c1.r, c1.g, c1.b);
    const lab2 = rgbToLab(c2.r, c2.g, c2.b);
    return Math.sqrt(Math.pow(lab1.l - lab2.l, 2) + Math.pow(lab1.a - lab2.a, 2) + Math.pow(lab1.b - lab2.b, 2));
}

const target = { r: 91, g: 39, b: 10 }; // #5B270A

console.log(`Target Color: R${target.r} G${target.g} B${target.b} (#5B270A)`);
console.log('--- Distances ---');

RESISTOR_COLORS.forEach(c => {
    const dist = colorDistance(target, c);
    console.log(`${c.name.padEnd(12)} (R${c.r} G${c.g} B${c.b}): ${dist.toFixed(2)}`);
});
