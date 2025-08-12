document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const uploadArea = document.getElementById("upload-area");
    const fileInputLabel = document.querySelector(".file-input-label");
    const fileInput = document.getElementById("file-input");
    const errorMessage = document.getElementById("error-message");
    const dismissError = document.getElementById("dismiss-error");
    const previewContainer = document.getElementById("preview-container");
    const previewImg = document.getElementById("preview-img");
    const originalSizeText = document.getElementById("original-size");
    const scaledSizeText = document.getElementById("scaled-size");
    const sliceCountText = document.getElementById("slice-count");
    const sliceResolutionText = document.getElementById("slice-resolution");
    const highResToggle = document.getElementById("high-res-toggle");
    const aspectRatioToggle = document.getElementById("aspect-ratio-toggle");
    const aspectRatioLabel = document.getElementById("aspect-ratio-label");
    const processBtn = document.getElementById("process-btn");
    const resetBtn = document.getElementById("reset-btn");
    const resultContainer = document.getElementById("result-container");
    const slicesPreview = document.getElementById("slices-preview");
    let downloadBtn = document.getElementById("download-btn");
    const loadingOverlay = document.getElementById("loading-overlay");
    const loadingText = document.getElementById("loading-text");
    const downloadBtnText = document.querySelector(".btn-text");
    const downloadBtnLoader = document.querySelector(".btn-loader");
    
    // Variables to store image data
    let originalImage = null;
    let slicedImages = [];
    let fullViewImage = null;
    
    // Default Ratio
    let aspectRatio = 4 / 5; // default 4:5
    aspectRatioToggle.checked = false;
    aspectRatioLabel.textContent = '4:5';
    
    // Standard resolution (for standard mode)
    const standardWidth = 1080;
    let standardHeight = Math.round(standardWidth / aspectRatio);
    
    const minSlices = 2;
    
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
            handleFile(e.dataTransfer.files[0]);
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
            handleFile(e.target.files[0]);
        }
    });
    
    // Process button
    processBtn.addEventListener('click', () => {
        showLoading('Generating slices...');
        
        // Use setTimeout to allow the loading overlay to appear before processing
        setTimeout(() => {
            processImage();
            hideLoading();
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
    
    // Toggle aspect ratio
    aspectRatioToggle.addEventListener("change", () => {
        if (aspectRatioToggle.checked) {
            aspectRatio = 1; // Square
            aspectRatioLabel.textContent = "1:1";
        } else {
            aspectRatio = 4 / 5; // Portrait
            aspectRatioLabel.textContent = "4:5";
        }
        standardHeight = Math.round(standardWidth / aspectRatio);
        if (originalImage) updateImageDetails();
    });
    
    // High-res toggle change
    highResToggle.addEventListener('change', () => {
        if (originalImage) {
            updateImageDetails();
        }
    });
    
    // Handle file upload
    function handleFile(file) {
        // Check if file is image
        if (!file.type.match('image.*')) {
            showError('Please select an image file');
            return;
        }
        
        showLoading('Loading your image...');
        
        const reader = new FileReader();
        
        reader.onload = (e) => {
            // Create image object to get dimensions
            const img = new Image();
            
            img.onload = () => {
                hideLoading();
                
                // Check if image is panorama (horizontal aspect ratio)
                if (img.width <= img.height) {
                    showError('Please upload a panorama image with a horizontal aspect ratio (width > height).');
                    return;
                }
                
                originalImage = {
                    element: img,
                    width: img.width,
                    height: img.height,
                    src: e.target.result
                };
                slicedImages = [];
                fullViewImage = null;
                
                // Update image details
                updateImageDetails();
                
                // Show preview
                previewImg.src = e.target.result;
                
                // Hide error if shown
                errorMessage.style.display = 'none';
                
                // Show preview container
                uploadArea.style.display = 'none';
                previewContainer.style.display = 'block';
                resultContainer.style.display = 'none';
            };
            
            img.src = e.target.result;
        };
        
        reader.onerror = () => {
            hideLoading();
            showError('There was an error reading the file. Please try again.');
        };
        
        reader.readAsDataURL(file);
    }
    
    // Update image details based on selected mode
    function updateImageDetails() {
        if (!originalImage) return;
        
        const isHighResMode = highResToggle.checked;
        const { scaledWidth, scaledHeight, sliceCount, sliceWidth, sliceHeight } = calculateOptimalScaling(
            originalImage.width, 
            originalImage.height, 
            highResToggle.checked
        );
        
        // Update image details
        originalSizeText.textContent = `${originalImage.width}px × ${originalImage.height}px`;
        scaledSizeText.textContent = `${scaledWidth}px × ${scaledHeight}px`;
        sliceCountText.textContent = sliceCount;
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
            // Calculate corresponding width based on selected aspect ratio
            sliceWidth = Math.round(sliceHeight * aspectRatio);
        }
        
        // Initial scaling based on height
        const scaleFactor = sliceHeight / originalHeight;
        const baseScaledWidth = Math.round(originalWidth * scaleFactor);
        
        // Calculate how many full slices we can get
        const fullSlices = Math.floor(baseScaledWidth / sliceWidth);
        
        // Calculate the remaining width after using full slices
        const remainingWidth = baseScaledWidth - (fullSlices * sliceWidth);
        
        let finalSliceCount, finalScaledWidth, finalScaledHeight;
        
        // Ensure a minimum of 2 slices
        if (fullSlices < minSlices) {
            finalSliceCount = minSlices;
            finalScaledWidth = minSlices * sliceWidth;
            // Calculate height based on maintaining aspect ratio
            finalScaledHeight = Math.round((finalScaledWidth / originalWidth) * originalHeight);
        }
        // If remaining width is more than half a slice, add another slice
        else if (remainingWidth > (sliceWidth / 2)) {
            finalSliceCount = fullSlices + 1;
            finalScaledWidth = finalSliceCount * sliceWidth;
            // Adjust the scale factor to fit exactly the number of slices
            const adjustedScaleFactor = finalScaledWidth / originalWidth;
            finalScaledHeight = Math.round(originalHeight * adjustedScaleFactor);
        } 
        // Otherwise use the original number of slices
        else {
            finalSliceCount = fullSlices;
            finalScaledWidth = finalSliceCount * sliceWidth;
            finalScaledHeight = sliceHeight;
        }
        
        return {
            scaledWidth: finalScaledWidth,
            scaledHeight: finalScaledHeight,
            sliceCount: finalSliceCount, sliceWidth, sliceHeight 
        };
    }
    
    // Show error message
    function showError(message) {
        errorMessage.querySelector("p").textContent = message;
        errorMessage.style.display = 'block';
        
        // Scroll to error
        errorMessage.scrollIntoView({ behavior: 'smooth' });
    }
    
    // Process image into slices
    function processImage() {
        if (!originalImage) return;
        
        const isHighResMode = highResToggle.checked;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Calculate optimal scaling and slicing
        const { scaledWidth, scaledHeight, sliceCount, sliceWidth, sliceHeight } = calculateOptimalScaling(
            originalImage.width, 
            originalImage.height,
            isHighResMode
        );
        
        // Set canvas dimensions
        canvas.width = scaledWidth;
        canvas.height = scaledHeight;
        
        // Draw scaled image
        ctx.drawImage(originalImage.element, 0, 0, scaledWidth, scaledHeight);
        
        slicedImages = [];
        
        // Create each slice
        for (let i = 0; i < sliceCount; i++) {
            const sliceCanvas = document.createElement('canvas');
            const sliceCtx = sliceCanvas.getContext('2d');
            
            sliceCanvas.width = sliceWidth;
            sliceCanvas.height = sliceHeight;
            
            // Draw slice portion
            sliceCtx.drawImage(
                canvas, 
                i * sliceWidth, 0, sliceWidth, scaledHeight,
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
        createFullViewImage(sliceWidth, sliceHeight);
        
        // Show results
        displayResults();
    }
    
    // Create a full panorama view on white background with selected aspect ratio
    function createFullViewImage(sliceWidth, sliceHeight) {
        if (!originalImage) return;
        
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
        fullViewImage = {
            dataURL: fullCanvas.toDataURL('image/jpeg', 0.95),
            width: sliceWidth,
            height: sliceHeight
        };
    }
    
    // Display processed slices
    function displayResults() {
        slicesPreview.innerHTML = '';
        
        // Add the full view as the first item with special styling
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
            
            fullViewItem.append(img, label, resolution);
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
            
            sliceItem.append(img, number, resolution);
            slicesPreview.appendChild(sliceItem);
        });
        
        resultContainer.style.display = "block";
        window.scrollTo({
            top: resultContainer.offsetTop - 20,
            behavior: "smooth",
         });

        // Reset & re-bind download button to prevent multiple zips
        const newDownloadBtn = downloadBtn.cloneNode(true);
        downloadBtn.parentNode.replaceChild(newDownloadBtn, downloadBtn);
        downloadBtn = newDownloadBtn;

        downloadBtn.addEventListener("click", () => {
            showButtonLoading(downloadBtn, downloadBtnText, downloadBtnLoader);
            setTimeout(() => {
                downloadZip().then(() => {
                    hideButtonLoading(downloadBtn, downloadBtnText, downloadBtnLoader);
                }).catch((error) => {
                    console.error("Error creating zip:", error);
                    hideButtonLoading(downloadBtn, downloadBtnText, downloadBtnLoader);
                    showError("There was a problem creating your zip file. Please try again.");
                });
            }, 50);
        });
    }
    
    // Download slices as zip file
    async function downloadZip() {
        if (slicedImages.length === 0) return;
        
        const zip = new JSZip();
        const isHighRes = highResToggle.checked;
        const folderName = isHighRes ? 'high_res_slices' : 'standard_slices';
        
        // Add the full view as slice_00.jpg if available
        if (fullViewImage) {
            const imageData = fullViewImage.dataURL.split(',')[1];
            zip.file(`${folderName}/slice_00_full_view.jpg`, imageData, { base64: true });
        }
        
        // Add each slice to the zip
        slicedImages.forEach(slice => {
            // Convert data URL to blob
            const imageData = slice.dataURL.split(',')[1];
            zip.file(`${folderName}/slice_${String(slice.number).padStart(2, '0')}.jpg`, imageData, { base64: true });
        });
        
        // Add a readme file explaining the full view
        const currentDate = new Date().toISOString().split('T')[0];
        const readmeContent = 
`Instagram Panorama Slicer - Created by FUTC (@FUTC.Photography on Instagram)

IF YOU LIKE THIS TOOL, PLEASE CONSIDER SUPPORTING ME BY CHECKING OUT MY LIGHTROOM PRESET PACKS (this link includes a heavy discount): https://futc.gumroad.com/l/analogvibes2/panosplitter

This package contains:
- slice_00_full_view.jpg: A complete view of your panorama that fits Instagram's 4:5 aspect ratio
- slice_01.jpg to slice_${String(slicedImages.length).padStart(2, '0')}.jpg: Individual slices of your panorama

For best results on Instagram:
1. Make an instagram carousel post adding slice_01.jpg through slice_${String(slicedImages.length).padStart(2, '0')}.jpg in order
2. Add slice_00_full_view.jpg either as the first or last image in the carousel
`;
        
        zip.file('README.txt', readmeContent);
        
        // Generate zip file
        const content = await zip.generateAsync({ type: 'blob' });
        saveAs(content, 'instagram_carousel_slices.zip');
    }

    function resetApp() {
        fileInput.value = "";
        previewContainer.style.display = "none";
        resultContainer.style.display = "none";
        errorMessage.style.display = "none";
        uploadArea.style.display = "block";
        originalImage = null;
        slicedImages = [];
        fullViewImage = null;
        previewImg.src = "";
    }
});
