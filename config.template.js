/**
 * Configuration template for PDF Upload to Fabric Lakehouse
 * 
 * Copy this file to config.js and update with your actual values
 */

const CONFIG = {
    // Azure AD / Microsoft Entra ID Configuration
    // Get these values from Azure Portal > App Registrations
    clientId: 'YOUR_CLIENT_ID_HERE',           // Application (client) ID from Azure AD
    tenantId: 'YOUR_TENANT_ID_HERE',           // Directory (tenant) ID from Azure AD
    
    // Microsoft Fabric Configuration
    fabricWorkspaceId: 'YOUR_WORKSPACE_ID_HERE',  // Your Fabric workspace ID
    
    // Required API permissions/scopes
    scopes: [
        'https://api.fabric.microsoft.com/.default'  // Fabric API scope
    ]
};
