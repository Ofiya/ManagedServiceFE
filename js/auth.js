/**
 * Authentication module using MSAL.js for Microsoft Entra ID (Azure AD)
 */

let msalInstance;
let currentAccount = null;

/**
 * Initialize MSAL instance
 */
function initializeMsal() {
    const msalConfig = {
        auth: {
            clientId: CONFIG.clientId,
            authority: `https://login.microsoftonline.com/${CONFIG.tenantId}`,
            redirectUri: window.location.origin
        },
        cache: {
            cacheLocation: "localStorage",
            storeAuthStateInCookie: false
        }
    };

    msalInstance = new msal.PublicClientApplication(msalConfig);
    
    // Handle redirect promise
    msalInstance.handleRedirectPromise()
        .then(handleResponse)
        .catch(err => {
            console.error('Redirect error:', err);
            showNotification('Authentication error: ' + err.message, 'error');
        });
}

/**
 * Handle authentication response
 */
function handleResponse(response) {
    if (response !== null) {
        currentAccount = response.account;
        showNotification('Successfully signed in!', 'success');
        updateUI();
    } else {
        // Check if we have cached accounts
        const accounts = msalInstance.getAllAccounts();
        if (accounts.length > 0) {
            currentAccount = accounts[0];
            updateUI();
        }
    }
}

/**
 * Sign in user using redirect flow (more reliable than popup)
 */
async function signIn() {
    const loginRequest = {
        scopes: CONFIG.scopes,
        redirectUri: window.location.origin
    };

    try {
        // Use redirect instead of popup to avoid cross-origin issues
        await msalInstance.loginRedirect(loginRequest);
    } catch (error) {
        console.error('Login error:', error);
        showNotification('Sign in failed: ' + error.message, 'error');
    }
}

/**
 * Sign out user using redirect flow
 */
async function signOut() {
    const logoutRequest = {
        account: currentAccount,
        postLogoutRedirectUri: window.location.origin
    };

    try {
        // Use redirect instead of popup
        await msalInstance.logoutRedirect(logoutRequest);
    } catch (error) {
        console.error('Logout error:', error);
        showNotification('Sign out failed: ' + error.message, 'error');
    }
}

/**
 * Get access token for API calls
 * @param {string} scope - Optional specific scope. Use 'storage' for OneLake, 'powerbi' for Fabric API, or null for default
 */
async function getAccessToken(scope = 'powerbi') {
    if (!currentAccount) {
        throw new Error('No user signed in');
    }

    // Determine which scope to use
    let requestedScopes;
    if (scope === 'storage') {
        // OneLake DFS API requires Azure Storage scope
        requestedScopes = ['https://storage.azure.com/.default'];
    } else if (scope === 'powerbi') {
        // Fabric REST API uses Power BI scope
        requestedScopes = ['https://analysis.windows.net/powerbi/api/.default'];
    } else {
        // Default to Power BI scope
        requestedScopes = CONFIG.scopes;
    }

    const tokenRequest = {
        scopes: requestedScopes,
        account: currentAccount
    };

    console.log('Requesting token for scopes:', requestedScopes);

    try {
        // Try to acquire token silently first
        const response = await msalInstance.acquireTokenSilent(tokenRequest);
        console.log('Token acquired successfully');
        return response.accessToken;
    } catch (error) {
        console.warn('Silent token acquisition failed, trying interactive:', error);
        
        // Fall back to redirect method
        try {
            await msalInstance.acquireTokenRedirect(tokenRequest);
            // Note: This will redirect the page, so we won't reach here
            // Token will be available after redirect via handleRedirectPromise
        } catch (interactiveError) {
            console.error('Interactive token acquisition failed:', interactiveError);
            throw new Error('Failed to acquire access token');
        }
    }
}

/**
 * Check if user is authenticated
 */
function isAuthenticated() {
    return currentAccount !== null;
}

/**
 * Get current user info
 */
function getCurrentUser() {
    return currentAccount;
}

/**
 * Update UI based on authentication state
 */
function updateUI() {
    const signInBtn = document.getElementById('signInBtn');
    const signOutBtn = document.getElementById('signOutBtn');
    const userInfo = document.getElementById('userInfo');
    const uploadSection = document.getElementById('uploadSection');
    const loginPrompt = document.getElementById('loginPrompt');

    if (isAuthenticated()) {
        // User is signed in
        signInBtn.classList.add('hidden');
        signOutBtn.classList.remove('hidden');
        userInfo.classList.remove('hidden');
        userInfo.textContent = `Signed in as ${currentAccount.username}`;
        uploadSection.classList.remove('hidden');
        loginPrompt.classList.add('hidden');
        
        // Load lakehouses when user signs in
        if (typeof loadLakehouses === 'function') {
            loadLakehouses();
        }
    } else {
        // User is signed out
        signInBtn.classList.remove('hidden');
        signOutBtn.classList.add('hidden');
        userInfo.classList.add('hidden');
        uploadSection.classList.add('hidden');
        loginPrompt.classList.remove('hidden');
    }
}

// Initialize MSAL when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeMsal);
} else {
    initializeMsal();
}
