/**
 * Oracle Dashboard - Google Drive Integration
 * Connect and browse files from Google Drive
 */

const GDRIVE_CLIENT_ID = ''; // Set in Settings
const GDRIVE_SCOPES = 'https://www.googleapis.com/auth/drive.readonly';

class GoogleDriveIntegration {
    constructor() {
        this.accessToken = null;
        this.connected = false;
        this.user = null;
    }
    
    init() {
        // Load saved token
        this.accessToken = localStorage.getItem('gdrive_access_token');
        if (this.accessToken) {
            this.connected = true;
            this.validateToken();
        }
    }
    
    async validateToken() {
        try {
            const response = await fetch('https://www.googleapis.com/oauth2/v1/userinfo', {
                headers: { 'Authorization': `Bearer ${this.accessToken}` }
            });
            
            if (response.ok) {
                this.user = await response.json();
                this.connected = true;
                console.log('[GDrive] Connected as:', this.user.email);
                return true;
            } else {
                this.disconnect();
                return false;
            }
        } catch (e) {
            console.warn('[GDrive] Token validation failed:', e);
            return false;
        }
    }
    
    // OAuth popup flow
    async connect() {
        const clientId = localStorage.getItem('gdrive_client_id') || GDRIVE_CLIENT_ID;
        
        if (!clientId) {
            throw new Error('Google Drive Client ID not configured. Add it in Settings.');
        }
        
        const redirectUri = window.location.origin;
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
            `client_id=${clientId}&` +
            `redirect_uri=${encodeURIComponent(redirectUri)}&` +
            `response_type=token&` +
            `scope=${encodeURIComponent(GDRIVE_SCOPES)}&` +
            `prompt=consent`;
        
        // Open popup
        const popup = window.open(authUrl, 'gdrive_auth', 'width=500,height=600');
        
        // Listen for redirect
        return new Promise((resolve, reject) => {
            const checkPopup = setInterval(() => {
                try {
                    if (popup.closed) {
                        clearInterval(checkPopup);
                        reject(new Error('Popup closed'));
                        return;
                    }
                    
                    const hash = popup.location.hash;
                    if (hash && hash.includes('access_token')) {
                        clearInterval(checkPopup);
                        popup.close();
                        
                        const params = new URLSearchParams(hash.substring(1));
                        this.accessToken = params.get('access_token');
                        localStorage.setItem('gdrive_access_token', this.accessToken);
                        
                        this.validateToken().then(() => {
                            this.connected = true;
                            resolve({ success: true, user: this.user });
                        });
                    }
                } catch (e) {
                    // Cross-origin - ignore
                }
            }, 500);
            
            // Timeout after 2 minutes
            setTimeout(() => {
                clearInterval(checkPopup);
                reject(new Error('Auth timeout'));
            }, 120000);
        });
    }
    
    disconnect() {
        this.accessToken = null;
        this.connected = false;
        this.user = null;
        localStorage.removeItem('gdrive_access_token');
    }
    
    // List files using backend function
    async listFiles(folderId = null) {
        if (!this.accessToken) throw new Error('Not connected');
        
        const response = await fetch('/.netlify/functions/gdrive', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'list',
                accessToken: this.accessToken,
                folderId
            })
        });
        
        const data = await response.json();
        if (!data.success) throw new Error(data.error);
        return data.files;
    }
    
    // List folders
    async listFolders() {
        if (!this.accessToken) throw new Error('Not connected');
        
        const response = await fetch('/.netlify/functions/gdrive', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'list_folders',
                accessToken: this.accessToken
            })
        });
        
        const data = await response.json();
        if (!data.success) throw new Error(data.error);
        return data.folders;
    }
    
    // Search for invoices
    async searchInvoices() {
        if (!this.accessToken) throw new Error('Not connected');
        
        const response = await fetch('/.netlify/functions/gdrive', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'search_invoices',
                accessToken: this.accessToken
            })
        });
        
        const data = await response.json();
        if (!data.success) throw new Error(data.error);
        return data.files;
    }
    
    // Get file content
    async downloadFile(fileId) {
        if (!this.accessToken) throw new Error('Not connected');
        
        const response = await fetch('/.netlify/functions/gdrive', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'download',
                accessToken: this.accessToken,
                fileId
            })
        });
        
        const data = await response.json();
        if (!data.success) throw new Error(data.error);
        return data.content;
    }
}

window.gdrive = new GoogleDriveIntegration();
window.GoogleDriveIntegration = GoogleDriveIntegration;

console.log('[GDrive] Module loaded');
