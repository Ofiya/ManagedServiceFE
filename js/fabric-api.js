/**
 * Microsoft Fabric Lakehouse API integration
 */

/**
 * Load available lakehouses
 */
async function loadLakehouses() {
    const lakehouseSelect = document.getElementById('lakehouseSelect');
    lakehouseSelect.innerHTML = '<option value="">Loading lakehouses...</option>';

    try {
        const token = await getAccessToken('powerbi');
        
        // API endpoint to get lakehouses
        // Note: You'll need to replace this with your actual Fabric workspace ID and API endpoint
        const workspaceId = CONFIG.fabricWorkspaceId;
        const apiUrl = `https://api.fabric.microsoft.com/v1/workspaces/${workspaceId}/lakehouses`;

        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to load lakehouses: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        if (data.value && data.value.length > 0) {
            lakehouseSelect.innerHTML = '<option value="">Select a lakehouse...</option>';
            data.value.forEach(lakehouse => {
                const option = document.createElement('option');
                option.value = lakehouse.id;
                option.textContent = lakehouse.displayName;
                lakehouseSelect.appendChild(option);
            });
        } else {
            lakehouseSelect.innerHTML = '<option value="">No lakehouses found</option>';
            showNotification('No lakehouses found in workspace', 'warning');
        }
    } catch (error) {
        console.error('Error loading lakehouses:', error);
        lakehouseSelect.innerHTML = '<option value="">Error loading lakehouses</option>';
        showNotification('Failed to load lakehouses: ' + error.message, 'error');
    }
}

/**
 * Upload file to Fabric Lakehouse using OneLake File System API (ADLS Gen2)
 */
async function uploadFileToLakehouse(file, lakehouseId, folderPath, progressCallback) {
    try {
        console.log('Starting upload:', {
            fileName: file.name,
            workspaceId: CONFIG.fabricWorkspaceId,
            lakehouseId,
            fileSize: file.size
        });
        
        // Get Power BI token for Fabric REST API (to get lakehouse name)
        const powerBiToken = await getAccessToken('powerbi');
        const workspaceId = CONFIG.fabricWorkspaceId;
        
        // Get lakehouse name (required for OneLake DFS API)
        const lakehouseUrl = `https://api.fabric.microsoft.com/v1/workspaces/${workspaceId}/lakehouses/${lakehouseId}`;
        const lakehouseResponse = await fetch(lakehouseUrl, {
            headers: {
                'Authorization': `Bearer ${powerBiToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!lakehouseResponse.ok) {
            throw new Error(`Cannot get lakehouse: ${lakehouseResponse.statusText}`);
        }
        
        const lakehouseInfo = await lakehouseResponse.json();
        const lakehouseName = lakehouseInfo.displayName;
        console.log('Lakehouse name:', lakehouseName);
        console.log('Using lakehouse ID for OneLake:', lakehouseId);
        
        progressCallback(20);
        
        // Get Storage token for OneLake DFS API
        const storageToken = await getAccessToken('storage');
        console.log('Storage token acquired for OneLake');
        
        // Construct the file path (use lakehouse ID, not name)
        const fileName = file.name;
        const fullPath = folderPath ? `Files/${folderPath}/${fileName}` : `Files/${fileName}`;
        
        console.log('Full path:', fullPath);
        
        // Read file as ArrayBuffer
        const fileBuffer = await file.arrayBuffer();
        progressCallback(40);
        
        // OneLake DFS API - Step 1: Create the file
        // Use lakehouse ID instead of name in the URL
        const createUrl = `https://onelake.dfs.fabric.microsoft.com/${workspaceId}/${lakehouseId}/${fullPath}?resource=file`;
        console.log('Step 1 - Create file:', createUrl);
        
        const createResponse = await fetch(createUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${storageToken}`,
                'x-ms-version': '2020-04-08'
            },
            body: new Uint8Array(0)
        });
        
        if (!createResponse.ok) {
            const errorText = await createResponse.text();
            console.error('Create failed:', errorText);
            throw new Error(`Create failed: ${createResponse.status} - ${errorText}`);
        }
        
        console.log('Step 1 - File created');
        progressCallback(60);
        
        // Step 2: Append content
        const appendUrl = `https://onelake.dfs.fabric.microsoft.com/${workspaceId}/${lakehouseId}/${fullPath}?action=append&position=0`;
        console.log('Step 2 - Append content');
        
        const appendResponse = await fetch(appendUrl, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${storageToken}`,
                'x-ms-version': '2020-04-08',
                'Content-Type': 'application/octet-stream'
            },
            body: fileBuffer
        });
        
        if (!appendResponse.ok) {
            const errorText = await appendResponse.text();
            console.error('Append failed:', errorText);
            throw new Error(`Append failed: ${appendResponse.status} - ${errorText}`);
        }
        
        console.log('Step 2 - Content appended');
        progressCallback(80);
        
        // Step 3: Flush the file
        const flushUrl = `https://onelake.dfs.fabric.microsoft.com/${workspaceId}/${lakehouseId}/${fullPath}?action=flush&position=${fileBuffer.byteLength}`;
        console.log('Step 3 - Flush file');
        
        const flushResponse = await fetch(flushUrl, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${storageToken}`,
                'x-ms-version': '2020-04-08'
            },
            body: new Uint8Array(0)
        });
        
        if (!flushResponse.ok) {
            const errorText = await flushResponse.text();
            console.error('Flush failed:', errorText);
            throw new Error(`Flush failed: ${flushResponse.status} - ${errorText}`);
        }
        
        console.log('Step 3 - File flushed');
        progressCallback(100);
        console.log('Upload successful:', fileName);
        
        return {
            success: true,
            fileName: fileName,
            path: fullPath
        };
    } catch (error) {
        console.error('Upload error:', error);
        progressCallback(-1);
        return {
            success: false,
            fileName: file.name,
            error: error.message
        };
    }
}

/**
 * Upload multiple files with progress tracking
 */
async function uploadFiles(files, lakehouseId, folderPath, progressCallbacks) {
    const results = [];
    
    // First, verify we have a valid lakehouse
    try {
        const token = await getAccessToken('powerbi');
        const workspaceId = CONFIG.fabricWorkspaceId;
        
        console.log('Verifying lakehouse access...');
        const lakehouseUrl = `https://api.fabric.microsoft.com/v1/workspaces/${workspaceId}/lakehouses/${lakehouseId}`;
        const lakehouseResponse = await fetch(lakehouseUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!lakehouseResponse.ok) {
            const errorText = await lakehouseResponse.text();
            console.error('Lakehouse verification failed:', errorText);
            showNotification(`Cannot access lakehouse: ${lakehouseResponse.status} ${lakehouseResponse.statusText}`, 'error');
            
            // Mark all as failed
            return files.map(file => ({
                success: false,
                fileName: file.name,
                error: `Cannot access lakehouse: ${lakehouseResponse.statusText}`
            }));
        }
        
        const lakehouseInfo = await lakehouseResponse.json();
        console.log('Lakehouse verified:', lakehouseInfo);
        
    } catch (error) {
        console.error('Error verifying lakehouse:', error);
        showNotification('Error verifying lakehouse access: ' + error.message, 'error');
    }
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const progressCallback = progressCallbacks[i];
        
        const result = await uploadFileToLakehouse(file, lakehouseId, folderPath, progressCallback);
        results.push(result);
        
        // Small delay between uploads to avoid rate limiting
        if (i < files.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
    
    return results;
}

/**
 * Create folder in lakehouse (if needed)
 */
async function createFolderIfNeeded(lakehouseId, folderPath) {
    if (!folderPath) return; // No folder to create
    
    try {
        const token = await getAccessToken();
        const workspaceId = CONFIG.fabricWorkspaceId;
        
        const oneLakeUrl = `https://onelake.dfs.fabric.microsoft.com/${workspaceId}/${lakehouseId}/Files/${folderPath}`;
        
        // Try to create directory using PUT with x-ms-resource-type header
        await fetch(`${oneLakeUrl}?resource=directory`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Length': '0'
            }
        });
        
        // Note: If the folder already exists, this might return an error, which is fine
    } catch (error) {
        // Ignore errors - folder might already exist
        console.log('Folder creation note:', error.message);
    }
}
