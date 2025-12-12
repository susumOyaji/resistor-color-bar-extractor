
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

const darkColors = [
    { r: 0, g: 0, b: 0 },
    { r: 10, g: 10, b: 10 },
    { r: 20, g: 20, b: 20 },
    { r: 30, g: 30, b: 30 }, // Very dark gray
    { r: 40, g: 40, b: 40 }
];

console.log("Checking L values for dark RGB colors:");
darkColors.forEach(c => {
    const lab = rgbToLab(c.r, c.g, c.b);
    console.log(`RGB(${c.r}, ${c.g}, ${c.b}) -> L: ${lab.l.toFixed(2)}`);
    if (lab.l < 10) console.log("  -> FILTERED OUT by current l < 10 rule");
    else console.log("  -> PASSED");
});
