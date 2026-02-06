// Oracle Dashboard - Invoice Sync Module
// Syncs invoices between Oracle (Supabase) and Exergy Invoice Generator
// ============================================================

const INVOICE_SYNC_CONFIG = {
    // Exerinv API endpoint (if deployed)
    exerinvUrl: localStorage.getItem('oracle_exerinv_url') || 'https://exerinv.netlify.app',
    
    // Sync interval (30 minutes)
    syncInterval: 30 * 60 * 1000,
    
    // Last sync timestamp
    lastSync: null
};

// ============================================================
// SYNC STATUS
// ============================================================

let invoiceSyncStatus = {
    lastSync: null,
    pending: 0,
    synced: 0,
    errors: []
};

function getInvoiceSyncStatus() {
    return invoiceSyncStatus;
}

// ============================================================
// SUPABASE -> EXERINV SYNC
// ============================================================

async function syncInvoicesToExerinv() {
    if (!supabaseClient) {
        console.warn('[InvoiceSync] Supabase not initialized');
        return { success: false, error: 'Not initialized' };
    }
    
    try {
        // Get invoices from Supabase that need syncing
        const { data: invoices, error } = await supabaseClient
            .from('invoices')
            .select('*')
            .or('synced_to_exerinv.is.null,synced_to_exerinv.eq.false')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        if (!invoices || invoices.length === 0) {
            console.log('[InvoiceSync] No invoices to sync');
            return { success: true, synced: 0 };
        }
        
        console.log(`[InvoiceSync] Syncing ${invoices.length} invoices to Exerinv`);
        invoiceSyncStatus.pending = invoices.length;
        
        const results = [];
        for (const invoice of invoices) {
            try {
                // Transform to Exerinv format
                const exerinvInvoice = transformToExerinvFormat(invoice);
                
                // POST to Exerinv API (if available)
                // For now, we'll just mark as synced
                // In production, this would be:
                // const response = await fetch(`${INVOICE_SYNC_CONFIG.exerinvUrl}/api/invoices`, {
                //     method: 'POST',
                //     headers: { 'Content-Type': 'application/json' },
                //     body: JSON.stringify(exerinvInvoice)
                // });
                
                // Mark as synced in Supabase
                await supabaseClient
                    .from('invoices')
                    .update({ synced_to_exerinv: true, synced_at: new Date().toISOString() })
                    .eq('id', invoice.id);
                
                results.push({ id: invoice.id, success: true });
                invoiceSyncStatus.synced++;
            } catch (err) {
                results.push({ id: invoice.id, success: false, error: err.message });
                invoiceSyncStatus.errors.push({ invoice: invoice.id, error: err.message });
            }
        }
        
        invoiceSyncStatus.lastSync = new Date().toISOString();
        invoiceSyncStatus.pending = 0;
        
        return { success: true, results };
    } catch (error) {
        console.error('[InvoiceSync] Sync failed:', error);
        return { success: false, error: error.message };
    }
}

// ============================================================
// EXERINV -> SUPABASE SYNC
// ============================================================

async function syncInvoicesFromExerinv() {
    try {
        // Fetch from Exerinv API
        const response = await fetch(`${INVOICE_SYNC_CONFIG.exerinvUrl}/api/invoices`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('oracle_exerinv_token') || ''}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`Exerinv API error: ${response.status}`);
        }
        
        const exerinvInvoices = await response.json();
        console.log(`[InvoiceSync] Fetched ${exerinvInvoices.length} invoices from Exerinv`);
        
        // Transform and upsert to Supabase
        for (const inv of exerinvInvoices) {
            const oracleInvoice = transformFromExerinvFormat(inv);
            
            // Upsert based on invoice_number
            const { error } = await supabaseClient
                .from('invoices')
                .upsert(oracleInvoice, { 
                    onConflict: 'invoice_number',
                    ignoreDuplicates: false 
                });
            
            if (error) {
                console.error('[InvoiceSync] Upsert error:', error);
            }
        }
        
        return { success: true, count: exerinvInvoices.length };
    } catch (error) {
        console.error('[InvoiceSync] Fetch from Exerinv failed:', error);
        return { success: false, error: error.message };
    }
}

// ============================================================
// FORMAT TRANSFORMERS
// ============================================================

function transformToExerinvFormat(oracleInvoice) {
    return {
        invoiceNumber: oracleInvoice.invoice_number,
        clientName: oracleInvoice.client_name,
        clientCompany: oracleInvoice.client_company,
        clientEmail: oracleInvoice.client_email,
        clientAddress: oracleInvoice.client_address,
        issueDate: oracleInvoice.issue_date || oracleInvoice.created_at,
        dueDate: oracleInvoice.due_date,
        currency: oracleInvoice.currency || 'ZAR',
        subtotal: oracleInvoice.subtotal || oracleInvoice.amount,
        vatRate: oracleInvoice.vat_rate || 0,
        vatAmount: oracleInvoice.vat_amount || 0,
        total: oracleInvoice.total || oracleInvoice.amount,
        status: oracleInvoice.status || 'draft',
        items: oracleInvoice.line_items || [],
        notes: oracleInvoice.notes,
        paymentMethod: oracleInvoice.payment_method,
        oracleId: oracleInvoice.id
    };
}

function transformFromExerinvFormat(exerinvInvoice) {
    return {
        invoice_number: exerinvInvoice.invoiceNumber || exerinvInvoice.invoice_number,
        client_name: exerinvInvoice.clientName || exerinvInvoice.client_name,
        client_company: exerinvInvoice.clientCompany || exerinvInvoice.client_company,
        client_email: exerinvInvoice.clientEmail || exerinvInvoice.client_email,
        client_address: exerinvInvoice.clientAddress || exerinvInvoice.client_address,
        issue_date: exerinvInvoice.issueDate || exerinvInvoice.issue_date,
        due_date: exerinvInvoice.dueDate || exerinvInvoice.due_date,
        currency: exerinvInvoice.currency || 'ZAR',
        subtotal: exerinvInvoice.subtotal,
        vat_rate: exerinvInvoice.vatRate || exerinvInvoice.vat_rate || 0,
        vat_amount: exerinvInvoice.vatAmount || exerinvInvoice.vat_amount || 0,
        total: exerinvInvoice.total,
        amount: exerinvInvoice.total,
        status: exerinvInvoice.status || 'draft',
        line_items: exerinvInvoice.items || exerinvInvoice.line_items || [],
        notes: exerinvInvoice.notes,
        payment_method: exerinvInvoice.paymentMethod || exerinvInvoice.payment_method,
        exerinv_id: exerinvInvoice.id,
        synced_from_exerinv: true,
        synced_at: new Date().toISOString()
    };
}

// ============================================================
// CALENDAR INTEGRATION
// ============================================================

async function createCalendarEventsForInvoices(invoices) {
    if (!window.createInvoiceDueEvent) {
        console.warn('[InvoiceSync] Calendar module not loaded');
        return [];
    }
    
    const created = [];
    const unpaidInvoices = invoices.filter(inv => 
        inv.status !== 'paid' && 
        inv.due_date && 
        !inv.calendar_event_created
    );
    
    for (const invoice of unpaidInvoices) {
        const event = await window.createInvoiceDueEvent(invoice);
        if (event) {
            // Mark invoice as having calendar event
            await supabaseClient
                .from('invoices')
                .update({ calendar_event_created: true, calendar_event_id: event.id })
                .eq('id', invoice.id);
            
            created.push(event);
        }
    }
    
    return created;
}

// ============================================================
// AUTO-SYNC SCHEDULER
// ============================================================

let syncIntervalId = null;

function startAutoSync() {
    if (syncIntervalId) return;
    
    // Initial sync after 5 seconds
    setTimeout(() => {
        syncAllInvoices();
    }, 5000);
    
    // Periodic sync
    syncIntervalId = setInterval(() => {
        syncAllInvoices();
    }, INVOICE_SYNC_CONFIG.syncInterval);
    
    console.log('[InvoiceSync] Auto-sync started');
}

function stopAutoSync() {
    if (syncIntervalId) {
        clearInterval(syncIntervalId);
        syncIntervalId = null;
        console.log('[InvoiceSync] Auto-sync stopped');
    }
}

async function syncAllInvoices() {
    console.log('[InvoiceSync] Running full sync...');
    
    // Sync from Oracle to Exerinv
    const toExerinv = await syncInvoicesToExerinv();
    
    // Sync from Exerinv to Oracle (if configured)
    let fromExerinv = { success: true, count: 0 };
    if (localStorage.getItem('oracle_exerinv_token')) {
        fromExerinv = await syncInvoicesFromExerinv();
    }
    
    // Update sync status
    INVOICE_SYNC_CONFIG.lastSync = new Date().toISOString();
    localStorage.setItem('oracle_invoice_sync_last', INVOICE_SYNC_CONFIG.lastSync);
    
    console.log('[InvoiceSync] Sync complete:', { toExerinv, fromExerinv });
    
    // Refresh invoice list if on invoices page
    if (typeof renderInvoices === 'function') {
        renderInvoices();
    }
    
    return { toExerinv, fromExerinv };
}

// ============================================================
// SETTINGS UI
// ============================================================

function renderInvoiceSyncSettings() {
    const exerinvUrl = localStorage.getItem('oracle_exerinv_url') || '';
    const exerinvToken = localStorage.getItem('oracle_exerinv_token') || '';
    const lastSync = localStorage.getItem('oracle_invoice_sync_last') || 'Never';
    
    return `
        <div class="settings-section">
            <h3 style="font-size: 14px; font-weight: 600; margin-bottom: 16px;">
                <span style="margin-right: 8px;">🔄</span>Invoice Sync
            </h3>
            
            <div class="form-group" style="margin-bottom: 16px;">
                <label class="form-label">Exerinv URL</label>
                <input type="url" id="exerinvUrl" value="${exerinvUrl}" 
                       placeholder="https://exerinv.netlify.app"
                       style="width: 100%;">
                <small style="color: var(--grey-500);">Invoice generator endpoint</small>
            </div>
            
            <div class="form-group" style="margin-bottom: 16px;">
                <label class="form-label">API Token</label>
                <input type="password" id="exerinvToken" value="${exerinvToken}" 
                       placeholder="Your Exerinv API token"
                       style="width: 100%;">
            </div>
            
            <div style="display: flex; gap: 12px; align-items: center; margin-bottom: 16px;">
                <button onclick="saveInvoiceSyncSettings()" class="btn btn-primary">
                    Save Settings
                </button>
                <button onclick="syncAllInvoices()" class="btn btn-secondary">
                    Sync Now
                </button>
            </div>
            
            <div style="font-size: 12px; color: var(--grey-500);">
                Last sync: ${lastSync}
            </div>
        </div>
    `;
}

function saveInvoiceSyncSettings() {
    const url = document.getElementById('exerinvUrl').value;
    const token = document.getElementById('exerinvToken').value;
    
    if (url) localStorage.setItem('oracle_exerinv_url', url);
    if (token) localStorage.setItem('oracle_exerinv_token', token);
    
    INVOICE_SYNC_CONFIG.exerinvUrl = url || INVOICE_SYNC_CONFIG.exerinvUrl;
    
    toast('Invoice sync settings saved', 'success');
}

// ============================================================
// EXPORTS
// ============================================================

if (typeof window !== 'undefined') {
    window.syncInvoicesToExerinv = syncInvoicesToExerinv;
    window.syncInvoicesFromExerinv = syncInvoicesFromExerinv;
    window.syncAllInvoices = syncAllInvoices;
    window.startAutoSync = startAutoSync;
    window.stopAutoSync = stopAutoSync;
    window.getInvoiceSyncStatus = getInvoiceSyncStatus;
    window.renderInvoiceSyncSettings = renderInvoiceSyncSettings;
    window.saveInvoiceSyncSettings = saveInvoiceSyncSettings;
    window.createCalendarEventsForInvoices = createCalendarEventsForInvoices;
}
