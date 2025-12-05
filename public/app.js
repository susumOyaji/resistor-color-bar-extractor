document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded fired');

    // Elements
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const analysisSection = document.getElementById('analysis-section');
    const imagePreview = document.getElementById('image-preview');
    const paletteGrid = document.getElementById('palette-grid');
    const colorCountSlider = document.getElementById('color-count-slider');
    const colorCountValue = document.getElementById('color-count-value');
    const toast = document.getElementById('toast');
    const changeImageBtn = document.getElementById('change-image-btn');
    const resetCropBtn = document.getElementById('reset-crop-btn');
    const scanSlicesSelect = document.getElementById('scan-slices-select');

    console.log('Elements:', { dropZone, fileInput, analysisSection, imagePreview });

    // State
    let currentImage = null;
    let cropper = null;
    const analyzeBtn = document.getElementById('analyze-btn');

    console.log('analyzeBtn:', analyzeBtn);

    if (!analyzeBtn) {
        console.error('analyzeBtn not found!');
    }

    // Event Listeners for Drag & Drop
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, unhighlight, false);
    });

    function highlight() {
        dropZone.classList.add('drag-over');
    }

    function unhighlight() {
        dropZone.classList.remove('drag-over');
    }

    dropZone.addEventListener('drop', handleDrop, false);
    dropZone.addEventListener('click', (e) => {
        console.log('dropZone clicked!');
        console.log('Click target:', e.target);
        console.log('fileInput:', fileInput);
        fileInput.click();
    }, true); // Use capture phase to catch event before children
    fileInput.addEventListener('change', handleFiles);

    console.log('Event listeners registered');

    // Slider Event
    colorCountSlider.addEventListener('input', (e) => {
        const count = e.target.value;
        colorCountValue.textContent = count;
    });

    // Analyze button event
    if (analyzeBtn) {
        analyzeBtn.addEventListener('click', () => {
            console.log('Analyze button clicked');
            if (currentImage) {
                performAnalysis();
            } else {
                console.error('No image loaded');
            }
        });
    } else {
        console.warn('Analyze button not found, event listener not registered');
    }

    // Scan button event
    const scanBtn = document.getElementById('scan-btn');
    if (scanBtn) {
        scanBtn.addEventListener('click', () => {
            console.log('Scan button clicked');
            if (currentImage) {
                performScan();
            } else {
                console.error('No image loaded');
            }
        });
    }

    // Change Image Button
    if (changeImageBtn) {
        changeImageBtn.addEventListener('click', () => {
            resetApp();
        });
    }

    // Reset Crop Button
    if (resetCropBtn) {
        resetCropBtn.addEventListener('click', () => {
            if (cropper) {
                cropper.reset();
            }
        });
    }

    function resetApp() {
        currentImage = null;
        if (cropper) {
            cropper.destroy();
            cropper = null;
        }
        imagePreview.src = '';
        fileInput.value = ''; // Reset file input

        analysisSection.classList.add('hidden');
        dropZone.classList.remove('hidden');
        dropZone.style.display = 'block'; // Ensure it's visible

        // Clear results
        paletteGrid.innerHTML = '';
        const colorBar = document.getElementById('color-bar');
        if (colorBar) colorBar.innerHTML = '';
        if (colorBar) colorBar.innerHTML = '';
        const scanChart = document.getElementById('scan-chart');
        if (scanChart) scanChart.innerHTML = '';
        const scanResult = document.getElementById('scan-result');
        if (scanResult) scanResult.style.display = 'none';
        const harmoniesGrid = document.getElementById('harmonies-grid');
        if (harmoniesGrid) harmoniesGrid.innerHTML = '';
    }


    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles({ target: { files: files } });
    }

    function handleFiles(e) {
        console.log('handleFiles called', e);
        const files = e.target.files;
        console.log('Files:', files);
        if (files.length > 0) {
            const file = files[0];
            console.log('File:', file);
            if (file.type.startsWith('image/')) {
                console.log('Valid image file detected');
                const reader = new FileReader();
                reader.onload = (e) => {
                    console.log('FileReader onload');
                    const img = new Image();
                    img.onload = () => {
                        console.log('Image onload');
                        currentImage = img;
                        imagePreview.src = img.src;

                        // Hide drop zone and show analysis section
                        dropZone.classList.add('hidden');
                        dropZone.style.display = 'none';
                        analysisSection.classList.remove('hidden');

                        // Initialize Cropper
                        if (cropper) {
                            cropper.destroy();
                        }
                        cropper = new Cropper(imagePreview, {
                            aspectRatio: NaN,
                            viewMode: 1,
                            autoCropArea: 1,
                            responsive: true,
                            background: false
                        });

                        // Scroll to analysis section smoothly
                        setTimeout(() => {
                            analysisSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }, 100);
                    };
                    img.src = e.target.result;
                };
                reader.readAsDataURL(file);
            } else {
                showToast('Please upload a valid image file.');
            }
        }
    }

    // Perform analysis with crop data
    async function performAnalysis() {
        console.log('performAnalysis called');
        if (!cropper) {
            console.error('Cropper not initialized!');
            return;
        }

        // Get cropped canvas (downsampled for performance)
        const canvas = cropper.getCroppedCanvas({ maxWidth: 150, maxHeight: 150 });
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = [];

        for (let i = 0; i < imageData.data.length; i += 4) {
            pixels.push({
                r: imageData.data[i],
                g: imageData.data[i + 1],
                b: imageData.data[i + 2]
            });
        }

        console.log(`Sending ${pixels.length} pixels to server...`);

        try {
            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pixels })
            });

            if (!response.ok) {
                throw new Error('Server analysis failed');
            }

            const data = await response.json();
            console.log('Server response:', data);

            // The worker returns 'bands' which are the dominant colors in this context
            // We map them to the format expected by renderPalette
            const dominantColors = data.bands.map(b => ({
                r: b.rgb.r,
                g: b.rgb.g,
                b: b.rgb.b,
                count: b.width, // Using width as count proxy
                hex: rgbToHex(b.rgb.r, b.rgb.g, b.rgb.b)
            }));

            // Sort by count (width) descending
            dominantColors.sort((a, b) => b.count - a.count);

            const totalPixels = dominantColors.reduce((sum, c) => sum + c.count, 0);

            renderPalette(dominantColors, totalPixels);
            renderColorBar(dominantColors, totalPixels);

            if (dominantColors.length > 0) {
                generateHarmonies(dominantColors[0]);
            }

        } catch (error) {
            console.error('Error analyzing image:', error);
            showToast('Error analyzing image.');
        }
    }

    // Perform scan analysis
    async function performScan() {
        console.log('performScan called');
        if (!cropper) {
            console.error('Cropper not initialized!');
            return;
        }

        // Get full resolution cropped canvas
        const canvas = cropper.getCroppedCanvas();
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const numSlices = parseInt(scanSlicesSelect ? scanSlicesSelect.value : 10);
        const sliceHeight = canvas.height / numSlices;
        const slicesData = [];

        console.log(`Extracting ${numSlices} slices...`);

        for (let i = 0; i < numSlices; i++) {
            const y = Math.floor(i * sliceHeight + sliceHeight / 2);
            // Ensure y is within bounds
            if (y >= canvas.height) continue;

            const imageData = ctx.getImageData(0, y, canvas.width, 1);
            const pixels = [];
            for (let j = 0; j < imageData.data.length; j += 4) {
                pixels.push({
                    r: imageData.data[j],
                    g: imageData.data[j + 1],
                    b: imageData.data[j + 2]
                });
            }
            slicesData.push(pixels);
        }

        try {
            const response = await fetch('/api/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ slices: slicesData })
            });

            if (!response.ok) {
                throw new Error('Server scan failed');
            }

            const data = await response.json();
            console.log('Scan response:', data);

            renderScanChart(data.slices);

            // Render Resistor Result
            const resultContainer = document.getElementById('scan-result');
            const valueEl = document.getElementById('resistor-value');
            const bandsEl = document.getElementById('detected-bands');

            if (resultContainer && valueEl && bandsEl) {
                resultContainer.style.display = 'block';

                if (data.resistor_value) {
                    valueEl.textContent = data.resistor_value;
                    bandsEl.innerHTML = `Detected sequence: <span style="color:white;">${data.detected_bands.join(' → ')}</span>`;
                } else {
                    valueEl.textContent = "Detection Failed";
                    bandsEl.innerHTML = `Detected bands: <span style="color:rgba(255,255,255,0.5);">${data.detected_bands ? data.detected_bands.join(' → ') : 'None'}</span><br><small style="opacity:0.7">Result unavailable (need ≥3 valid bands)</small>`;
                }
            }

        } catch (error) {
            console.error('Error scanning image:', error);
            showToast('Error scanning image.');
        }
    }

    // Render scan chart
    function renderScanChart(slices) {
        const scanChartContainer = document.getElementById('scan-chart');
        if (!scanChartContainer) return;


        scanChartContainer.innerHTML = '';
        scanChartContainer.style.display = 'flex';
        scanChartContainer.style.flexDirection = 'column'; // Stack slices vertically
        scanChartContainer.style.gap = '0.5rem';
        scanChartContainer.style.marginBottom = '2rem';
        scanChartContainer.style.overflowX = 'auto'; // Enable horizontal scrolling
        scanChartContainer.style.paddingBottom = '0.5rem'; // Space for scrollbar

        slices.forEach((slice, index) => {
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.flexDirection = 'row'; // Arrange colors horizontally
            row.style.height = '50px'; // Fixed height for each slice
            row.style.width = '100%';
            row.style.borderRadius = '4px';
            row.style.overflow = 'hidden'; // Ensure rounded corners work

            slice.colors.forEach(color => {
                const colorBlock = document.createElement('div');
                colorBlock.style.backgroundColor = `rgb(${color.r}, ${color.g}, ${color.b})`;

                // Use flex-grow to make width proportional to actual pixel width
                colorBlock.style.flexGrow = color.count || 1;

                colorBlock.style.cursor = 'pointer';
                colorBlock.title = `${color.name} (${color.hex})`;

                // Style for text display
                colorBlock.style.display = 'flex';
                colorBlock.style.alignItems = 'center';
                colorBlock.style.justifyContent = 'center';
                colorBlock.style.fontSize = '0.75rem';
                colorBlock.style.fontWeight = '500';
                colorBlock.style.overflow = 'hidden';
                colorBlock.style.textAlign = 'center';
                colorBlock.style.whiteSpace = 'nowrap'; // Prevent text wrapping
                colorBlock.style.padding = '0 4px';
                colorBlock.style.minWidth = '0'; // Allow to shrink properly
                colorBlock.style.textOverflow = 'ellipsis'; // Show dots if too small

                // Determine text color based on brightness
                const brightness = (color.r * 299 + color.g * 587 + color.b * 114) / 1000;
                colorBlock.style.color = brightness > 128 ? '#000' : '#fff';

                colorBlock.textContent = color.name;

                colorBlock.addEventListener('click', () => copyToClipboard(color.hex));
                row.appendChild(colorBlock);
            });

            scanChartContainer.appendChild(row);
        });
    }

    function renderPalette(colors, totalPixels) {
        paletteGrid.innerHTML = '';

        // Analyze button is now static in HTML


        colors.forEach((color, index) => {
            const percentage = ((color.count / totalPixels) * 100).toFixed(1);
            const hex = color.hex || rgbToHex(color.r, color.g, color.b);
            const rgbString = `rgb(${color.r}, ${color.g}, ${color.b})`;

            // Create Card
            const card = document.createElement('div');
            card.className = 'color-card';
            card.style.animationDelay = `${index * 0.1}s`;
            card.classList.add('fade-in-up');

            card.innerHTML = `
                <div class="color-preview" style="background-color: ${rgbString}">
                    <span class="percentage">${percentage}%</span>
                </div>
                <div class="color-info">
                    <div class="hex-code">${hex}</div>
                    <div class="rgb-code">${rgbString}</div>
                </div>
            `;

            card.addEventListener('click', () => {
                copyToClipboard(hex);
            });

            paletteGrid.appendChild(card);
        });
    }

    function renderColorBar(colors, totalPixels) {
        const colorBarContainer = document.getElementById('color-bar');

        if (!colorBarContainer) return;

        colorBarContainer.innerHTML = '';

        // Normalize to the sum of displayed colors so the bar is full width
        const totalDisplayedCount = colors.reduce((sum, c) => sum + c.count, 0);

        colors.forEach(color => {
            const percentage = (color.count / totalDisplayedCount) * 100;
            const hex = color.hex || rgbToHex(color.r, color.g, color.b);

            const segment = document.createElement('div');
            segment.className = 'color-bar-segment';
            segment.style.width = `${percentage}%`;
            segment.style.backgroundColor = `rgb(${color.r}, ${color.g}, ${color.b})`;
            segment.dataset.percentage = `${Math.round(percentage)}%`;
            segment.title = hex;

            segment.addEventListener('click', () => {
                copyToClipboard(hex);
            });

            colorBarContainer.appendChild(segment);
        });
    }

    function rgbToHex(r, g, b) {
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
    }

    function copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            showToast(`Copied ${text} to clipboard!`);
        });
    }

    function showToast(message) {
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    function generateHarmonies(baseColor) {
        const hsl = rgbToHsl(baseColor.r, baseColor.g, baseColor.b);
        const harmoniesContainer = document.getElementById('harmonies-grid');
        harmoniesContainer.innerHTML = '';

        const patterns = [
            { name: 'Complementary', colors: getComplementary(hsl) },
            { name: 'Analogous', colors: getAnalogous(hsl) },
            { name: 'Triadic', colors: getTriadic(hsl) },
            { name: 'Split Complementary', colors: getSplitComplementary(hsl) }
        ];

        patterns.forEach(pattern => {
            const patternEl = document.createElement('div');
            patternEl.className = 'harmony-group';

            const title = document.createElement('h3');
            title.className = 'harmony-title';
            title.textContent = pattern.name;
            patternEl.appendChild(title);

            const colorsContainer = document.createElement('div');
            colorsContainer.className = 'harmony-colors';

            pattern.colors.forEach(color => {
                const rgb = hslToRgb(color.h, color.s, color.l);
                const hex = rgbToHex(rgb.r, rgb.g, rgb.b);

                const colorBox = document.createElement('div');
                colorBox.className = 'harmony-color-box';
                colorBox.style.backgroundColor = hex;
                colorBox.title = hex;
                colorBox.addEventListener('click', () => copyToClipboard(hex));

                const hexLabel = document.createElement('span');
                hexLabel.className = 'harmony-hex';
                hexLabel.textContent = hex;
                colorBox.appendChild(hexLabel);

                colorsContainer.appendChild(colorBox);
            });

            patternEl.appendChild(colorsContainer);
            harmoniesContainer.appendChild(patternEl);
        });
    }

    function rgbToHsl(r, g, b) {
        r /= 255, g /= 255, b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;

        if (max === min) {
            h = s = 0; // achromatic
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        return { h: h * 360, s: s * 100, l: l * 100 };
    }

    function hslToRgb(h, s, l) {
        h /= 360, s /= 100, l /= 100;
        let r, g, b;

        if (s === 0) {
            r = g = b = l; // achromatic
        } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1 / 6) return p + (q - p) * 6 * t;
                if (t < 1 / 2) return q;
                if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                return p;
            };
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1 / 3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1 / 3);
        }
        return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
    }

    function getComplementary(hsl) {
        return [
            hsl,
            { h: (hsl.h + 180) % 360, s: hsl.s, l: hsl.l }
        ];
    }

    function getAnalogous(hsl) {
        return [
            { h: (hsl.h - 30 + 360) % 360, s: hsl.s, l: hsl.l },
            hsl,
            { h: (hsl.h + 30) % 360, s: hsl.s, l: hsl.l }
        ];
    }

    function getTriadic(hsl) {
        return [
            hsl,
            { h: (hsl.h + 120) % 360, s: hsl.s, l: hsl.l },
            { h: (hsl.h + 240) % 360, s: hsl.s, l: hsl.l }
        ];
    }

    function getSplitComplementary(hsl) {
        return [
            hsl,
            { h: (hsl.h + 150) % 360, s: hsl.s, l: hsl.l },
            { h: (hsl.h + 210) % 360, s: hsl.s, l: hsl.l }
        ];
    }

    // --- Demo Functionality ---
    const demoBtn = document.createElement('button');
    demoBtn.style.marginTop = "1rem";
    demoBtn.style.padding = "0.5rem 1rem";
    demoBtn.style.background = "rgba(255,255,255,0.2)";
    demoBtn.style.border = "1px solid rgba(255,255,255,0.3)";
    demoBtn.style.color = "white";
    demoBtn.style.borderRadius = "6px";
    demoBtn.style.cursor = "pointer";
    demoBtn.innerHTML = '<i class="fa-solid fa-play"></i> Run Demo (27Ω)';

    demoBtn.addEventListener('mouseenter', () => demoBtn.style.background = "rgba(255,255,255,0.3)");
    demoBtn.addEventListener('mouseleave', () => demoBtn.style.background = "rgba(255,255,255,0.2)");

    const dropZoneContent = document.querySelector('.upload-content');
    if (dropZoneContent) dropZoneContent.appendChild(demoBtn);

    demoBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        console.log("Running demo...");
        try {
            const response = await fetch('Resistor-27-Ohm-5.jpg');
            if (!response.ok) throw new Error("Demo image not found");
            const blob = await response.blob();

            const img = new Image();
            img.onload = () => {
                currentImage = img;
                imagePreview.src = img.src;

                dropZone.classList.add('hidden');
                dropZone.style.display = 'none';
                analysisSection.classList.remove('hidden');

                if (cropper) cropper.destroy();
                cropper = new Cropper(imagePreview, {
                    aspectRatio: NaN,
                    viewMode: 1,
                    autoCropArea: 1,
                    responsive: true,
                    background: false,
                    ready() {
                        setTimeout(() => {
                            analysisSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            performScan();
                            setTimeout(() => {
                                const resultEl = document.getElementById('scan-result');
                                if (resultEl) resultEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }, 1000);
                        }, 500);
                    }
                });
            };
            img.src = URL.createObjectURL(blob);

        } catch (e) {
            console.error("Demo failed", e);
            showToast("Demo image not found");
        }
    });
});
