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

### 3. Update Configuration

Edit `onedrive_to_fabric_sync.py` and update the CONFIG section:

```python
CONFIG = {
    'client_id': 'YOUR_CLIENT_ID',
    'tenant_id': 'YOUR_TENANT_ID',
    'workspace_id': 'YOUR_WORKSPACE_ID',
    'lakehouse_id': 'YOUR_LAKEHOUSE_ID',  # ⚠️ IMPORTANT: Update this!
    # ... other settings
}
```

**How to get your Lakehouse ID:**
1. Open Microsoft Fabric portal
2. Navigate to your workspace and lakehouse
3. Copy the lakehouse ID from the URL:
   ```
   https://app.fabric.microsoft.com/groups/{WORKSPACE_ID}/lakehouses/{LAKEHOUSE_ID}
   ```

### 4. Configure OneDrive Access

The script is pre-configured with your OneDrive path:
```
/personal/kingsley_relianceinfosystems_com/Documents/Reliance Inforcer Assessment Report
```

If your folder structure is different, update `onedrive_folder_path` in the CONFIG.

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

### Provide Lakehouse ID via Command Line

```bash
python onedrive_to_fabric_sync.py --lakehouse-id YOUR_LAKEHOUSE_ID
```

## File Organization

The script automatically categorizes files based on their names and uploads them to appropriate folders:

| File Contains | Fabric Destination |
|---------------|-------------------|
| "copilot" | `Files/copilot_readiness_reports/` |
| "cis" | `Files/security_assessment_reports/cis/` |
| "m365" or "microsoft 365" | `Files/security_assessment_reports/m365/` |
| "security" | `Files/security_assessment_reports/` |
| Other PDFs | `Files/assessment_reports/` |

You can customize this mapping by editing the `folder_mapping` in CONFIG.

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
