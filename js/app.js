/**
 * Main application logic for PDF Upload to Fabric Lakehouse
 */

let selectedFiles = [];

/**
 * Initialize application
 */
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
});

/**
 * Set up event listeners
 */
function initializeEventListeners() {
    // Authentication buttons
    const signInBtn = document.getElementById('signInBtn');
    const signOutBtn = document.getElementById('signOutBtn');
    
    if (signInBtn) {
        signInBtn.addEventListener('click', signIn);
    }
    
    if (signOutBtn) {
        signOutBtn.addEventListener('click', signOut);
    }

    // File input and drag-drop
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);
    
    // Drag and drop events
    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('dragleave', handleDragLeave);
    dropZone.addEventListener('drop', handleDrop);
    
    // Upload button
    const uploadBtn = document.getElementById('uploadBtn');
    uploadBtn.addEventListener('click', handleUpload);
    
    // Lakehouse selection
    const lakehouseSelect = document.getElementById('lakehouseSelect');
    lakehouseSelect.addEventListener('change', updateUploadButton);

    // Report type selection - auto-fills folder path
    const reportType = document.getElementById('reportType');
    reportType.addEventListener('change', () => {
        document.getElementById('folderPath').value = reportType.value || '';
        updateUploadButton();
    });
}

/**
 * Handle file selection from input
 */
function handleFileSelect(event) {
    const files = Array.from(event.target.files);
    addFiles(files);
}

/**
 * Handle drag over event
 */
function handleDragOver(event) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.classList.add('dragover');
}

/**
 * Handle drag leave event
 */
function handleDragLeave(event) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.classList.remove('dragover');
}

/**
 * Handle drop event
 */
function handleDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.classList.remove('dragover');
    
    const files = Array.from(event.dataTransfer.files).filter(file => 
        file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    );
    
    if (files.length > 0) {
        addFiles(files);
    } else {
        showNotification('Please drop only PDF files', 'warning');
    }
}

/**
 * Add files to the upload queue
 */
function addFiles(files) {
    // Filter for PDF files only
    const pdfFiles = files.filter(file => 
        file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    );
    
    if (pdfFiles.length === 0) {
        showNotification('Please select only PDF files', 'warning');
        return;
    }
    
    // Add to selected files (avoid duplicates)
    pdfFiles.forEach(file => {
        const exists = selectedFiles.some(f => f.name === file.name && f.size === file.size);
        if (!exists) {
            selectedFiles.push(file);
        }
    });
    
    updateFilesList();
    updateUploadButton();
    
    if (pdfFiles.length !== files.length) {
        showNotification(`Added ${pdfFiles.length} PDF file(s). Non-PDF files were ignored.`, 'info');
    }
}

/**
 * Update the files list display
 */
function updateFilesList() {
    const filesList = document.getElementById('filesList');
    const filesListItems = document.getElementById('filesListItems');
    
    if (selectedFiles.length === 0) {
        filesList.classList.add('hidden');
        return;
    }
    
    filesList.classList.remove('hidden');
    filesListItems.innerHTML = '';
    
    selectedFiles.forEach((file, index) => {
        const li = document.createElement('li');
        li.className = 'file-item';
        
        const fileSize = formatFileSize(file.size);
        
        li.innerHTML = `
            <div class="file-name">
                <svg class="w-5 h-5 pdf-icon" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd" />
                </svg>
                <span class="text-sm font-medium text-gray-900">${file.name}</span>
            </div>
            <div class="flex items-center gap-3">
                <span class="file-size">${fileSize}</span>
                <button class="remove-file-btn" onclick="removeFile(${index})" title="Remove file">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>
        `;
        
        filesListItems.appendChild(li);
    });
}

/**
 * Remove file from selection
 */
function removeFile(index) {
    selectedFiles.splice(index, 1);
    updateFilesList();
    updateUploadButton();
    
    // Reset file input
    document.getElementById('fileInput').value = '';
}

/**
 * Update upload button state
 */
function updateUploadButton() {
    const uploadBtn = document.getElementById('uploadBtn');
    const lakehouseSelect = document.getElementById('lakehouseSelect');
    const reportType = document.getElementById('reportType');
    
    const canUpload = selectedFiles.length > 0 && lakehouseSelect.value !== '' && reportType.value !== '';
    uploadBtn.disabled = !canUpload;
}

/**
 * Handle upload process
 */
async function handleUpload() {
    if (selectedFiles.length === 0) {
        showNotification('Please select files to upload', 'warning');
        return;
    }
    
    const lakehouseId = document.getElementById('lakehouseSelect').value;
    if (!lakehouseId) {
        showNotification('Please select a lakehouse', 'warning');
        return;
    }
    
    const reportType = document.getElementById('reportType').value;
    if (!reportType) {
        showNotification('Please select a report type', 'warning');
        return;
    }
    
    const folderPath = document.getElementById('folderPath').value.trim();
    
    // Disable upload button and show progress section
    const uploadBtn = document.getElementById('uploadBtn');
    uploadBtn.disabled = true;
    uploadBtn.innerHTML = '<span class="spinner mr-2"></span> Uploading...';
    
    const progressSection = document.getElementById('progressSection');
    const progressItems = document.getElementById('progressItems');
    progressSection.classList.remove('hidden');
    progressItems.innerHTML = '';
    
    // Create progress items for each file
    const progressCallbacks = selectedFiles.map((file, index) => {
        const progressItem = createProgressItem(file.name, index);
        progressItems.appendChild(progressItem);
        
        return (progress) => updateProgress(index, progress);
    });
    
    try {
        // Create folder if specified
        if (folderPath) {
            await createFolderIfNeeded(lakehouseId, folderPath);
        }
        
        // Upload files
        const results = await uploadFiles(selectedFiles, lakehouseId, folderPath, progressCallbacks);
        
        // Show results
        const successCount = results.filter(r => r.success).length;
        const failureCount = results.length - successCount;
        
        if (failureCount === 0) {
            showNotification(`Successfully uploaded ${successCount} file(s)!`, 'success');
        } else if (successCount === 0) {
            showNotification(`Failed to upload all ${failureCount} file(s)`, 'error');
        } else {
            showNotification(`Uploaded ${successCount} file(s). ${failureCount} failed.`, 'warning');
        }
        
        // Clear selected files after successful uploads
        if (successCount > 0) {
            selectedFiles = selectedFiles.filter((_, index) => !results[index].success);
            updateFilesList();
            document.getElementById('fileInput').value = '';
        }
        
    } catch (error) {
        console.error('Upload error:', error);
        showNotification('Upload failed: ' + error.message, 'error');
    } finally {
        // Re-enable upload button
        uploadBtn.innerHTML = 'Upload Files';
        updateUploadButton();
    }
}

/**
 * Create a progress item element
 */
function createProgressItem(fileName, index) {
    const div = document.createElement('div');
    div.className = 'progress-item';
    div.id = `progress-${index}`;
    
    div.innerHTML = `
        <div class="flex items-center justify-between mb-2">
            <span class="text-sm font-medium text-gray-700">${fileName}</span>
            <span id="progress-status-${index}" class="text-sm text-gray-500">0%</span>
        </div>
        <div class="progress-bar-container">
            <div id="progress-bar-${index}" class="progress-bar" style="width: 0%"></div>
        </div>
    `;
    
    return div;
}

/**
 * Update progress for a file
 */
function updateProgress(index, progress) {
    const progressBar = document.getElementById(`progress-bar-${index}`);
    const progressStatus = document.getElementById(`progress-status-${index}`);
    
    if (progress < 0) {
        // Error state
        progressBar.style.width = '100%';
        progressBar.classList.add('error');
        progressStatus.textContent = 'Failed';
        progressStatus.classList.add('text-red-600');
    } else if (progress >= 100) {
        // Success state
        progressBar.style.width = '100%';
        progressBar.classList.add('success');
        progressStatus.textContent = 'Complete';
        progressStatus.classList.add('text-green-600');
    } else {
        // In progress
        progressBar.style.width = `${progress}%`;
        progressStatus.textContent = `${progress}%`;
    }
}

/**
 * Show notification
 */
function showNotification(message, type = 'info') {
    const notifications = document.getElementById('notifications');
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    const icon = getNotificationIcon(type);
    
    notification.innerHTML = `
        <div class="flex items-start gap-3">
            ${icon}
            <div class="flex-1">
                <p class="text-sm font-medium text-gray-900">${message}</p>
            </div>
            <button onclick="this.parentElement.parentElement.remove()" class="text-gray-400 hover:text-gray-600">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
            </button>
        </div>
    `;
    
    notifications.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

/**
 * Get notification icon based on type
 */
function getNotificationIcon(type) {
    const icons = {
        success: '<svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>',
        error: '<svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>',
        warning: '<svg class="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>',
        info: '<svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>'
    };
    return icons[type] || icons.info;
}

/**
 * Format file size for display
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}
