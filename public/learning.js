
// Learning Feature Module for Resistor Color Bar Extractor

document.addEventListener('DOMContentLoaded', () => {
    console.log('Learning module loaded');

    // 1. Hook fetch to capture analysis results without modifying app.js
    const originalFetch = window.fetch;
    window.fetch = async function (...args) {

        // Intercept request to inject custom colors (Learning -> Server)
        const isExtractColors = args[0] && args[0].toString().includes('/api/extract-colors') && args[1] && args[1].method === 'POST';
        const isEdgeDetection = args[0] && args[0].toString().includes('/api/detect-edges') && args[1] && args[1].method === 'POST';

        if (isExtractColors || isEdgeDetection) {
            try {
                const body = JSON.parse(args[1].body);
                // Load custom definitions
                const savedDefs = localStorage.getItem('resistor_custom_colors');
                if (savedDefs) {
                    const defsMap = JSON.parse(savedDefs);

                    // Convert Map to Array for Server logic (findClosestColor expects array)
                    // We only send items that have full RGB data
                    const customColorsArray = [];
                    for (const key in defsMap) {
                        const val = defsMap[key];
                        if (val && typeof val === 'object' && val.r !== undefined) {
                            customColorsArray.push(val);
                        }
                    }

                    if (customColorsArray.length > 0) {
                        body.customColors = customColorsArray;
                        // Determine if client needs global sync (optional, mainly for display override)
                        // window.customColorDefinitions = defsMap; 

                        args[1].body = JSON.stringify(body);
                        console.log(`Injected ${customColorsArray.length} custom color definitions for server learning.`);
                    }
                }
            } catch (e) {
                console.error('Error injecting custom colors', e);
            }
        }

        // Execute fetch
        const response = await originalFetch.apply(this, args);

        // Intercept response to capture dominant colors (Server -> Learning)
        if (args[0] && args[0].toString().includes('/api/extract-colors')) {
            const clone = response.clone();
            clone.json().then(data => {
                if (data && data.colors) {
                    window.g_dominantColors = data.colors;
                    console.log('Captured dominant colors for learning:', window.g_dominantColors);
                }
            }).catch(e => { /* Ignore json parse errors */ });
        }

        return response;
    };

    // 2. UI Event Listeners
    const learningModeToggle = document.getElementById('learning-mode-toggle');
    const learnBtn = document.getElementById('learn-from-value-btn');

    if (learningModeToggle) {
        learningModeToggle.addEventListener('change', (e) => {
            const isLearningMode = e.target.checked;
            const learningInputArea = document.getElementById('learning-input-area');
            if (learningInputArea) {
                learningInputArea.style.display = isLearningMode ? 'block' : 'none';
            }
        });
    }

    if (learnBtn) {
        learnBtn.addEventListener('click', () => {
            const inputEl = document.getElementById('correct-resistance-input');
            const statusEl = document.getElementById('learning-status');
            const valStr = inputEl.value.trim();

            if (!valStr) {
                alert('Please enter a resistance value.');
                return;
            }

            if (!window.g_dominantColors || window.g_dominantColors.length === 0) {
                alert('Please run analysis first.');
                return;
            }

            const expectedColors = calculateColorsFromResistance(valStr);
            if (!expectedColors) {
                alert('Invalid resistance format. Try "4.7k", "100", etc.');
                return;
            }

            let learnedCount = 0;
            // Load existing definitions
            let definitions = {};
            try {
                definitions = JSON.parse(localStorage.getItem('resistor_custom_colors') || '{}');
            } catch (e) { }

            // Limit to min length
            const limit = Math.min(window.g_dominantColors.length, expectedColors.length);

            for (let i = 0; i < limit; i++) {
                const domColor = window.g_dominantColors[i];
                const targetColorName = expectedColors[i];

                // Save full color object for distance calculation on server
                if (domColor.hex) {
                    definitions[domColor.hex] = {
                        name: targetColorName,
                        r: domColor.r,
                        g: domColor.g,
                        b: domColor.b,
                        hex: domColor.hex,
                        learnedAt: new Date().toISOString()
                    };
                    learnedCount++;
                }
            }

            if (learnedCount > 0) {
                localStorage.setItem('resistor_custom_colors', JSON.stringify(definitions));

                statusEl.textContent = `Learned sequence: ${expectedColors.join(' → ')}`;

                // Toast
                const toast = document.getElementById('toast');
                if (toast) {
                    toast.textContent = `Learned ${learnedCount} colors! Please Re-run Analysis to update results.`;
                    toast.className = "toast show";
                    setTimeout(() => { toast.className = toast.className.replace("show", ""); }, 4000);
                }
            }
        });
    }
});

function calculateColorsFromResistance(resistanceStr) {
    let s = resistanceStr.toLowerCase().replace(/ω|ohm|\s/g, '');
    let multiplier = 1;
    if (s.endsWith('k')) { multiplier = 1000; s = s.slice(0, -1); }
    else if (s.endsWith('m')) { multiplier = 1000000; s = s.slice(0, -1); }

    let val = parseFloat(s) * multiplier;
    if (isNaN(val)) return null;

    let exponent = 0;
    if (val === 0) { exponent = 0; }
    else {
        // Normalize for 2 digit precision
        // E24 values: 10, 11, 12 ... 91
        // We want val to be in [10, 99] or similar logic

        // Handle subtle floating point issues with epsilon?
        // 4700 -> 47 * 10^2
        while (val >= 100) { val /= 10; exponent++; }
        while (val < 10 && val > 0.001) { val *= 10; exponent--; }
    }
    val = Math.round(val);

    let d1 = Math.floor(val / 10);
    let d2 = val % 10;

    const colors = ["Black", "Brown", "Red", "Orange", "Yellow", "Green", "Blue", "Violet", "Gray", "White"];
    const multipliers = {
        "-2": "Silver", "-1": "Gold", "0": "Black", "1": "Brown", "2": "Red",
        "3": "Orange", "4": "Yellow", "5": "Green", "6": "Blue", "7": "Violet",
        "8": "Gray", "9": "White"
    };

    let band1 = colors[d1];
    let band2 = colors[d2];
    let mult = multipliers[exponent.toString()];

    if (!band1 || !band2 || !mult) return null;
    return [band1, band2, mult, "Gold"];
}

// Edge Detection Learning Function
window.learnFromEdgeDetection = function (resistanceStr, statusEl) {
    console.log('Learning from edge detection:', resistanceStr);

    // Calculate expected colors from resistance value
    const expectedColors = calculateColorsFromResistance(resistanceStr);
    if (!expectedColors) {
        alert('Invalid resistance format. Try "12k", "270", etc.');
        return;
    }

    // Get detected bands from edge detection result
    const edgeVisualization = document.getElementById('edge-visualization');
    if (!edgeVisualization) {
        alert('No edge detection result found.');
        return;
    }

    // Extract detected colors from visualization
    const detectedBands = [];
    const bandChips = edgeVisualization.querySelectorAll('.band-chip');

    bandChips.forEach(chip => {
        const colorDiv = chip.querySelector('div[style*="background"]');
        if (colorDiv) {
            const bgColor = colorDiv.style.background;
            // Extract RGB from background style
            const rgbMatch = bgColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
            if (rgbMatch) {
                const r = parseInt(rgbMatch[1]);
                const g = parseInt(rgbMatch[2]);
                const b = parseInt(rgbMatch[3]);
                const hex = '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();

                detectedBands.push({ r, g, b, hex });
            }
        }
    });

    if (detectedBands.length === 0) {
        alert('No detected bands found in edge detection result.');
        return;
    }

    // Learn color mappings
    let definitions = {};
    try {
        definitions = JSON.parse(localStorage.getItem('resistor_custom_colors') || '{}');
    } catch (e) { }

    const limit = Math.min(detectedBands.length, expectedColors.length);
    let learnedCount = 0;

    for (let i = 0; i < limit; i++) {
        const detectedColor = detectedBands[i];
        const targetColorName = expectedColors[i];

        definitions[detectedColor.hex] = {
            name: targetColorName,
            r: detectedColor.r,
            g: detectedColor.g,
            b: detectedColor.b,
            hex: detectedColor.hex,
            learnedAt: new Date().toISOString(),
            source: 'edge-detection'
        };
        learnedCount++;
    }

    if (learnedCount > 0) {
        localStorage.setItem('resistor_custom_colors', JSON.stringify(definitions));

        if (statusEl) {
            statusEl.textContent = `Learned sequence: ${expectedColors.join(' → ')}`;
        }

        // Show Learning Result Modal
        showLearningResultModal(detectedBands, expectedColors, limit);

        console.log(`Learned ${learnedCount} color mappings from edge detection`);
    }
};

function showLearningResultModal(detectedBands, expectedColors, count) {
    // Create modal element if not exists
    let modal = document.getElementById('learning-result-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'learning-result-modal';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.8); z-index: 2000;
            display: flex; justify-content: center; align-items: center;
        `;
        document.body.appendChild(modal);
    }

    let contentHtml = `
        <div style="background: #1e1e2e; padding: 2rem; border-radius: 12px; border: 1px solid var(--glass-border); max-width: 500px; width: 90%; color: white;">
            <h3 style="color: #4ade80; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
                <i class="fa-solid fa-check-circle"></i> Learning Successful!
            </h3>
            <p style="margin-bottom: 1rem; color: #cbd5e1;">The following color definitions have been saved:</p>
            
            <div style="background: rgba(0,0,0,0.3); border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem;">
    `;

    for (let i = 0; i < count; i++) {
        const band = detectedBands[i];
        const learnedName = expectedColors[i];

        contentHtml += `
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.8rem; padding-bottom: 0.8rem; border-bottom: 1px solid rgba(255,255,255,0.1);">
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <div style="width: 32px; height: 32px; background: ${band.hex}; border-radius: 6px; border: 1px solid rgba(255,255,255,0.5);"></div>
                    <div style="display: flex; flex-direction: column;">
                        <span style="font-size: 0.8rem; opacity: 0.7;">Detected Color</span>
                        <span style="font-family: monospace;">${band.hex}</span>
                    </div>
                </div>
                
                <i class="fa-solid fa-arrow-right" style="color: #64748b;"></i>
                
                <div style="text-align: right;">
                    <span style="font-size: 0.8rem; opacity: 0.7;">Learned As</span>
                    <div style="font-weight: bold; color: #fbbf24; font-size: 1.1rem;">${learnedName}</div>
                </div>
            </div>
        `;
    }

    contentHtml += `
            </div>
            
            <p style="margin-bottom: 1.5rem; font-size: 0.9rem; color: #94a3b8;">
                <i class="fa-solid fa-circle-info"></i> Please click "エッジ検出" again to apply these new definitions.
            </p>
            
            <div style="text-align: right;">
                <button onclick="document.getElementById('learning-result-modal').remove()" 
                    style="background: #4ade80; color: #020617; border: none; padding: 0.6rem 1.5rem; border-radius: 6px; font-weight: bold; cursor: pointer;">
                    OK
                </button>
            </div>
        </div>
    `;

    modal.innerHTML = contentHtml;
}

