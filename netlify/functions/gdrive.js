// Oracle Dashboard - Google Drive Integration
// Lists and downloads files from connected Google Drive

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        const { action, accessToken, folderId, fileId, query } = JSON.parse(event.body || '{}');

        if (!accessToken) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ error: 'Access token required' })
            };
        }

        const gdriveHeaders = {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        };

        // List files in a folder or search
        if (action === 'list') {
            let q = folderId 
                ? `'${folderId}' in parents and trashed=false`
                : query || 'trashed=false';
            
            const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,size,modifiedTime,webViewLink,iconLink)&orderBy=modifiedTime desc&pageSize=50`;
            
            const response = await fetch(url, { headers: gdriveHeaders });
            
            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Google Drive error: ${response.status} - ${error}`);
            }

            const data = await response.json();
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, files: data.files })
            };
        }

        // Get file metadata
        if (action === 'get' && fileId) {
            const url = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,size,modifiedTime,webViewLink,webContentLink,parents`;
            
            const response = await fetch(url, { headers: gdriveHeaders });
            const data = await response.json();

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, file: data })
            };
        }

        // Download file content (text files only)
        if (action === 'download' && fileId) {
            const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
            
            const response = await fetch(url, { headers: gdriveHeaders });
            
            if (!response.ok) {
                throw new Error(`Download error: ${response.status}`);
            }

            const content = await response.text();
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, content: content.substring(0, 100000) })
            };
        }

        // Search for invoices/financial docs
        if (action === 'search_invoices') {
            const q = "(name contains 'invoice' or name contains 'INV-' or name contains 'statement') and trashed=false";
            const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,size,modifiedTime,webViewLink)&orderBy=modifiedTime desc&pageSize=50`;
            
            const response = await fetch(url, { headers: gdriveHeaders });
            const data = await response.json();

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, files: data.files || [] })
            };
        }

        // List folders
        if (action === 'list_folders') {
            const q = "mimeType='application/vnd.google-apps.folder' and trashed=false";
            const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,modifiedTime)&orderBy=name&pageSize=100`;
            
            const response = await fetch(url, { headers: gdriveHeaders });
            const data = await response.json();

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, folders: data.files || [] })
            };
        }

        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Invalid action' })
        };

    } catch (error) {
        console.error('GDrive error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};
