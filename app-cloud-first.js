// Oracle Dashboard - Cloud-First Edition v3
// SUPABASE AS SINGLE SOURCE OF TRUTH
// NO localStorage - everything lives in the cloud
// ============================================================

const SUPABASE_URL = 'https://uaivaspunoceuzxkukmh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhaXZhc3B1bm9jZXV6eGt1a21oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMTc2MDEsImV4cCI6MjA4NDY5MzYwMX0.yasfPMw3fRyOawYXLNTtZhpxutFCBd70f1Cot3AVcFc';

// Global state - loaded ONLY from Supabase
let supabaseClient = null;
let currentUser = null;
let projects = [];
let clients = [];
let invoices = [];
let payments = [];
let transactions = [];
let timeEntries = [];
let billingEntries = [];
let team = [];
let meetings = [];
let allocations = [];

// Sync state
let syncStatus = 'idle'; // 'idle' | 'saving' | 'saved' | 'error'
let syncTimeout = null;

// Real-time subscriptions
let subscriptions = [];

console.log('[Oracle Cloud] Starting cloud-first mode...');

// ============================================================
// SYNC STATUS INDICATOR
// ============================================================
function updateSyncStatus(status, message = '') {
    syncStatus = status;
    const indicator = document.getElementById('syncIndicator');
    if (!indicator) return;
    
    // Clear existing timeout
    if (syncTimeout) clearTimeout(syncTimeout);
    
    switch (status) {
        case 'saving':
            indicator.className = 'sync-indicator saving';
            indicator.innerHTML = '<span class="sync-spinner"></span> Saving...';
            break;
        case 'saved':
            indicator.className = 'sync-indicator saved';
            indicator.innerHTML = '✓ Saved to cloud';
            // Auto-hide after 2 seconds
            syncTimeout = setTimeout(() => {
                indicator.className = 'sync-indicator';
                indicator.innerHTML = '';
            }, 2000);
            break;
        case 'error':
            indicator.className = 'sync-indicator error';
            indicator.innerHTML = `⚠ ${message || 'Sync error'}`;
            // Auto-hide after 5 seconds
            syncTimeout = setTimeout(() => {
                indicator.className = 'sync-indicator';
                indicator.innerHTML = '';
            }, 5000);
            break;
        default:
            indicator.className = 'sync-indicator';
            indicator.innerHTML = '';
    }
}

// ============================================================
// INITIALIZATION
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
    if (typeof window.supabase === 'undefined') {
        showError('Failed to load Supabase. Refresh the page.');
        return;
    }
    
    try {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        
        supabaseClient.auth.onAuthStateChange(async (event, session) => {
            console.log('[Oracle Cloud] Auth event:', event);
            if (session && session.user) {
                currentUser = session.user;
                await initializeApp();
            } else {
                currentUser = null;
                showLogin();
            }
        });
        
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session && session.user) {
            currentUser = session.user;
            await initializeApp();
        } else {
            showLogin();
        }
    } catch (error) {
        console.error('[Oracle Cloud] Initialization error:', error);
        showError('Failed to initialize. Please refresh.');
    }
});

async function initializeApp() {
    console.log('[Oracle Cloud] Initializing app for user:', currentUser.email);
    
    showApp();
    
    // Load ALL data from Supabase
    updateSyncStatus('saving', 'Loading data...');
    await loadAllDataFromCloud();
    updateSyncStatus('saved', 'Data loaded');
    
    // Setup real-time subscriptions
    setupRealTimeSync();
    
    // Render UI
    renderAll();
    
    console.log('[Oracle Cloud] App initialized successfully');
}

// ============================================================
// LOAD DATA FROM CLOUD (ONLY SOURCE)
// ============================================================
async function loadAllDataFromCloud() {
    if (!supabaseClient || !currentUser) {
        console.error('[Oracle Cloud] Cannot load data - not authenticated');
        return;
    }
    
    console.log('[Oracle Cloud] Loading all data from Supabase...');
    
    try {
        // Load projects
        const { data: projectsData, error: projectsError } = await supabaseClient
            .from('projects')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false });
        
        if (projectsError) throw projectsError;
        projects = projectsData || [];
        console.log(`[Oracle Cloud] Loaded ${projects.length} projects`);
        
        // Load clients
        const { data: clientsData, error: clientsError } = await supabaseClient
            .from('clients')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false });
        
        if (clientsError) throw clientsError;
        clients = clientsData || [];
        console.log(`[Oracle Cloud] Loaded ${clients.length} clients`);
        
        // Load invoices
        const { data: invoicesData, error: invoicesError } = await supabaseClient
            .from('invoices')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false });
        
        if (invoicesError) throw invoicesError;
        invoices = invoicesData || [];
        console.log(`[Oracle Cloud] Loaded ${invoices.length} invoices`);
        
        // Load payments
        const { data: paymentsData, error: paymentsError } = await supabaseClient
            .from('payments')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false });
        
        if (paymentsError) throw paymentsError;
        payments = paymentsData || [];
        console.log(`[Oracle Cloud] Loaded ${payments.length} payments`);
        
        // Load transactions
        const { data: transactionsData, error: transactionsError } = await supabaseClient
            .from('transactions')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('date', { ascending: false })
            .limit(1000); // Limit to recent 1000
        
        if (transactionsError) throw transactionsError;
        transactions = transactionsData || [];
        console.log(`[Oracle Cloud] Loaded ${transactions.length} transactions`);
        
        // Load time entries
        const { data: timeEntriesData, error: timeEntriesError } = await supabaseClient
            .from('time_entries')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false })
            .limit(500);
        
        if (timeEntriesError) throw timeEntriesError;
        timeEntries = timeEntriesData || [];
        console.log(`[Oracle Cloud] Loaded ${timeEntries.length} time entries`);
        
        // Load billing entries
        const { data: billingEntriesData, error: billingEntriesError } = await supabaseClient
            .from('billing_entries')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false });
        
        if (billingEntriesError && billingEntriesError.code !== 'PGRST116') throw billingEntriesError;
        billingEntries = billingEntriesData || [];
        console.log(`[Oracle Cloud] Loaded ${billingEntries.length} billing entries`);
        
        // Load team
        const { data: teamData, error: teamError } = await supabaseClient
            .from('team')
            .select('*')
            .eq('user_id', currentUser.id);
        
        if (teamError && teamError.code !== 'PGRST116') throw teamError;
        team = teamData || [];
        console.log(`[Oracle Cloud] Loaded ${team.length} team members`);
        
        // Load allocations
        const { data: allocationsData, error: allocationsError } = await supabaseClient
            .from('allocations')
            .select('*')
            .eq('user_id', currentUser.id);
        
        if (allocationsError && allocationsError.code !== 'PGRST116') throw allocationsError;
        allocations = allocationsData || [];
        console.log(`[Oracle Cloud] Loaded ${allocations.length} allocations`);
        
        console.log('[Oracle Cloud] ✅ All data loaded from cloud');
        
    } catch (error) {
        console.error('[Oracle Cloud] Error loading data:', error);
        updateSyncStatus('error', 'Failed to load data');
        throw error;
    }
}

// ============================================================
// REAL-TIME SYNC
// ============================================================
function setupRealTimeSync() {
    if (!supabaseClient || !currentUser) return;
    
    console.log('[Oracle Cloud] Setting up real-time subscriptions...');
    
    // Projects subscription
    const projectsSub = supabaseClient
        .channel('projects_changes')
        .on('postgres_changes', 
            { event: '*', schema: 'public', table: 'projects', filter: `user_id=eq.${currentUser.id}` },
            (payload) => handleProjectChange(payload)
        )
        .subscribe();
    
    subscriptions.push(projectsSub);
    
    // Similar subscriptions for other tables...
    console.log('[Oracle Cloud] ✅ Real-time subscriptions active');
}

function handleProjectChange(payload) {
    console.log('[Oracle Cloud] Project change:', payload);
    const { eventType, new: newRecord, old: oldRecord } = payload;
    
    if (eventType === 'INSERT') {
        if (!projects.find(p => p.id === newRecord.id)) {
            projects.unshift(newRecord);
            renderProjects();
        }
    } else if (eventType === 'UPDATE') {
        const index = projects.findIndex(p => p.id === newRecord.id);
        if (index !== -1) {
            projects[index] = newRecord;
            renderProjects();
        }
    } else if (eventType === 'DELETE') {
        projects = projects.filter(p => p.id !== oldRecord.id);
        renderProjects();
    }
}

// ============================================================
// SAVE TO CLOUD (ALL OPERATIONS)
// ============================================================
async function saveToCloud(table, data, operation = 'upsert') {
    if (!supabaseClient || !currentUser) {
        updateSyncStatus('error', 'Not authenticated');
        return { success: false, error: 'Not authenticated' };
    }
    
    updateSyncStatus('saving');
    
    try {
        // Add user_id if not present
        const dataWithUser = Array.isArray(data) 
            ? data.map(d => ({ ...d, user_id: currentUser.id }))
            : { ...data, user_id: currentUser.id };
        
        let result;
        
        if (operation === 'insert') {
            result = await supabaseClient
                .from(table)
                .insert(dataWithUser)
                .select();
        } else if (operation === 'update') {
            result = await supabaseClient
                .from(table)
                .update(dataWithUser)
                .eq('id', dataWithUser.id)
                .eq('user_id', currentUser.id)
                .select();
        } else if (operation === 'delete') {
            result = await supabaseClient
                .from(table)
                .delete()
                .eq('id', dataWithUser.id)
                .eq('user_id', currentUser.id);
        } else {
            // upsert
            result = await supabaseClient
                .from(table)
                .upsert(dataWithUser, { onConflict: 'id' })
                .select();
        }
        
        if (result.error) throw result.error;
        
        updateSyncStatus('saved');
        console.log(`[Oracle Cloud] ✅ Saved to ${table}:`, result.data);
        
        return { success: true, data: result.data };
    } catch (error) {
        console.error(`[Oracle Cloud] ❌ Save failed for ${table}:`, error);
        updateSyncStatus('error', error.message || 'Save failed');
        return { success: false, error: error.message };
    }
}

// ============================================================
// PROJECT OPERATIONS
// ============================================================
async function saveProject() {
    const id = document.getElementById('projectId').value;
    const projectData = {
        id: id || crypto.randomUUID(),
        name: document.getElementById('projectName').value.trim(),
        client_id: document.getElementById('projectClient').value || null,
        status: document.getElementById('projectStatus').value,
        hourly_rate: parseFloat(document.getElementById('projectRate').value) || null,
        source: document.getElementById('projectSource').value,
        description: document.getElementById('projectDesc').value.trim(),
        created_at: id ? undefined : new Date().toISOString()
    };
    
    if (!projectData.name) {
        toast('Project name required', 'error');
        return;
    }
    
    const result = await saveToCloud('projects', projectData, id ? 'update' : 'insert');
    
    if (result.success) {
        // Update local state
        if (id) {
            const index = projects.findIndex(p => p.id === id);
            if (index !== -1) projects[index] = result.data[0];
        } else {
            projects.unshift(result.data[0]);
        }
        
        closeModal();
        renderProjects();
        updateDashboard();
        toast(`Project ${id ? 'updated' : 'created'}`, 'success');
    } else {
        toast(`Failed to save project: ${result.error}`, 'error');
    }
}

async function deleteProject(id) {
    if (!confirm('Delete this project? This cannot be undone.')) return;
    
    const result = await saveToCloud('projects', { id }, 'delete');
    
    if (result.success) {
        projects = projects.filter(p => p.id !== id);
        renderProjects();
        updateDashboard();
        toast('Project deleted', 'success');
    } else {
        toast(`Failed to delete project: ${result.error}`, 'error');
    }
}

// ============================================================
// RENDER FUNCTIONS
// ============================================================
function renderAll() {
    renderProjects();
    renderClients();
    renderInvoices();
    renderPayments();
    renderTransactions();
    renderTimeEntries();
    updateDashboard();
}

function renderProjects() {
    const container = document.getElementById('projectsGrid');
    if (!container) return;
    
    if (!projects.length) {
        container.innerHTML = '<div class="empty-state" style="grid-column: 1/-1;"><p>No projects yet. All data is stored in the cloud.</p></div>';
        return;
    }
    
    container.innerHTML = projects.map(p => {
        const client = clients.find(c => c.id === p.client_id);
        const projectTimeEntries = timeEntries.filter(t => t.project_id === p.id);
        const totalHours = projectTimeEntries.reduce((s, t) => s + (t.duration || 0), 0) / 3600;
        const revenue = totalHours * (p.hourly_rate || 0);
        
        return `
            <div class="project-card">
                <div class="project-card-header">
                    <div>
                        <div class="project-name">${escapeHtml(p.name)}</div>
                        <div class="project-client">${client ? escapeHtml(client.company || client.name) : 'No client'}</div>
                    </div>
                    <span class="project-status ${p.status}">${p.status}</span>
                </div>
                <div class="project-stats">
                    <div>
                        <div class="project-stat-label">Hours</div>
                        <div class="project-stat-value">${totalHours.toFixed(1)}h</div>
                    </div>
                    <div>
                        <div class="project-stat-label">Rate</div>
                        <div class="project-stat-value">$${p.hourly_rate || 0}</div>
                    </div>
                    <div>
                        <div class="project-stat-label">Revenue</div>
                        <div class="project-stat-value">$${revenue.toFixed(2)}</div>
                    </div>
                </div>
                <div class="project-actions">
                    <button onclick="editProject('${p.id}')" class="btn btn-sm btn-secondary">Edit</button>
                    <button onclick="deleteProject('${p.id}')" class="btn btn-sm btn-danger">Delete</button>
                </div>
            </div>
        `;
    }).join('');
}

// Add similar render functions for other entities...

// ============================================================
// UTILITY FUNCTIONS
// ============================================================
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function toast(message, type = 'info') {
    console.log(`[Toast ${type}]`, message);
    // Implement toast notification
}

function showLogin() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('app').style.display = 'none';
}

function showApp() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
}

function closeModal() {
    document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
}

// Export functions for onclick handlers
window.saveProject = saveProject;
window.deleteProject = deleteProject;
window.editProject = (id) => {
    const p = projects.find(x => x.id === id);
    if (p) {
        document.getElementById('projectId').value = p.id;
        document.getElementById('projectName').value = p.name || '';
        document.getElementById('projectClient').value = p.client_id || '';
        document.getElementById('projectStatus').value = p.status || 'active';
        document.getElementById('projectRate').value = p.hourly_rate || '';
        document.getElementById('projectSource').value = p.source || 'direct';
        document.getElementById('projectDesc').value = p.description || '';
        document.getElementById('projectModal').style.display = 'block';
    }
};

console.log('[Oracle Cloud] ✅ Cloud-first app loaded');
