// Oracle Dashboard - Fast Sync API
// Handles batch sync operations for scanned data, invoices, etc.

const SUPABASE_URL = 'https://uaivaspunoceuzxkukmh.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

exports.handler = async (event, context) => {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
            },
            body: ''
        };
    }

    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
    };

    try {
        const { action, data, table } = JSON.parse(event.body || '{}');

        // Batch insert scanned data
        if (action === 'batch_insert' && table === 'scanned_data') {
            const items = Array.isArray(data) ? data : [data];
            
            const response = await fetch(`${SUPABASE_URL}/rest/v1/scanned_data`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_SERVICE_KEY,
                    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify(items.map(item => ({
                    scan_id: item.id || item.scan_id,
                    category: item.category,
                    title: item.title,
                    url: item.url,
                    scanned_at: item.scannedAt || item.scanned_at,
                    client_id: item.clientId || item.client_id,
                    notes: item.notes,
                    content: item.content?.substring(0, 50000),
                    tables: JSON.stringify(item.tables || []),
                    links: JSON.stringify(item.links || []),
                    metadata: JSON.stringify(item.metadata || {}),
                    status: item.status || 'pending'
                })))
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Supabase error: ${response.status} - ${error}`);
            }

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, count: items.length })
            };
        }

        // Fetch scanned data
        if (action === 'fetch' && table === 'scanned_data') {
            const response = await fetch(
                `${SUPABASE_URL}/rest/v1/scanned_data?order=scanned_at.desc&limit=100`,
                {
                    headers: {
                        'apikey': SUPABASE_SERVICE_KEY,
                        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
                    }
                }
            );

            if (!response.ok) {
                throw new Error(`Fetch error: ${response.status}`);
            }

            const scans = await response.json();
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, data: scans })
            };
        }

        // Fetch invoices
        if (action === 'fetch' && table === 'invoices') {
            const response = await fetch(
                `${SUPABASE_URL}/rest/v1/invoices?order=date.desc&limit=100`,
                {
                    headers: {
                        'apikey': SUPABASE_SERVICE_KEY,
                        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
                    }
                }
            );

            const invoices = await response.json();
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, data: invoices })
            };
        }

        // Update scan status
        if (action === 'update' && table === 'scanned_data') {
            const { id, updates } = data;
            
            const response = await fetch(
                `${SUPABASE_URL}/rest/v1/scanned_data?scan_id=eq.${id}`,
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': SUPABASE_SERVICE_KEY,
                        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                        'Prefer': 'return=minimal'
                    },
                    body: JSON.stringify(updates)
                }
            );

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: response.ok })
            };
        }

        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Invalid action or table' })
        };

    } catch (error) {
        console.error('Sync error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};
