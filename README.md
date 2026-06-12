# Inforcer Assessment Reports Upload Platform

A comprehensive solution for uploading assessment reports to Microsoft Fabric Lakehouse with both web interface and automated OneDrive sync capabilities.

## Features

### Web Upload Interface
- 🔐 **Secure Authentication** - Microsoft Entra ID (Azure AD) authentication using MSAL.js
- 📁 **Drag & Drop Upload** - Easy file upload with drag-and-drop support
- 🎯 **Multiple Files** - Upload multiple PDF files at once
- 📊 **Progress Tracking** - Real-time upload progress for each file
- 🎨 **Modern UI** - Clean, responsive interface with security carousel
- 🎨 **Reliance Branding** - Professional design with company logo and colors

### Automated OneDrive Sync
- 🔄 **Bulk Import** - Automatically sync entire folders from OneDrive/SharePoint
- 🤖 **Scheduled Sync** - Run on a schedule for continuous synchronization
- 📂 **Smart Categorization** - Automatically organizes files by report type
- 💾 **Batch Processing** - Handle hundreds of files efficiently
- ⚡ **Dry-Run Mode** - Test before actual sync

## Prerequisites

Before using this application, you need:

1. **Microsoft Fabric Access**
   - Active Microsoft Fabric subscription
   - Workspace with at least one Lakehouse created
   - Contributor or higher permissions on the workspace

2. **Azure AD App Registration**
   - Azure subscription
   - Permissions to create app registrations in Azure AD

## Setup Instructions

### 1. Create Azure AD App Registration

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **App registrations** > **New registration**
3. Fill in the details:
   - **Name**: `Fabric PDF Upload App` (or your preferred name)
   - **Supported account types**: Select appropriate option (typically "Accounts in this organizational directory only")
   - **Redirect URI**: Select "Single-page application (SPA)" and enter your URL (e.g., `http://localhost:8080` for local testing)
4. Click **Register**

### 2. Configure API Permissions

1. In your app registration, go to **API permissions**
2. Click **Add a permission**
3. Add the following permissions:
   - **Microsoft Graph**
     - `User.Read` (Delegated)
   - **Microsoft Fabric API** (may be listed as "Power BI Service")
     - `Item.ReadWrite.All` (Delegated)
     - `Workspace.Read.All` (Delegated)
4. Click **Grant admin consent** for your organization

### 3. Configure Authentication

1. In your app registration, go to **Authentication**
2. Under **Single-page application**, add your redirect URIs:
   - For local development: `http://localhost:8080`
   - For production: Your production URL
3. Under **Implicit grant and hybrid flows**, ensure nothing is checked (SPA uses PKCE)
4. Save changes

### 4. Get Your Configuration Values

1. **Client ID**: Copy from app registration Overview page
2. **Tenant ID**: Copy from app registration Overview page
3. **Workspace ID**:
   - Open [Microsoft Fabric](https://app.fabric.microsoft.com)
   - Navigate to your workspace
   - Copy the workspace ID from the URL: `https://app.fabric.microsoft.com/groups/{WORKSPACE_ID}/...`

### 5. Update Configuration File

1. Open `config.js` in your application
2. Replace the placeholder values:

```javascript
const CONFIG = {
    clientId: 'YOUR_CLIENT_ID_HERE',           // From step 4
    tenantId: 'YOUR_TENANT_ID_HERE',           // From step 4
    fabricWorkspaceId: 'YOUR_WORKSPACE_ID_HERE', // From step 4
    scopes: [
        'https://api.fabric.microsoft.com/.default'
    ]
};
```

## Running the Application

**IMPORTANT**: This application **must** be run through an HTTP server, not opened directly as a file. OAuth2 authentication requires a proper HTTP(S) origin.

### Option 1: Using Node.js http-server (Recommended)

```bash
# Navigate to the application directory
cd c:\MSPFrontEnd

# Install dependencies (first time only)
npm install

# Start the HTTP server
npm run serve
```

Then open your browser to `http://localhost:8080`

### Option 2: Using Python

```bash
# Navigate to the application directory
cd c:\MSPFrontEnd

# Start a simple HTTP server on port 8080
python -m http.server 8080
```

Then open your browser to `http://localhost:8080`

### Option 3: Using Node.js http-server directly

```bash
# Install http-server globally (one time)
npm install -g http-server

# Navigate to the application directory
cd c:\MSPFrontEnd

# Start the server
http-server -p 8080
```

Then open your browser to `http://localhost:8080`

### Option 3: Using VS Code Live Server

1. Install the "Live Server" extension in VS Code
2. Right-click on `index.html`
3. Select "Open with Live Server"

## Usage

1. **Sign In**
   - Click the "Sign In" button
   - Authenticate with your Microsoft account
   - Grant permissions when prompted

2. **Select Lakehouse**
   - Choose the destination lakehouse from the dropdown
   - Available lakehouses will load automatically after sign-in

3. **Choose Destination Folder** (Optional)
   - Enter a folder path like `documents/pdfs` or `uploads/2024`
   - Leave empty to upload to the root Files directory

4. **Upload Files**
   - Click the upload area or drag PDF files onto it
   - Select one or more PDF files
   - Review the selected files list
   - Click "Upload Files"
   - Monitor progress for each file

5. **View Results**
   - Success/error notifications will appear
   - Files will be available in your Lakehouse under Files section

## Automated OneDrive Sync

For bulk imports or automated synchronization from OneDrive/SharePoint, use the Python sync script:

### Quick Start

```bash
cd notebooks
python run_sync.bat
```

Or run directly:

```bash
cd notebooks
pip install -r requirements_sync.txt
python onedrive_to_fabric_sync.py --dry-run  # Test first
python onedrive_to_fabric_sync.py            # Actual sync
```

### Features

- ✅ Automatically discovers and downloads files from your OneDrive folder
- ✅ Categorizes files by name (Copilot, Security, CIS, M365)
- ✅ Bulk uploads to appropriate Fabric folders
- ✅ Can be scheduled for automatic daily/weekly syncs

### Pre-configured OneDrive Path

The script is already configured for your OneDrive location:
```
/personal/kingsley_relianceinfosystems_com/Documents/Reliance Inforcer Assessment Report
```

**📖 Full Documentation:** See [`notebooks/ONEDRIVE_SYNC_README.md`](notebooks/ONEDRIVE_SYNC_README.md) for complete setup instructions.

### When to Use Each Method

| Scenario | Use Web Upload | Use OneDrive Sync |
|----------|---------------|-------------------|
| Quick single file | ✅ | |
| 5-10 files | ✅ | |
| 50+ files | | ✅ |
| Initial bulk import | | ✅ |
| Scheduled automation | | ✅ |
| Files already in OneDrive | | ✅ |
| New ad-hoc upload | ✅ | |

## File Structure

```
MSPFrontEnd/
├── index.html                 # Main HTML page
├── config.js                  # Configuration file (update with your values)
├── css/
│   └── styles.css            # Custom CSS styles
├── js/
│   ├── app.js                # Main application logic
│   ├── auth.js               # Authentication handling (MSAL)
│   └── fabric-api.js         # Fabric Lakehouse API integration
├── notebooks/
│   ├── onedrive_to_fabric_sync.py    # OneDrive sync automation script
│   ├── parse_assessment_pdfs.py      # PDF parsing notebook
│   ├── requirements_sync.txt         # Python dependencies
│   ├── run_sync.bat                  # Quick start script
│   └── ONEDRIVE_SYNC_README.md       # Detailed sync documentation
├── images/
│   └── reliance logo.png     # Company logo
└── README.md                  # This file
```

## API Endpoints Used

This application uses the following Microsoft Fabric APIs:

1. **List Lakehouses**: `GET https://api.fabric.microsoft.com/v1/workspaces/{workspaceId}/lakehouses`
2. **Upload File**: `PUT https://onelake.dfs.fabric.microsoft.com/{workspaceId}/{lakehouseId}/Files/{path}`

## Troubleshooting

### Login Button Not Responding

- **Problem**: Clicking "Sign In" does nothing or shows errors
  - **Cause**: Application opened directly as a file (`file://` protocol)
  - **Solution**: Run the application through an HTTP server (see "Running the Application" section)
  - OAuth2 authentication requires a proper HTTP origin URL

### Authentication Issues

- **Error: AADSTS70011 - Static scope limit exceeded**
  - **Cause**: Requesting too many `.default` scopes simultaneously
  - **Solution**: Update `config.js` to use specific scopes instead:
    ```javascript
    scopes: [
        'User.Read',
        'Files.ReadWrite.All'
    ]
    ```

- **Error: AADSTS50011**: Redirect URI mismatch
  - Ensure the redirect URI in Azure AD matches your application URL exactly
  - For local development, add `http://localhost:8080` to the app registration
  - Check for http vs https, trailing slashes, and port numbers

- **Error: AADSTS65001**: Consent required
  - Grant admin consent for API permissions in Azure AD
  - Or have users consent individually on first sign-in

### Upload Issues

- **Error: 401 Unauthorized**
  - Check API permissions are granted in Azure AD
  - Ensure you have access to the workspace and lakehouse
  - Try signing out and signing back in

- **Error: 404 Not Found**
  - Verify the workspace ID is correct
  - Verify the lakehouse ID is correct
  - Check that the lakehouse exists in the workspace

- **Error: Network Error**
  - Check CORS settings if hosting on a custom domain
  - Verify firewall/network access to Fabric APIs

### File Upload Fails

- Ensure file is a valid PDF
- Check file size limits (OneLake has file size limits)
- Verify you have write permissions on the lakehouse
- Check network connectivity

## Security Considerations

1. **Never commit `config.js` with real credentials** to source control
2. Use environment-specific configuration files
3. For production, consider using:
   - Azure Key Vault for storing secrets
   - Managed identities where applicable
   - HTTPS for all connections
4. Regularly rotate client secrets (if using confidential client flow)
5. Review and minimize API permissions

## Browser Compatibility

- Modern browsers with ES6 support
- Chrome 60+
- Firefox 60+
- Edge 79+
- Safari 12+

## License

This project is provided as-is for demonstration and development purposes.

## Support

For issues related to:
- **Microsoft Fabric**: [Fabric documentation](https://learn.microsoft.com/fabric/)
- **Azure AD/MSAL**: [MSAL.js documentation](https://learn.microsoft.com/azure/active-directory/develop/msal-overview)
- **This application**: Create an issue in your repository

## Next Steps

Consider enhancing this application with:

- File type validation on the backend
- Virus scanning integration
- Metadata extraction from PDFs
- Bulk upload optimizations
- Upload queue management
- File preview before upload
- Integration with Fabric Data Pipeline for processing
- Automatic text extraction and indexing
