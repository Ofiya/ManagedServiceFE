# OneDrive to Fabric Lakehouse Sync

This Python script automatically syncs assessment reports from your OneDrive/SharePoint folder to Microsoft Fabric Lakehouse.

## Features

- ✅ Automatic file discovery from OneDrive/SharePoint
- ✅ Intelligent categorization based on file names and folder structure
- ✅ Bulk upload to Fabric Lakehouse
- ✅ Progress tracking and error handling
- ✅ Dry-run mode for testing
- ✅ Support for scheduled/automated runs

## Prerequisites

1. **Python 3.8+** installed
2. **Azure AD App Registration** with permissions:
   - `Files.Read.All` or `Files.ReadWrite.All` (Microsoft Graph)
   - `Sites.Read.All` (for SharePoint access)
   - Azure Storage API access for Fabric
3. **Lakehouse ID** from your Microsoft Fabric workspace

## Setup

### 1. Install Dependencies

```bash
cd c:\MSPFrontEnd\notebooks
pip install -r requirements_sync.txt
```

### 2. Configure Azure AD Permissions

In your Azure AD App Registration (portal.azure.com), add these API permissions:

**Microsoft Graph:**
- `Files.Read.All` (Delegated or Application)
- `Sites.Read.All` (Delegated or Application)
- `User.Read` (Delegated)

**Azure Storage:**
- `user_impersonation` (Delegated)

Grant admin consent for all permissions.

### 3. Lakehouse Configuration

**✅ Already Configured!**

The script is pre-configured with your Lakehouse:
- **Lakehouse ID:** `3d0144b0-12bf-4483-9508-67b26b1fd125`
- **Lakehouse Name:** ManagedServiceData

**How it was obtained:**
From the Fabric portal URL: `https://app.fabric.microsoft.com/groups/{WORKSPACE_ID}/lakehouses/{LAKEHOUSE_ID}`

### 4. OneDrive Path Configuration

**✅ Already Configured!**

The script is pre-configured for your OneDrive location:
```
/personal/kingsley_relianceinfosystems_com/Documents/Reliance Inforcer Assessment Report
```

## Usage

### Test Run (Dry Run)

First, do a dry run to see what would be synced:

```bash
python onedrive_to_fabric_sync.py --dry-run
```

This will:
- List all files in the OneDrive folder
- Show where each file would be uploaded
- NOT actually upload anything

### Full Sync

Once you're satisfied with the dry run, perform the actual sync:

```bash
python onedrive_to_fabric_sync.py
```

The script will:
1. Authenticate with your Microsoft account
2. Scan your OneDrive folder for PDF files
3. Download files to a temporary directory
4. Categorize each file (Copilot vs Security)
5. Upload to the appropriate Fabric Lakehouse folder
6. Display a summary with next steps

### Processing the Uploaded Files

After files are synced to Fabric, you need to run the parsing notebook to extract data into tables:

**Option 1: Via Fabric Portal (Recommended)**
1. Open [Microsoft Fabric](https://app.fabric.microsoft.com)
2. Navigate to your workspace
3. Open the `ManagedServiceData` lakehouse
4. Open the `parse_assessment_pdfs` notebook
5. Click "Run All" to process all PDFs

**Option 2: Via Fabric API (Advanced)**
```python
# Future enhancement: Auto-trigger notebook execution
# This can be added to the sync script if needed
```

### Viewing the Results

After the parse notebook completes:

1. Navigate to your Lakehouse in Fabric portal
2. Click on "Tables" in the left sidebar
3. You'll see the following tables:

## File Organization

The script automatically categorizes files based on their names and uploads them to folders that feed into the `parse_assessment_pdfs.py` notebook:

| File Contains | Fabric Destination | Parsed Into Tables |
|---------------|-------------------|-------------------|
| "copilot" or "readiness" | `Files/copilot_readiness/` | `copilot_readiness_assessments`<br>`copilot_readiness_categories`<br>`copilot_readiness_checks` |
| "security", "cis", or "m365" | `Files/security_assessment/` | `security_assessment_assessments`<br>`security_assessment_categories`<br>`security_assessment_checks` |
| Other PDFs | `Files/security_assessment/` (default) | Same as security |

### Integration with Parse Notebook

After files are uploaded, the `parse_assessment_pdfs.py` notebook processes them:

1. **Extracts Data:**
   - Assessment metadata (name, tenant, date, time)
   - Executive summary (scores, passed/failed counts)
   - Categories and their scores
   - Individual check results with status and priority

2. **Creates Delta Tables:**
   - Upserts data (merge or delete+insert for idempotency)
   - Maintains referential integrity across tables
   - Handles re-runs gracefully (no duplicates)

3. **Table Structure:**
   ```
   {report_type}_assessments      # Main assessment record
   {report_type}_categories       # Category-level scores
   {report_type}_checks          # Individual check details
   ```

You can customize the folder mapping by editing the `folder_mapping` in the CONFIG section of `onedrive_to_fabric_sync.py`.

## Authentication

The script uses **device code flow** for authentication:

1. Run the script
2. You'll see a message with a code and URL
3. Open the URL in your browser
4. Enter the code
5. Sign in with your Microsoft account
6. The script will continue automatically

**Note:** Authentication is cached, so you only need to sign in once.

## Scheduling Automated Syncs

### Option 1: Windows Task Scheduler

1. Create a batch file `run_sync.bat`:
```batch
@echo off
cd /d c:\MSPFrontEnd\notebooks
python onedrive_to_fabric_sync.py
```

2. Open Task Scheduler
3. Create a new task:
   - **Trigger**: Daily at specific time
   - **Action**: Run `run_sync.bat`
   - **Conditions**: Run only when computer is on AC power

### Option 2: Azure Automation

For cloud-based scheduling:

1. Create an Azure Automation account
2. Upload the script as a runbook
3. Configure a schedule
4. Use Managed Identity for authentication

### Option 3: Power Automate

For low-code solution:

1. Create a Power Automate flow
2. Use "When a file is created or modified" trigger
3. Call a custom connector or Azure Function that runs this script

## Troubleshooting

### "Not authenticated" Error

**Solution:** Run the script interactively first to complete the device code flow authentication.

### "Invalid Lakehouse ID" Error

**Solution:** Verify your lakehouse ID is correct. Get it from the Fabric portal URL.

### Files Not Appearing in Lakehouse

**Possible causes:**
1. Lakehouse ID is incorrect
2. Insufficient permissions (check Azure AD app permissions)
3. OneDrive path is wrong

**Debug:**
- Run with `--dry-run` to verify files are being discovered
- Check the console output for specific error messages

### "Access Denied" Errors

**Solutions:**
1. Ensure your Azure AD app has admin consent for all required permissions
2. Verify you're signed in with an account that has access to both OneDrive and Fabric
3. Check that the Lakehouse exists and you have write permissions

## Advanced Configuration

### Custom Folder Mapping

Edit the `categorize_file()` method to implement custom logic:

```python
def categorize_file(self, file_name: str, file_path: str = '') -> str:
    # Custom logic here
    if 'project_a' in file_name_lower:
        return 'Files/projects/project_a'
    # ... more conditions
```

### Filter Files by Date

Modify `list_onedrive_files()` to filter by last modified date:

```python
from datetime import datetime, timedelta

# Only sync files modified in last 7 days
cutoff_date = datetime.now() - timedelta(days=7)
if item.get('lastModifiedDateTime'):
    modified = datetime.fromisoformat(item['lastModifiedDateTime'].replace('Z', '+00:00'))
    if modified < cutoff_date:
        continue  # Skip old files
```

## Comparison with Web Upload

| Feature | Web Upload | OneDrive Sync |
|---------|-----------|---------------|
| **Use Case** | Ad-hoc uploads | Bulk/automated sync |
| **User Interface** | Web browser | Command line |
| **File Selection** | Manual | Automatic |
| **Scheduling** | Manual only | Can be scheduled |
| **Best For** | Individual uploads | Large batches |

**Recommendation:** Use both tools together:
- OneDrive Sync for initial bulk import and scheduled updates
- Web Upload for quick ad-hoc uploads of new reports

## Security Notes

- Never commit `config.js` or files with credentials to Git
- Use Azure Key Vault for production deployments
- Rotate client secrets regularly (if using client secret flow)
- Monitor authentication logs in Azure AD

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review Azure AD app permissions
3. Verify Fabric Lakehouse access
4. Check the console output for detailed error messages
