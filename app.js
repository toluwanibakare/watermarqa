// IndexedDB Helper for persistent watermark storage
const DB_NAME = 'WatermarqaDB';
const DB_VERSION = 1;
const STORE_NAME = 'settings';
const WATERMARK_KEY = 'saved_watermark';

class SettingsDB {
    static open() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };
        });
    }

    static async getWatermark() {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(WATERMARK_KEY);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
        });
    }

    static async saveWatermark(blob) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(blob, WATERMARK_KEY);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }

    static async clearWatermark() {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(WATERMARK_KEY);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }
}

// App State
let watermarkImage = null;
let uploadedPhotos = []; // Array of objects: { id, name, originalImage }
let activeModalPhotoId = null;

// DOM Elements
const watermarkInput = document.getElementById('watermark-input');
const watermarkDropzone = document.getElementById('watermark-dropzone');
const watermarkPrompt = document.getElementById('watermark-prompt');
const watermarkPreviewContainer = document.getElementById('watermark-preview-container');
const watermarkPreview = document.getElementById('watermark-preview');
const btnRemoveWatermark = document.getElementById('btn-remove-watermark');

const controlSize = document.getElementById('control-size');
const controlPosX = document.getElementById('control-pos-x');
const controlPosY = document.getElementById('control-pos-y');
const controlOpacity = document.getElementById('control-opacity');
const valSize = document.getElementById('val-size');
const valPosX = document.getElementById('val-pos-x');
const valPosY = document.getElementById('val-pos-y');
const valOpacity = document.getElementById('val-opacity');

const btnDecX = document.getElementById('btn-dec-x');
const btnIncX = document.getElementById('btn-inc-x');
const btnDecY = document.getElementById('btn-dec-y');
const btnIncY = document.getElementById('btn-inc-y');

const photosInput = document.getElementById('photos-input');
const photosDropzone = document.getElementById('photos-dropzone');

const previewCard = document.getElementById('preview-card');
const photoCount = document.getElementById('photo-count');
const previewGrid = document.getElementById('preview-grid');
const btnClearAll = document.getElementById('btn-clear-all');
const btnDownloadAll = document.getElementById('btn-download-all');

const previewModal = document.getElementById('preview-modal');
const modalImg = document.getElementById('modal-img');
const modalCaption = document.getElementById('modal-caption');
const modalClose = document.getElementById('modal-close');

// Initialize
window.addEventListener('DOMContentLoaded', async () => {
    setupDragAndDrop(watermarkDropzone, watermarkInput, handleWatermarkSelect);
    setupDragAndDrop(photosDropzone, photosInput, handlePhotosSelect);
    setupControls();
    setupModal();
    
    // Load saved watermark
    try {
        const savedBlob = await SettingsDB.getWatermark();
        if (savedBlob) {
            await loadWatermarkFromBlob(savedBlob);
        }
    } catch (err) {
        console.error('Failed to load saved watermark', err);
    }
});

// Setup Drag & Drop listeners
function setupDragAndDrop(dropzone, input, fileHandler) {
    // Safari fix: Prevent click event loops
    dropzone.addEventListener('click', (e) => {
        if (e.target !== input) {
            input.click();
        }
    });
    
    input.addEventListener('click', (e) => {
        e.stopPropagation();
    });
    
    input.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            fileHandler(e.target.files);
        }
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.add('dragover');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.remove('dragover');
        }, false);
    });

    dropzone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
            fileHandler(files);
        }
    }, false);
}

// Handle Watermark Loading
async function handleWatermarkSelect(files) {
    const file = files[0];
    if (!file || !file.type.startsWith('image/')) return;

    try {
        await SettingsDB.saveWatermark(file);
        await loadWatermarkFromBlob(file);
    } catch (err) {
        console.error('Failed to save watermark', err);
    }
}

function loadWatermarkFromBlob(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                watermarkImage = img;
                watermarkPreview.src = e.target.result;
                watermarkPrompt.classList.add('hidden');
                watermarkPreviewContainer.classList.remove('hidden');
                
                // Reprocess all photos with the new watermark
                processAllPhotos();
                resolve();
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

btnRemoveWatermark.addEventListener('click', async (e) => {
    e.stopPropagation(); // Avoid triggering file selection
    watermarkImage = null;
    watermarkPreview.src = '';
    watermarkPreviewContainer.classList.add('hidden');
    watermarkPrompt.classList.remove('hidden');
    watermarkInput.value = '';
    
    await SettingsDB.clearWatermark();
    processAllPhotos();
});

// Setup settings sliders and buttons
function setupControls() {
    const updateLabel = (input, label, suffix = '') => {
        label.textContent = input.value + suffix;
    };

    controlSize.addEventListener('input', () => {
        updateLabel(controlSize, valSize, '%');
        processAllPhotos();
    });

    // X-axis Slider + Buttons
    controlPosX.addEventListener('input', () => {
        updateLabel(controlPosX, valPosX);
        processAllPhotos();
    });
    btnDecX.addEventListener('click', () => {
        controlPosX.value = Math.max(parseInt(controlPosX.min), parseInt(controlPosX.value) - 1);
        updateLabel(controlPosX, valPosX);
        processAllPhotos();
    });
    btnIncX.addEventListener('click', () => {
        controlPosX.value = Math.min(parseInt(controlPosX.max), parseInt(controlPosX.value) + 1);
        updateLabel(controlPosX, valPosX);
        processAllPhotos();
    });

    // Y-axis Slider + Buttons
    controlPosY.addEventListener('input', () => {
        updateLabel(controlPosY, valPosY);
        processAllPhotos();
    });
    btnDecY.addEventListener('click', () => {
        controlPosY.value = Math.max(parseInt(controlPosY.min), parseInt(controlPosY.value) - 1);
        updateLabel(controlPosY, valPosY);
        processAllPhotos();
    });
    btnIncY.addEventListener('click', () => {
        controlPosY.value = Math.min(parseInt(controlPosY.max), parseInt(controlPosY.value) + 1);
        updateLabel(controlPosY, valPosY);
        processAllPhotos();
    });

    controlOpacity.addEventListener('input', () => {
        updateLabel(controlOpacity, valOpacity, '%');
        processAllPhotos();
    });
}

// Handle Photo Uploads
async function handlePhotosSelect(files) {
    const validFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
    
    for (const file of validFiles) {
        const originalImage = await loadImageFromFile(file);
        uploadedPhotos.push({
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            name: file.name,
            originalImage: originalImage
        });
    }

    if (uploadedPhotos.length > 0) {
        previewCard.classList.remove('hidden');
    }

    processAllPhotos();
    photosInput.value = ''; // Reset input to allow re-upload of same file
}

function loadImageFromFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Setup Modal Events
function setupModal() {
    const closeModal = () => {
        previewModal.classList.add('hidden');
        activeModalPhotoId = null;
    };

    modalClose.addEventListener('click', closeModal);
    previewModal.addEventListener('click', (e) => {
        if (e.target === previewModal) {
            closeModal();
        }
    });

    // Close on ESC key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !previewModal.classList.contains('hidden')) {
            closeModal();
        }
    });
}

// Main processing logic
function processAllPhotos() {
    previewGrid.innerHTML = '';
    photoCount.textContent = uploadedPhotos.length;

    if (uploadedPhotos.length === 0) {
        previewCard.classList.add('hidden');
        previewModal.classList.add('hidden');
        activeModalPhotoId = null;
        return;
    }

    uploadedPhotos.forEach(photo => {
        const container = document.createElement('div');
        container.className = 'preview-item';
        container.dataset.id = photo.id;

        // Header/Delete button
        const btnRemove = document.createElement('button');
        btnRemove.className = 'btn-remove-item';
        btnRemove.innerHTML = '&times;';
        btnRemove.title = 'Remove image';
        btnRemove.onclick = (e) => {
            e.stopPropagation();
            uploadedPhotos = uploadedPhotos.filter(p => p.id !== photo.id);
            if (activeModalPhotoId === photo.id) {
                previewModal.classList.add('hidden');
                activeModalPhotoId = null;
            }
            processAllPhotos();
        };
        container.appendChild(btnRemove);

        // Preview canvas
        const imgWrapper = document.createElement('div');
        imgWrapper.className = 'preview-img-wrapper';
        imgWrapper.onclick = () => {
            activeModalPhotoId = photo.id;
            updateModalView();
            previewModal.classList.remove('hidden');
        };
        
        const previewImg = document.createElement('img');
        const watermarkedDataUrl = applyWatermark(photo.originalImage);
        previewImg.src = watermarkedDataUrl;
        imgWrapper.appendChild(previewImg);
        container.appendChild(imgWrapper);

        // Info and Download
        const infoDiv = document.createElement('div');
        infoDiv.className = 'preview-info';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'preview-name';
        nameSpan.textContent = photo.name;
        infoDiv.appendChild(nameSpan);

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'preview-actions';

        const btnDownload = document.createElement('a');
        btnDownload.className = 'btn btn-secondary btn-sm';
        btnDownload.href = watermarkedDataUrl;
        btnDownload.download = 'watermarqt_' + photo.name;
        btnDownload.innerHTML = 'Download';
        actionsDiv.appendChild(btnDownload);

        infoDiv.appendChild(actionsDiv);
        container.appendChild(infoDiv);

        previewGrid.appendChild(container);
    });

    // Update modal if currently viewing an active photo
    if (activeModalPhotoId) {
        updateModalView();
    }
}

// Update the modal contents live
function updateModalView() {
    const photo = uploadedPhotos.find(p => p.id === activeModalPhotoId);
    if (photo) {
        modalImg.src = applyWatermark(photo.originalImage);
        modalCaption.textContent = photo.name;
    } else {
        previewModal.classList.add('hidden');
        activeModalPhotoId = null;
    }
}

// Core Watermarking Canvas logic
function applyWatermark(originalImg) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Make canvas same resolution as original photo
    canvas.width = originalImg.naturalWidth;
    canvas.height = originalImg.naturalHeight;

    // Draw main image
    ctx.drawImage(originalImg, 0, 0);

    // Apply watermark if loaded
    if (watermarkImage) {
        const sizePct = parseFloat(controlSize.value) / 100;
        const posXSlider = parseFloat(controlPosX.value); // 0 to 100
        const posYSlider = parseFloat(controlPosY.value); // 0 to 100
        const opacity = parseFloat(controlOpacity.value) / 100;

        // Calculate size relative to image width
        const wmWidth = canvas.width * sizePct;
        const aspect = watermarkImage.naturalHeight / watermarkImage.naturalWidth;
        const wmHeight = wmWidth * aspect;

        // Map -100 to 100 slider inputs (where 0 is default center/bottom alignment)
        // Deviations are scaled by 15 for X and 70 for Y to achieve high virtual range bounds.
        const posX = 0.5 + (posXSlider / 100) * 15;
        const posY = 0.96 + (posYSlider / 100) * 70;

        // Calculate custom positions
        const x = (canvas.width - wmWidth) * posX;
        const y = (canvas.height - wmHeight) * posY;

        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.drawImage(watermarkImage, x, y, wmWidth, wmHeight);
        ctx.restore();
    }

    return canvas.toDataURL('image/jpeg', 0.92);
}

// Clear all
btnClearAll.addEventListener('click', () => {
    uploadedPhotos = [];
    processAllPhotos();
});

// Download All (ZIP)
btnDownloadAll.addEventListener('click', async () => {
    if (uploadedPhotos.length === 0) return;

    btnDownloadAll.disabled = true;
    btnDownloadAll.textContent = 'Generating ZIP...';

    try {
        const zip = new JSZip();
        
        uploadedPhotos.forEach(photo => {
            const dataUrl = applyWatermark(photo.originalImage);
            // Split metadata prefix to get raw base64 string
            const base64Data = dataUrl.split(',')[1];
            zip.file('watermarqt_' + photo.name, base64Data, { base64: true });
        });

        const content = await zip.generateAsync({ type: 'blob' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = 'watermarqt_photos.zip';
        link.click();
        
        // Cleanup URL object
        setTimeout(() => URL.revokeObjectURL(link.href), 100);
    } catch (err) {
        console.error('Error creating ZIP archive', err);
        alert('Could not generate ZIP archive. Please download images individually.');
    } finally {
        btnDownloadAll.disabled = false;
        btnDownloadAll.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Download All (ZIP)`;
    }
});
