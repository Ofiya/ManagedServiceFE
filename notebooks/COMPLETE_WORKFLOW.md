# Inforcer Assessment Reports - Complete Workflow

## 📋 Overview

This document explains the complete workflow for uploading and processing assessment reports from OneDrive to Microsoft Fabric Lakehouse.

## 🔄 Complete Data Flow

```
OneDrive Folder
    ↓
[OneDrive Sync Script]
    ↓
Fabric Lakehouse Files
    ├── Files/copilot_readiness/*.pdf
    └── Files/security_assessment/*.pdf
    ↓
[parse_assessment_pdfs Notebook]
    ↓
Fabric Lakehouse Delta Tables
    ├── copilot_readiness_assessments
    ├── copilot_readiness_categories
    ├── copilot_readiness_checks
    ├── security_assessment_assessments
    ├── security_assessment_categories
    └── security_assessment_checks
```

## ⚙️ Pre-Configured Settings

### ✅ Lakehouse Configuration
- **Lakehouse Name:** ManagedServiceData
- **Lakehouse ID:** `3d0144b0-12bf-4483-9508-67b26b1fd125`
- **Workspace ID:** `0f895a7e-09c6-4645-8b47-d272bc687b8a`

### ✅ OneDrive Path
```
/personal/kingsley_relianceinfosystems_com/Documents/Reliance Inforcer Assessment Report
```

### ✅ File Organization Rules

| Keywords in Filename | Destination Folder | Target Tables |
|---------------------|-------------------|---------------|
| copilot, co-pilot, readiness | `Files/copilot_readiness/` | copilot_readiness_* |
| security, cis, m365, compliance | `Files/security_assessment/` | security_assessment_* |

## 🚀 Quick Start - First Time Setup

### Step 1: Install Dependencies
```bash
cd c:\MSPFrontEnd\notebooks
pip install -r requirements_sync.txt
```

### Step 2: Configure Azure AD Permissions

Ensure your Azure AD app has these permissions:
- **Microsoft Graph:** Files.Read.All, Sites.Read.All, User.Read
- **Azure Storage:** user_impersonation

Grant admin consent if not already done.

## 📊 Running the Sync - Step by Step

### Option A: Initial Bulk Import (First Time)

**1. Test Run First (Recommended)**
```bash
cd c:\MSPFrontEnd\notebooks
python onedrive_to_fabric_sync.py --dry-run
```

Expected output:
```
🔄 Starting OneDrive to Fabric Sync
====================================
📍 Target Lakehouse: 3d0144b0-12bf-4483-9508-67b26b1fd125
📁 OneDrive Path: /personal/kingsley_relianceinfosystems_com/...

📂 Listing files in OneDrive folder...
✅ Found 45 files

📦 Processing 45 files...
----------------------------------------
[1/45] Contoso-CopilotReadiness-2024.pdf
⬇️  Downloading: Contoso-CopilotReadiness-2024.pdf
   ✅ Downloaded
   📂 Target folder: Files/copilot_readiness
   🏷️  Report type: COPILOT
   🔍 DRY RUN - Would upload to: Files/copilot_readiness

[2/45] Fabrikam-SecurityAssessment-CIS.pdf
⬇️  Downloading: Fabrikam-SecurityAssessment-CIS.pdf
   ✅ Downloaded
   📂 Target folder: Files/security_assessment
   🏷️  Report type: SECURITY
   🔍 DRY RUN - Would upload to: Files/security_assessment

...

📊 Sync Summary
====================================
Total files found:  45
Downloaded:         45
Uploaded:           45
  • Copilot:        15
  • Security:       30
Failed:             0
Skipped:            0
====================================
```

**2. Run Actual Sync**
```bash
python onedrive_to_fabric_sync.py
```

You'll see:
1. Device code authentication prompt (sign in via browser)
2. File download progress
3. Upload progress for each file
4. Summary with next steps

**3. Process the Files in Fabric**

After sync completes, you'll see:
```
✅ Files uploaded successfully!

📊 Next Steps:
1. Open Microsoft Fabric workspace
2. Navigate to your Lakehouse: ManagedServiceData
3. Run the 'parse_assessment_pdfs' notebook to process the files
4. Check the following tables:
   • copilot_readiness_assessments
   • copilot_readiness_categories
   • copilot_readiness_checks
   • security_assessment_assessments
   • security_assessment_categories
   • security_assessment_checks
```

**4. Run the Parse Notebook**
1. Go to https://app.fabric.microsoft.com
2. Open your workspace
3. Navigate to ManagedServiceData lakehouse
4. Open `parse_assessment_pdfs` notebook
5. Click "Run All"
6. Wait for processing to complete (~30 seconds per PDF)

**5. Verify the Data**
```sql
-- Check copilot assessments
SELECT * FROM copilot_readiness_assessments;

-- Check security assessments
SELECT * FROM security_assessment_assessments;

-- View all categories
SELECT * FROM copilot_readiness_categories
UNION ALL
SELECT * FROM security_assessment_categories;
```

### Option B: Ad-hoc Web Upload (Ongoing Use)

For quick single-file uploads, use the web interface:

1. Open http://localhost:8080 (or your deployed URL)
2. Click "Sign In"
3. Select report type (Copilot or Security)
4. Drag and drop PDF file
5. Click "Upload Assessment Reports"
6. Files automatically go to correct folder
7. Run parse notebook to process

### Option C: Scheduled Automatic Sync

**Windows Task Scheduler Setup:**

1. Create `c:\MSPFrontEnd\notebooks\scheduled_sync.bat`:
```batch
@echo off
cd /d c:\MSPFrontEnd\notebooks
python onedrive_to_fabric_sync.py >> sync_log.txt 2>&1
```

2. Open Task Scheduler
3. Create Basic Task:
   - **Name:** Inforcer Assessment Sync
   - **Trigger:** Daily at 2:00 AM
   - **Action:** Start a program
   - **Program:** `c:\MSPFrontEnd\notebooks\scheduled_sync.bat`

4. Configure:
   - Run whether user is logged on or not
   - Run with highest privileges
   - Store credentials

5. Optionally schedule the parse notebook via Fabric Pipeline

## 🎯 Common Scenarios

### Scenario 1: New Assessment Report Received via Email

**Option 1 - Manual (fastest):**
1. Save PDF to local machine
2. Open web upload interface (http://localhost:8080)
3. Select report type
4. Upload

**Option 2 - Automated:**
1. Save PDF to OneDrive folder
2. Wait for scheduled sync (or run manually)
3. Parse notebook processes it

### Scenario 2: Bulk Import of Historical Reports

**Best approach:** OneDrive Sync
1. Copy all PDFs to OneDrive folder
2. Organize in subfolders if desired (copilot/, security/)
3. Run: `python onedrive_to_fabric_sync.py --dry-run`
4. Review output
5. Run: `python onedrive_to_fabric_sync.py`
6. Run parse notebook

### Scenario 3: Monthly Scheduled Sync

**Setup:**
1. Configure Windows Task Scheduler (see Option C above)
2. All new PDFs in OneDrive sync automatically
3. Manually run parse notebook after sync email notification
4. Or set up Fabric Pipeline to auto-trigger notebook

## 📁 Folder Structure

```
OneDrive:
  Reliance Inforcer Assessment Report/
    ├── Contoso-CopilotReadiness-2024.pdf          → Copilot
    ├── Fabrikam-SecurityAssessment-CIS.pdf        → Security
    ├── AcmeCorps-M365-Security-Report.pdf         → Security
    └── TechCorp-Copilot-Assessment-Dec2024.pdf    → Copilot

Fabric Lakehouse:
  Files/
    ├── copilot_readiness/
    │   ├── Contoso-CopilotReadiness-2024.pdf
    │   └── TechCorp-Copilot-Assessment-Dec2024.pdf
    └── security_assessment/
        ├── Fabrikam-SecurityAssessment-CIS.pdf
        └── AcmeCorps-M365-Security-Report.pdf

Tables:
  ├── copilot_readiness_assessments     (2 rows)
  ├── copilot_readiness_categories      (20 rows)
  ├── copilot_readiness_checks          (150 rows)
  ├── security_assessment_assessments   (2 rows)
  ├── security_assessment_categories    (15 rows)
  └── security_assessment_checks        (180 rows)
```

## 🔍 Troubleshooting

### Authentication Issues

**Problem:** "Not authenticated" error
**Solution:** 
1. Run interactively first time to complete device code flow
2. Tokens are cached for future runs
3. Re-authenticate if token expires

### Files Not Categorizing Correctly

**Problem:** Files going to wrong folder
**Solution:**
1. Check filename contains keywords: copilot, security, cis, m365
2. Update categorization logic in `categorize_file()` method
3. Re-run with `--dry-run` to verify

### Parse Notebook Fails

**Problem:** Notebook errors during processing
**Solution:**
1. Check PDF is properly formatted (Inforcer report format)
2. Verify lakehouse is attached to notebook
3. Check error messages for specific parsing issues
4. PDFs must be in exact folders: Files/copilot_readiness or Files/security_assessment

## 📊 Monitoring & Logs

### Sync Script Logs
```bash
# Add logging to your batch file
python onedrive_to_fabric_sync.py >> sync_log_$(date +%Y%m%d).txt 2>&1
```

### View Recent Syncs
```bash
# Check log files
dir sync_log*.txt | sort
type sync_log_20240612.txt
```

### Fabric Portal Monitoring
1. Open Lakehouse in Fabric
2. Check "Files" section for new PDFs
3. Check "Tables" section for row counts
4. Use SQL analytics to verify data

## 🎓 Best Practices

1. **Always test with `--dry-run` first** when changing configuration
2. **Run parse notebook soon after sync** to ensure data is current
3. **Monitor sync logs** for failed uploads
4. **Keep OneDrive organized** with clear folder structure
5. **Use descriptive PDF filenames** including report type
6. **Schedule syncs during off-hours** (2-4 AM)
7. **Backup before re-running parse notebook** on important data

## 📞 Support

For issues:
1. Check this guide first
2. Review [ONEDRIVE_SYNC_README.md](ONEDRIVE_SYNC_README.md)
3. Check Azure AD permissions
4. Verify Lakehouse access
5. Review console error messages

## 🔗 Related Files

- `onedrive_to_fabric_sync.py` - Main sync script
- `parse_assessment_pdfs.py` - Fabric notebook for PDF parsing
- `run_sync.bat` - Interactive sync launcher
- `requirements_sync.txt` - Python dependencies
- `ONEDRIVE_SYNC_README.md` - Detailed documentation
