"""
OneDrive to Fabric Lakehouse Sync Script

This script automatically downloads assessment reports from a OneDrive/SharePoint folder
and uploads them to the appropriate folders in Microsoft Fabric Lakehouse.

Features:
- Authenticates with Microsoft Graph API
- Downloads files from OneDrive/SharePoint
- Automatically categorizes reports based on folder structure
- Uploads to Fabric Lakehouse with proper organization
- Tracks sync progress and handles errors
"""

import os
import json
import requests
from pathlib import Path
from typing import List, Dict, Optional
from datetime import datetime
import msal

# Configuration
CONFIG = {
    # Azure AD App Registration details
    'client_id': '55636aca-83c5-4e15-ab25-8df679261286',
    'tenant_id': '0b60fed4-5fc9-409d-95f2-271114f4c86f',
    
    # Microsoft Fabric details
    'workspace_id': '0f895a7e-09c6-4645-8b47-d272bc687b8a',
    'lakehouse_id': '3d0144b0-12bf-4483-9508-67b26b1fd125',  # ManagedServiceData Lakehouse
    
    # OneDrive folder path (extracted from the shared link)
    'onedrive_folder_path': '/personal/kingsley_relianceinfosystems_com/Documents/Reliance Inforcer Assessment Report',
    
    # Local temp directory for downloads
    'temp_dir': './temp_downloads',
    
    # Fabric folder mapping based on report type
    # These folders match the parse_assessment_pdfs.py notebook expectations
    'folder_mapping': {
        'copilot': 'Files/copilot_readiness',           # Parsed to copilot_readiness_* tables
        'security': 'Files/security_assessment',         # Parsed to security_assessment_* tables
        'cis': 'Files/security_assessment',              # CIS reports go to security tables
        'm365': 'Files/security_assessment',             # M365 reports go to security tables
        'default': 'Files/security_assessment'           # Default to security if unclear
    }
}

# Required scopes for Microsoft Graph and Fabric APIs
SCOPES = [
    'https://graph.microsoft.com/.default',  # For OneDrive access
    'https://storage.azure.com/.default'     # For Fabric/OneLake access
]


class OneDriveToFabricSync:
    """Handles syncing files from OneDrive to Fabric Lakehouse"""
    
    def __init__(self):
        self.access_token = None
        self.fabric_token = None
        
    def authenticate(self) -> bool:
        """
        Authenticate with Azure AD using device code flow
        Returns True if successful
        """
        print("🔐 Authenticating with Microsoft...")
        
        # Create MSAL public client application
        app = msal.PublicClientApplication(
            CONFIG['client_id'],
            authority=f"https://login.microsoftonline.com/{CONFIG['tenant_id']}"
        )
        
        # Try to get token from cache first
        accounts = app.get_accounts()
        if accounts:
            print("Found existing account, attempting silent authentication...")
            result = app.acquire_token_silent(SCOPES, account=accounts[0])
            if result and 'access_token' in result:
                self.access_token = result['access_token']
                print("✅ Authentication successful (cached)")
                return True
        
        # Use device code flow for interactive authentication
        flow = app.initiate_device_flow(scopes=SCOPES)
        
        if 'user_code' not in flow:
            print("❌ Failed to create device flow")
            return False
        
        print("\n" + "="*60)
        print(flow['message'])
        print("="*60 + "\n")
        
        # Wait for user to authenticate
        result = app.acquire_token_by_device_flow(flow)
        
        if 'access_token' in result:
            self.access_token = result['access_token']
            print("✅ Authentication successful")
            return True
        else:
            print(f"❌ Authentication failed: {result.get('error_description', 'Unknown error')}")
            return False
    
    def list_onedrive_files(self, folder_path: str = None) -> List[Dict]:
        """
        List all files in the OneDrive folder
        Returns list of file metadata
        """
        if not self.access_token:
            raise Exception("Not authenticated. Call authenticate() first.")
        
        folder_path = folder_path or CONFIG['onedrive_folder_path']
        
        print(f"\n📂 Listing files in OneDrive folder...")
        
        # Use Microsoft Graph API to list files
        # First, get the drive item by path
        headers = {
            'Authorization': f'Bearer {self.access_token}',
            'Content-Type': 'application/json'
        }
        
        # Get user's drive
        drive_url = 'https://graph.microsoft.com/v1.0/me/drive'
        
        # List files in the specified folder
        # Note: You may need to adjust this path based on your folder structure
        files_url = f'https://graph.microsoft.com/v1.0/me/drive/root:{folder_path}:/children'
        
        all_files = []
        
        while files_url:
            response = requests.get(files_url, headers=headers)
            
            if response.status_code != 200:
                print(f"❌ Error listing files: {response.status_code}")
                print(f"Response: {response.text}")
                return all_files
            
            data = response.json()
            files = data.get('value', [])
            
            for item in files:
                if 'file' in item:  # It's a file, not a folder
                    all_files.append({
                        'id': item['id'],
                        'name': item['name'],
                        'size': item['size'],
                        'download_url': item.get('@microsoft.graph.downloadUrl'),
                        'path': item.get('parentReference', {}).get('path', '')
                    })
                elif 'folder' in item:  # It's a folder, recurse into it
                    subfolder_path = f"{folder_path}/{item['name']}"
                    all_files.extend(self.list_onedrive_files(subfolder_path))
            
            # Handle pagination
            files_url = data.get('@odata.nextLink')
        
        print(f"✅ Found {len(all_files)} files")
        return all_files
    
    def download_file(self, file_info: Dict, temp_dir: str) -> Optional[str]:
        """
        Download a file from OneDrive to local temp directory
        Returns local file path if successful
        """
        download_url = file_info.get('download_url')
        if not download_url:
            print(f"⚠️  No download URL for {file_info['name']}")
            return None
        
        # Create temp directory if it doesn't exist
        os.makedirs(temp_dir, exist_ok=True)
        
        local_path = os.path.join(temp_dir, file_info['name'])
        
        print(f"⬇️  Downloading: {file_info['name']} ({file_info['size']} bytes)")
        
        # Download file
        response = requests.get(download_url)
        
        if response.status_code == 200:
            with open(local_path, 'wb') as f:
                f.write(response.content)
            print(f"   ✅ Downloaded to: {local_path}")
            return local_path
        else:
            print(f"   ❌ Download failed: {response.status_code}")
            return None
    
    def categorize_file(self, file_name: str, file_path: str = '') -> tuple:
        """
        Determine the appropriate Fabric folder based on file name and path
        Returns tuple of (folder_path, report_type)
        
        Report types:
        - 'copilot': Copilot Readiness Assessment
        - 'security': Security Assessment (CIS, M365, etc.)
        """
        file_name_lower = file_name.lower()
        path_lower = file_path.lower()
        
        # Check for copilot readiness reports (most specific first)
        copilot_keywords = ['copilot', 'co-pilot', 'readiness']
        if any(keyword in file_name_lower for keyword in copilot_keywords) or \
           any(keyword in path_lower for keyword in copilot_keywords):
            return (CONFIG['folder_mapping']['copilot'], 'copilot')
        
        # Check for security-related keywords
        security_keywords = ['security', 'cis', 'm365', 'microsoft 365', 'compliance', 'assessment']
        if any(keyword in file_name_lower for keyword in security_keywords) or \
           any(keyword in path_lower for keyword in security_keywords):
            return (CONFIG['folder_mapping']['security'], 'security')
        
        # Default to security assessment
        print(f"   ⚠️  Unable to categorize '{file_name}' - defaulting to security assessment")
        return (CONFIG['folder_mapping']['default'], 'security')
    
    def upload_to_fabric(self, local_file_path: str, fabric_folder: str, file_name: str) -> bool:
        """
        Upload a file to Fabric Lakehouse
        Returns True if successful
        """
        workspace_id = CONFIG['workspace_id']
        lakehouse_id = CONFIG['lakehouse_id']
        
        # OneLake uses Azure Data Lake Storage Gen2 API
        fabric_path = f"{fabric_folder}/{file_name}"
        
        # OneLake endpoint format
        upload_url = (
            f"https://onelake.dfs.fabric.microsoft.com/"
            f"{workspace_id}/{lakehouse_id}/{fabric_path}"
        )
        
        print(f"⬆️  Uploading to Fabric: {fabric_path}")
        
        # Read file content
        with open(local_file_path, 'rb') as f:
            file_content = f.read()
        
        # Upload using Azure Storage REST API
        headers = {
            'Authorization': f'Bearer {self.access_token}',
            'x-ms-version': '2023-01-03',
            'Content-Type': 'application/octet-stream',
            'Content-Length': str(len(file_content))
        }
        
        # Create/overwrite file
        response = requests.put(
            upload_url,
            headers=headers,
            params={'resource': 'file'},
            data=file_content
        )
        
        if response.status_code in [200, 201]:
            print(f"   ✅ Upload successful")
            return True
        else:
            print(f"   ❌ Upload failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    
    def sync_all(self, dry_run: bool = False) -> Dict:
        """
        Sync all files from OneDrive to Fabric
        
        Args:
            dry_run: If True, only shows what would be synced without uploading
        
        Returns:
            Dictionary with sync statistics
        """
        stats = {
            'total_files': 0,
            'downloaded': 0,
            'uploaded': 0,
            'failed': 0,
            'skipped': 0,
            'copilot_reports': 0,
            'security_reports': 0
        }
        
        print("\n" + "="*60)
        print("🔄 Starting OneDrive to Fabric Sync")
        print("="*60)
        print(f"📍 Target Lakehouse: {CONFIG['lakehouse_id']}")
        print(f"📁 OneDrive Path: {CONFIG['onedrive_folder_path']}")
        
        # Authenticate
        if not self.authenticate():
            print("\n❌ Sync aborted: Authentication failed")
            return stats
        
        # List files
        files = self.list_onedrive_files()
        stats['total_files'] = len(files)
        
        if not files:
            print("\n⚠️  No files found to sync")
            return stats
        
        # Create temp directory
        temp_dir = CONFIG['temp_dir']
        os.makedirs(temp_dir, exist_ok=True)
        
        # Process each file
        print(f"\n📦 Processing {len(files)} files...")
        print("-" * 60)
        
        for i, file_info in enumerate(files, 1):
            print(f"\n[{i}/{len(files)}] {file_info['name']}")
            
            # Only process PDF files
            if not file_info['name'].lower().endswith('.pdf'):
                print(f"   ⏭️  Skipping non-PDF file")
                stats['skipped'] += 1
                continue
            
            # Download file
            local_path = self.download_file(file_info, temp_dir)
            
            if not local_path:
                stats['failed'] += 1
                continue
            
            stats['downloaded'] += 1
            
            # Determine target folder and report type
            fabric_folder, report_type = self.categorize_file(
                file_info['name'],
                file_info.get('path', '')
            )
            
            print(f"   📂 Target folder: {fabric_folder}")
            print(f"   🏷️  Report type: {report_type.upper()}")
            
            if dry_run:
                print(f"   🔍 DRY RUN - Would upload to: {fabric_folder}")
                stats['uploaded'] += 1
                if report_type == 'copilot':
                    stats['copilot_reports'] += 1
                else:
                    stats['security_reports'] += 1
            else:
                # Upload to Fabric
                if self.upload_to_fabric(local_path, fabric_folder, file_info['name']):
                    stats['uploaded'] += 1
                    if report_type == 'copilot':
                        stats['copilot_reports'] += 1
                    else:
                        stats['security_reports'] += 1
                else:
                    stats['failed'] += 1
            
            # Clean up local file
            try:
                os.remove(local_path)
            except:
                pass
        
        # Clean up temp directory
        try:
            os.rmdir(temp_dir)
        except:
            pass
        
        # Print summary
        print("\n" + "="*60)
        print("📊 Sync Summary")
        print("="*60)
        print(f"Total files found:  {stats['total_files']}")
        print(f"Downloaded:         {stats['downloaded']}")
        print(f"Uploaded:           {stats['uploaded']}")
        print(f"  • Copilot:        {stats['copilot_reports']}")
        print(f"  • Security:       {stats['security_reports']}")
        print(f"Failed:             {stats['failed']}")
        print(f"Skipped:            {stats['skipped']}")
        print("="*60)
        
        # Show next steps if files were uploaded
        if stats['uploaded'] > 0 and not dry_run:
            print("\n✅ Files uploaded successfully!")
            print("\n📊 Next Steps:")
            print("1. Open Microsoft Fabric workspace")
            print("2. Navigate to your Lakehouse: ManagedServiceData")
            print("3. Run the 'parse_assessment_pdfs' notebook to process the files")
            print("4. Check the following tables:")
            if stats['copilot_reports'] > 0:
                print("   • copilot_readiness_assessments")
                print("   • copilot_readiness_categories")
                print("   • copilot_readiness_checks")
            if stats['security_reports'] > 0:
                print("   • security_assessment_assessments")
                print("   • security_assessment_categories")
                print("   • security_assessment_checks")
        
        return stats


def main():
    """Main entry point for the sync script"""
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Sync assessment reports from OneDrive to Fabric Lakehouse'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Show what would be synced without actually uploading'
    )
    parser.add_argument(
        '--lakehouse-id',
        help='Fabric Lakehouse ID (overrides config)'
    )
    
    args = parser.parse_args()
    
    # Update config if lakehouse ID provided
    if args.lakehouse_id:
        CONFIG['lakehouse_id'] = args.lakehouse_id
        print(f"Using Lakehouse ID from command line: {args.lakehouse_id}")
    
    # Create syncer and run
    syncer = OneDriveToFabricSync()
    stats = syncer.sync_all(dry_run=args.dry_run)
    
    # Exit code based on results
    if stats['failed'] > 0:
        exit(1)
    else:
        exit(0)


if __name__ == '__main__':
    main()
