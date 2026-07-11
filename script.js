document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const uploadArea = document.getElementById('upload-area');
    const fileInputLabel = document.querySelector('.file-input-label');
    const fileInput = document.getElementById('file-input');
    const errorMessage = document.getElementById('error-message');
    const dismissError = document.getElementById('dismiss-error');
    const previewContainer = document.getElementById('preview-container');
    const previewImg = document.getElementById('preview-img');
    const imageCountText = document.getElementById('image-count');
    const originalSizeText = document.getElementById('original-size');
    const scaledSizeText = document.getElementById('scaled-size');
    const sliceCountText = document.getElementById('slice-count');
    const sliceResolutionText = document.getElementById('slice-resolution');
    const highResToggle = document.getElementById('high-res-toggle');
    const slicesToggle = document.getElementById('slices-toggle');
    const processBtn = document.getElementById('process-btn');
    const resetBtn = document.getElementById('reset-btn');
    const resultContainer = document.getElementById('result-container');
    const slicesPreview = document.getElementById('slices-preview');
    const downloadBtn = document.getElementById('download-btn');
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingText = document.getElementById('loading-text');
    const downloadBtnText = document.querySelector('.btn-text');
    const downloadBtnLoader = document.querySelector('.btn-loader');
    
    // Variables to store image data
    let originalImages = [];
    let processedImages = [];
    let processedOptions = null;
    
    // Standard Instagram 3:4 aspect ratio
    const aspectRatio = 3/4; // width:height ratio
    
    // Standard resolution (for standard mode)
    const standardWidth = 1080;
    const standardHeight = Math.round(standardWidth / aspectRatio); // Should be 1440
    
    const minSlices = 2;
    const halfSliceWidth = standardWidth / 2;
    
    // Show loading overlay with custom message
    function showLoading(message) {
        loadingText.textContent = message;
        loadingOverlay.classList.add('active');
    }
    
    // Hide loading overlay
    function hideLoading() {
        loadingOverlay.classList.remove('active');
    }
    
    // Show button loading state
    function showButtonLoading(button, textElement, loaderElement) {
        button.disabled = true;
        textElement.style.opacity = '0.7';
        loaderElement.style.display = 'inline-block';
    }
    
    // Hide button loading state
    function hideButtonLoading(button, textElement, loaderElement) {
        button.disabled = false;
        textElement.style.opacity = '1';
        loaderElement.style.display = 'none';
    }
    
    // Event Listeners for drag and drop
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('drag-over');
    });
    
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('drag-over');
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
        
        if (e.dataTransfer.files.length) {
            handleFiles(e.dataTransfer.files);
        }
    });
    
    // Click on upload area to select file
    fileInputLabel.addEventListener('click', (e) => {
        e.preventDefault();
        fileInput.click();
    });
    
    // File input change
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) {
            handleFiles(e.target.files);
        }
    });
    
    // Process button
    processBtn.addEventListener('click', () => {
        showLoading('Generating images...');
        
        // Use setTimeout to allow the loading overlay to appear before processing
        setTimeout(() => {
            try {
                processImages();
            } finally {
                hideLoading();
            }
        }, 50);
    });
    
    // Reset button
    resetBtn.addEventListener('click', () => {
        resetApp();
    });
    
    // Dismiss error
    dismissError.addEventListener('click', () => {
        errorMessage.style.display = 'none';
    });
    
    // Download button
    downloadBtn.addEventListener('click', () => {
        showButtonLoading(downloadBtn, downloadBtnText, downloadBtnLoader);
        
        // Use setTimeout to allow the UI to update before processing
        setTimeout(() => {
            downloadZip().then(() => {
                hideButtonLoading(downloadBtn, downloadBtnText, downloadBtnLoader);
            }).catch((error) => {
                console.error('Error creating zip:', error);
                hideButtonLoading(downloadBtn, downloadBtnText, downloadBtnLoader);
                showError('There was a problem creating your zip file. Please try again.');
            });
        }, 50);
    });
    
    // High-res toggle change
    highResToggle.addEventListener('change', () => {
        if (originalImages.length) {
            updateImageDetails();
        }
    });

    slicesToggle.addEventListener('change', () => {
        if (originalImages.length) updateImageDetails();
    });
    
    // Handle file upload
    async function handleFiles(fileList) {
        const files = Array.from(fileList);
        const invalidFile = files.find(file => !file.type.match('image.*'));
        if (!files.length || invalidFile) {
            showError('Please select image files only');
            return;
        }

        showLoading('Loading your image...');
        try {
            const loadedImages = await Promise.all(files.map(loadImage));
            const nonHorizontal = loadedImages.find(image => image.width <= image.height);
            if (nonHorizontal) {
                showError(`“${nonHorizontal.name}” is not horizontal. Please select images where width is greater than height.`);
                return;
            }

            originalImages = loadedImages;
            processedImages = [];
            processedOptions = null;
            updateImageDetails();
            previewImg.src = originalImages[0].src;
            errorMessage.style.display = 'none';
            uploadArea.style.display = 'none';
            previewContainer.style.display = 'block';
            resultContainer.style.display = 'none';
        } catch (error) {
            console.error('Error reading images:', error);
            showError('There was an error reading one of the files. Please try again.');
        } finally {
            hideLoading();
        }
    }

    function loadImage(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = reject;
            reader.onload = (event) => {
                const img = new Image();
                img.onerror = reject;
                img.onload = () => resolve({
                    element: img,
                    width: img.width,
                    height: img.height,
                    src: event.target.result,
                    name: file.name
                });
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        });
    }
    
    // Update image details based on selected mode
    function updateImageDetails() {
        if (!originalImages.length) return;

        const originalImage = originalImages[0];
        
        const isHighResMode = highResToggle.checked;
        const { scaledWidth, scaledHeight, sliceCount, sliceWidth, sliceHeight } = calculateOptimalScaling(
            originalImage.width, 
            originalImage.height, 
            isHighResMode
        );
        
        // Update image details
        imageCountText.textContent = originalImages.length;
        originalSizeText.textContent = `${originalImage.width}px × ${originalImage.height}px`;
        scaledSizeText.textContent = `${scaledWidth}px × ${scaledHeight}px`;
        sliceCountText.textContent = slicesToggle.checked ? `${sliceCount} per image` : 'None (framed images only)';
        sliceResolutionText.textContent = `${sliceWidth}px × ${sliceHeight}px`;
    }
    
    // Calculate optimal scaling to minimize wasted space
    function calculateOptimalScaling(originalWidth, originalHeight, highResMode) {
        // Default to standard resolution
        let sliceWidth = standardWidth;
        let sliceHeight = standardHeight;
        
        // For high-res mode: calculate the maximum possible slice size while maintaining aspect ratio
        if (highResMode) {
            // Calculate maximum height based on original image height
            sliceHeight = originalHeight;
            // Calculate corresponding width based on 3:4 aspect ratio
            sliceWidth = Math.round(sliceHeight * aspectRatio);
        }
        
        // Calculate the minimum number of slices needed to contain the image
        // while maintaining the original aspect ratio
        const originalAspectRatio = originalWidth / originalHeight;
        const sliceAspectRatio = sliceWidth / sliceHeight;
        
        // Calculate how many slices we need to maintain the original aspect ratio
        let requiredSlices;
        
        if (originalAspectRatio >= sliceAspectRatio) {
            // Image is wider than slice ratio - calculate based on width
            requiredSlices = Math.ceil(originalAspectRatio / sliceAspectRatio);
        } else {
            // Image is taller than slice ratio - use minimum slices
            requiredSlices = minSlices;
        }
        
        // Ensure we have at least the minimum number of slices
        const finalSliceCount = Math.max(minSlices, requiredSlices);
        
        // Calculate the total canvas size that maintains the original aspect ratio
        // while filling all slices
        const totalCanvasWidth = finalSliceCount * sliceWidth;
        const totalCanvasHeight = sliceHeight;
        
        // Scale the image to fit this canvas while maintaining aspect ratio
        const scaleX = totalCanvasWidth / originalWidth;
        const scaleY = totalCanvasHeight / originalHeight;
        const scaleFactor = Math.min(scaleX, scaleY);
        
        const scaledImageWidth = Math.round(originalWidth * scaleFactor);
        const scaledImageHeight = Math.round(originalHeight * scaleFactor);
        
        return {
            scaledWidth: scaledImageWidth,
            scaledHeight: scaledImageHeight,
            sliceCount: finalSliceCount,
            sliceWidth: sliceWidth,
            sliceHeight: sliceHeight,
            totalCanvasWidth: totalCanvasWidth,
            totalCanvasHeight: totalCanvasHeight
        };
    }
    
    // Show error message
    function showError(message) {
        const errorText = errorMessage.querySelector('p');
        errorText.textContent = message;
        errorMessage.style.display = 'block';
        
        // Scroll to error
        errorMessage.scrollIntoView({ behavior: 'smooth' });
    }
    
    // Process all selected images using the chosen output mode
    function processImages() {
        if (!originalImages.length) return;

        processedImages = originalImages.map(originalImage => processImage(originalImage));
        processedOptions = {
            highRes: highResToggle.checked,
            includeSlices: slicesToggle.checked
        };
        displayResults();
    }

    function processImage(originalImage) {

        const isHighResMode = highResToggle.checked;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Calculate optimal scaling and slicing
        const { scaledWidth, scaledHeight, sliceCount, sliceWidth, sliceHeight, totalCanvasWidth, totalCanvasHeight } = calculateOptimalScaling(
            originalImage.width, 
            originalImage.height,
            isHighResMode
        );

        // Set canvas dimensions to the total canvas size
        canvas.width = totalCanvasWidth;
        canvas.height = totalCanvasHeight;

        // Fill with white background
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, totalCanvasWidth, totalCanvasHeight);

        // Scale to FILL the canvas (crop to fill, not fit)
        // This ensures no white bars appear in the slices
        const scaleX = totalCanvasWidth / originalImage.width;
        const scaleY = totalCanvasHeight / originalImage.height;
        const scaleFactor = Math.max(scaleX, scaleY); // Use max to fill, not min
        
        const scaledImageWidth = Math.round(originalImage.width * scaleFactor);
        const scaledImageHeight = Math.round(originalImage.height * scaleFactor);

        // Calculate position to center the scaled image on the total canvas
        const offsetX = (totalCanvasWidth - scaledImageWidth) / 2;
        const offsetY = (totalCanvasHeight - scaledImageHeight) / 2;

        // Draw the image scaled to fill and centered (this will crop if necessary)
        ctx.drawImage(
            originalImage.element,
            0, 0, originalImage.width, originalImage.height,
            offsetX, offsetY, scaledImageWidth, scaledImageHeight
        );

        const slicedImages = [];

        // Create slices only when carousel output is enabled
        if (slicesToggle.checked) for (let i = 0; i < sliceCount; i++) {
            const sliceCanvas = document.createElement('canvas');
            const sliceCtx = sliceCanvas.getContext('2d');

            sliceCanvas.width = sliceWidth;
            sliceCanvas.height = sliceHeight;

            // Calculate the source area for this slice
            const sourceX = i * sliceWidth;
            
            // Draw the slice portion from the main canvas
            sliceCtx.drawImage(
                canvas, 
                sourceX, 0, sliceWidth, sliceHeight,
                0, 0, sliceWidth, sliceHeight
            );

            // Convert to data URL
            const dataURL = sliceCanvas.toDataURL('image/jpeg', 0.95);

            slicedImages.push({
                dataURL,
                number: i + 1,
                width: sliceWidth,
                height: sliceHeight
            });
        }

        // Create the full panorama view on white background
        const fullViewImage = createFullViewImage(originalImage, sliceWidth, sliceHeight);
        return { name: originalImage.name, slicedImages, fullViewImage };
    }
    
    // Create a full panorama view on white background with 3:4 aspect ratio
    function createFullViewImage(originalImage, sliceWidth, sliceHeight) {
        
        // Create a canvas with the same aspect ratio as the slices
        const fullCanvas = document.createElement('canvas');
        const fullCtx = fullCanvas.getContext('2d');
        
        // Use the same dimensions as the slices for consistency
        fullCanvas.width = sliceWidth;
        fullCanvas.height = sliceHeight;
        
        // Fill with white background
        fullCtx.fillStyle = '#FFFFFF';
        fullCtx.fillRect(0, 0, sliceWidth, sliceHeight);
        
        // Calculate the scale for the panorama to fit within the frame with margins
        const margin = Math.round(sliceWidth * 0.08); // 8% margin
        const availableWidth = sliceWidth - (margin * 2);
        const availableHeight = sliceHeight - (margin * 2);
        
        // Determine which dimension constrains the scaling
        const originalAspectRatio = originalImage.width / originalImage.height;
        let scaledPanoWidth, scaledPanoHeight;
        
        if (originalAspectRatio > availableWidth / availableHeight) {
            // Width is the constraining factor
            scaledPanoWidth = availableWidth;
            scaledPanoHeight = scaledPanoWidth / originalAspectRatio;
        } else {
            // Height is the constraining factor
            scaledPanoHeight = availableHeight;
            scaledPanoWidth = scaledPanoHeight * originalAspectRatio;
        }
        
        // Calculate position to center the image
        const x = Math.round((sliceWidth - scaledPanoWidth) / 2);
        const y = Math.round((sliceHeight - scaledPanoHeight) / 2);
        
        // Draw the scaled panorama centered on the white canvas
        fullCtx.drawImage(
            originalImage.element,
            0, 0, originalImage.width, originalImage.height,
            x, y, scaledPanoWidth, scaledPanoHeight
        );
        
        // Add a subtle border
        fullCtx.strokeStyle = '#EEEEEE';
        fullCtx.lineWidth = 1;
        fullCtx.strokeRect(x - 1, y - 1, scaledPanoWidth + 2, scaledPanoHeight + 2);
        
        // Convert to data URL
        return {
            dataURL: fullCanvas.toDataURL('image/jpeg', 0.95),
            width: sliceWidth,
            height: sliceHeight
        };
    }
    
    // Display processed slices
    function displayResults() {
        slicesPreview.innerHTML = '';
        
        processedImages.forEach((processedImage) => {
        const { name, fullViewImage, slicedImages } = processedImage;

        const batchTitle = document.createElement('h3');
        batchTitle.className = 'batch-image-title';
        batchTitle.textContent = name;
        slicesPreview.appendChild(batchTitle);

        // Add the full view as the first item for this source image
        if (fullViewImage) {
            const fullViewItem = document.createElement('div');
            fullViewItem.className = 'slice-item full-view-item';
            
            const img = document.createElement('img');
            img.src = fullViewImage.dataURL;
            img.alt = 'Full Panorama View';
            
            const label = document.createElement('div');
            label.className = 'slice-label';
            label.textContent = 'Full View';
            
            const resolution = document.createElement('div');
            resolution.className = 'resolution';
            resolution.textContent = `${fullViewImage.width}×${fullViewImage.height}`;
            
            fullViewItem.appendChild(img);
            fullViewItem.appendChild(label);
            fullViewItem.appendChild(resolution);
            slicesPreview.appendChild(fullViewItem);
        }
        
        // Add all the regular slices
        slicedImages.forEach(slice => {
            const sliceItem = document.createElement('div');
            sliceItem.className = 'slice-item';
            
            const img = document.createElement('img');
            img.src = slice.dataURL;
            img.alt = `Slice ${slice.number}`;
            
            const number = document.createElement('div');
            number.className = 'slice-number';
            number.textContent = slice.number;
            
            const resolution = document.createElement('div');
            resolution.className = 'resolution';
            resolution.textContent = `${slice.width}×${slice.height}`;
            
            sliceItem.appendChild(img);
            sliceItem.appendChild(number);
            sliceItem.appendChild(resolution);
            slicesPreview.appendChild(sliceItem);
        });
        });
        
        resultContainer.style.display = 'block';
        window.scrollTo({
            top: resultContainer.offsetTop - 20,
            behavior: 'smooth'
        });
    }
    
    // Reset app to initial state
    function resetApp() {
        // Clear file input
        fileInput.value = '';
        
        // Hide preview and results
        previewContainer.style.display = 'none';
        resultContainer.style.display = 'none';
        errorMessage.style.display = 'none';
        
        // Show upload area
        uploadArea.style.display = 'block';
        
        // Clear image data
        originalImages = [];
        processedImages = [];
        processedOptions = null;
        
        // Clear preview
        previewImg.src = '';
    }
    
    // Download slices as zip file
    async function downloadZip() {
        if (processedImages.length === 0) return;
        
        const zip = new JSZip();
        const isHighRes = processedOptions?.highRes ?? highResToggle.checked;
        const includeSlices = processedOptions?.includeSlices ?? slicesToggle.checked;
        const folderName = isHighRes ? 'high_res_images' : 'standard_images';

        processedImages.forEach((processedImage, index) => {
            const baseName = sanitizeFileName(processedImage.name.replace(/\.[^.]+$/, '')) || `image_${index + 1}`;
            const uniqueName = `${String(index + 1).padStart(2, '0')}_${baseName}`;

            if (processedImage.fullViewImage) {
                const imageData = processedImage.fullViewImage.dataURL.split(',')[1];
                zip.file(`${folderName}/${uniqueName}_full_view.jpg`, imageData, { base64: true });
            }

            processedImage.slicedImages.forEach(slice => {
                const imageData = slice.dataURL.split(',')[1];
                zip.file(`${folderName}/${uniqueName}_slice_${String(slice.number).padStart(2, '0')}.jpg`, imageData, { base64: true });
            });
        });
        
        // Add a readme file explaining the full view
        const currentDate = new Date().toISOString().split('T')[0];
        const readmeContent = 
`Instagram Panorama Slicer - Created by FUTC (@FUTC.Photography on Instagram)

IF YOU LIKE THIS TOOL, PLEASE CONSIDER SUPPORTING ME BY CHECKING OUT MY LIGHTROOM PRESET PACKS (this link includes a heavy discount): https://futc.gumroad.com/l/analogvibes2/panosplitter

This package contains one image folder with all generated files.
Files ending in _full_view.jpg contain the complete source image centered on a white 3:4 background.${includeSlices ? '\nCarousel mode was enabled, so the folder also contains numbered _slice_XX.jpg files.' : ''}
`;
        
        zip.file('README.txt', readmeContent);
        
        // Generate zip file
        const content = await zip.generateAsync({ type: 'blob' });
        saveAs(content, includeSlices ? 'instagram_carousel_images.zip' : 'instagram_framed_images.zip');
    }

    function sanitizeFileName(name) {
        return name.replace(/[^a-z0-9_-]+/gi, '_').replace(/^_+|_+$/g, '');
    }
});
