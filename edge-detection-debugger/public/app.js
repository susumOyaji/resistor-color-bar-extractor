// Global state accessible by other scripts
window.lastEdgeDetectionResult = null;

function showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded fired for Edge Detection Debugger');

    // Elements
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const analysisSection = document.getElementById('analysis-section');
    const imagePreview = document.getElementById('image-preview');
    const changeImageBtn = document.getElementById('change-image-btn');
    const resetCropBtn = document.getElementById('reset-crop-btn');
    
    // State
    let currentImage = null;
    let cropper = null;

    // --- Event Listeners for Drag & Drop ---
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => dropZone.addEventListener(eventName, preventDefaults, false));
    function preventDefaults(e) { e.preventDefault(); e.stopPropagation(); }
    ['dragenter', 'dragover'].forEach(eventName => dropZone.addEventListener(eventName, () => dropZone.classList.add('drag-over'), false));
    ['dragleave', 'drop'].forEach(eventName => dropZone.addEventListener(eventName, () => dropZone.classList.remove('drag-over'), false));
    
    dropZone.addEventListener('drop', handleDrop, false);
    dropZone.addEventListener('click', () => fileInput.click(), true);
    fileInput.addEventListener('change', handleFiles);

    // --- Main Buttons ---
    const edgeDetectBtn = document.getElementById('edge-detect-btn');
    const edgeThresholdSlider = document.getElementById('edge-threshold-slider');
    const edgeThresholdValue = document.getElementById('edge-threshold-value');
    const thresholdDecrementBtn = document.getElementById('threshold-decrement-btn');
    const thresholdIncrementBtn = document.getElementById('threshold-increment-btn');

    const updateThreshold = (newValue) => {
        const value = Math.max(parseInt(edgeThresholdSlider.min, 10), Math.min(parseInt(edgeThresholdSlider.max, 10), newValue));
        edgeThresholdSlider.value = value;
        // Manually trigger input event to update the display
        edgeThresholdSlider.dispatchEvent(new Event('input', { bubbles: true }));
    };

    if (edgeThresholdSlider && edgeThresholdValue) {
        edgeThresholdSlider.addEventListener('input', (e) => {
            edgeThresholdValue.textContent = e.target.value;
        });
    }

    if (thresholdDecrementBtn) {
        thresholdDecrementBtn.addEventListener('click', () => {
            updateThreshold(parseInt(edgeThresholdSlider.value, 10) - 1);
        });
    }

    if (thresholdIncrementBtn) {
        thresholdIncrementBtn.addEventListener('click', () => {
            updateThreshold(parseInt(edgeThresholdSlider.value, 10) + 1);
        });
    }

    if (edgeDetectBtn) {
        edgeDetectBtn.addEventListener('click', () => {
            if (currentImage) performEdgeDetection();
            else console.error('No image loaded');
        });
    }

    const edgeLearningModeToggle = document.getElementById('edge-learning-mode-toggle');
    const edgeLearningInputArea = document.getElementById('edge-learning-input-area');
    if (edgeLearningModeToggle && edgeLearningInputArea) {
        edgeLearningModeToggle.addEventListener('change', (e) => {
            edgeLearningInputArea.style.display = e.target.checked ? 'block' : 'none';
        });
    }

    const edgeLearnFromValueBtn = document.getElementById('edge-learn-from-value-btn');
    const edgeCorrectResistanceInput = document.getElementById('edge-correct-resistance-input');
    const edgeCorrectToleranceSelect = document.getElementById('edge-correct-tolerance-select');
    const edgeLearningStatus = document.getElementById('edge-learning-status');
    if (edgeLearnFromValueBtn) {
        edgeLearnFromValueBtn.addEventListener('click', () => {
            const inputValue = edgeCorrectResistanceInput.value.trim();
            const toleranceValue = edgeCorrectToleranceSelect.value;
            if (!inputValue) {
                showToast('正しい抵抗値を入力してください');
                return;
            }
            if (!window.lastEdgeDetectionResult) {
                showToast('先にエッジ検出を実行してください');
                return;
            }
            if (typeof learnFromEdgeDetection === 'function') {
                learnFromEdgeDetection(inputValue, toleranceValue, edgeLearningStatus);
            } else {
                console.error('learnFromEdgeDetection function not found');
            }
        });
    }

    if (changeImageBtn) changeImageBtn.addEventListener('click', resetApp);
    if (resetCropBtn) resetCropBtn.addEventListener('click', () => cropper ? cropper.reset() : null);

    // --- Core Functions ---

    function resetApp() {
        currentImage = null;
        if (cropper) {
            cropper.destroy();
            cropper = null;
        }
        imagePreview.src = '';
        fileInput.value = '';
        analysisSection.classList.add('hidden');
        dropZone.classList.remove('hidden');
        dropZone.style.display = 'block';
        const edgeResult = document.getElementById('edge-result');
        if (edgeResult) edgeResult.style.display = 'none';
        const edgeImageContainer = document.getElementById('edge-image-container');
        if (edgeImageContainer) edgeImageContainer.style.display = 'none';
    }

    function handleDrop(e) {
        handleFiles({ target: { files: e.dataTransfer.files } });
    }

    function handleFiles(e) {
        const file = e.target.files[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (event) => {
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
                        background: false
                    });
                    setTimeout(() => analysisSection.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        } else {
            showToast('Please upload a valid image file.');
        }
    }

    async function performEdgeDetection() {
        if (!cropper) {
            showToast('Cropper not initialized!');
            return;
        }
        const canvas = cropper.getCroppedCanvas();
        if (!canvas) return;

        const edgeImageContainer = document.getElementById('edge-image-container');
        const edgeAnalyzedImage = document.getElementById('edge-analyzed-image');
        if (edgeAnalyzedImage && edgeImageContainer) {
            edgeAnalyzedImage.src = canvas.toDataURL();
            edgeImageContainer.style.display = 'block';
        }

        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = [];
        for (let i = 0; i < imageData.data.length; i += 4) {
            pixels.push({ r: imageData.data[i], g: imageData.data[i + 1], b: imageData.data[i + 2] });
        }

        const threshold = edgeThresholdSlider ? parseInt(edgeThresholdSlider.value, 10) : 10;

        try {
            const response = await fetch('/api/detect-edges', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pixels, width: canvas.width, height: canvas.height, threshold })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Edge detection failed');
            }

            const data = await response.json();
            window.lastEdgeDetectionResult = data;
            renderEdgeVisualization(data.bands, canvas.width);
            renderEdgeResult(data);
        } catch (error) {
            console.error('Error in edge detection:', error);
            showToast(`Error: ${error.message}`);
        }
    }

    function renderEdgeVisualization(bands, width) {
        const edgeOverlay = document.getElementById('edge-overlay');
        if (!edgeOverlay) return;
        edgeOverlay.innerHTML = '';
        bands.forEach(band => {
            const line = document.createElement('div');
            line.style.cssText = `
                position: absolute;
                left: ${(band.x / width) * 100}%;
                top: 0;
                width: 3px;
                height: 100%;
                background: rgb(${band.rgb.r}, ${band.rgb.g}, ${band.rgb.b});
                box-shadow: 0 0 8px rgba(255, 255, 255, 0.8), 0 0 4px rgba(0, 0, 0, 0.5);
                pointer-events: none;
                z-index: 10;
            `;
            const label = document.createElement('div');
            label.style.cssText = `
                position: absolute; top: 5px; left: 50%; transform: translateX(-50%);
                background: rgba(0, 0, 0, 0.8); color: white; padding: 2px 6px;
                border-radius: 4px; font-size: 10px; font-weight: bold; white-space: nowrap;
            `;
            label.textContent = band.colorName;
            line.appendChild(label);
            edgeOverlay.appendChild(line);
        });
    }

    function renderEdgeResult(data) {
        const resultContainer = document.getElementById('edge-result');
        const valueEl = document.getElementById('edge-resistor-value');
        const bandsEl = document.getElementById('edge-detected-bands');
        const vizEl = document.getElementById('edge-visualization');

        if (!resultContainer || !valueEl || !bandsEl || !vizEl) return;

        resultContainer.style.display = 'block';
        if (data.resistor_value) {
            valueEl.textContent = data.resistor_value;
            bandsEl.innerHTML = `Detected sequence: <span style="color:white;">${data.detected_bands.join(' → ')}</span>`;
        } else {
            valueEl.textContent = "Detection Failed";
            bandsEl.innerHTML = `Detected bands: <span style="color:rgba(255,255,255,0.5);">${data.detected_bands ? data.detected_bands.join(' → ') : 'None'}</span>`;
        }

        vizEl.innerHTML = '';
        data.bands.forEach(band => {
            const chip = document.createElement('div');
            chip.className = 'band-chip';
            chip.style.cssText = `display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; background: rgba(${band.rgb.r}, ${band.rgb.g}, ${band.rgb.b}, 0.2); border: 2px solid rgb(${band.rgb.r}, ${band.rgb.g}, ${band.rgb.b}); border-radius: 8px; color: white; font-size: 0.9rem;`;
            chip.innerHTML = `
                <div style="width: 24px; height: 24px; background: rgb(${band.rgb.r}, ${band.rgb.g}, ${band.rgb.b}); border-radius: 4px; border: 1px solid rgba(255,255,255,0.3);"></div>
                <span>${band.colorName}</span>
                <span style="opacity: 0.6; font-size: 0.8rem;">#${((1 << 24) + (band.rgb.r << 16) + (band.rgb.g << 8) + band.rgb.b).toString(16).slice(1).toUpperCase()}</span>
                <span style="opacity: 0.5; font-size: 0.75rem;">(x: ${band.x})</span>
            `;
            vizEl.appendChild(chip);
        });
    }
});
