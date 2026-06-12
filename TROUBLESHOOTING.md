# Troubleshooting Upload Failures

## Current Issue
PDF files are failing to upload to the Fabric Lakehouse.

## Debugging Steps

### 1. Check Browser Console
1. Open your browser's Developer Tools (F12)
2. Go to the **Console** tab
3. Try uploading a file
4. Look for error messages - they will show:
   - Upload URL being used
   - HTTP status codes
   - Detailed error messages

### 2. Verify Authentication
Check that you're properly authenticated:
```javascript
// In browser console, run:
console.log('Token available:', !!currentAccount);
console.log('User:', currentAccount?.username);
```

### 3. Verify Azure AD API Permissions
In Azure Portal > App Registrations > Your App > API Permissions, you need:

**Power BI Service API:**
- ✅ `Item.ReadWrite.All` (Delegated)
- ✅ `Workspace.Read.All` (Delegated)
- ✅ `Dataset.ReadWrite.All` (Delegated)

**Status:** Must show "Granted for [Your Organization]"

### 4. Check Lakehouse Selection
- Make sure you've selected a lakehouse from the dropdown
- The lakehouse ID should appear in the console logs

### 5. Test API Connectivity

Open browser console and run:
```javascript
// Test token acquisition
getAccessToken().then(token => {
    console.log('Token acquired:', token.substring(0, 50) + '...');
}).catch(err => {
    console.error('Token error:', err);
});

// Test lakehouse listing
loadLakehouses();
```

## Common Errors and Solutions

### Error: "401 Unauthorized"
**Cause:** Missing or invalid authentication token
**Solution:**
1. Sign out and sign back in
2. Check API permissions in Azure AD
3. Verify the app has admin consent

### Error: "403 Forbidden"
**Cause:** Insufficient permissions on the lakehouse
**Solution:**
1. Verify you're a Contributor or Admin on the Fabric workspace
2. Check that the lakehouse exists and you have write access
3. Verify API permissions include `Item.ReadWrite.All`

### Error: "404 Not Found"
**Cause:** Incorrect workspace or lakehouse ID
**Solution:**
1. Verify workspace ID in config.js matches your Fabric workspace
2. Check that the lakehouse ID is correct
3. Ensure the lakehouse exists in the workspace

### Error: "CORS policy"
**Cause:** Cross-Origin Resource Sharing restriction
**Solution:**
1. This usually means wrong API endpoint
2. Check that you're using the correct Fabric API URLs
3. Verify your app is registered with the correct redirect URIs

## Alternative Upload Method: Manual API Testing

### Using PowerShell to Test Upload

```powershell
# Get your access token (from browser console after sign-in)
$token = "YOUR_ACCESS_TOKEN_HERE"
$workspaceId = "YOUR_WORKSPACE_ID"
$lakehouseId = "YOUR_LAKEHOUSE_ID"
$filePath = "C:\path\to\your\file.pdf"
$fileName = "test.pdf"

# Upload via Fabric API
$uri = "https://api.fabric.microsoft.com/v1/workspaces/$workspaceId/lakehouses/$lakehouseId/files/$fileName"
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/octet-stream"
}

Invoke-RestMethod -Uri $uri -Method PUT -Headers $headers -InFile $filePath
```

### Using Python to Test

```python
import requests

token = "YOUR_ACCESS_TOKEN_HERE"
workspace_id = "YOUR_WORKSPACE_ID"
lakehouse_id = "YOUR_LAKEHOUSE_ID"
file_path = "path/to/file.pdf"
file_name = "test.pdf"

url = f"https://api.fabric.microsoft.com/v1/workspaces/{workspace_id}/lakehouses/{lakehouse_id}/files/{file_name}"

headers = {
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/octet-stream"
}

with open(file_path, 'rb') as f:
    response = requests.put(url, headers=headers, data=f)
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")
```

## Correct API Endpoints for Fabric Lakehouse

Fabric has evolved its APIs. Here are the current endpoints:

### Option 1: Fabric REST API (Recommended)
```
PUT https://api.fabric.microsoft.com/v1/workspaces/{workspaceId}/lakehouses/{lakehouseId}/files/{filePath}
```

### Option 2: OneLake File System API (ADLS Gen2 Compatible)
```
PUT https://onelake.dfs.fabric.microsoft.com/{workspaceId}/{lakehouseId}/Files/{filePath}
Headers:
  - x-ms-version: 2020-04-08
  - x-ms-blob-type: BlockBlob
```

### Option 3: Lakehouse Upload API (If available)
```
POST https://api.fabric.microsoft.com/v1/workspaces/{workspaceId}/lakehouses/{lakehouseId}/upload
```

## Verify Lakehouse Access

Run this in browser console after signing in:
```javascript
async function testLakehouseAccess() {
    try {
        const token = await getAccessToken();
        const workspaceId = CONFIG.fabricWorkspaceId;
        
        // List lakehouses
        const response = await fetch(
            `https://api.fabric.microsoft.com/v1/workspaces/${workspaceId}/lakehouses`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        const data = await response.json();
        console.log('Available lakehouses:', data);
        
        if (data.value && data.value.length > 0) {
            const lakehouse = data.value[0];
            console.log('Testing access to:', lakehouse.displayName);
            console.log('Lakehouse ID:', lakehouse.id);
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

testLakehouseAccess();
```

## Next Steps

1. **Refresh the page** to load the updated code
2. **Open Developer Tools** (F12) and check Console tab
3. **Sign in again** to get a fresh token
4. **Try uploading** and watch the console for detailed error messages
5. **Share the console output** with IT/support if issues persist

## Getting More Help

If the issue persists, collect this information:
- Browser console errors (screenshots)
- Network tab showing failed requests
- Your workspace ID and lakehouse ID
- Azure AD app permissions screenshot
- Your role/permissions in the Fabric workspace
