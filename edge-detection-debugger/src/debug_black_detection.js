
// Debug script to simulate extractBands and log detailed transitions
const RESISTOR_COLORS = [
    { name: 'Black', r: 0, g: 0, b: 0 },
    { name: 'Brown', r: 165, g: 42, b: 42 },
    { name: 'Red', r: 255, g: 0, b: 0 },
    { name: 'Orange', r: 255, g: 165, b: 0 },
    { name: 'Yellow', r: 255, g: 255, b: 0 },
    { name: 'Green', r: 0, g: 128, b: 0 },
    { name: 'Blue', r: 0, g: 0, b: 255 },
    { name: 'Violet', r: 238, g: 130, b: 238 },
    { name: 'Gray', r: 128, g: 128, b: 128 },
    { name: 'White', r: 255, g: 255, b: 255 },
    { name: 'Gold', r: 255, g: 215, b: 0 },
    { name: 'Silver', r: 192, g: 192, b: 192 },
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

// 模拟データ: ボディ(Beige/Blue) -> 黒(Black) -> ボディ(Beige/Blue) の遷移をシミュレート
// パターン1: 青色抵抗器のボディ（暗い青）から黒への遷移
const blueBody = { r: 60, g: 100, b: 180 }; // くすんだ青
const blackBand = { r: 20, g: 20, b: 30 };  // 少し明るい黒（現実的な値）

const dist = colorDistance(blueBody, blackBand);
console.log(`Body(Blue) vs Band(Black) Distance: ${dist.toFixed(2)}`);

// パターン2: ベージュ抵抗器のボディから黒への遷移
const beigeBody = { r: 220, g: 200, b: 180 };
const dist2 = colorDistance(beigeBody, blackBand);
console.log(`Body(Beige) vs Band(Black) Distance: ${dist2.toFixed(2)}`);

if (dist < 10) {
    console.log("CRITICAL: Dark body and Black band are too close! Threshold (10) will ignore this edge.");
} else {
    console.log("Edge detection should work (Distance > 10).");
}
