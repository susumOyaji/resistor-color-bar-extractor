const fs = require('fs');
const path = require('path');

// Simple PNG reader - extract raw pixel data
function readPngPixels(filePath) {
    // Use a simple approach: load image via canvas-like simulation
    // For now, we'll use a workaround with jimp or a simple raw read
    // Since we don't have canvas here, we'll create a mock pixel array
    
    // For testing, create synthetic resistor-like data:
    // Brown band, Gray band, Brown band (4-band resistor pattern)
    const mockPixels = [];
    const width = 100;
    const height = 20;
    
    // Brown (x: 0-30)
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < 30; x++) {
            mockPixels.push({ r: 93, g: 79, b: 67 }); // Brown
        }
    }
    
    // Gray (x: 30-50)
    for (let y = 0; y < height; y++) {
        for (let x = 30; x < 50; x++) {
            mockPixels.push({ r: 128, g: 128, b: 128 }); // Gray
        }
    }
    
    // Brown (x: 50-70)
    for (let y = 0; y < height; y++) {
        for (let x = 50; x < 70; x++) {
            mockPixels.push({ r: 93, g: 79, b: 67 }); // Brown
        }
    }
    
    // Gray (x: 70-100)
    for (let y = 0; y < height; y++) {
        for (let x = 70; x < 100; x++) {
            mockPixels.push({ r: 128, g: 128, b: 128 }); // Gray
        }
    }
    
    return { pixels: mockPixels, width, height };
}

// Test the API
async function testDetectEdges() {
    const { pixels, width, height } = readPngPixels('2025-12.png');
    
    const payload = {
        pixels: pixels,
        width: width,
        height: height,
        customColors: []
    };
    
    console.log(`Testing /api/detect-edges with ${pixels.length} pixels (${width}x${height})`);
    console.log(`Payload size: ${JSON.stringify(payload).length} bytes`);
    
    try {
        const response = await fetch('http://127.0.0.1:8787/api/detect-edges', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            console.error(`HTTP ${response.status}: ${response.statusText}`);
            const text = await response.text();
            console.error('Response:', text);
            return;
        }
        
        const data = await response.json();
        console.log('\n=== RESPONSE ===');
        console.log(JSON.stringify(data, null, 2));
        
        console.log('\n=== ANALYSIS ===');
        console.log(`Total edges detected: ${data.edges ? data.edges.length : 0}`);
        console.log(`Bands extracted: ${data.bands ? data.bands.length : 0}`);
        console.log(`Final detected bands: [${data.detected_bands ? data.detected_bands.join(', ') : 'none'}]`);
        console.log(`Resistor value: ${data.resistor_value || 'Failed'}`);
        
        if (data.bands) {
            console.log('\n=== BAND DETAILS ===');
            data.bands.forEach((b, i) => {
                console.log(`Band ${i}: ${b.colorName} (RGB: ${b.rgb.r}, ${b.rgb.g}, ${b.rgb.b})`);
            });
        }
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

testDetectEdges();
