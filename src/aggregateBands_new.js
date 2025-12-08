// New position-based aggregation function
function aggregateBands(sliceResults) {
    // For each position (left to right), find the most common color across all slices
    // This is more robust than looking for exact sequence matches

    // First, find the maximum number of bands detected in any slice
    const maxBands = Math.max(...sliceResults.map(res => res.detected_bands.length));

    console.log(`[Server] Max bands in any slice: ${maxBands}`);

    if (maxBands === 0) {
        console.log(`[Server] No bands detected in any slice`);
        return [];
    }

    // For each position, count which colors appear most frequently
    const positionCounts = [];
    for (let pos = 0; pos < maxBands; pos++) {
        const colorCounts = {};

        for (const res of sliceResults) {
            if (pos < res.detected_bands.length) {
                const color = res.detected_bands[pos];
                if (color && color !== 'Beige (Body)') {
                    colorCounts[color] = (colorCounts[color] || 0) + 1;
                }
            }
        }

        positionCounts.push(colorCounts);
    }

    // Select the most common color at each position
    const result = [];
    for (let pos = 0; pos < positionCounts.length; pos++) {
        const counts = positionCounts[pos];
        const entries = Object.entries(counts);

        if (entries.length === 0) continue;

        // Find the color with maximum count
        const [mostCommonColor, count] = entries.reduce((a, b) => a[1] > b[1] ? a : b);

        console.log(`[Server] Position ${pos}: ${mostCommonColor} (${count}/${sliceResults.length} slices)`);
        result.push(mostCommonColor);
    }

    console.log(`[Server] Final aggregated sequence: [${result.join(', ')}]`);
    return result;
}
