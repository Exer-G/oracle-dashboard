// Oracle Dashboard - Professional Edition v2
// Comprehensive Business Intelligence Platform
// ============================================================

const SUPABASE_URL = 'https://uaivaspunoceuzxkukmh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhaXZhc3B1bm9jZXV6eGt1a21oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMTc2MDEsImV4cCI6MjA4NDY5MzYwMX0.yasfPMw3fRyOawYXLNTtZhpxutFCBd70f1Cot3AVcFc';

// ============================================================
// STANDARD BANK TRANSACTION CLASSIFICATION
// ============================================================
const INCOME_PATTERNS = [
    { pattern: /TELETRANSMISSION INWARD/i, category: 'wire_transfer', source: 'international' },
    { pattern: /CREDIT TRANSFER/i, category: 'credit_transfer', source: 'local' },
    { pattern: /IB PAYMENT FROM/i, category: 'ib_transfer', source: 'internal' },
    { pattern: /IB TRANSFER FROM/i, category: 'ib_transfer', source: 'internal' },
    { pattern: /REAL TIME TRANSFER FROM/i, category: 'rtt', source: 'local' },
    { pattern: /UPWORK ESCROW/i, category: 'freelance', source: 'upwork' },
];

const EXPENSE_PATTERNS = [
    { pattern: /IB PAYMENT TO/i, category: 'payment', subcategory: 'ib_transfer' },
    { pattern: /IB TRANSFER TO/i, category: 'transfer', subcategory: 'internal' },
    { pattern: /IMMEDIATE PAYMENT/i, category: 'payment', subcategory: 'eft' },
    { pattern: /PAYSHAP PAYMENT TO/i, category: 'payment', subcategory: 'payshap' },
    { pattern: /CHEQUE CARD PURCHASE/i, category: 'card_purchase', subcategory: 'debit' },
    { pattern: /TELETRANSMISSION OUTWARD/i, category: 'wire_transfer', subcategory: 'international' },
    { pattern: /ELECTRICITY PURCHASE/i, category: 'utilities', subcategory: 'electricity' },
    { pattern: /ACCOUNT PAYMENT/i, category: 'payment', subcategory: 'account' },
    { pattern: /REGISTERED DC DEBIT/i, category: 'debit_order', subcategory: 'vehicle' },
    { pattern: /INSURANCE PREMIUM/i, category: 'insurance', subcategory: 'premium' },
    { pattern: /CELLPHONE INSTANTMON/i, category: 'instant_money', subcategory: 'cash_send' },
];

const FEE_PATTERNS = [
    /FEE IMMEDIATE PAYMENT/i,
    /FEE: PAYSHAP PAYMENT/i,
    /FEE-TELETRANSMISSION/i,
    /FEE: PAYMENT CONFIRM/i,
    /FEE: ELECTRICITY/i,
    /FEE - INSTANT MONEY/i,
    /FEE: MYUPDATES/i,
    /MONTHLY MANAGEMENT FEE/i,
];

const KNOWN_ENTITIES = {
    'EVANSWERKS': { name: 'EvansWerks', category: 'consulting' },
    'SENSIFY': { name: 'Sensify UK', category: 'consulting' },
    'AYANDA CAPITAL': { name: 'Ayanda Capital', category: 'consulting' },
    'ORTHOGLIDE': { name: 'Orthoglide', category: 'manufacturing' },
    'INVESTECPB': { name: 'Investec', category: 'payment' },
    'YOCO': { name: 'Yoco', category: 'payment' },
    'UPWORK': { name: 'Upwork', category: 'freelance' },
    'OPENAI': { name: 'OpenAI', category: 'software' },
    'DISCOVERY': { name: 'Discovery', category: 'savings' },
    'OLD MUTUAL': { name: 'Old Mutual', category: 'insurance' },
    'BUILD VOLUME': { name: 'Build Volume', category: 'manufacturing' },
    'NEDABF': { name: 'Nedbank Vehicle Finance', category: 'vehicle' },
};

// Global state
let supabaseClient = null;
let currentUser = null;
let projects = [];
let clients = [];
let invoices = [];
let payments = [];
let transactions = [];
let timeEntries = [];
let billingEntries = [];
let trackerBlocks = []; // Time Tracker blocks from tt_time_blocks
let settings = {};
let firefliesIntegration = null;
let teammates = [];
let meetings = [];

// Timer state
let timerRunning = false;
let timerSeconds = 0;
let timerInterval = null;
let timerStartTime = null;

// Invoice line items
let lineItems = [];

// Real-time subscriptions
let projectsSubscription = null;
let clientsSubscription = null;
let invoicesSubscription = null;

console.log('[Oracle] Starting...');

// ============================================================
// INITIALIZATION
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    if (typeof window.supabase === 'undefined') {
        showError('Failed to load Supabase. Refresh the page.');
        return;
    }
    
    try {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        
        supabaseClient.auth.onAuthStateChange((event, session) => {
            console.log('[Auth] State change event:', event);
            if (session && session.user) {
                console.log('[Auth] User signed in:', session.user.email);
                currentUser = session.user;
                showApp();
                loadAllData().catch(err => {
                    console.error('[Auth] Error loading data:', err);
                    toast('Failed to load data', 'error');
                });
            } else {
                console.log('[Auth] User signed out');
                currentUser = null;
                showLogin();
            }
        });
        
        if (window.location.hash && window.location.hash.includes('access_token')) {
            setTimeout(() => history.replaceState(null, '', window.location.pathname), 500);
        }
    } catch (err) {
        showError('Init failed: ' + err.message);
        return;
    }
    
    setupNavigation();
    setupChat();
    setupFileUploads();
    setupFilters();
    loadLocalData();
    setupLiveUpdates();
});

// ============================================================
// AUTH
// ============================================================
async function signInWithGoogle() {
    if (!supabaseClient) {
        toast('Not ready. Refresh.', 'error');
        return;
    }
    
    try {
        await supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.origin + window.location.pathname }
        });
    } catch (err) {
        console.error('[Auth] Sign in error:', err);
        toast('Sign in failed: ' + (err.message || 'Unknown error'), 'error');
    }
}

async function signOut() {
    if (supabaseClient) await supabaseClient.auth.signOut();
    currentUser = null;
    showLogin();
}

function showError(msg) {
    const card = document.querySelector('.login-card');
    if (card) card.innerHTML = `<div style="color:#EF4444;padding:20px;"><h2>Error</h2><p>${msg}</p><button onclick="location.reload()" class="google-btn" style="margin-top:16px;">Refresh</button></div>`;
}

function showLogin() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('app').style.display = 'none';
    document.getElementById('app').classList.remove('visible');
}

function showApp() {
    if (!currentUser) {
        showLogin();
        return;
    }
    
    // Access control - allow @exergydesigns.com OR team members
    const email = currentUser.email || '';
    const emailParts = email.split('@');
    const domain = emailParts.length === 2 ? emailParts[1] : null;
    
    // Load team members from data-loader or localStorage
    const team = window.ORACLE_PRELOAD?.team || JSON.parse(localStorage.getItem('oracle_team') || '[]');
    const allowedFreelancers = team.map(m => m.email.toLowerCase());
    
    const isExergyEmail = domain && domain.toLowerCase() === 'exergydesigns.com';
    const isAllowedFreelancer = allowedFreelancers.includes(email.toLowerCase());
    
    console.log('[Auth] Access check:', { email, isExergyEmail, isAllowedFreelancer, teamEmails: allowedFreelancers });
    
    if (!isExergyEmail && !isAllowedFreelancer) {
        showAccessDenied();
        return;
    }
    
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('accessDeniedScreen')?.classList.add('hidden');
    document.getElementById('app').style.display = 'flex';
    document.getElementById('app').classList.add('visible');
    
    const name = currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || 'User';
    const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    
    document.getElementById('userName').textContent = name;
    document.getElementById('userEmail').textContent = currentUser.email || '';
    
    const avatar = document.getElementById('userAvatar');
    if (currentUser.user_metadata?.avatar_url) {
        avatar.innerHTML = `<img src="${currentUser.user_metadata.avatar_url}" alt="${name}">`;
    } else {
        avatar.textContent = initials;
    }
    
    // Determine user role
    const adminEmails = window.ORACLE_ADMIN_EMAILS || ['shuaib@exergydesigns.com', 'oracle@exergydesigns.com'];
    const isAdmin = adminEmails.includes(email.toLowerCase());
    
    // Store globally
    window.ORACLE_IS_ADMIN = isAdmin;
    window.ORACLE_CURRENT_USER = currentUser;
    window.ORACLE_USER_ROLE = isAdmin ? 'admin' : 'freelancer';
    
    // Apply viewport based on role
    applyViewport(isAdmin);
}

function showAccessDenied() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('app').style.display = 'none';
    
    // Create access denied screen if not exists
    let deniedScreen = document.getElementById('accessDeniedScreen');
    if (!deniedScreen) {
        deniedScreen = document.createElement('div');
        deniedScreen.id = 'accessDeniedScreen';
        deniedScreen.className = 'login-screen';
        deniedScreen.innerHTML = `
            <div class="login-card">
                <div class="login-logo" style="background: var(--danger);"><span>⚠</span></div>
                <h1>Access Denied</h1>
                <p style="margin-bottom: 16px;">Oracle is only available to Exergy Designs team members.</p>
                <p style="font-size: 12px; color: var(--grey-500);">Please sign in with your @exergydesigns.com email address.</p>
                <button class="google-btn" onclick="signOut()" style="margin-top: 20px;">
                    Sign Out & Try Again
                </button>
            </div>
        `;
        document.body.appendChild(deniedScreen);
    }
    
    deniedScreen.style.display = 'flex';
    deniedScreen.classList.remove('hidden');
}

function applyViewport(isAdmin) {
    // Admin-only nav items
    const adminNavItems = ['analyzerNav', 'teamNav', 'scannedNav'];
    adminNavItems.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = isAdmin ? 'flex' : 'none';
    });
    
    // Freelancer-hidden nav items (business data they shouldn't see)
    const adminOnlyPages = ['clients', 'invoices', 'payments', 'transactions', 'upload'];
    adminOnlyPages.forEach(page => {
        const navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
        if (navItem) navItem.style.display = isAdmin ? 'flex' : 'none';
    });
    
    // Show freelancer dashboard or admin dashboard
    if (!isAdmin) {
        // Freelancer: Show simplified dashboard with their allocations
        renderFreelancerDashboard();
    }
    
    // Update sidebar title based on role
    const logoText = document.querySelector('.logo-text span');
    if (logoText) {
        logoText.textContent = isAdmin ? 'Exergy Designs' : 'Freelancer Portal';
    }
}

// ============================================================
// DATA LOADING
// ============================================================
async function loadAllData() {
    // Check for preloaded data first
    await loadPreloadedData();
    
    await Promise.all([
        loadProjects(),
        loadClients(),
        loadInvoices(),
        loadPayments(),
        loadTransactions(),
        loadSettings(),
        loadTimeEntries(),
        loadTrackerBlocks(),
        loadTrackerTeamMembers(),
        initializeFireflies()
    ]);

    // Seed projects to Supabase if table is empty (one-time sync)
    await seedProjectsToSupabase();

    // Load allocations from Supabase user_settings
    await loadAllocationsFromSupabase();

    updateDashboard();
    updateProjectDropdowns();
    updateClientDropdowns();
    renderProjectChart();
    renderFinancialAnalyzer();
    renderTeamPage();
    renderMeetingsPage();
    populateMeetingsClientFilter();
    loadScannedData();
    setupRealtimeSubscriptions();
}

// ============================================================
// FIREFLIES INTEGRATION
// ============================================================
async function initializeFireflies() {
    try {
        if (!window.ORACLE_CONFIG?.fireflies?.graphqlEndpoint) {
            console.log('[Fireflies] No endpoint configured');
            return;
        }
        
        console.log('[Fireflies] Initializing...');
        firefliesIntegration = new FirefliesIntegration(null);
        
        // Check last sync time to avoid rate limits
        const lastSync = parseInt(localStorage.getItem('fireflies_last_sync') || '0');
        const now = Date.now();
        const SYNC_INTERVAL = 30 * 60 * 1000; // 30 minutes
        
        // Load from cache first
        const cached = localStorage.getItem('oracle_meetings');
        if (cached) {
            try {
                meetings = JSON.parse(cached);
                window.ORACLE_MEETINGS = meetings;
                console.log('[Fireflies] Loaded', meetings.length, 'meetings from cache');
            } catch (e) {
                console.warn('[Fireflies] Cache parse error:', e);
            }
        }
        
        // Check if we hit rate limit recently
        const rateLimitUntil = parseInt(localStorage.getItem('fireflies_rate_limit_until') || '0');
        const isRateLimited = now < rateLimitUntil;
        
        if (isRateLimited) {
            const waitMinutes = Math.round((rateLimitUntil - now) / 60000);
            console.log('[Fireflies] 🚫 Rate limited - skipping API call (retry in', waitMinutes, 'minutes)');
        } else if (now - lastSync > SYNC_INTERVAL) {
            console.log('[Fireflies] Fetching from API (last sync:', Math.round((now - lastSync) / 60000), 'mins ago)');
            try {
                await firefliesIntegration.fetchMeetings(500);
                teammates = firefliesIntegration.teammates;
                meetings = firefliesIntegration.meetings;
                localStorage.setItem('fireflies_last_sync', String(now));
                localStorage.setItem('oracle_meetings', JSON.stringify(meetings));
                localStorage.removeItem('fireflies_rate_limit_until'); // Clear any old rate limit
                console.log('[Fireflies] ✅ Synced', meetings.length, 'meetings');
            } catch (err) {
                console.warn('[Fireflies] ⚠️ API error (using cached data):', err.message);
                
                // If rate limit error, store when it expires
                if (err.message?.includes('Too many requests') || err.message?.includes('retry after')) {
                    // Parse retry time from error message or default to tomorrow midnight UTC
                    const tomorrow = new Date();
                    tomorrow.setUTCHours(24, 0, 0, 0);
                    localStorage.setItem('fireflies_rate_limit_until', String(tomorrow.getTime()));
                    console.log('[Fireflies] 🚫 Rate limit stored - will retry after', tomorrow.toISOString());
                }
            }
        } else {
            console.log('[Fireflies] Using cache (next sync in', Math.round((SYNC_INTERVAL - (now - lastSync)) / 60000), 'mins)');
        }
        
        teammates = firefliesIntegration.teammates;
        if (meetings.length === 0 && firefliesIntegration.meetings?.length > 0) {
            meetings = firefliesIntegration.meetings;
        }
        
        console.log(`[Fireflies] Loaded ${meetings.length} meetings, ${teammates.length} teammates`);
        
        // Update UI
        renderTeammatesNoticeBoard();
        updateMeetingsBadge();
    } catch (error) {
        console.error('[Fireflies] Initialization failed:', error);
        toast('Failed to load Fireflies data', 'warning');
    }
}

function renderTeammatesNoticeBoard() {
    // This will be called to render the notice board UI
    // For now, just log it
    console.log('[Oracle] Teammates loaded:', teammates.length);
    
    // Update team badge
    const teamBadge = document.getElementById('teamBadge');
    if (teamBadge) teamBadge.textContent = teammates.length;
}

function updateMeetingsBadge() {
    const meetingsBadge = document.getElementById('meetingsBadge');
    if (meetingsBadge) meetingsBadge.textContent = meetings.length;
}

// ============================================================
// REAL-TIME SUPABASE SUBSCRIPTIONS
// ============================================================
function setupRealtimeSubscriptions() {
    if (!supabaseClient || !currentUser) {
        console.log('[Realtime] Not ready for subscriptions');
        return;
    }
    
    console.log('[Realtime] Setting up subscriptions...');
    
    // Projects subscription
    projectsSubscription = supabaseClient
        .channel('projects_changes')
        .on('postgres_changes', 
            { event: '*', schema: 'public', table: 'projects' },
            (payload) => {
                console.log('[Realtime] Projects change:', payload);
                handleProjectChange(payload);
            }
        )
        .subscribe();
    
    // Clients subscription
    clientsSubscription = supabaseClient
        .channel('clients_changes')
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'clients' },
            (payload) => {
                console.log('[Realtime] Clients change:', payload);
                handleClientChange(payload);
            }
        )
        .subscribe();
    
    // Invoices subscription
    invoicesSubscription = supabaseClient
        .channel('invoices_changes')
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'invoices' },
            (payload) => {
                console.log('[Realtime] Invoices change:', payload);
                handleInvoiceChange(payload);
            }
        )
        .subscribe();
    
    console.log('[Realtime] Subscriptions active');
}

function handleProjectChange(payload) {
    const { eventType, new: newRecord, old: oldRecord } = payload;
    
    if (eventType === 'INSERT') {
        projects.push(newRecord);
        toast('New project added', 'success');
    } else if (eventType === 'UPDATE') {
        const index = projects.findIndex(p => p.id === newRecord.id);
        if (index !== -1) {
            projects[index] = newRecord;
            toast('Project updated', 'info');
        }
    } else if (eventType === 'DELETE') {
        projects = projects.filter(p => p.id !== oldRecord.id);
        toast('Project deleted', 'info');
    }
    
    // Update UI
    renderProjects();
    renderProjectsPage();
    updateProjectDropdowns();
    updateDashboard();
}

function handleClientChange(payload) {
    const { eventType, new: newRecord, old: oldRecord } = payload;
    
    if (eventType === 'INSERT') {
        clients.push(newRecord);
        toast('New client added', 'success');
    } else if (eventType === 'UPDATE') {
        const index = clients.findIndex(c => c.id === newRecord.id);
        if (index !== -1) clients[index] = newRecord;
    } else if (eventType === 'DELETE') {
        clients = clients.filter(c => c.id !== oldRecord.id);
    }
    
    // Update UI
    renderClients();
    renderClientsPage();
    updateClientDropdowns();
}

function handleInvoiceChange(payload) {
    const { eventType, new: newRecord, old: oldRecord } = payload;
    
    if (eventType === 'INSERT') {
        invoices.push(newRecord);
        toast('New invoice created', 'success');
    } else if (eventType === 'UPDATE') {
        const index = invoices.findIndex(i => i.id === newRecord.id);
        if (index !== -1) invoices[index] = newRecord;
    } else if (eventType === 'DELETE') {
        invoices = invoices.filter(i => i.id !== oldRecord.id);
    }
    
    // Update UI
    renderInvoices();
    renderOutstandingInvoices();
    updateDashboard();
}

async function loadPreloadedData() {
    // Check if preloaded data exists (from data-loader.js)
    if (window.ORACLE_PRELOAD) {
        console.log('[Oracle] Loading preloaded data...');
        const preload = window.ORACLE_PRELOAD;
        
        // Always load preloaded data directly into arrays
        if (preload.clients?.length) {
            const existing = JSON.parse(localStorage.getItem('oracle_clients') || '[]');
            const merged = [...preload.clients];
            existing.forEach(e => {
                if (!merged.find(m => m.id === e.id || m.name === e.name)) merged.push(e);
            });
            clients = merged;
            localStorage.setItem('oracle_clients', JSON.stringify(clients));
            console.log(`[Oracle] Loaded ${clients.length} clients`);
        }
        
        if (preload.invoices?.length) {
            const existing = JSON.parse(localStorage.getItem('oracle_invoices') || '[]');
            const merged = [...preload.invoices];
            existing.forEach(e => {
                if (!merged.find(m => m.id === e.id || m.invoice_number === e.invoice_number)) merged.push(e);
            });
            invoices = merged;
            localStorage.setItem('oracle_invoices', JSON.stringify(invoices));
            console.log(`[Oracle] Loaded ${invoices.length} invoices`);
        }
        
        if (preload.transactions?.length) {
            const existing = JSON.parse(localStorage.getItem('oracle_transactions') || '[]');
            const existingKeys = new Set(existing.map(t => `${t.date}|${t.amount}|${t.description?.substring(0, 30)}`));
            const newTxns = preload.transactions.filter(t => 
                !existingKeys.has(`${t.date}|${t.amount}|${t.description?.substring(0, 30)}`)
            );
            transactions = [...newTxns, ...existing];
            localStorage.setItem('oracle_transactions', JSON.stringify(transactions));
            console.log(`[Oracle] Loaded ${transactions.length} transactions`);
        }
        
        // Load persisted allocations from localStorage
        const storedAllocations = localStorage.getItem('oracle_allocations');
        if (storedAllocations) {
            try {
                const parsed = JSON.parse(storedAllocations);
                if (parsed.length > 0) {
                    window.ORACLE_PRELOAD.allocations = parsed;
                    console.log('[Oracle] Loaded', parsed.length, 'allocations from localStorage');
                }
            } catch (e) {
                console.warn('[Oracle] Failed to parse stored allocations');
            }
        }

        // Auto-generate projects from invoices if projects array is empty
        if (preload.projects?.length === 0 && preload.invoices?.length > 0) {
            const existingProjects = JSON.parse(localStorage.getItem('oracle_projects') || '[]');
            if (existingProjects.length === 0) {
                console.log('[Oracle] Auto-generating projects from invoice data...');
                const projectMap = {};
                preload.invoices.forEach(inv => {
                    const key = inv.client_company || inv.client_name || 'Unknown';
                    if (!projectMap[key]) {
                        // Find matching client
                        const matchedClient = (preload.clients || []).find(c =>
                            c.company === inv.client_company || c.name === inv.client_name
                        );
                        projectMap[key] = {
                            id: crypto.randomUUID(),
                            name: key + ' Project',
                            client_id: matchedClient?.id || null,
                            status: 'active',
                            hourly_rate: inv.currency === 'USD' ? 64 : null,
                            currency: inv.currency || 'USD',
                            source: 'direct',
                            description: 'Auto-generated from invoice ' + inv.invoice_number,
                            total_revenue: inv.zar_total || 0,
                            created_at: inv.date || new Date().toISOString()
                        };
                    } else {
                        // Accumulate revenue
                        projectMap[key].total_revenue += (inv.zar_total || 0);
                    }
                });
                const generatedProjects = Object.values(projectMap);
                projects = generatedProjects;
                localStorage.setItem('oracle_projects', JSON.stringify(projects));
                console.log('[Oracle] Generated', generatedProjects.length, 'projects from invoices');
            }
        }

        // Link preloaded invoices to clients by matching client_name
        if (preload.invoices?.length && preload.clients?.length) {
            invoices.forEach(inv => {
                if (!inv.client_id && inv.client_name) {
                    const match = preload.clients.find(c =>
                        c.name === inv.client_name || c.company === inv.client_company
                    );
                    if (match) inv.client_id = match.id;
                }
            });
            localStorage.setItem('oracle_invoices', JSON.stringify(invoices));
        }

        console.log('[Oracle] Preloaded data ready');
    }
}

async function loadProjects() {
    // LOCAL IS SOURCE OF TRUTH - always load from localStorage first
    // NEVER wipe existing data
    const stored = JSON.parse(localStorage.getItem('oracle_projects') || '[]');
    
    console.log('[Oracle] loadProjects: localStorage has', stored.length, 'projects, memory has', projects.length);
    
    // If we already have projects in memory, DON'T overwrite them
    if (projects.length > 0 && stored.length === 0) {
        // Memory has data that localStorage doesn't - save it!
        console.log('[Oracle] Preserving in-memory projects to localStorage');
        localStorage.setItem('oracle_projects', JSON.stringify(projects));
    } else if (stored.length > 0) {
        // Merge: keep all from localStorage, add any from memory that aren't there
        const storedIds = new Set(stored.map(p => p.id));
        const newFromMemory = projects.filter(p => !storedIds.has(p.id));
        projects = [...stored, ...newFromMemory];
        if (newFromMemory.length > 0) {
            localStorage.setItem('oracle_projects', JSON.stringify(projects));
        }
    } else if (window.ORACLE_PRELOAD?.projects?.length > 0) {
        // Only use preload if we have nothing
        projects = window.ORACLE_PRELOAD.projects;
        localStorage.setItem('oracle_projects', JSON.stringify(projects));
    }
    
    // If still empty AND we have Supabase, pull SHARED data (not user-specific)
    if (projects.length === 0 && currentUser && supabaseClient) {
        try {
            // Pull ALL projects (shared across team - no user_id filter)
            const { data, error } = await supabaseClient
                .from('projects')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (!error && data?.length > 0) {
                projects = data;
                localStorage.setItem('oracle_projects', JSON.stringify(projects));
                console.log('[Oracle] Synced', data.length, 'shared projects from Supabase');
            }
        } catch (e) {
            console.warn('Failed to seed projects from Supabase:', e);
        }
    }
    
    console.log('[Oracle] loadProjects complete:', projects.length, 'projects');
    document.getElementById('projectsBadge').textContent = projects.filter(p => p.status === 'active').length;
    renderProjects();
}

async function loadClients() {
    // LOCAL IS SOURCE OF TRUTH - always load from localStorage first
    const stored = JSON.parse(localStorage.getItem('oracle_clients') || '[]');
    
    // Merge with preloaded data if available
    if (stored.length === 0 && window.ORACLE_PRELOAD?.clients) {
        clients = window.ORACLE_PRELOAD.clients;
        localStorage.setItem('oracle_clients', JSON.stringify(clients));
    } else {
        clients = stored;
    }
    
    // Pull SHARED data from Supabase (all team clients)
    if (clients.length === 0 && currentUser && supabaseClient) {
        try {
            const { data, error } = await supabaseClient
                .from('clients')
                .select('*')
                .order('name');
            
            if (!error && data?.length > 0) {
                clients = data;
                localStorage.setItem('oracle_clients', JSON.stringify(clients));
                console.log('[Oracle] Synced', data.length, 'shared clients from Supabase');
            }
        } catch (e) {
            console.warn('Failed to seed clients from Supabase:', e);
        }
    }
    
    document.getElementById('clientsBadge').textContent = clients.length;
    renderClients();
}

async function loadInvoices() {
    // LOCAL IS SOURCE OF TRUTH - always load from localStorage first
    const stored = JSON.parse(localStorage.getItem('oracle_invoices') || '[]');
    
    // Merge with preloaded data if available
    if (stored.length === 0 && window.ORACLE_PRELOAD?.invoices) {
        invoices = window.ORACLE_PRELOAD.invoices;
        localStorage.setItem('oracle_invoices', JSON.stringify(invoices));
    } else {
        invoices = stored;
    }
    
    // Pull SHARED data from Supabase (all team invoices)
    if (invoices.length === 0 && currentUser && supabaseClient) {
        try {
            const { data, error } = await supabaseClient
                .from('invoices')
                .select('*')
                .order('date', { ascending: false });
            
            if (!error && data?.length > 0) {
                invoices = data;
                localStorage.setItem('oracle_invoices', JSON.stringify(invoices));
                console.log('[Oracle] Synced', data.length, 'shared invoices from Supabase');
            }
        } catch (e) {
            console.warn('Failed to seed invoices from Supabase:', e);
        }
    }
    
    document.getElementById('invoicesBadge').textContent = invoices.filter(i => i.status === 'pending' || i.status === 'overdue').length;
    renderInvoices();
    renderOutstandingInvoices();
}

async function loadPayments() {
    // LOCAL IS SOURCE OF TRUTH
    const stored = JSON.parse(localStorage.getItem('oracle_payments') || '[]');
    
    if (stored.length === 0 && window.ORACLE_PRELOAD?.payments) {
        payments = window.ORACLE_PRELOAD.payments;
        localStorage.setItem('oracle_payments', JSON.stringify(payments));
    } else {
        payments = stored;
    }
    
    // Pull SHARED data from Supabase (all team payments)
    if (payments.length === 0 && currentUser && supabaseClient) {
        try {
            const { data, error} = await supabaseClient
                .from('payments')
                .select('*')
                .order('paid_at', { ascending: false });
            
            if (!error && data?.length > 0) {
                payments = data;
                localStorage.setItem('oracle_payments', JSON.stringify(payments));
                console.log('[Oracle] Synced', data.length, 'shared payments from Supabase');
            }
        } catch (e) {
            console.warn('Failed to seed payments from Supabase:', e);
        }
    }
    
    renderPayments();
}

async function loadTransactions() {
    // LOCAL IS SOURCE OF TRUTH
    const stored = JSON.parse(localStorage.getItem('oracle_transactions') || '[]');
    transactions = stored;
    
    // Pull SHARED data from Supabase (all team transactions)
    if (transactions.length === 0 && currentUser && supabaseClient) {
        try {
            const { data, error } = await supabaseClient
                .from('transactions')
                .select('*')
                .order('transaction_date', { ascending: false })
                .limit(1000);
            
            if (!error && data?.length > 0) {
                transactions = data;
                localStorage.setItem('oracle_transactions', JSON.stringify(transactions.slice(0, 500)));
                console.log('[Oracle] Synced', data.length, 'shared transactions from Supabase');
            }
        } catch (e) {
            console.warn('Failed to seed transactions from Supabase:', e);
        }
    }
    
    document.getElementById('txnBadge').textContent = transactions.length;
    renderTransactions();
}

async function loadSettings() {
    if (!currentUser || !supabaseClient) {
        settings = JSON.parse(localStorage.getItem('oracle_settings') || '{}');
        applySettings();
        return;
    }
    
    try {
        const { data } = await supabaseClient
            .from('user_settings')
            .select('*')
            .eq('user_id', currentUser.id)
            .single();
        
        if (data) {
            settings = data;
            localStorage.setItem('oracle_settings', JSON.stringify(settings));
        }
    } catch (e) {
        settings = JSON.parse(localStorage.getItem('oracle_settings') || '{}');
    }
    
    applySettings();
}

function applySettings() {
    if (settings.claude_api_key) document.getElementById('claudeKey').value = settings.claude_api_key;
    if (settings.default_hourly_rate) document.getElementById('defaultRate').value = settings.default_hourly_rate;
    if (settings.default_exchange_rate) document.getElementById('exchangeRate').value = settings.default_exchange_rate;
    if (settings.default_payment_terms) document.getElementById('paymentTerms').value = settings.default_payment_terms;
    
    updateSettingsStatus();
}

async function saveSettings() {
    const newSettings = {
        user_id: currentUser?.id,
        claude_api_key: document.getElementById('claudeKey')?.value.trim() || '',
        default_hourly_rate: parseFloat(document.getElementById('defaultRate')?.value) || 64,
        default_exchange_rate: parseFloat(document.getElementById('exchangeRate')?.value) || 18.5,
        default_payment_terms: parseInt(document.getElementById('paymentTerms')?.value) || 7
    };
    
    if (currentUser && supabaseClient) {
        try {
            const { error } = await supabaseClient.from('user_settings').upsert(newSettings, { onConflict: 'user_id' });
            if (error) console.error('[Oracle] Settings save failed:', error.message);
        } catch (e) { console.error('[Oracle] Settings save exception:', e); }
    }
    
    settings = newSettings;
    localStorage.setItem('oracle_settings', JSON.stringify(settings));
    updateSettingsStatus();
    toast('Settings saved', 'success');
}

function updateSettingsStatus() {
    document.getElementById('claudeStatus').className = `status-box ${settings.claude_api_key ? 'success' : 'error'}`;
    document.getElementById('claudeStatus').textContent = settings.claude_api_key ? '✓ Claude API configured' : '✗ Claude API not configured';
}

function loadLocalData() {
    // Load time entries from localStorage always
    timeEntries = JSON.parse(localStorage.getItem('oracle_time_entries') || '[]');
    billingEntries = JSON.parse(localStorage.getItem('oracle_billing_entries') || '[]');
    // Load cached tracker blocks
    trackerBlocks = JSON.parse(localStorage.getItem('oracle_tracker_blocks') || '[]');
    renderTimeEntries();
    updateTodayTotal();
    restoreTimerState();
}

// ============================================================
// TIME TRACKER INTEGRATION (tt_time_blocks + tt_team_members)
// ============================================================
async function loadTrackerBlocks() {
    if (!supabaseClient) return;

    try {
        // Load all approved/pending blocks from the time tracker (last 60 days)
        const sixtyDaysAgo = new Date();
        sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

        const { data, error } = await supabaseClient
            .from('tt_time_blocks')
            .select('*')
            .gte('start_time', sixtyDaysAgo.toISOString())
            .order('start_time', { ascending: false })
            .limit(1000);

        if (error) {
            console.error('[Tracker Integration] Load blocks error:', error);
            return;
        }

        trackerBlocks = data || [];
        localStorage.setItem('oracle_tracker_blocks', JSON.stringify(trackerBlocks));
        console.log('[Tracker Integration] Loaded', trackerBlocks.length, 'blocks from tt_time_blocks');
    } catch (err) {
        console.error('[Tracker Integration] Error:', err);
    }
}

async function loadTrackerTeamMembers() {
    if (!supabaseClient) return;

    try {
        const { data, error } = await supabaseClient
            .from('tt_team_members')
            .select('*')
            .order('name');

        if (error) {
            console.error('[Tracker Integration] Load team error:', error);
            return;
        }

        if (data && data.length > 0) {
            // Update ORACLE_PRELOAD.team with live Supabase data
            window.ORACLE_PRELOAD.team = data.map(m => ({
                id: m.id,
                email: m.email,
                name: m.name,
                role: m.role,
                title: m.title || '',
                hourlyRate: parseFloat(m.hourly_rate) || 0,
                currency: m.currency || 'USD',
                status: m.status || 'active'
            }));
            console.log('[Tracker Integration] Synced', data.length, 'team members from tt_team_members');
        }
    } catch (err) {
        console.error('[Tracker Integration] Team load error:', err);
    }
}

function getTrackerSummary() {
    // Aggregate tracker blocks into useful metrics for the dashboard
    const team = window.ORACLE_PRELOAD?.team || [];
    const now = new Date();
    const startOfWeek = getStartOfWeek(now);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const weekBlocks = trackerBlocks.filter(b => new Date(b.start_time) >= startOfWeek);
    const monthBlocks = trackerBlocks.filter(b => new Date(b.start_time) >= startOfMonth);

    // Per-user weekly breakdown
    const weeklyByUser = {};
    weekBlocks.forEach(b => {
        if (!weeklyByUser[b.user_id]) weeklyByUser[b.user_id] = { hours: 0, blocks: 0, cost: 0 };
        const hours = (b.duration_seconds || 0) / 3600;
        weeklyByUser[b.user_id].hours += hours;
        weeklyByUser[b.user_id].blocks++;
        weeklyByUser[b.user_id].cost += hours * (b.hourly_rate || 0);
    });

    // Total weekly team cost
    const weeklyTeamHours = weekBlocks.reduce((s, b) => s + (b.duration_seconds || 0), 0) / 3600;
    const weeklyTeamCost = weekBlocks.reduce((s, b) => {
        const hours = (b.duration_seconds || 0) / 3600;
        return s + (hours * (b.hourly_rate || 0));
    }, 0);

    // Monthly totals
    const monthlyTeamHours = monthBlocks.reduce((s, b) => s + (b.duration_seconds || 0), 0) / 3600;

    return {
        weeklyTeamHours,
        weeklyTeamCost,
        monthlyTeamHours,
        weeklyByUser,
        totalBlocks: trackerBlocks.length,
        weekBlocks: weekBlocks.length,
        monthBlocks: monthBlocks.length
    };
}

function getStartOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

// ============================================================
// SUPABASE PROJECT SEEDING & ALLOCATION SYNC
// ============================================================
async function seedProjectsToSupabase() {
    if (!supabaseClient || !currentUser) return;

    try {
        // Check if Supabase projects table has any data
        const { data: existing, error: checkError } = await supabaseClient
            .from('projects')
            .select('id')
            .limit(1);

        if (checkError) {
            console.warn('[Seed] Could not check projects table:', checkError.message);
            return;
        }

        if (existing && existing.length > 0) {
            console.log('[Seed] Projects table already has data, skipping seed');
            return;
        }

        // Table is empty — seed from local projects (localStorage or in-memory)
        if (projects.length === 0) {
            console.log('[Seed] No local projects to seed');
            return;
        }

        console.log('[Seed] Seeding', projects.length, 'projects to Supabase...');

        // Convert projects to valid Supabase format (ensure UUID IDs)
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const idMap = {}; // old ID -> new UUID mapping

        const projectsToSeed = projects.map(p => {
            let projectId = p.id;
            if (!uuidRegex.test(projectId)) {
                projectId = crypto.randomUUID();
                idMap[p.id] = projectId;
            }
            return {
                id: projectId,
                name: p.name,
                status: p.status || 'active',
                hourly_rate: p.hourly_rate || null,
                source: p.source || 'direct',
                description: p.description || '',
                user_id: currentUser.id,
                created_at: p.created_at || new Date().toISOString()
            };
        });

        const { error } = await supabaseClient.from('projects').insert(projectsToSeed);
        if (error) {
            console.error('[Seed] Project seed error:', error.message);
            return;
        }

        // Update local projects with new UUIDs
        if (Object.keys(idMap).length > 0) {
            projects = projects.map(p => {
                if (idMap[p.id]) {
                    return { ...p, id: idMap[p.id] };
                }
                return p;
            });
            localStorage.setItem('oracle_projects', JSON.stringify(projects));
            console.log('[Seed] Updated', Object.keys(idMap).length, 'project IDs to UUIDs');
        }

        console.log('[Seed] Successfully seeded', projectsToSeed.length, 'projects to Supabase');
        toast('Projects synced to cloud', 'success');
    } catch (err) {
        console.error('[Seed] Error:', err);
    }
}

async function loadAllocationsFromSupabase() {
    if (!supabaseClient || !currentUser) return;

    try {
        // Load allocations from user_settings JSON field
        const { data, error } = await supabaseClient
            .from('user_settings')
            .select('preferences')
            .eq('user_id', currentUser.id)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = not found
            console.warn('[Allocations] Load error:', error.message);
            return;
        }

        if (data?.preferences?.allocations) {
            const cloudAllocations = data.preferences.allocations;
            const localAllocations = window.ORACLE_PRELOAD?.allocations || [];

            // Merge: cloud wins for existing IDs, keep local-only ones
            const cloudIds = new Set(cloudAllocations.map(a => a.id));
            const localOnly = localAllocations.filter(a => !cloudIds.has(a.id));
            const merged = [...cloudAllocations, ...localOnly];

            if (!window.ORACLE_PRELOAD) window.ORACLE_PRELOAD = {};
            window.ORACLE_PRELOAD.allocations = merged;
            localStorage.setItem('oracle_allocations', JSON.stringify(merged));
            console.log('[Allocations] Loaded', cloudAllocations.length, 'allocations from Supabase');
        } else {
            // No cloud allocations, check localStorage
            const local = JSON.parse(localStorage.getItem('oracle_allocations') || '[]');
            if (local.length > 0) {
                if (!window.ORACLE_PRELOAD) window.ORACLE_PRELOAD = {};
                window.ORACLE_PRELOAD.allocations = local;
                // Push local to cloud
                await saveAllocationsToSupabase(local);
            }
        }
    } catch (err) {
        console.error('[Allocations] Load error:', err);
    }
}

async function saveAllocationsToSupabase(allocations) {
    if (!supabaseClient || !currentUser) return;

    try {
        // Save allocations as JSON in user_settings preferences
        const { data: existing } = await supabaseClient
            .from('user_settings')
            .select('id, preferences')
            .eq('user_id', currentUser.id)
            .single();

        const prefs = existing?.preferences || {};
        prefs.allocations = allocations || window.ORACLE_PRELOAD?.allocations || [];

        if (existing) {
            await supabaseClient
                .from('user_settings')
                .update({ preferences: prefs })
                .eq('user_id', currentUser.id);
        } else {
            await supabaseClient
                .from('user_settings')
                .insert({ user_id: currentUser.id, preferences: prefs });
        }

        console.log('[Allocations] Saved', prefs.allocations.length, 'allocations to Supabase');
    } catch (err) {
        console.error('[Allocations] Save error:', err);
    }
}

// ============================================================
// PROJECTS
// ============================================================
function renderProjects() {
    const container = document.getElementById('projectsGrid');
    if (!container) return;
    
    if (!projects.length) {
        container.innerHTML = '<div class="empty-state" style="grid-column: 1/-1;"><p>No projects yet. Create your first project!</p></div>';
        return;
    }
    
    container.innerHTML = projects.map(p => {
        const client = clients.find(c => c.id === p.client_id);
        const projectTimeEntries = timeEntries.filter(t => t.project_id === p.id);
        const totalHours = projectTimeEntries.reduce((s, t) => s + t.duration, 0) / 3600;
        const timeRevenue = totalHours * (p.hourly_rate || 0);
        
        // Add manual billing entries
        const projectBillings = billingEntries.filter(b => b.project_id === p.id);
        const billingRevenue = projectBillings.reduce((s, b) => s + (b.amount || 0), 0);
        const totalRevenue = (timeRevenue * (settings.default_exchange_rate || 18.5)) + billingRevenue;
        
        return `
            <div class="project-card" onclick="editProject('${p.id}')">
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
                        <div class="project-stat-value">${formatZAR(totalRevenue)}</div>
                    </div>
                </div>
                ${projectBillings.length > 0 ? `<div style="font-size: 11px; color: var(--text-secondary); margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--grey-200);">${projectBillings.length} manual billing ${projectBillings.length === 1 ? 'entry' : 'entries'}</div>` : ''}
            </div>
        `;
    }).join('');
}

function showProjectModal(id = null) {
    const modal = document.getElementById('projectModal');
    document.getElementById('projectModalTitle').textContent = id ? 'Edit Project' : 'New Project';
    document.getElementById('projectId').value = id || '';
    
    updateClientDropdowns();
    
    if (id) {
        const p = projects.find(x => x.id === id);
        if (p) {
            document.getElementById('projectName').value = p.name || '';
            document.getElementById('projectClient').value = p.client_id || '';
            document.getElementById('projectStatus').value = p.status || 'active';
            document.getElementById('projectRate').value = p.hourly_rate || '';
            document.getElementById('projectSource').value = p.source || 'direct';
            document.getElementById('projectDesc').value = p.description || '';
        }
    } else {
        document.getElementById('projectName').value = '';
        document.getElementById('projectClient').value = '';
        document.getElementById('projectStatus').value = 'active';
        document.getElementById('projectRate').value = settings.default_hourly_rate || 64;
        document.getElementById('projectSource').value = 'direct';
        document.getElementById('projectDesc').value = '';
    }
    
    openModal('projectModal');
}

async function saveProject() {
    const id = document.getElementById('projectId').value;
    const projectData = {
        name: document.getElementById('projectName').value.trim(),
        client_id: document.getElementById('projectClient').value || null,
        status: document.getElementById('projectStatus').value,
        hourly_rate: parseFloat(document.getElementById('projectRate').value) || null,
        source: document.getElementById('projectSource').value,
        description: document.getElementById('projectDesc').value.trim(),
        budget_allocated: parseFloat(document.getElementById('projectBudget')?.value) || null,
        budget_spent: parseFloat(document.getElementById('projectBudgetSpent')?.value) || 0,
        user_id: currentUser?.id
    };
    
    if (!projectData.name) {
        toast('Project name required', 'error');
        return;
    }
    
    if (id) {
        // Update
        const idx = projects.findIndex(p => p.id === id);
        if (idx >= 0) {
            projects[idx] = { ...projects[idx], ...projectData };
            if (supabaseClient && currentUser) {
                try {
                    const { error } = await supabaseClient.from('projects').update(projectData).eq('id', id);
                    if (error) console.error('[Oracle] Project update failed:', error.message);
                } catch (e) { console.error('[Oracle] Project update exception:', e); }
            }
        }
    } else {
        // Create
        const newProject = { ...projectData, id: crypto.randomUUID(), created_at: new Date().toISOString() };
        projects.unshift(newProject);
        if (supabaseClient && currentUser) {
            try {
                const { error } = await supabaseClient.from('projects').insert(newProject);
                if (error) console.error('[Oracle] Project insert failed:', error.message);
            } catch (e) { console.error('[Oracle] Project insert exception:', e); }
        }
    }
    
    localStorage.setItem('oracle_projects', JSON.stringify(projects));
    renderProjects();
    updateProjectDropdowns();
    closeModal();
    toast('Project saved', 'success');
    
    // Auto-sync to cloud
    syncData();
}

function editProject(id) {
    showProjectModal(id);
}

// ============================================================
// CLIENTS
// ============================================================
function renderClients() {
    const container = document.getElementById('clientsList');
    if (!container) return;
    
    if (!clients.length) {
        container.innerHTML = '<div class="empty-state"><p>No clients yet. Add your first client!</p></div>';
        return;
    }
    
    container.innerHTML = clients.map(c => {
        const clientInvoices = invoices.filter(i => i.client_id === c.id);
        const totalInvoiced = clientInvoices.reduce((s, i) => s + (i.zar_total || 0), 0);
        const totalPaid = clientInvoices.filter(i => i.status === 'paid').reduce((s, i) => s + (i.zar_total || 0), 0);
        
        return `
            <div class="list-item" onclick="editClient('${c.id}')">
                <div class="list-icon"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg></div>
                <div class="list-info">
                    <div class="list-title">${escapeHtml(c.name)}${c.company ? ` • ${escapeHtml(c.company)}` : ''}</div>
                    <div class="list-meta">${c.email || 'No email'} • ${clientInvoices.length} invoices</div>
                </div>
                <div style="text-align: right;">
                    <div class="list-amount positive">${formatZAR(totalPaid)}</div>
                    <div class="list-meta">of ${formatZAR(totalInvoiced)}</div>
                </div>
            </div>
        `;
    }).join('');
}

function showClientModal(id = null) {
    const modal = document.getElementById('clientModal');
    document.getElementById('clientModalTitle').textContent = id ? 'Edit Client' : 'New Client';
    document.getElementById('clientId').value = id || '';
    
    if (id) {
        const c = clients.find(x => x.id === id);
        if (c) {
            document.getElementById('clientName').value = c.name || '';
            document.getElementById('clientCompany').value = c.company || '';
            document.getElementById('clientEmail').value = c.email || '';
            document.getElementById('clientPhone').value = c.phone || '';
            document.getElementById('clientAddress').value = c.address || '';
            document.getElementById('clientCurrency').value = c.currency || 'USD';
            document.getElementById('clientTerms').value = c.payment_terms || 7;
        }
    } else {
        document.getElementById('clientName').value = '';
        document.getElementById('clientCompany').value = '';
        document.getElementById('clientEmail').value = '';
        document.getElementById('clientPhone').value = '';
        document.getElementById('clientAddress').value = '';
        document.getElementById('clientCurrency').value = 'USD';
        document.getElementById('clientTerms').value = settings.default_payment_terms || 7;
    }
    
    openModal('clientModal');
}

async function saveClient() {
    const id = document.getElementById('clientId').value;
    const clientData = {
        name: document.getElementById('clientName').value.trim(),
        company: document.getElementById('clientCompany').value.trim(),
        email: document.getElementById('clientEmail').value.trim(),
        phone: document.getElementById('clientPhone').value.trim(),
        address: document.getElementById('clientAddress').value.trim(),
        currency: document.getElementById('clientCurrency').value,
        payment_terms: parseInt(document.getElementById('clientTerms').value) || 7,
        user_id: currentUser?.id
    };
    
    if (!clientData.name) {
        toast('Client name required', 'error');
        return;
    }
    
    if (id) {
        const idx = clients.findIndex(c => c.id === id);
        if (idx >= 0) {
            clients[idx] = { ...clients[idx], ...clientData };
            if (supabaseClient && currentUser) {
                try {
                    const { error } = await supabaseClient.from('clients').update(clientData).eq('id', id);
                    if (error) console.error('[Oracle] Client update failed:', error.message);
                } catch (e) { console.error('[Oracle] Client update exception:', e); }
            }
        }
    } else {
        const newClient = { ...clientData, id: crypto.randomUUID(), created_at: new Date().toISOString() };
        clients.push(newClient);
        clients.sort((a, b) => a.name.localeCompare(b.name));
        if (supabaseClient && currentUser) {
            try {
                const { error } = await supabaseClient.from('clients').insert(newClient);
                if (error) console.error('[Oracle] Client insert failed:', error.message);
            } catch (e) { console.error('[Oracle] Client insert exception:', e); }
        }
    }
    
    localStorage.setItem('oracle_clients', JSON.stringify(clients));
    renderClients();
    updateClientDropdowns();
    closeModal();
    toast('Client saved', 'success');
    
    // Auto-sync to cloud
    syncData();
}

function editClient(id) {
    showClientModal(id);
}

// ============================================================
// INVOICES
// ============================================================
let currentFilter = 'all';

function setupFilters() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderInvoices();
        });
    });
}

function renderInvoices() {
    const container = document.getElementById('invoicesList');
    if (!container) return;
    
    let filtered = invoices;
    if (currentFilter !== 'all') {
        filtered = invoices.filter(i => i.status === currentFilter);
    }
    
    if (!filtered.length) {
        container.innerHTML = '<div class="empty-state"><p>No invoices found.</p></div>';
        return;
    }
    
    container.innerHTML = filtered.map(inv => {
        // Try to find client by ID, or use invoice's client_name directly
        const client = clients.find(c => c.id === inv.client_id);
        const clientName = client?.name || inv.client_name || inv.client_company || 'Unknown';
        return `
            <div class="list-item">
                <div class="list-icon ${inv.status === 'paid' ? 'income' : 'pending'}">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                </div>
                <div class="list-info">
                    <div class="list-title">${inv.invoice_number} • ${escapeHtml(clientName)}</div>
                    <div class="list-meta">${inv.date} • ${inv.currency} ${formatNum(inv.subtotal || inv.total || 0)}</div>
                </div>
                <div class="list-amount ${inv.status === 'paid' ? 'positive' : ''}">${formatZAR(inv.zar_total || 0)}</div>
                <span class="invoice-status ${inv.status}">${inv.status}</span>
                <div class="list-actions">
                    <button class="list-action" onclick="editInvoice('${inv.id}')" title="Edit">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                    </button>
                    ${inv.status !== 'paid' ? `<button class="list-action" onclick="markInvoicePaid('${inv.id}')" title="Mark Paid">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 13l4 4L19 7"></path></svg>
                    </button>` : ''}
                    <button class="list-action" onclick="openInvoiceGenerator('${inv.id}')" title="Open in Generator">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function renderOutstandingInvoices() {
    const container = document.getElementById('outstandingInvoices');
    if (!container) return;
    
    const outstanding = invoices.filter(i => i.status === 'pending' || i.status === 'overdue').slice(0, 5);
    
    if (!outstanding.length) {
        container.innerHTML = '<div class="empty-state"><p>No outstanding invoices</p></div>';
        return;
    }
    
    container.innerHTML = outstanding.map(inv => {
        // Try to find client by ID, or use invoice's client_name directly
        const client = clients.find(c => c.id === inv.client_id);
        const clientName = client?.name || inv.client_name || inv.client_company || 'Unknown';
        return `
            <div class="list-item">
                <div class="list-icon pending">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                </div>
                <div class="list-info">
                    <div class="list-title">${inv.invoice_number}</div>
                    <div class="list-meta">${escapeHtml(clientName)}${inv.client_company ? ' - ' + escapeHtml(inv.client_company) : ''}</div>
                </div>
                <div class="list-amount">${formatZAR(inv.zar_total || 0)}</div>
            </div>
        `;
    }).join('');
}

function showInvoiceModal(id = null) {
    const modal = document.getElementById('invoiceModal');
    document.getElementById('invoiceModalTitle').textContent = id ? 'Edit Invoice' : 'New Invoice';
    document.getElementById('invoiceId').value = id || '';
    
    updateClientDropdowns();
    updateProjectDropdowns();
    
    if (id) {
        const inv = invoices.find(x => x.id === id);
        if (inv) {
            document.getElementById('invoiceNumber').value = inv.invoice_number || '';
            document.getElementById('invoiceDate').value = inv.date || '';
            document.getElementById('invoiceDueDate').value = inv.due_date || '';
            document.getElementById('invoiceClient').value = inv.client_id || '';
            document.getElementById('invoiceProject').value = inv.project_id || '';
            document.getElementById('invoiceCurrency').value = inv.currency || 'USD';
            document.getElementById('invoiceExchangeRate').value = inv.exchange_rate || 18.5;
            document.getElementById('invoicePaymentMethod').value = inv.payment_method || 'yoco';
            document.getElementById('invoiceRemarks').value = inv.remarks || '';
            lineItems = inv.line_items || [];
        }
    } else {
        const today = new Date().toISOString().split('T')[0];
        const num = `INV-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 900) + 100)}`;
        document.getElementById('invoiceNumber').value = num;
        document.getElementById('invoiceDate').value = today;
        document.getElementById('invoiceDueDate').value = '';
        document.getElementById('invoiceClient').value = '';
        document.getElementById('invoiceProject').value = '';
        document.getElementById('invoiceCurrency').value = 'USD';
        document.getElementById('invoiceExchangeRate').value = settings.default_exchange_rate || 18.5;
        document.getElementById('invoicePaymentMethod').value = 'yoco';
        document.getElementById('invoiceRemarks').value = '';
        lineItems = [{ id: Date.now(), description: '', qty: 1, unitPrice: settings.default_hourly_rate || 64, isHours: true }];
    }
    
    renderLineItems();
    openModal('invoiceModal');
}

function renderLineItems() {
    const container = document.getElementById('lineItemsContainer');
    container.innerHTML = lineItems.map((item, idx) => `
        <div class="line-item">
            <input type="text" class="form-input" placeholder="Description" value="${escapeHtml(item.description || '')}" onchange="updateLineItem(${idx}, 'description', this.value)">
            <input type="number" class="form-input" placeholder="Qty" value="${item.qty || 1}" step="0.01" onchange="updateLineItem(${idx}, 'qty', this.value)">
            <input type="number" class="form-input" placeholder="Rate" value="${item.unitPrice || 0}" step="0.01" onchange="updateLineItem(${idx}, 'unitPrice', this.value)">
            <button class="line-item-remove" onclick="removeLineItem(${idx})">×</button>
        </div>
    `).join('');
    
    calculateInvoiceTotals();
}

function addLineItem() {
    lineItems.push({ id: Date.now(), description: '', qty: 1, unitPrice: settings.default_hourly_rate || 64, isHours: true });
    renderLineItems();
}

function updateLineItem(idx, field, value) {
    if (lineItems[idx]) {
        lineItems[idx][field] = field === 'description' ? value : parseFloat(value) || 0;
        calculateInvoiceTotals();
    }
}

function removeLineItem(idx) {
    lineItems.splice(idx, 1);
    renderLineItems();
}

function calculateInvoiceTotals() {
    const subtotal = lineItems.reduce((sum, item) => sum + (item.qty || 0) * (item.unitPrice || 0), 0);
    const exchangeRate = parseFloat(document.getElementById('invoiceExchangeRate').value) || 18.5;
    const currency = document.getElementById('invoiceCurrency').value;
    const zarTotal = currency === 'ZAR' ? subtotal : subtotal * exchangeRate;
    
    document.getElementById('invoiceSubtotal').value = `${currency} ${formatNum(subtotal)}`;
    document.getElementById('invoiceZarTotal').value = formatZAR(zarTotal);
}

async function saveInvoice() {
    const id = document.getElementById('invoiceId').value;
    const exchangeRate = parseFloat(document.getElementById('invoiceExchangeRate').value) || 18.5;
    const currency = document.getElementById('invoiceCurrency').value;
    const subtotal = lineItems.reduce((sum, item) => sum + (item.qty || 0) * (item.unitPrice || 0), 0);
    const zarTotal = currency === 'ZAR' ? subtotal : subtotal * exchangeRate;
    
    const invoiceData = {
        invoice_number: document.getElementById('invoiceNumber').value.trim(),
        date: document.getElementById('invoiceDate').value,
        due_date: document.getElementById('invoiceDueDate').value || null,
        client_id: document.getElementById('invoiceClient').value || null,
        project_id: document.getElementById('invoiceProject').value || null,
        currency,
        exchange_rate: exchangeRate,
        subtotal,
        total: subtotal,
        zar_total: zarTotal,
        line_items: lineItems,
        remarks: document.getElementById('invoiceRemarks').value.trim(),
        payment_method: document.getElementById('invoicePaymentMethod').value,
        status: 'pending',
        user_id: currentUser?.id
    };
    
    if (!invoiceData.invoice_number || !invoiceData.client_id) {
        toast('Invoice number and client required', 'error');
        return;
    }
    
    if (id) {
        const idx = invoices.findIndex(i => i.id === id);
        if (idx >= 0) {
            invoices[idx] = { ...invoices[idx], ...invoiceData };
            if (supabaseClient && currentUser) {
                try {
                    const { error } = await supabaseClient.from('invoices').update(invoiceData).eq('id', id);
                    if (error) console.error('[Oracle] Invoice update failed:', error.message);
                } catch (e) { console.error('[Oracle] Invoice update exception:', e); }
            }
        }
    } else {
        const newInvoice = { ...invoiceData, id: crypto.randomUUID(), created_at: new Date().toISOString() };
        invoices.unshift(newInvoice);
        if (supabaseClient && currentUser) {
            try {
                const { error } = await supabaseClient.from('invoices').insert(newInvoice);
                if (error) console.error('[Oracle] Invoice insert failed:', error.message);
            } catch (e) { console.error('[Oracle] Invoice insert exception:', e); }
        }
    }
    
    localStorage.setItem('oracle_invoices', JSON.stringify(invoices));
    renderInvoices();
    renderOutstandingInvoices();
    updateDashboard();
    closeModal();
    toast('Invoice saved', 'success');
    
    // Auto-sync to cloud
    syncData();
}

function editInvoice(id) {
    showInvoiceModal(id);
}

async function markInvoicePaid(id) {
    const idx = invoices.findIndex(i => i.id === id);
    if (idx >= 0) {
        invoices[idx].status = 'paid';
        invoices[idx].paid_at = new Date().toISOString();
        
        // Create payment record
        const payment = {
            id: crypto.randomUUID(),
            invoice_id: id,
            client_id: invoices[idx].client_id,
            amount: invoices[idx].zar_total,
            currency: 'ZAR',
            original_amount: invoices[idx].total,
            original_currency: invoices[idx].currency,
            payment_method: invoices[idx].payment_method,
            status: 'completed',
            paid_at: new Date().toISOString(),
            user_id: currentUser?.id
        };
        payments.unshift(payment);
        
        if (supabaseClient && currentUser) {
            try {
                const { error: invErr } = await supabaseClient.from('invoices').update({ status: 'paid', paid_at: invoices[idx].paid_at }).eq('id', id);
                if (invErr) console.error('[Oracle] Invoice paid update failed:', invErr.message);
                const { error: payErr } = await supabaseClient.from('payments').insert(payment);
                if (payErr) console.error('[Oracle] Payment insert failed:', payErr.message);
            } catch (e) { console.error('[Oracle] Mark paid exception:', e); }
        }
        
        localStorage.setItem('oracle_invoices', JSON.stringify(invoices));
        localStorage.setItem('oracle_payments', JSON.stringify(payments));
        renderInvoices();
        renderPayments();
        updateDashboard();
        toast('Invoice marked as paid', 'success');
    }
}

function openInvoiceGenerator(id) {
    // Open the existing invoice generator with data
    window.open('https://exerinv.netlify.app/', '_blank');
}

// ============================================================
// PAYMENTS
// ============================================================
function renderPayments() {
    const container = document.getElementById('paymentsList');
    if (!container) return;
    
    if (!payments.length) {
        container.innerHTML = '<div class="empty-state"><p>No payments recorded yet.</p></div>';
        return;
    }
    
    // Update stats
    const totalAll = payments.filter(p => p.status === 'completed').reduce((s, p) => s + (p.amount || 0), 0);
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonth = payments.filter(p => p.status === 'completed' && new Date(p.paid_at) >= startOfMonth).reduce((s, p) => s + (p.amount || 0), 0);
    const pendingInvoices = invoices.filter(i => i.status === 'pending' || i.status === 'overdue').reduce((s, i) => s + (i.zar_total || 0), 0);
    
    document.getElementById('statPaymentsTotal').textContent = formatZAR(totalAll);
    document.getElementById('statPaymentsMonth').textContent = formatZAR(thisMonth);
    document.getElementById('statPaymentsPending').textContent = formatZAR(pendingInvoices);
    
    container.innerHTML = payments.slice(0, 50).map(p => {
        const client = clients.find(c => c.id === p.client_id);
        const inv = invoices.find(i => i.id === p.invoice_id);
        return `
            <div class="list-item">
                <div class="list-icon income">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                </div>
                <div class="list-info">
                    <div class="list-title">${client ? escapeHtml(client.name) : 'Unknown'}</div>
                    <div class="list-meta">${inv ? inv.invoice_number : 'Direct payment'} • ${p.payment_method || 'Unknown'} • ${new Date(p.paid_at).toLocaleDateString()}</div>
                </div>
                <div class="list-amount positive">${formatZAR(p.amount)}</div>
            </div>
        `;
    }).join('');
}

// ============================================================
// TRANSACTIONS
// ============================================================
function renderTransactions() {
    const container = document.getElementById('allTxns');
    if (!container) return;
    
    if (!transactions.length) {
        container.innerHTML = '<div class="empty-state"><p>No transactions yet. Upload bank statements or CSV files.</p></div>';
        document.getElementById('txnCount').textContent = '0 transactions';
        return;
    }
    
    document.getElementById('txnCount').textContent = `${transactions.length} transactions`;
    
    container.innerHTML = transactions.slice(0, 100).map(t => `
        <div class="list-item">
            <div class="list-icon ${t.amount >= 0 ? 'income' : 'expense'}">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    ${t.amount >= 0 
                        ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4v16m8-8H4"></path>'
                        : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 12H4"></path>'}
                </svg>
            </div>
            <div class="list-info">
                <div class="list-title">${escapeHtml(t.description?.substring(0, 50) || 'Unknown')}</div>
                <div class="list-meta">${t.date} • ${t.source || 'Unknown'}</div>
            </div>
            <div class="list-amount ${t.amount >= 0 ? 'positive' : 'negative'}">${formatZAR(t.amount)}</div>
        </div>
    `).join('');
}

// ============================================================
// TIME TRACKING
// ============================================================
function loadTimeEntries() {
    timeEntries = JSON.parse(localStorage.getItem('oracle_time_entries') || '[]');
    renderTimeEntries();
    updateTodayTotal();
}

function restoreTimerState() {
    const saved = localStorage.getItem('oracle_timer_state');
    if (saved) {
        try {
            const state = JSON.parse(saved);
            if (state.running && state.startTime) {
                timerStartTime = state.startTime;
                timerRunning = true;
                timerInterval = setInterval(updateTimerDisplay, 1000);
                updateTimerUI(true);
                
                // Restore selections
                ['trackerProjectSelect', 'trackerProjectSelect2'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el && state.projectId) el.value = state.projectId;
                });
                ['trackerDescInput', 'trackerDescInput2'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el && state.description) el.value = state.description;
                });
            }
        } catch (e) {
            localStorage.removeItem('oracle_timer_state');
        }
    }
}

function toggleTimer() {
    if (timerRunning) {
        stopTimer();
    } else {
        startTimer();
    }
}

function startTimer() {
    const projectSelect = document.getElementById('trackerProjectSelect');
    if (!projectSelect.value) {
        toast('Please select a project', 'error');
        return;
    }
    
    timerStartTime = Date.now();
    timerRunning = true;
    timerInterval = setInterval(updateTimerDisplay, 1000);
    updateTimerUI(true);
    saveTimerState();
    toast('Timer started', 'success');
}

function stopTimer() {
    timerRunning = false;
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    updateTimerUI(false);
    localStorage.removeItem('oracle_timer_state');
}

function resetTimer() {
    stopTimer();
    timerSeconds = 0;
    timerStartTime = null;
    updateTimerDisplayValue('00:00:00');
    toast('Timer reset', 'success');
}

function updateTimerDisplay() {
    if (!timerStartTime) return;
    const elapsed = Math.floor((Date.now() - timerStartTime) / 1000);
    timerSeconds = elapsed;
    
    const hrs = Math.floor(elapsed / 3600);
    const mins = Math.floor((elapsed % 3600) / 60);
    const secs = elapsed % 60;
    
    updateTimerDisplayValue(`${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);
}

function updateTimerDisplayValue(value) {
    ['trackerTime', 'trackerTime2'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    });
}

function updateTimerUI(running) {
    const sets = [
        { toggle: 'trackerToggle', play: 'playIcon', pause: 'pauseIcon', status: 'trackerStatusDisplay', statusText: 'trackerStatusText' },
        { toggle: 'trackerToggle2', play: 'playIcon2', pause: 'pauseIcon2', status: 'trackerStatusDisplay2', statusText: 'trackerStatusText2' }
    ];
    
    sets.forEach(ids => {
        const toggle = document.getElementById(ids.toggle);
        const play = document.getElementById(ids.play);
        const pause = document.getElementById(ids.pause);
        const status = document.getElementById(ids.status);
        const statusText = document.getElementById(ids.statusText);
        
        if (toggle) { toggle.classList.toggle('start', !running); toggle.classList.toggle('stop', running); }
        if (play) play.style.display = running ? 'none' : 'block';
        if (pause) pause.style.display = running ? 'block' : 'none';
        if (status) status.classList.toggle('running', running);
        if (statusText) statusText.textContent = running ? 'Running' : 'Stopped';
    });
}

function saveTimerState() {
    const projectSelect = document.getElementById('trackerProjectSelect');
    const descInput = document.getElementById('trackerDescInput');
    localStorage.setItem('oracle_timer_state', JSON.stringify({
        running: true,
        startTime: timerStartTime,
        projectId: projectSelect?.value || '',
        description: descInput?.value || ''
    }));
}

async function saveTimeEntry() {
    if (timerSeconds < 60) {
        toast('Track at least 1 minute', 'error');
        return;
    }
    
    const projectSelect = document.getElementById('trackerProjectSelect');
    const descInput = document.getElementById('trackerDescInput');
    const projectId = projectSelect?.value || document.getElementById('trackerProjectSelect2')?.value;
    const description = descInput?.value || document.getElementById('trackerDescInput2')?.value || 'Work';
    
    const project = projects.find(p => p.id === projectId);
    
    const entry = {
        id: crypto.randomUUID(),
        project_id: projectId,
        project_name: project?.name || 'Unknown',
        client_id: project?.client_id,
        description,
        duration: timerSeconds,
        hourly_rate: project?.hourly_rate,
        billable: true,
        date: new Date().toISOString().split('T')[0],
        created_at: new Date().toISOString(),
        user_id: currentUser?.id
    };
    
    timeEntries.unshift(entry);
    localStorage.setItem('oracle_time_entries', JSON.stringify(timeEntries));
    
    if (supabaseClient && currentUser) {
        try { await supabaseClient.from('time_entries').insert(entry); } catch (e) {}
    }
    
    renderTimeEntries();
    updateTodayTotal();
    renderProjects();
    updateDashboard();
    resetTimer();
    
    // Clear inputs
    ['trackerDescInput', 'trackerDescInput2'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    
    toast('Time entry saved', 'success');
    
    // Auto-sync to cloud
    syncData();
}

function deleteTimeEntry(id) {
    timeEntries = timeEntries.filter(e => e.id !== id);
    localStorage.setItem('oracle_time_entries', JSON.stringify(timeEntries));
    renderTimeEntries();
    updateTodayTotal();
    toast('Entry deleted', 'success');
}

function renderTimeEntries() {
    const container = document.getElementById('timeEntriesList');
    if (!container) return;
    
    if (!timeEntries.length) {
        container.innerHTML = '<div class="empty-state"><p>No time entries yet. Start tracking!</p></div>';
        return;
    }
    
    container.innerHTML = timeEntries.slice(0, 50).map(entry => `
        <div class="list-item">
            <div class="list-icon income">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </div>
            <div class="list-info">
                <div class="list-title">${escapeHtml(entry.description || entry.project_name)}</div>
                <div class="list-meta">${entry.project_name} • ${new Date(entry.created_at).toLocaleString()}</div>
            </div>
            <div class="list-amount positive">${formatDuration(entry.duration)}</div>
            <div class="list-actions">
                <button class="list-action" onclick="deleteTimeEntry('${entry.id}')" title="Delete">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
            </div>
        </div>
    `).join('');
}

function updateTodayTotal() {
    const today = new Date().toDateString();
    const todayEntries = timeEntries.filter(e => new Date(e.created_at).toDateString() === today);
    const totalSeconds = todayEntries.reduce((s, e) => s + e.duration, 0);
    
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    
    const el = document.getElementById('todayTotal');
    if (el) el.textContent = `${hrs}h ${mins}m`;
}

function exportTimeEntries() {
    if (!timeEntries.length) {
        toast('No entries to export', 'error');
        return;
    }
    
    const csv = [
        'Project,Description,Duration (min),Date',
        ...timeEntries.map(e => `"${e.project_name || ''}","${e.description || ''}",${Math.round(e.duration / 60)},"${e.date}"`)
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `oracle-time-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast('Exported time entries', 'success');
}

// ============================================================
// MANUAL BILLING ENTRIES
// ============================================================
function showBillingModal() {
    openModal('billingModal');
    
    // Populate project dropdown
    const projectSelect = document.getElementById('billingProject');
    projectSelect.innerHTML = '<option value="">Select project...</option>' + 
        projects.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
    
    // Set default week end date to next Sunday
    const today = new Date();
    const daysUntilSunday = (7 - today.getDay()) % 7;
    const nextSunday = new Date(today);
    nextSunday.setDate(today.getDate() + (daysUntilSunday === 0 ? 7 : daysUntilSunday));
    
    const weekEndInput = document.getElementById('billingWeekEnd');
    weekEndInput.value = nextSunday.toISOString().split('T')[0];
    weekEndInput.min = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    
    // Reset form
    document.getElementById('billingType').value = 'time';
    document.getElementById('billingHours').value = '';
    document.getElementById('billingAmount').value = '';
    document.getElementById('billingDescription').value = '';
    document.getElementById('billingPreview').style.display = 'none';
    updateBillingFields();
}

function updateBillingFields() {
    const billingType = document.getElementById('billingType').value;
    const hoursGroup = document.getElementById('hoursGroup');
    const amountGroup = document.getElementById('amountGroup');
    const billingPreview = document.getElementById('billingPreview');
    
    if (billingType === 'time') {
        hoursGroup.style.display = 'block';
        amountGroup.style.display = 'none';
    } else {
        hoursGroup.style.display = 'none';
        amountGroup.style.display = 'block';
    }
    
    // Update preview when fields change
    updateBillingPreview();
}

function updateBillingPreview() {
    const projectSelect = document.getElementById('billingProject');
    const billingType = document.getElementById('billingType').value;
    const hours = parseFloat(document.getElementById('billingHours').value) || 0;
    const amount = parseFloat(document.getElementById('billingAmount').value) || 0;
    const weekEnd = document.getElementById('billingWeekEnd').value;
    
    const project = projects.find(p => p.id === projectSelect.value);
    const preview = document.getElementById('billingPreview');
    const previewText = document.getElementById('billingPreviewText');
    
    if (!project || (!hours && !amount) || !weekEnd) {
        preview.style.display = 'none';
        return;
    }
    
    let text = '';
    if (billingType === 'time') {
        const rate = project.hourly_rate || 0;
        const total = hours * rate;
        text = `${hours} hours × R${rate.toFixed(2)}/hr = R${total.toFixed(2)} for ${project.name}`;
    } else {
        text = `Fixed price R${amount.toFixed(2)} for ${project.name}`;
    }
    text += ` (Week ending ${new Date(weekEnd).toLocaleDateString()})`;
    
    previewText.textContent = text;
    preview.style.display = 'block';
}

// Add event listeners for preview updates
document.addEventListener('DOMContentLoaded', () => {
    const billingFields = ['billingProject', 'billingType', 'billingHours', 'billingAmount', 'billingWeekEnd'];
    billingFields.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', updateBillingPreview);
            el.addEventListener('input', updateBillingPreview);
        }
    });
});

async function saveBillingEntry() {
    const projectId = document.getElementById('billingProject').value;
    const billingType = document.getElementById('billingType').value;
    const hours = parseFloat(document.getElementById('billingHours').value) || 0;
    const amount = parseFloat(document.getElementById('billingAmount').value) || 0;
    const weekEnd = document.getElementById('billingWeekEnd').value;
    const description = document.getElementById('billingDescription').value;
    
    // Validation
    if (!projectId) {
        toast('Please select a project', 'error');
        return;
    }
    
    const selectedDate = new Date(weekEnd);
    if (selectedDate.getDay() !== 0) {
        toast('Week end date must be a Sunday', 'error');
        return;
    }
    
    if (billingType === 'time' && hours <= 0) {
        toast('Please enter hours worked', 'error');
        return;
    }
    
    if (billingType === 'fixed' && amount <= 0) {
        toast('Please enter billing amount', 'error');
        return;
    }
    
    const project = projects.find(p => p.id === projectId);
    if (!project) {
        toast('Project not found', 'error');
        return;
    }
    
    // Calculate amount based on type
    let finalAmount = 0;
    if (billingType === 'time') {
        finalAmount = hours * (project.hourly_rate || 0);
    } else {
        finalAmount = amount;
    }
    
    // Create billing entry
    const entry = {
        id: crypto.randomUUID(),
        project_id: projectId,
        project_name: project.name,
        client_id: project.client_id,
        billing_type: billingType,
        hours: billingType === 'time' ? hours : null,
        hourly_rate: billingType === 'time' ? project.hourly_rate : null,
        amount: finalAmount,
        currency: 'ZAR',
        week_ending: weekEnd,
        description: description || (billingType === 'time' ? `${hours} hours of work` : 'Fixed price billing'),
        created_at: new Date().toISOString(),
        created_by: currentUser?.id || 'manual'
    };
    
    // Save to memory and localStorage
    billingEntries.unshift(entry);
    localStorage.setItem('oracle_billing_entries', JSON.stringify(billingEntries));
    
    // Sync to Supabase
    if (supabaseClient && currentUser) {
        try {
            await supabaseClient.from('billing_entries').insert(entry);
        } catch (e) {
            console.warn('[Billing] Failed to sync to Supabase:', e);
        }
    }
    
    // Update UI
    toast(`Billing entry saved: R${finalAmount.toFixed(2)}`, 'success');
    closeModal();
    renderProjects(); // Refresh project cards to show billing
    updateDashboard();
    
    // Auto-sync to cloud
    syncData();
}

// Export for window
window.showBillingModal = showBillingModal;
window.updateBillingFields = updateBillingFields;
window.saveBillingEntry = saveBillingEntry;

// ============================================================
// DASHBOARD
// ============================================================
function updateDashboard() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    
    // Revenue this month (from paid invoices)
    const monthlyRevenue = invoices
        .filter(i => i.status === 'paid' && i.paid_at && new Date(i.paid_at) >= startOfMonth)
        .reduce((s, i) => s + (i.zar_total || 0), 0);
    
    // Outstanding
    const outstanding = invoices
        .filter(i => i.status === 'pending' || i.status === 'overdue')
        .reduce((s, i) => s + (i.zar_total || 0), 0);
    
    // Active projects
    const activeProjects = projects.filter(p => p.status === 'active').length;
    
    // Hours this week (combine manual time entries + tracker blocks)
    const weeklyHoursManual = timeEntries
        .filter(e => new Date(e.created_at) >= startOfWeek)
        .reduce((s, e) => s + e.duration, 0) / 3600;

    // Add tracker block hours (from tt_time_blocks)
    const trackerSummary = getTrackerSummary();
    const weeklyHours = weeklyHoursManual + (trackerSummary.weeklyTeamHours || 0);

    document.getElementById('statIncome').textContent = formatZAR(monthlyRevenue);
    document.getElementById('statOutstanding').textContent = formatZAR(outstanding);
    document.getElementById('statProjects').textContent = activeProjects;
    document.getElementById('statHours').textContent = `${weeklyHours.toFixed(1)}h`;
}

function updateProjectDropdowns() {
    const selects = ['trackerProjectSelect', 'trackerProjectSelect2', 'projectClient', 'invoiceProject'];
    selects.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        
        if (id.includes('Project') && id !== 'projectClient') {
            el.innerHTML = '<option value="">Select Project...</option>' + 
                projects.filter(p => p.status === 'active').map(p => 
                    `<option value="${p.id}">${escapeHtml(p.name)}</option>`
                ).join('');
        }
    });
}

function updateClientDropdowns() {
    const selects = ['projectClient', 'invoiceClient'];
    selects.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        
        el.innerHTML = '<option value="">Select Client...</option>' + 
            clients.map(c => 
                `<option value="${c.id}">${escapeHtml(c.name)}${c.company ? ` (${escapeHtml(c.company)})` : ''}</option>`
            ).join('');
    });
}

function renderProjectChart() {
    const ctx = document.getElementById('projectChart');
    if (!ctx) return;
    
    if (window.projectChartInstance) window.projectChartInstance.destroy();
    
    // Get revenue by project
    const projectRevenue = projects.slice(0, 6).map(p => {
        const projectTime = timeEntries.filter(t => t.project_id === p.id);
        const hours = projectTime.reduce((s, t) => s + t.duration, 0) / 3600;
        return { name: p.name, revenue: hours * (p.hourly_rate || 0) * (settings.default_exchange_rate || 18.5) };
    }).filter(p => p.revenue > 0);
    
    if (!projectRevenue.length) {
        ctx.parentElement.innerHTML = '<div class="empty-state"><p>No project revenue data yet</p></div>';
        return;
    }
    
    window.projectChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: projectRevenue.map(p => p.name),
            datasets: [{
                data: projectRevenue.map(p => p.revenue),
                backgroundColor: ['#18181B', '#3F3F46', '#52525B', '#71717A', '#A1A1AA', '#D4D4D8'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: { color: '#71717A', font: { family: "'Inter', sans-serif", size: 11 } }
                }
            }
        }
    });
}

// ============================================================
// FILE UPLOADS
// ============================================================
function setupFileUploads() {
    const pdfZone = document.getElementById('pdfZone');
    const pdfInput = document.getElementById('pdfInput');
    const csvZone = document.getElementById('csvZone');
    const csvInput = document.getElementById('csvInput');
    
    if (pdfZone && pdfInput) {
        pdfZone.onclick = () => pdfInput.click();
        pdfZone.ondragover = e => { e.preventDefault(); pdfZone.classList.add('dragover'); };
        pdfZone.ondragleave = () => pdfZone.classList.remove('dragover');
        pdfZone.ondrop = e => { e.preventDefault(); pdfZone.classList.remove('dragover'); if (e.dataTransfer.files[0]) handlePdf(e.dataTransfer.files[0]); };
        pdfInput.onchange = () => { if (pdfInput.files[0]) handlePdf(pdfInput.files[0]); };
    }
    
    if (csvZone && csvInput) {
        csvZone.onclick = () => csvInput.click();
        csvZone.ondragover = e => { e.preventDefault(); csvZone.classList.add('dragover'); };
        csvZone.ondragleave = () => csvZone.classList.remove('dragover');
        csvZone.ondrop = e => { e.preventDefault(); csvZone.classList.remove('dragover'); if (e.dataTransfer.files[0]) handleCsv(e.dataTransfer.files[0]); };
        csvInput.onchange = () => { if (csvInput.files[0]) handleCsv(csvInput.files[0]); };
    }
}

// ============================================================
// ROBUST STANDARD BANK PDF PARSER (No page limit!)
// ============================================================
function classifyBankTransaction(description, amount) {
    const result = { category: 'uncategorized', subcategory: null, entity: null, isFee: false };
    const descUpper = description.toUpperCase();
    
    // Check fees first
    for (const pattern of FEE_PATTERNS) {
        if (pattern.test(description)) {
            result.category = 'fee';
            result.subcategory = 'bank_fee';
            result.isFee = true;
            return result;
        }
    }
    
    // Check known entities
    for (const [key, entity] of Object.entries(KNOWN_ENTITIES)) {
        if (descUpper.includes(key)) {
            result.entity = entity.name;
            result.category = entity.category;
            break;
        }
    }
    
    // Income patterns
    if (amount > 0) {
        for (const income of INCOME_PATTERNS) {
            if (income.pattern.test(description)) {
                result.category = result.category === 'uncategorized' ? income.category : result.category;
                result.subcategory = income.source;
                return result;
            }
        }
    }
    
    // Expense patterns
    if (amount < 0) {
        for (const expense of EXPENSE_PATTERNS) {
            if (expense.pattern.test(description)) {
                result.category = result.category === 'uncategorized' ? expense.category : result.category;
                result.subcategory = expense.subcategory;
                return result;
            }
        }
    }
    
    return result;
}

function parseStandardBankDate(dateStr) {
    const months = { 'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5, 'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11 };
    const parts = dateStr.trim().split(/\s+/);
    if (parts.length >= 3) {
        const day = parseInt(parts[0]);
        const month = months[parts[1]] || 0;
        const year = 2000 + parseInt(parts[2]);
        return new Date(year, month, day).toISOString().split('T')[0];
    }
    return new Date().toISOString().split('T')[0];
}

function parseStandardBankText(text, accountType = 'bank') {
    const transactions = [];
    const lines = text.split('\n');
    
    // Standard Bank format patterns - more flexible
    const txnPattern = /(\d{2}\s+\w{3}\s+\d{2})\s+(.+?)\s+([-]?[\d,]+\.\d{2})\s+([\d,]+\.\d{2})/;
    
    for (const line of lines) {
        // Skip empty lines and headers
        if (!line.trim() || line.includes('Date') || line.includes('Description')) continue;
        
        const match = line.match(txnPattern);
        if (match) {
            const [_, dateStr, rawDesc, amountStr, balanceStr] = match;
            const amount = parseFloat(amountStr.replace(/,/g, ''));
            // Clean up description - remove extra whitespace and trim
            const description = rawDesc.trim().replace(/\s+/g, ' ');
            const date = parseStandardBankDate(dateStr);
            const classification = classifyBankTransaction(description, amount);
            
            // Only add if description is meaningful (not just numbers or very short)
            if (description.length > 3 && !/^\d+$/.test(description)) {
                transactions.push({
                    id: crypto.randomUUID(),
                    date,
                    description,
                    amount,
                    balance: parseFloat(balanceStr.replace(/,/g, '')),
                    source: accountType,
                    type: amount >= 0 ? 'income' : 'expense',
                    category: classification.category,
                    subcategory: classification.subcategory,
                    entity: classification.entity,
                    is_fee: classification.isFee
                });
            }
        }
    }
    
    return transactions;
}

async function handlePdf(file) {
    const status = document.getElementById('pdfStatus');
    status.innerHTML = '<p style="color:#F59E0B;">Loading PDF... (supports any size)</p>';
    
    try {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        const totalPages = pdf.numPages;
        status.innerHTML = `<p style="color:#F59E0B;">Extracting text from ${totalPages} pages...</p>`;
        
        let allText = '';
        const batchSize = 50; // Process 50 pages at a time for memory efficiency
        
        for (let batch = 0; batch < Math.ceil(totalPages / batchSize); batch++) {
            const startPage = batch * batchSize + 1;
            const endPage = Math.min((batch + 1) * batchSize, totalPages);
            
            status.innerHTML = `<p style="color:#F59E0B;">Processing pages ${startPage}-${endPage} of ${totalPages}...</p>`;
            
            for (let i = startPage; i <= endPage; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                allText += content.items.map(item => item.str).join(' ') + '\n';
            }
            
            // Allow UI to update
            await new Promise(r => setTimeout(r, 10));
        }
        
        status.innerHTML = '<p style="color:#F59E0B;">Parsing Standard Bank transactions...</p>';
        
        // First try direct parsing (Standard Bank format)
        let txns = parseStandardBankText(allText, 'bank');
        
        // If no transactions found and Claude API available, use AI
        if (txns.length === 0 && settings.claude_api_key) {
            status.innerHTML = '<p style="color:#F59E0B;">Using AI to parse non-standard format...</p>';
            
            // Process in chunks for large documents
            const chunkSize = 15000;
            const chunks = [];
            for (let i = 0; i < allText.length; i += chunkSize) {
                chunks.push(allText.substring(i, i + chunkSize));
            }
            
            for (let i = 0; i < Math.min(chunks.length, 10); i++) { // Max 10 chunks
                status.innerHTML = `<p style="color:#F59E0B;">AI analyzing chunk ${i + 1}/${Math.min(chunks.length, 10)}...</p>`;
                
                try {
                    const response = await callClaude(`Parse these bank statement transactions. Return ONLY valid JSON array:
[{"date": "YYYY-MM-DD", "description": "desc", "amount": number}]
Positive=deposit/income, Negative=payment/expense.

${chunks[i]}`);
                    
                    const match = response.match(/\[[\s\S]*?\]/);
                    if (match) {
                        const parsed = JSON.parse(match[0]);
                        txns.push(...parsed.map(t => ({
                            id: crypto.randomUUID(),
                            date: t.date,
                            description: t.description,
                            amount: parseFloat(t.amount),
                            source: 'bank',
                            type: t.amount > 0 ? 'income' : 'expense',
                            ...classifyBankTransaction(t.description, t.amount)
                        })));
                    }
                } catch (e) {
                    console.warn('Chunk parse failed:', e);
                }
            }
        }
        
        if (txns.length > 0) {
            // Add user_id
            txns = txns.map(t => ({ ...t, user_id: currentUser?.id }));
            
            // Merge with existing (avoid duplicates by date+amount+description)
            const existing = new Set(transactions.map(t => `${t.date}|${t.amount}|${t.description?.substring(0, 30)}`));
            const newTxns = txns.filter(t => !existing.has(`${t.date}|${t.amount}|${t.description?.substring(0, 30)}`));
            
            transactions = [...newTxns, ...transactions];
            localStorage.setItem('oracle_transactions', JSON.stringify(transactions));
            
            if (supabaseClient && currentUser && newTxns.length > 0) {
                try {
                    // Batch insert in chunks of 100
                    for (let i = 0; i < newTxns.length; i += 100) {
                        await supabaseClient.from('transactions').insert(newTxns.slice(i, i + 100));
                    }
                } catch (e) { console.warn('Supabase insert error:', e); }
            }
            
            renderTransactions();
            updateDashboard();
            
            const income = newTxns.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
            const expenses = newTxns.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
            
            status.innerHTML = `<p style="color:#22C55E;">✓ Imported ${newTxns.length} new transactions<br>
                <small>Income: ${formatZAR(income)} | Expenses: ${formatZAR(expenses)}</small></p>`;
            toast(`Imported ${newTxns.length} transactions`, 'success');
        } else {
            status.innerHTML = '<p style="color:#F59E0B;">No transactions found. Is this a Standard Bank statement?</p>';
        }
    } catch (e) {
        console.error('PDF error:', e);
        status.innerHTML = `<p style="color:#EF4444;">Error: ${e.message}</p>`;
        toast('Failed to process PDF', 'error');
    }
}

async function handleCsv(file) {
    const status = document.getElementById('csvStatus');
    const csvType = document.getElementById('csvType')?.value || 'upwork';
    
    status.innerHTML = '<p style="color:#F59E0B;">Parsing CSV...</p>';
    
    try {
        const text = await file.text();
        const USD_TO_ZAR = settings.default_exchange_rate || 18.5;
        let txns = [];
        let summary = '';
        
        if (csvType === 'upwork') {
            // Use new Upwork parser
            const result = window.parseUpworkCSV ? window.parseUpworkCSV(text) : parseUpworkFallback(text);
            
            // Convert earnings to transactions
            result.earnings.filter(e => e.isEarning && e.amount > 0).forEach(e => {
                txns.push({
                    id: crypto.randomUUID(),
                    transaction_date: e.date ? e.date.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                    description: `${e.client}: ${e.description}`,
                    amount: e.amount * USD_TO_ZAR,
                    amount_usd: e.amount,
                    source: 'upwork',
                    type: 'income',
                    category: 'freelance',
                    client_name: e.client,
                    hours: e.hours,
                    user_id: currentUser?.id
                });
            });
            
            summary = `Upwork: $${result.totals.total.toLocaleString()} total, ${result.totals.hours.toFixed(1)} hours`;
            
            // Update Upwork earnings in preload
            if (window.ORACLE_PRELOAD) {
                window.ORACLE_PRELOAD.upworkTotals = result.totals;
            }
            
        } else if (csvType === 'business' || csvType === 'personal') {
            // Use Standard Bank parser
            const result = window.parseStandardBankCSV ? window.parseStandardBankCSV(text, csvType) : { transactions: [], totals: {} };
            
            result.transactions.forEach(t => {
                txns.push({
                    id: crypto.randomUUID(),
                    transaction_date: t.date ? t.date.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                    description: t.description,
                    amount: t.amount,
                    balance: t.balance,
                    source: csvType === 'business' ? 'std_bank_business' : 'std_bank_personal',
                    type: t.isIncome ? 'income' : 'expense',
                    category: t.category,
                    entity: t.entity,
                    transaction_type: t.type,
                    user_id: currentUser?.id
                });
            });
            
            summary = `Bank: R${result.totals.income?.toLocaleString() || 0} in, R${result.totals.expenses?.toLocaleString() || 0} out`;
        }
        
        if (txns.length) {
            // Deduplicate by creating unique key from date+amount+description
            const existingKeys = new Set(transactions.map(t => 
                `${t.transaction_date}|${t.amount}|${t.description?.substring(0,30)}`
            ));
            
            const newTxns = txns.filter(t => {
                const key = `${t.transaction_date}|${t.amount}|${t.description?.substring(0,30)}`;
                if (existingKeys.has(key)) return false;
                existingKeys.add(key);
                return true;
            });
            
            if (newTxns.length === 0) {
                status.innerHTML = '<p style="color:#F59E0B;">All transactions already imported</p>';
                return;
            }
            
            // Add new transactions
            transactions = [...newTxns, ...transactions];
            
            // Sort by date descending
            transactions.sort((a, b) => new Date(b.transaction_date) - new Date(a.transaction_date));
            
            // Keep only last 500 in localStorage to avoid quota
            const localStoreTxns = transactions.slice(0, 500);
            try {
                localStorage.setItem('oracle_transactions', JSON.stringify(localStoreTxns));
            } catch (e) {
                console.warn('localStorage full, keeping last 200 only');
                localStorage.setItem('oracle_transactions', JSON.stringify(transactions.slice(0, 200)));
            }
            
            // Batch insert to Supabase (100 at a time)
            if (supabaseClient && currentUser) {
                const batchSize = 100;
                let inserted = 0;
                for (let i = 0; i < newTxns.length; i += batchSize) {
                    const batch = newTxns.slice(i, i + batchSize);
                    try { 
                        await supabaseClient.from('transactions').upsert(batch, { 
                            onConflict: 'id',
                            ignoreDuplicates: true 
                        }); 
                        inserted += batch.length;
                    } catch (e) {
                        console.warn('Supabase batch insert failed:', e);
                    }
                }
                console.log(`[Oracle] Synced ${inserted}/${newTxns.length} transactions to Supabase`);
            }
            
            renderTransactions();
            updateDashboard();
            updateTxnCount();
            
            const skipped = txns.length - newTxns.length;
            const skippedMsg = skipped > 0 ? ` (${skipped} duplicates skipped)` : '';
            status.innerHTML = `<p style="color:#22C55E;">✓ Imported ${newTxns.length} transactions${skippedMsg}</p><p style="font-size:11px;color:#666;">${summary}</p>`;
            toast(`Imported ${newTxns.length} transactions`, 'success');
        } else {
            status.innerHTML = '<p style="color:#F59E0B;">No transactions found in CSV</p>';
        }
    } catch (e) {
        console.error('CSV Error:', e);
        status.innerHTML = `<p style="color:#EF4444;">Error: ${e.message}</p>`;
        toast('Failed to process CSV', 'error');
    }
}

// Fallback parser if csv-parser.js not loaded
function parseUpworkFallback(text) {
    const lines = text.split('\n');
    const earnings = [];
    const totals = { total: 0, hours: 0, byClient: {}, byMonth: {} };
    
    for (let i = 1; i < lines.length; i++) {
        const cols = parseCsvLine(lines[i]);
        if (cols.length < 16) continue;
        
        const type = cols[2] || '';
        const amount = parseFloat((cols[15] || '0').replace(/[,$]/g, '')) || 0;
        const client = cols[11] || '';
        
        if (['Hourly', 'Fixed Price', 'Bonus'].includes(type) && amount > 0) {
            earnings.push({
                date: new Date(cols[0]),
                type, amount, client,
                description: cols[3] || '',
                hours: 0,
                isEarning: true
            });
            totals.total += amount;
            totals.byClient[client] = (totals.byClient[client] || 0) + amount;
        }
    }
    
    return { earnings, totals };
}

function parseCsvLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (const char of line) {
        if (char === '"') inQuotes = !inQuotes;
        else if (char === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
        else current += char;
    }
    result.push(current.trim());
    return result;
}

function parseDate(str) {
    if (!str) return new Date().toISOString().split('T')[0];
    const d = new Date(str);
    if (!isNaN(d)) return d.toISOString().split('T')[0];
    return new Date().toISOString().split('T')[0];
}

// ============================================================
// AI CHAT
// ============================================================
let conversationHistory = [];

function setupChat() {
    const input = document.getElementById('chatInput');
    if (input) {
        input.onkeydown = e => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendChat();
            }
        };
    }
}

function askAI(q) {
    document.getElementById('chatInput').value = q;
    sendChat();
}

async function sendChat() {
    const input = document.getElementById('chatInput');
    const msg = input?.value.trim();
    if (!msg) return;
    
    if (!settings.claude_api_key) {
        toast('Configure Claude API key', 'error');
        return;
    }
    
    addChatMessage('user', msg);
    input.value = '';
    addChatMessage('ai', '...', true);
    
    try {
        const response = await callClaude(msg);
        removeThinker();
        addChatMessage('ai', response);
    } catch (e) {
        removeThinker();
        addChatMessage('ai', 'Error: ' + e.message);
    }
}

async function callClaude(message) {
    const summary = getBusinessSummary();
    conversationHistory.push({ role: 'user', content: message });
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': settings.claude_api_key,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 2048,
            system: `You are Oracle, a professional financial intelligence assistant for Exergy Designs (Shuaib Badat's engineering consultancy). 

Current business data:
${summary}

Be concise. Use ZAR for amounts. USD to ZAR: R${settings.default_exchange_rate || 18.5}.`,
            messages: conversationHistory.slice(-10)
        })
    });
    
    if (!response.ok) throw new Error((await response.json()).error?.message || 'API error');
    
    const data = await response.json();
    const reply = data.content[0].text;
    conversationHistory.push({ role: 'assistant', content: reply });
    return reply;
}

function getBusinessSummary() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    
    // Invoice data
    const pendingInvoices = invoices.filter(i => i.status === 'pending' || i.status === 'overdue');
    const paidInvoices = invoices.filter(i => i.status === 'paid');
    const outstanding = pendingInvoices.reduce((s, i) => s + (i.zar_total || 0), 0);
    const totalPaid = paidInvoices.reduce((s, i) => s + (i.zar_total || 0), 0);
    
    // Transaction data
    const incomeTransactions = transactions.filter(t => t.type === 'income');
    const expenseTransactions = transactions.filter(t => t.type === 'expense');
    const totalIncome = incomeTransactions.reduce((s, t) => s + Math.abs(t.amount || 0), 0);
    const totalExpenses = expenseTransactions.reduce((s, t) => s + Math.abs(t.amount || 0), 0);
    
    // Upwork data
    const upworkTotals = window.ORACLE_PRELOAD?.upworkTotals || {};
    const upworkTotal = upworkTotals.total || 0;
    const upworkByClient = upworkTotals.byClient || {};
    
    // Team data
    const team = window.ORACLE_PRELOAD?.team || [];
    const allocations = window.ORACLE_PRELOAD?.allocations || [];
    
    // Meetings data (from Fireflies)
    const meetingsData = meetings || [];
    const recentMeetings = meetingsData.slice(0, 10);
    
    // Teammate data (from Fireflies)
    const teammatesData = teammates || [];
    const activeTeammates = teammatesData.slice(0, 10);
    
    // Get all action items from Fireflies
    let allActionItems = [];
    if (firefliesIntegration) {
        activeTeammates.forEach(teammate => {
            const items = firefliesIntegration.getActionItemsForTeammate(teammate.email);
            allActionItems.push(...items.map(item => ({
                teammate: teammate.name,
                ...item
            })));
        });
    }
    
    // Build detailed summary
    let summary = `=== FINANCIAL SUMMARY ===
Outstanding invoices: ${formatZAR(outstanding)} (${pendingInvoices.length} invoices)
Total paid: ${formatZAR(totalPaid)} (${paidInvoices.length} invoices)

=== OUTSTANDING INVOICES ===
${pendingInvoices.map(i => `- ${i.invoice_number}: ${i.client_name} - ${formatZAR(i.zar_total)} (${i.date})`).join('\n') || 'None'}

=== CLIENTS ===
${clients.map(c => `- ${c.name}${c.company ? ' (' + c.company + ')' : ''}`).join('\n') || 'None'}

=== BANK TRANSACTIONS ===
Total income: ${formatZAR(totalIncome)}
Total expenses: ${formatZAR(totalExpenses)}
Transaction count: ${transactions.length}

=== UPWORK EARNINGS ===
Total Upwork: $${upworkTotal.toLocaleString()} USD
By client: ${Object.entries(upworkByClient).map(([c, a]) => `${c}: $${a.toLocaleString()}`).join(', ') || 'N/A'}

=== TEAM ===
${team.map(t => `- ${t.name} (${t.role}) - ${t.currency === 'USD' ? '$' : 'R'}${t.hourlyRate}/hr`).join('\n')}

=== TEAMMATES (from Fireflies) ===
${activeTeammates.map(t => `- ${t.name} (${t.email}) - ${t.meetingCount} meetings, last seen: ${t.lastSeen ? new Date(t.lastSeen).toLocaleDateString() : 'N/A'}`).join('\n') || 'No Fireflies data'}

=== RECENT MEETINGS (from Fireflies) ===
${recentMeetings.map(m => {
    const date = new Date(m.date).toLocaleDateString();
    const attendees = m.meeting_attendees?.map(a => a.displayName).join(', ') || 'N/A';
    const summary = m.summary?.overview || 'No summary';
    const keywords = m.summary?.keywords?.slice(0, 3).join(', ') || '';
    return `- ${m.title} (${date})\n  Attendees: ${attendees}\n  Summary: ${summary}\n  Keywords: ${keywords}`;
}).join('\n') || 'No recent meetings'}

=== ACTION ITEMS (from Fireflies) ===
${allActionItems.slice(0, 10).map(item => `- [${item.teammate}] ${item.action} (from: ${item.meetingTitle})`).join('\n') || 'No pending action items'}
`;

    // Add meeting summaries if available
    if (recentMeetings.length > 0 && recentMeetings[0].summary?.overview) {
        const latestMeeting = recentMeetings[0];
        let actionItemsText = 'None recorded';
        
        if (latestMeeting.summary.action_items) {
            if (Array.isArray(latestMeeting.summary.action_items)) {
                actionItemsText = latestMeeting.summary.action_items.join('; ');
            } else if (typeof latestMeeting.summary.action_items === 'string') {
                actionItemsText = latestMeeting.summary.action_items;
            }
        }
        
        summary += `\n=== LATEST MEETING SUMMARY ===
Title: ${latestMeeting.title}
Date: ${new Date(latestMeeting.date).toLocaleDateString()}
Summary: ${latestMeeting.summary.overview}
Action Items: ${actionItemsText}
`;
    }
    
    return summary;
}

function addChatMessage(type, content, thinking = false) {
    const container = document.getElementById('chatMessages');
    const div = document.createElement('div');
    div.className = `chat-message ${type}`;
    if (thinking) div.id = 'thinker';
    
    const icon = type === 'ai'
        ? '<svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path></svg>'
        : '<svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>';
    
    div.innerHTML = `
        <div class="msg-avatar ${type}">${icon}</div>
        <div class="msg-bubble">${thinking ? '<em style="color:#71717A;">Thinking...</em>' : formatMsg(content)}</div>
    `;
    
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function removeThinker() {
    document.getElementById('thinker')?.remove();
}

function formatMsg(text) {
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code style="background:#F4F4F5;padding:2px 6px;border-radius:4px;">$1</code>')
        .replace(/\n/g, '<br>');
}

// ============================================================
// NAVIGATION & MODALS
// ============================================================
function setupNavigation() {
    document.querySelectorAll('.nav-item[data-page]').forEach(item => {
        item.addEventListener('click', () => navigateTo(item.dataset.page));
    });
}

function navigateTo(page) {
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    document.querySelector(`.nav-item[data-page="${page}"]`)?.classList.add('active');
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(page)?.classList.add('active');
    
    const titles = {
        dashboard: ['Dashboard', 'Financial overview'],
        projects: ['Projects', 'Manage your projects'],
        clients: ['Clients', 'Client database'],
        invoices: ['Invoices', 'Invoice management'],
        payments: ['Payments', 'Payment history'],
        transactions: ['Transactions', 'Bank transactions'],
        analyzer: ['Financial Analyzer', 'Upwork & revenue analysis'],
        team: ['Team Management', 'Manage your team & allocations'],
        meetings: ['Meetings', 'Fireflies.ai transcripts & summaries'],
        scanned: ['Scanned Data', 'Review & sort captured data'],
        upload: ['Upload Data', 'Import data'],
        timetracker: ['Time Tracker', 'Track billable hours'],
        ai: ['AI Assistant', 'Ask Oracle'],
        settings: ['Settings', 'Configuration']
    };
    
    // Render page-specific data
    if (page === 'analyzer') {
        renderFinancialAnalyzer();
    } else if (page === 'team') {
        renderTeamPage();
    } else if (page === 'meetings') {
        renderMeetingsPage();
    } else if (page === 'scanned') {
        loadScannedData();
    }
    
    document.getElementById('pageTitle').textContent = titles[page]?.[0] || 'Dashboard';
    document.getElementById('pageSubtitle').textContent = titles[page]?.[1] || '';
}

function openModal(modalId) {
    document.getElementById('modalOverlay').classList.add('active');
    document.getElementById(modalId).classList.add('active');
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('active');
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
}

// ============================================================
// UTILITIES
// ============================================================
function formatZAR(value) {
    const abs = Math.abs(value || 0);
    const sign = value < 0 ? '-' : '';
    if (abs >= 1000000) return sign + 'R' + (abs / 1000000).toFixed(1) + 'm';
    if (abs >= 1000) return sign + 'R' + Math.round(abs / 1000) + 'k';
    return sign + 'R' + abs.toLocaleString('en-ZA', { maximumFractionDigits: 0 });
}

function formatNum(value) {
    return (value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDuration(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function toast(msg, type = 'success') {
    const container = document.getElementById('toasts');
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = msg;
    container.appendChild(t);
    setTimeout(() => t.remove(), 3000);
}

async function syncData() {
    // SYNC = PUSH local data TO Supabase (local is source of truth)
    // IMPORTANT: This function should NEVER delete or reload local data
    
    console.log('[Oracle] SYNC START - projects in memory:', projects.length);
    console.log('[Oracle] SYNC START - projects in localStorage:', JSON.parse(localStorage.getItem('oracle_projects') || '[]').length);
    console.log('[Oracle] SYNC START - supabaseClient:', !!supabaseClient, 'currentUser:', !!currentUser);
    
    // First, ensure memory matches localStorage (in case something wiped memory)
    if (projects.length === 0) {
        const storedProjects = JSON.parse(localStorage.getItem('oracle_projects') || '[]');
        if (storedProjects.length > 0) {
            console.log('[Oracle] Restoring projects from localStorage');
            projects = storedProjects;
            renderProjects();
        }
    }
    
    if (!supabaseClient || !currentUser) {
        console.warn('[Oracle] Cannot sync - supabaseClient:', !!supabaseClient, 'currentUser:', !!currentUser);
        toast('⚠️ Data saved locally only (cloud sync unavailable)', 'error');
        return;
    }
    
    toast('Syncing to cloud...', 'success');
    
    let synced = 0;
    let errors = 0;
    
    // Sync projects (convert non-UUID IDs to UUIDs for Supabase)
    if (projects.length > 0) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const idMap = {};
        const projectsToSync = projects.map(p => {
            let projectId = p.id;
            if (!uuidRegex.test(projectId)) {
                projectId = crypto.randomUUID();
                idMap[p.id] = projectId;
            }
            return {
                id: projectId,
                name: p.name,
                status: p.status || 'active',
                hourly_rate: p.hourly_rate || null,
                source: p.source || 'direct',
                description: p.description || '',
                user_id: currentUser.id,
                created_at: p.created_at || new Date().toISOString()
            };
        });
        try {
            console.log('[Oracle] Syncing', projectsToSync.length, 'projects to Supabase...');
            const { data, error } = await supabaseClient.from('projects').upsert(projectsToSync, { onConflict: 'id' });
            if (error) {
                console.error('[Oracle] Projects sync error:', error);
                throw error;
            }
            // Update local IDs if we converted any
            if (Object.keys(idMap).length > 0) {
                projects = projects.map(p => idMap[p.id] ? { ...p, id: idMap[p.id] } : p);
                localStorage.setItem('oracle_projects', JSON.stringify(projects));
                console.log('[Oracle] Converted', Object.keys(idMap).length, 'project IDs to UUIDs');
            }
            synced++;
            console.log('[Oracle] ✅ Projects synced successfully:', projects.length);
        } catch (e) {
            console.error('[Oracle] ❌ Projects sync failed:', e.message || e);
            toast('⚠️ Projects sync failed: ' + (e.message || 'Unknown error'), 'error');
            errors++;
        }
    } else {
        console.log('[Oracle] No projects to sync');
    }

    // Sync allocations to user_settings
    try {
        await saveAllocationsToSupabase();
        synced++;
    } catch (e) {
        console.warn('[Oracle] Allocations sync failed:', e);
        errors++;
    }
    
    // Sync clients
    if (clients.length > 0) {
        const clientsToSync = clients.map(c => ({ ...c, user_id: currentUser.id }));
        try {
            const { error } = await supabaseClient.from('clients').upsert(clientsToSync, { onConflict: 'id' });
            if (error) throw error;
            synced++;
        } catch (e) { console.warn('Clients sync failed:', e); errors++; }
    }
    
    // Sync invoices
    if (invoices.length > 0) {
        const invoicesToSync = invoices.map(i => ({ ...i, user_id: currentUser.id }));
        try {
            const { error } = await supabaseClient.from('invoices').upsert(invoicesToSync, { onConflict: 'id' });
            if (error) throw error;
            synced++;
        } catch (e) { console.warn('Invoices sync failed:', e); errors++; }
    }
    
    // Sync payments
    if (payments.length > 0) {
        const paymentsToSync = payments.map(p => ({ ...p, user_id: currentUser.id }));
        try {
            const { error } = await supabaseClient.from('payments').upsert(paymentsToSync, { onConflict: 'id' });
            if (error) throw error;
            synced++;
        } catch (e) { console.warn('Payments sync failed:', e); errors++; }
    }
    
    // Sync transactions in batches
    if (transactions.length > 0) {
        const batchSize = 100;
        for (let i = 0; i < transactions.length; i += batchSize) {
            const batch = transactions.slice(i, i + batchSize).map(t => ({ ...t, user_id: currentUser.id }));
            try {
                await supabaseClient.from('transactions').upsert(batch, { onConflict: 'id', ignoreDuplicates: true });
            } catch (e) { console.warn('Transaction batch sync failed:', e); }
        }
        synced++;
    }
    
    // Sync time entries
    if (timeEntries.length > 0) {
        const entriesToSync = timeEntries.map(t => ({ ...t, user_id: currentUser.id }));
        try {
            const { error } = await supabaseClient.from('time_entries').upsert(entriesToSync, { onConflict: 'id' });
            if (error) console.warn('[Oracle] Time entries sync failed:', error.message);
            else synced++;
        } catch (e) { console.warn('Time entries sync failed:', e); }
    }

    // Sync billing entries
    if (billingEntries.length > 0) {
        const billingsToSync = billingEntries.map(b => ({ ...b, user_id: currentUser.id }));
        try {
            const { error } = await supabaseClient.from('billing_entries').upsert(billingsToSync, { onConflict: 'id' });
            if (error) console.warn('[Oracle] Billing entries sync failed:', error.message);
            else synced++;
        } catch (e) { console.warn('Billing entries sync failed:', e); }
    }

    // Sync allocations
    const allocations = window.ORACLE_PRELOAD?.allocations || [];
    if (allocations.length > 0) {
        try {
            const allocsToSync = allocations.map(a => ({
                id: a.id,
                user_id: currentUser.id,
                team_member_id: a.userId,
                team_member_name: a.userName,
                project_name: a.project,
                project_id: a.projectId?.startsWith('client_') ? null : a.projectId,
                hours_per_week: a.hoursPerWeek,
                hourly_rate: a.rate,
                currency: a.currency,
                status: a.status,
                weekly_estimate: a.weeklyEstimate
            }));
            const { error } = await supabaseClient.from('allocations').upsert(allocsToSync, { onConflict: 'id' });
            if (error) console.warn('[Oracle] Allocations sync skipped (table may not exist):', error.message);
            else synced++;
        } catch (e) { console.warn('Allocations sync failed:', e); }
    }

    // Re-save to localStorage to be absolutely sure (belt and suspenders)
    localStorage.setItem('oracle_projects', JSON.stringify(projects));
    localStorage.setItem('oracle_clients', JSON.stringify(clients));
    localStorage.setItem('oracle_invoices', JSON.stringify(invoices));
    localStorage.setItem('oracle_billing_entries', JSON.stringify(billingEntries));
    
    console.log('[Oracle] SYNC END - projects still in memory:', projects.length);
    
    if (errors > 0) {
        toast(`Synced with ${errors} errors - local data preserved`, 'error');
    } else {
        toast(`Synced ${synced} data types to cloud`, 'success');
    }
    
    console.log(`[Oracle] Sync complete: ${synced} types synced, ${errors} errors`);
}

// Pull ALL data from Supabase and merge with local
async function pullFromCloud() {
    if (!supabaseClient || !currentUser) {
        toast('Not connected to Supabase', 'error');
        return;
    }

    toast('Pulling data from cloud...', 'success');

    try {
        // Pull projects
        const { data: cloudProjects } = await supabaseClient
            .from('projects')
            .select('*')
            .eq('user_id', currentUser.id);
        
        if (cloudProjects?.length > 0) {
            const localIds = new Set(projects.map(p => p.id));
            const newProjects = cloudProjects.filter(p => !localIds.has(p.id));
            if (newProjects.length > 0) {
                projects = [...projects, ...newProjects];
                localStorage.setItem('oracle_projects', JSON.stringify(projects));
                console.log('[Oracle] Added', newProjects.length, 'projects from cloud');
            }
        }

        // Pull clients
        const { data: cloudClients } = await supabaseClient
            .from('clients')
            .select('*')
            .eq('user_id', currentUser.id);
        
        if (cloudClients?.length > 0) {
            const localIds = new Set(clients.map(c => c.id));
            const newClients = cloudClients.filter(c => !localIds.has(c.id));
            if (newClients.length > 0) {
                clients = [...clients, ...newClients];
                localStorage.setItem('oracle_clients', JSON.stringify(clients));
                console.log('[Oracle] Added', newClients.length, 'clients from cloud');
            }
        }

        // Pull invoices
        const { data: cloudInvoices } = await supabaseClient
            .from('invoices')
            .select('*')
            .eq('user_id', currentUser.id);
        
        if (cloudInvoices?.length > 0) {
            const localIds = new Set(invoices.map(i => i.id));
            const newInvoices = cloudInvoices.filter(i => !localIds.has(i.id));
            if (newInvoices.length > 0) {
                invoices = [...invoices, ...newInvoices];
                localStorage.setItem('oracle_invoices', JSON.stringify(invoices));
                console.log('[Oracle] Added', newInvoices.length, 'invoices from cloud');
            }
        }

        // Pull transactions
        const { data: cloudTransactions } = await supabaseClient
            .from('transactions')
            .select('*')
            .eq('user_id', currentUser.id);
        
        if (cloudTransactions?.length > 0) {
            const localIds = new Set(transactions.map(t => t.id));
            const newTransactions = cloudTransactions.filter(t => !localIds.has(t.id));
            if (newTransactions.length > 0) {
                transactions = [...transactions, ...newTransactions];
                localStorage.setItem('oracle_transactions', JSON.stringify(transactions));
                console.log('[Oracle] Added', newTransactions.length, 'transactions from cloud');
            }
        }

        // Pull payments
        const { data: cloudPayments } = await supabaseClient
            .from('payments')
            .select('*')
            .eq('user_id', currentUser.id);
        
        if (cloudPayments?.length > 0) {
            const localIds = new Set(payments.map(p => p.id));
            const newPayments = cloudPayments.filter(p => !localIds.has(p.id));
            if (newPayments.length > 0) {
                payments = [...payments, ...newPayments];
                localStorage.setItem('oracle_payments', JSON.stringify(payments));
                console.log('[Oracle] Added', newPayments.length, 'payments from cloud');
            }
        }

        // Pull billing entries
        const { data: cloudBillings } = await supabaseClient
            .from('billing_entries')
            .select('*')
            .eq('user_id', currentUser.id);
        
        if (cloudBillings?.length > 0) {
            const localIds = new Set(billingEntries.map(b => b.id));
            const newBillings = cloudBillings.filter(b => !localIds.has(b.id));
            if (newBillings.length > 0) {
                billingEntries = [...billingEntries, ...newBillings];
                localStorage.setItem('oracle_billing_entries', JSON.stringify(billingEntries));
                console.log('[Oracle] Added', newBillings.length, 'billing entries from cloud');
            }
        }

        // Reload UI
        renderProjects();
        renderClients();
        renderInvoices();
        renderPayments();
        renderTransactions();
        updateDashboard();

        toast('Data synced from cloud successfully', 'success');
    } catch (e) {
        console.error('[Oracle] Pull from cloud failed:', e);
        toast('Failed to pull data from cloud: ' + e.message, 'error');
    }
}

// ============================================================
// FINANCIAL ANALYZER (Admin Only)
// ============================================================
function renderFinancialAnalyzer() {
    console.log('[Oracle] Rendering Financial Analyzer...');
    
    if (!window.ORACLE_PRELOAD) {
        console.warn('[Oracle] ORACLE_PRELOAD not available');
        return;
    }
    
    const totals = window.ORACLE_PRELOAD.upworkTotals;
    const earnings = window.ORACLE_PRELOAD.upworkEarnings || [];
    const allocations = window.ORACLE_PRELOAD.allocations || window.ORACLE_PRELOAD.freelancerAllocations || [];
    
    console.log('[Oracle] Financial Analyzer data:', { 
        hasTotals: !!totals, 
        earningsCount: earnings.length, 
        allocationsCount: allocations.length,
        transactionsCount: transactions.length
    });
    
    // Calculate bank deposits and payments from transactions
    const bankDeposits = transactions.filter(t => 
        t.amount > 0 && 
        t.transaction_type !== 'Withdrawal' &&
        !t.description?.toLowerCase().includes('upwork')
    );
    
    const yocoPayments = bankDeposits.filter(t => 
        t.description?.toUpperCase().includes('YOCO') ||
        t.description?.toUpperCase().includes('CARD PURCH')
    );
    
    const directPayments = bankDeposits.filter(t => 
        !t.description?.toUpperCase().includes('YOCO') &&
        !t.description?.toUpperCase().includes('CARD PURCH')
    );
    
    const totalBankDeposits = bankDeposits.reduce((sum, t) => sum + t.amount, 0);
    const totalYoco = yocoPayments.reduce((sum, t) => sum + t.amount, 0);
    const totalDirect = directPayments.reduce((sum, t) => sum + t.amount, 0);
    
    // Upwork revenue (convert to ZAR using settings exchange rate)
    const exchangeRate = settings.default_exchange_rate || 18.5;
    const upworkNetZAR = totals ? totals.totalNet * exchangeRate : 0;
    
    const totalRevenue = upworkNetZAR + totalBankDeposits;
    
    console.log('[Oracle] Revenue breakdown:', {
        upworkUSD: totals?.totalNet || 0,
        upworkZAR: upworkNetZAR,
        bankDeposits: totalBankDeposits,
        yoco: totalYoco,
        direct: totalDirect,
        total: totalRevenue
    });
    
    // Update Upwork stats
    if (totals) {
        document.getElementById('analyzerUpworkNet').textContent = '$' + totals.totalNet.toLocaleString('en-US', { minimumFractionDigits: 2 });
        document.getElementById('analyzerUpworkHours').textContent = totals.totalHours.toFixed(1) + 'h tracked';
    } else {
        document.getElementById('analyzerUpworkNet').textContent = '$0';
        document.getElementById('analyzerUpworkHours').textContent = '0h tracked';
    }
    
    // Update bank deposit stats
    document.getElementById('analyzerBankDeposits').textContent = formatZAR(totalBankDeposits);
    document.getElementById('analyzerBankCount').textContent = bankDeposits.length + ' deposits';
    
    document.getElementById('analyzerYocoDeposits').textContent = formatZAR(totalYoco);
    document.getElementById('analyzerYocoCount').textContent = yocoPayments.length + ' payments';
    
    document.getElementById('analyzerDirectPayments').textContent = formatZAR(totalDirect);
    document.getElementById('analyzerDirectCount').textContent = directPayments.length + ' payments';
    
    document.getElementById('analyzerTotalRevenue').textContent = formatZAR(totalRevenue);
    
    if (!totals) {
        document.getElementById('analyzerClientRevenue').innerHTML = '<div class="empty-state"><p>No Upwork data available</p></div>';
        document.getElementById('analyzerMonthlyRevenue').innerHTML = '<div class="empty-state"><p>No monthly data available</p></div>';
        document.getElementById('analyzerAllocations').innerHTML = '<div class="empty-state"><p>No allocations yet</p></div>';
        document.getElementById('analyzerRecentEarnings').innerHTML = '<div class="empty-state"><p>No earnings data</p></div>';
        return;
    }
    
    // Client Revenue
    const clientContainer = document.getElementById('analyzerClientRevenue');
    if (clientContainer && totals.byClient) {
        const sorted = Object.entries(totals.byClient).sort((a, b) => b[1].gross - a[1].gross);
        clientContainer.innerHTML = sorted.map(([client, data]) => `
            <div class="list-item" style="display: flex; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--border);">
                <div>
                    <div style="font-weight: 500;">${escapeHtml(client)}</div>
                    <div style="font-size: 12px; color: var(--text-secondary);">${data.hours.toFixed(1)}h worked</div>
                </div>
                <div style="text-align: right;">
                    <div style="font-family: var(--font-mono); font-weight: 600;">$${data.gross.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                    <div style="font-size: 12px; color: var(--success);">Net: $${data.net.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                </div>
            </div>
        `).join('') || '<p style="padding: 16px; color: var(--text-secondary);">No client data</p>';
    }
    
    // Monthly Revenue
    const monthContainer = document.getElementById('analyzerMonthlyRevenue');
    if (monthContainer && totals.byMonth) {
        const sorted = Object.entries(totals.byMonth).sort((a, b) => b[0].localeCompare(a[0]));
        monthContainer.innerHTML = sorted.map(([month, data]) => {
            const [year, m] = month.split('-');
            const monthName = new Date(year, parseInt(m) - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
            return `
            <div class="list-item" style="display: flex; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--border);">
                <div>
                    <div style="font-weight: 500;">${monthName}</div>
                    <div style="font-size: 12px; color: var(--text-secondary);">${data.hours.toFixed(1)}h billed</div>
                </div>
                <div style="text-align: right;">
                    <div style="font-family: var(--font-mono); font-weight: 600;">$${data.gross.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                    <div style="font-size: 12px; color: var(--success);">≈ R${(data.gross * 18.5).toLocaleString('en-ZA', { maximumFractionDigits: 0 })}</div>
                </div>
            </div>
        `}).join('') || '<p style="padding: 16px; color: var(--text-secondary);">No monthly data</p>';
    }
    
    // Freelancer Allocations
    const allocContainer = document.getElementById('analyzerAllocations');
    if (allocContainer && allocations.length) {
        allocContainer.innerHTML = `
            <table class="data-table" style="width: 100%;">
                <thead>
                    <tr>
                        <th style="padding: 12px 16px; text-align: left; font-weight: 600; border-bottom: 2px solid var(--border);">Project</th>
                        <th style="padding: 12px 16px; text-align: center; font-weight: 600; border-bottom: 2px solid var(--border);">Hours/Week</th>
                        <th style="padding: 12px 16px; text-align: right; font-weight: 600; border-bottom: 2px solid var(--border);">Rate</th>
                        <th style="padding: 12px 16px; text-align: right; font-weight: 600; border-bottom: 2px solid var(--border);">Weekly Est.</th>
                        <th style="padding: 12px 16px; text-align: center; font-weight: 600; border-bottom: 2px solid var(--border);">Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${allocations.map(a => `
                        <tr>
                            <td style="padding: 12px 16px; border-bottom: 1px solid var(--border);">${escapeHtml(a.project)}</td>
                            <td style="padding: 12px 16px; text-align: center; font-family: var(--font-mono); border-bottom: 1px solid var(--border);">${a.hoursPerWeek}h</td>
                            <td style="padding: 12px 16px; text-align: right; font-family: var(--font-mono); border-bottom: 1px solid var(--border);">${a.currency === 'USD' ? '$' : 'R'}${a.rate}</td>
                            <td style="padding: 12px 16px; text-align: right; font-family: var(--font-mono); font-weight: 600; border-bottom: 1px solid var(--border);">${a.currency === 'USD' ? '$' : 'R'}${(a.hoursPerWeek * a.rate).toLocaleString()}</td>
                            <td style="padding: 12px 16px; text-align: center; border-bottom: 1px solid var(--border);"><span class="badge ${a.status}">${a.status}</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }
    
    // Tracker Team Costs (live from desktop tracker)
    const trackerCostsContainer = document.getElementById('analyzerTrackerCosts');
    if (trackerCostsContainer) {
        const trackerSummary = getTrackerSummary();
        const team = window.ORACLE_PRELOAD?.team || [];

        if (trackerSummary.weekBlocks > 0) {
            // Build per-user breakdown
            const userRows = Object.entries(trackerSummary.weeklyByUser).map(([userId, data]) => {
                const member = team.find(m => m.id === userId || m.email === userId);
                const name = member ? member.name : userId;
                const rate = member ? member.hourlyRate : 0;
                const currency = member ? (member.currency === 'USD' ? '$' : 'R') : '$';
                const cost = data.hours * rate;
                return { name, hours: data.hours, blocks: data.blocks, rate, currency, cost };
            }).sort((a, b) => b.hours - a.hours);

            trackerCostsContainer.innerHTML = `
                <div style="padding: 16px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; background: var(--grey-50);">
                    <div>
                        <div style="font-size: 12px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em;">Weekly Team Hours</div>
                        <div style="font-size: 24px; font-weight: 700; font-family: var(--font-mono);">${trackerSummary.weeklyTeamHours.toFixed(1)}h</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 12px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em;">Weekly Team Cost</div>
                        <div style="font-size: 24px; font-weight: 700; font-family: var(--font-mono); color: var(--danger);">$${trackerSummary.weeklyTeamCost.toFixed(0)}</div>
                    </div>
                </div>
                <table class="data-table" style="width: 100%;">
                    <thead>
                        <tr>
                            <th style="padding: 12px 16px; text-align: left;">Member</th>
                            <th style="padding: 12px 16px; text-align: center;">Blocks</th>
                            <th style="padding: 12px 16px; text-align: right;">Hours</th>
                            <th style="padding: 12px 16px; text-align: right;">Cost</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${userRows.map(u => `
                            <tr>
                                <td style="padding: 12px 16px; font-weight: 500;">${escapeHtml(u.name)}</td>
                                <td style="padding: 12px 16px; text-align: center; font-family: var(--font-mono);">${u.blocks}</td>
                                <td style="padding: 12px 16px; text-align: right; font-family: var(--font-mono);">${u.hours.toFixed(1)}h</td>
                                <td style="padding: 12px 16px; text-align: right; font-family: var(--font-mono); font-weight: 600;">${u.currency}${u.cost.toFixed(0)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <div style="padding: 12px 16px; font-size: 12px; color: var(--text-secondary); border-top: 1px solid var(--border);">
                    Monthly total: ${trackerSummary.monthlyTeamHours.toFixed(1)}h across ${trackerSummary.monthBlocks} blocks
                </div>
            `;
        } else {
            trackerCostsContainer.innerHTML = '<div class="empty-state"><p>No tracker data this week. Team members need to track time using Oracle Tracker desktop app.</p></div>';
        }
    }

    // Recent Earnings
    const recentContainer = document.getElementById('analyzerRecentEarnings');
    if (recentContainer && earnings.length) {
        recentContainer.innerHTML = earnings.slice(0, 15).map(e => `
            <div class="list-item" style="display: flex; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--border);">
                <div>
                    <div style="font-weight: 500;">${escapeHtml(e.client)}</div>
                    <div style="font-size: 12px; color: var(--text-secondary);">${e.project} • ${e.type}${e.hours ? ' • ' + e.hours + 'h' : ''}</div>
                </div>
                <div style="text-align: right;">
                    <div style="font-family: var(--font-mono); font-weight: 600; color: var(--success);">+$${e.net.toFixed(2)}</div>
                    <div style="font-size: 12px; color: var(--text-secondary);">${e.date}</div>
                </div>
            </div>
        `).join('');
    }
    
    // Yoco Payments
    const yocoContainer = document.getElementById('analyzerYocoList');
    if (yocoContainer) {
        if (yocoPayments.length) {
            yocoContainer.innerHTML = yocoPayments.slice(0, 20).map(t => `
                <div class="list-item" style="display: flex; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--border);">
                    <div>
                        <div style="font-weight: 500;">${escapeHtml(t.description || 'Yoco Payment')}</div>
                        <div style="font-size: 12px; color: var(--text-secondary);">${t.transaction_date || 'Unknown date'}</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-family: var(--font-mono); font-weight: 600; color: var(--success);">+${formatZAR(t.amount)}</div>
                    </div>
                </div>
            `).join('');
        } else {
            yocoContainer.innerHTML = '<div class="empty-state"><p>No Yoco payments found</p></div>';
        }
    }
    
    // Direct Deposits
    const directContainer = document.getElementById('analyzerDirectList');
    if (directContainer) {
        if (directPayments.length) {
            directContainer.innerHTML = directPayments.slice(0, 20).map(t => `
                <div class="list-item" style="display: flex; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--border);">
                    <div>
                        <div style="font-weight: 500;">${escapeHtml(t.description || 'Bank Deposit')}</div>
                        <div style="font-size: 12px; color: var(--text-secondary);">${t.transaction_date || 'Unknown date'}</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-family: var(--font-mono); font-weight: 600; color: var(--success);">+${formatZAR(t.amount)}</div>
                    </div>
                </div>
            `).join('');
        } else {
            directContainer.innerHTML = '<div class="empty-state"><p>No direct deposits found</p></div>';
        }
    }
}

function showAllocationModal(id = null) {
    const modal = document.getElementById('allocationModal');
    if (!modal) { toast('Allocation modal not found', 'error'); return; }

    document.getElementById('allocationModalTitle').textContent = id ? 'Edit Allocation' : 'New Allocation';
    document.getElementById('allocationId').value = id || '';

    // Populate team member dropdown
    const memberSelect = document.getElementById('allocationMember');
    const team = window.ORACLE_PRELOAD?.team || [];
    memberSelect.innerHTML = '<option value="">Select team member...</option>';
    team.filter(m => m.role === 'freelancer' && m.status === 'active').forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = m.name + ' (' + (m.currency === 'USD' ? '$' : 'R') + m.hourlyRate + '/hr)';
        memberSelect.appendChild(opt);
    });

    // Populate project dropdown
    const projectSelect = document.getElementById('allocationProject');
    projectSelect.innerHTML = '<option value="">Select project...</option>';
    projects.filter(p => p.status === 'active').forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        projectSelect.appendChild(opt);
    });
    // Also add client-based project names if no projects exist
    if (projects.length === 0) {
        clients.forEach(c => {
            const opt = document.createElement('option');
            opt.value = 'client_' + c.id;
            opt.textContent = (c.company || c.name) + ' (client)';
            projectSelect.appendChild(opt);
        });
    }

    if (id) {
        const allocations = window.ORACLE_PRELOAD?.allocations || [];
        const a = allocations.find(x => x.id === id);
        if (a) {
            document.getElementById('allocationMember').value = a.userId || '';
            document.getElementById('allocationProject').value = a.projectId || '';
            document.getElementById('allocationHours').value = a.hoursPerWeek || 10;
            document.getElementById('allocationRate').value = a.rate || '';
            document.getElementById('allocationCurrency').value = a.currency || 'USD';
            document.getElementById('allocationStatus').value = a.status || 'active';
        }
    } else {
        document.getElementById('allocationHours').value = 10;
        document.getElementById('allocationRate').value = '';
        document.getElementById('allocationCurrency').value = 'USD';
        document.getElementById('allocationStatus').value = 'active';

        // Auto-fill rate when member is selected
        memberSelect.onchange = () => {
            const member = team.find(m => m.id === memberSelect.value);
            if (member) {
                document.getElementById('allocationRate').value = member.hourlyRate;
                document.getElementById('allocationCurrency').value = member.currency;
            }
        };
    }

    openModal('allocationModal');
}

async function saveAllocation() {
    const id = document.getElementById('allocationId').value;
    const memberId = document.getElementById('allocationMember').value;
    const projectVal = document.getElementById('allocationProject').value;
    const hoursPerWeek = parseInt(document.getElementById('allocationHours').value) || 0;
    const rate = parseFloat(document.getElementById('allocationRate').value) || 0;
    const currency = document.getElementById('allocationCurrency').value;
    const status = document.getElementById('allocationStatus').value;

    if (!memberId || !projectVal) {
        toast('Team member and project are required', 'error');
        return;
    }
    if (hoursPerWeek < 1 || hoursPerWeek > 40) {
        toast('Hours per week must be between 1 and 40', 'error');
        return;
    }

    const team = window.ORACLE_PRELOAD?.team || [];
    const member = team.find(m => m.id === memberId);

    // Determine project name
    let projectName = '';
    let projectId = projectVal;
    if (projectVal.startsWith('client_')) {
        const clientId = projectVal.replace('client_', '');
        const client = clients.find(c => c.id === clientId);
        projectName = client ? (client.company || client.name) : 'Unknown';
        projectId = projectVal;
    } else {
        const proj = projects.find(p => p.id === projectVal);
        projectName = proj ? proj.name : 'Unknown';
    }

    const allocation = {
        id: id || crypto.randomUUID(),
        userId: memberId,
        userName: member?.name || memberId,
        project: projectName,
        projectId: projectId,
        hoursPerWeek,
        rate,
        currency,
        status,
        weeklyEstimate: hoursPerWeek * rate,
        updatedAt: new Date().toISOString()
    };

    // Initialize allocations array if needed
    if (!window.ORACLE_PRELOAD.allocations) {
        window.ORACLE_PRELOAD.allocations = [];
    }

    if (id) {
        // Update existing
        const idx = window.ORACLE_PRELOAD.allocations.findIndex(a => a.id === id);
        if (idx >= 0) {
            window.ORACLE_PRELOAD.allocations[idx] = allocation;
        }
    } else {
        // Add new
        window.ORACLE_PRELOAD.allocations.push(allocation);
    }

    // Persist to localStorage
    localStorage.setItem('oracle_allocations', JSON.stringify(window.ORACLE_PRELOAD.allocations));

    // Sync allocations to Supabase (via user_settings JSON)
    await saveAllocationsToSupabase(window.ORACLE_PRELOAD.allocations);

    // Re-render
    renderTeamPage();
    renderFinancialAnalyzer();
    if (!window.ORACLE_IS_ADMIN) renderFreelancerDashboard();
    closeModal();
    toast(id ? 'Allocation updated' : 'Allocation created', 'success');
    
    // Auto-sync to cloud
    syncData();
}

// ============================================================
// FREELANCER DASHBOARD (Limited View)
// ============================================================
function renderFreelancerDashboard() {
    const email = window.ORACLE_CURRENT_USER?.email;
    if (!email) return;
    
    // Find user's allocations
    const allAllocations = window.ORACLE_PRELOAD?.allocations || [];
    const team = window.ORACLE_PRELOAD?.team || [];
    
    // Find this user in team
    const userProfile = team.find(m => m.email.toLowerCase() === email.toLowerCase());
    const userId = userProfile?.id || email.split('@')[0];
    
    // Get user's allocations
    const myAllocations = allAllocations.filter(a => 
        a.userId === userId || 
        a.userName?.toLowerCase().includes(userId.toLowerCase())
    );
    
    // Calculate totals
    const totalAllocatedHours = myAllocations.filter(a => a.status === 'active').reduce((sum, a) => sum + a.hoursPerWeek, 0);
    const weeklyEarnings = myAllocations.filter(a => a.status === 'active').reduce((sum, a) => sum + (a.hoursPerWeek * a.rate), 0);
    
    // Update dashboard stats for freelancer
    document.getElementById('statIncome')?.textContent && (document.getElementById('statIncome').textContent = '$' + weeklyEarnings.toFixed(0) + '/wk');
    document.getElementById('statOutstanding')?.textContent && (document.getElementById('statOutstanding').textContent = totalAllocatedHours + 'h');
    document.getElementById('statProjects')?.textContent && (document.getElementById('statProjects').textContent = myAllocations.filter(a => a.status === 'active').length);
    
    // Update stat labels for freelancer context
    const statLabels = document.querySelectorAll('.stat-label');
    if (statLabels.length >= 3) {
        statLabels[0].textContent = 'Weekly Est.';
        statLabels[1].textContent = 'Hours/Week';
        statLabels[2].textContent = 'Active Projects';
    }
    
    // Render my allocations in the dashboard
    const outstandingDiv = document.getElementById('outstandingInvoices');
    if (outstandingDiv && myAllocations.length) {
        outstandingDiv.innerHTML = `
            <div style="padding: 8px 16px; background: var(--grey-50); font-weight: 600; font-size: 12px; text-transform: uppercase; color: var(--text-secondary);">
                My Project Allocations
            </div>
            ${myAllocations.map(a => `
                <div class="invoice-item" style="padding: 12px 16px; border-bottom: 1px solid var(--border);">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-weight: 500;">${escapeHtml(a.project)}</div>
                            <div style="font-size: 12px; color: var(--text-secondary);">
                                ${a.hoursPerWeek}h/week @ $${a.rate}/hr
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <span class="badge ${a.status}">${a.status}</span>
                        </div>
                    </div>
                </div>
            `).join('')}
        `;
    } else if (outstandingDiv) {
        outstandingDiv.innerHTML = `
            <div class="empty-state" style="padding: 32px;">
                <p>No projects allocated yet.</p>
                <p style="font-size: 12px; color: var(--text-secondary); margin-top: 8px;">Contact admin for project assignments.</p>
            </div>
        `;
    }
    
    // Hide revenue chart for freelancers
    const chartCard = document.querySelector('.chart-container')?.closest('.card');
    if (chartCard) chartCard.style.display = 'none';
}

function getCurrentUserAllocations() {
    const email = window.ORACLE_CURRENT_USER?.email;
    if (!email) return [];
    
    const allAllocations = window.ORACLE_PRELOAD?.allocations || [];
    const team = window.ORACLE_PRELOAD?.team || [];
    const userProfile = team.find(m => m.email.toLowerCase() === email.toLowerCase());
    const userId = userProfile?.id || email.split('@')[0];
    
    return allAllocations.filter(a => 
        a.userId === userId || 
        a.userName?.toLowerCase().includes(userId.toLowerCase())
    );
}

// ============================================================
// TEAM MANAGEMENT (Admin Only)
// ============================================================
function renderTeamPage() {
    if (!window.ORACLE_PRELOAD) return;
    
    const team = window.ORACLE_PRELOAD.team || [];
    const allocations = window.ORACLE_PRELOAD.allocations || [];
    
    // Get tracker summary for live hours data
    const trackerSummary = getTrackerSummary();

    // Calculate stats
    const activeMembers = team.filter(m => m.status === 'active' && m.role === 'freelancer');
    const totalCapacity = activeMembers.reduce((sum, m) => sum + 40, 0); // Assume 40h/week capacity
    const allocatedHours = allocations.filter(a => a.status === 'active').reduce((sum, a) => sum + a.hoursPerWeek, 0);
    const trackedThisWeek = trackerSummary.weeklyTeamHours || 0;
    const availableHours = totalCapacity - allocatedHours;

    // Update stats
    document.getElementById('teamTotalMembers')?.textContent && (document.getElementById('teamTotalMembers').textContent = team.length);
    document.getElementById('teamTotalCapacity')?.textContent && (document.getElementById('teamTotalCapacity').textContent = totalCapacity + 'h');
    document.getElementById('teamAllocatedHours')?.textContent && (document.getElementById('teamAllocatedHours').textContent = trackedThisWeek.toFixed(1) + 'h');
    document.getElementById('teamAvailableHours')?.textContent && (document.getElementById('teamAvailableHours').textContent = availableHours + 'h');
    document.getElementById('teamBadge')?.textContent && (document.getElementById('teamBadge').textContent = team.length);
    
    // Render team members
    const membersList = document.getElementById('teamMembersList');
    if (membersList && team.length) {
        membersList.innerHTML = `
            <table class="data-table" style="width: 100%;">
                <thead>
                    <tr>
                        <th style="padding: 12px 16px;">Member</th>
                        <th style="padding: 12px 16px;">Email</th>
                        <th style="padding: 12px 16px;">Role</th>
                        <th style="padding: 12px 16px;">Rate</th>
                        <th style="padding: 12px 16px;">This Week</th>
                        <th style="padding: 12px 16px;">Status</th>
                        <th style="padding: 12px 16px;">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${team.map(m => {
                        const userTracker = trackerSummary.weeklyByUser[m.id] || trackerSummary.weeklyByUser[m.email] || { hours: 0, blocks: 0, cost: 0 };
                        const weekHours = userTracker.hours;
                        const weekCost = weekHours * (m.hourlyRate || 0);
                        return `
                        <tr>
                            <td style="padding: 12px 16px;">
                                <div style="display: flex; align-items: center; gap: 10px;">
                                    <div style="width: 32px; height: 32px; border-radius: 50%; background: var(--grey-200); display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 12px;">
                                        ${m.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                                    </div>
                                    <div>
                                        <div style="font-weight: 500;">${escapeHtml(m.name)}</div>
                                        <div style="font-size: 11px; color: var(--text-secondary);">${m.title || ''}</div>
                                    </div>
                                </div>
                            </td>
                            <td style="padding: 12px 16px; font-size: 13px;">${escapeHtml(m.email)}</td>
                            <td style="padding: 12px 16px;"><span class="badge ${m.role}">${m.role}</span></td>
                            <td style="padding: 12px 16px; font-family: var(--font-mono);">${m.currency === 'USD' ? '$' : 'R'}${m.hourlyRate}/hr</td>
                            <td style="padding: 12px 16px; font-family: var(--font-mono);">
                                <div style="font-weight: 600;">${weekHours.toFixed(1)}h</div>
                                ${weekCost > 0 ? `<div style="font-size: 11px; color: var(--text-secondary);">${m.currency === 'USD' ? '$' : 'R'}${weekCost.toFixed(0)}</div>` : ''}
                            </td>
                            <td style="padding: 12px 16px;"><span class="badge ${m.status}">${m.status}</span></td>
                            <td style="padding: 12px 16px; white-space: nowrap;">
                                <button class="btn btn-sm btn-secondary" onclick="editTeamMember('${m.id}')">Edit</button>
                                <button class="btn btn-sm" style="color: var(--danger); margin-left: 4px;" onclick="deleteTeamMember('${m.id}', '${escapeHtml(m.name)}')">Delete</button>
                            </td>
                        </tr>
                    `;}).join('')}
                </tbody>
            </table>
        `;
    }
    
    // Render allocations
    const allocationsList = document.getElementById('teamAllocationsList');
    if (allocationsList && allocations.length) {
        allocationsList.innerHTML = `
            <table class="data-table" style="width: 100%;">
                <thead>
                    <tr>
                        <th style="padding: 12px 16px;">Team Member</th>
                        <th style="padding: 12px 16px;">Project</th>
                        <th style="padding: 12px 16px; text-align: center;">Hours/Week</th>
                        <th style="padding: 12px 16px; text-align: right;">Rate</th>
                        <th style="padding: 12px 16px; text-align: right;">Weekly Est.</th>
                        <th style="padding: 12px 16px;">Status</th>
                        <th style="padding: 12px 16px;">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${allocations.map(a => `
                        <tr>
                            <td style="padding: 12px 16px; font-weight: 500;">${escapeHtml(a.userName || a.userId)}</td>
                            <td style="padding: 12px 16px;">${escapeHtml(a.project)}</td>
                            <td style="padding: 12px 16px; text-align: center; font-family: var(--font-mono);">${a.hoursPerWeek}h</td>
                            <td style="padding: 12px 16px; text-align: right; font-family: var(--font-mono);">${a.currency === 'USD' ? '$' : 'R'}${a.rate}</td>
                            <td style="padding: 12px 16px; text-align: right; font-family: var(--font-mono); font-weight: 600;">${a.currency === 'USD' ? '$' : 'R'}${(a.hoursPerWeek * a.rate).toLocaleString()}</td>
                            <td style="padding: 12px 16px;"><span class="badge ${a.status}">${a.status}</span></td>
                            <td style="padding: 12px 16px; white-space: nowrap;">
                                <button class="btn btn-sm btn-secondary" onclick="editAllocation('${a.id}')">Edit</button>
                                <button class="btn btn-sm" style="color: var(--danger); margin-left: 4px;" onclick="deleteAllocation('${a.id}')">Del</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }
}

function showTeamMemberModal(id = null) {
    const modal = document.getElementById('teamMemberModal');
    if (!modal) { toast('Team member modal not found', 'error'); return; }
    
    document.getElementById('teamMemberModalTitle').textContent = id ? 'Edit Team Member' : 'Add Team Member';
    document.getElementById('teamMemberId').value = id || '';
    
    if (id) {
        const team = window.ORACLE_PRELOAD?.team || [];
        const member = team.find(m => m.id === id);
        if (member) {
            document.getElementById('teamMemberName').value = member.name || '';
            document.getElementById('teamMemberEmail').value = member.email || '';
            document.getElementById('teamMemberRole').value = member.role || 'freelancer';
            document.getElementById('teamMemberStatus').value = member.status || 'active';
            document.getElementById('teamMemberRate').value = member.hourlyRate || '';
            document.getElementById('teamMemberCurrency').value = member.currency || 'USD';
            document.getElementById('teamMemberTitle').value = member.title || '';
        }
    } else {
        document.getElementById('teamMemberName').value = '';
        document.getElementById('teamMemberEmail').value = '';
        document.getElementById('teamMemberRole').value = 'freelancer';
        document.getElementById('teamMemberStatus').value = 'active';
        document.getElementById('teamMemberRate').value = '';
        document.getElementById('teamMemberCurrency').value = 'USD';
        document.getElementById('teamMemberTitle').value = '';
    }
    
    openModal('teamMemberModal');
}

async function saveTeamMember() {
    const id = document.getElementById('teamMemberId').value;
    const memberData = {
        name: document.getElementById('teamMemberName').value.trim(),
        email: document.getElementById('teamMemberEmail').value.trim().toLowerCase(),
        role: document.getElementById('teamMemberRole').value,
        status: document.getElementById('teamMemberStatus').value,
        hourlyRate: parseFloat(document.getElementById('teamMemberRate').value) || 0,
        currency: document.getElementById('teamMemberCurrency').value,
        title: document.getElementById('teamMemberTitle').value.trim()
    };
    
    if (!memberData.name || !memberData.email) {
        toast('Name and email are required', 'error');
        return;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(memberData.email)) {
        toast('Invalid email address', 'error');
        return;
    }
    
    // Initialize team array if needed
    if (!window.ORACLE_PRELOAD.team) {
        window.ORACLE_PRELOAD.team = [];
    }
    
    if (id) {
        // Update existing
        const idx = window.ORACLE_PRELOAD.team.findIndex(m => m.id === id);
        if (idx >= 0) {
            window.ORACLE_PRELOAD.team[idx] = { ...window.ORACLE_PRELOAD.team[idx], ...memberData };
        }
    } else {
        // Add new
        const newMember = { 
            ...memberData, 
            id: crypto.randomUUID(), 
            createdAt: new Date().toISOString() 
        };
        window.ORACLE_PRELOAD.team.push(newMember);
        toast(`✅ ${memberData.name} can now log in with ${memberData.email}`, 'success');
    }
    
    // Save to localStorage
    localStorage.setItem('oracle_team', JSON.stringify(window.ORACLE_PRELOAD.team));
    
    // Sync to Supabase
    if (supabaseClient && currentUser) {
        try {
            const teamToSync = window.ORACLE_PRELOAD.team.map(m => ({
                id: m.id,
                user_id: currentUser.id,
                name: m.name,
                email: m.email,
                role: m.role,
                status: m.status,
                hourly_rate: m.hourlyRate,
                currency: m.currency,
                title: m.title,
                created_at: m.createdAt
            }));
            const { error } = await supabaseClient.from('tt_team_members').upsert(teamToSync, { onConflict: 'id' });
            if (error) console.warn('[Oracle] Team sync skipped (table may not exist):', error.message);
        } catch (e) {
            console.warn('[Oracle] Team sync failed:', e);
        }
    }
    
    // Re-render team page
    renderTeamPage();
    closeModal();
    toast('Team member saved', 'success');
}

function editTeamMember(id) {
    showTeamMemberModal(id);
}

async function deleteTeamMember(id, name) {
    // Prevent deleting current user
    const currentEmail = window.ORACLE_CURRENT_USER?.email;
    const member = window.ORACLE_PRELOAD.team.find(m => m.id === id);
    
    if (member?.email.toLowerCase() === currentEmail?.toLowerCase()) {
        toast('❌ Cannot delete your own account', 'error');
        return;
    }
    
    if (!confirm(`Remove ${name} from the team?\n\nThey will lose portal access immediately.`)) return;
    
    // Remove from team array
    window.ORACLE_PRELOAD.team = window.ORACLE_PRELOAD.team.filter(m => m.id !== id);
    
    // Save to localStorage
    localStorage.setItem('oracle_team', JSON.stringify(window.ORACLE_PRELOAD.team));
    
    // Remove from Supabase
    if (supabaseClient && currentUser) {
        try {
            const { error } = await supabaseClient.from('tt_team_members').delete().eq('id', id);
            if (error) console.warn('[Oracle] Team member delete from Supabase failed:', error.message);
        } catch (e) {
            console.warn('[Oracle] Team member delete exception:', e);
        }
    }
    
    // Also remove any allocations for this member
    const allocations = window.ORACLE_PRELOAD?.allocations || [];
    const removedAllocations = allocations.filter(a => a.userId === id);
    if (removedAllocations.length > 0) {
        window.ORACLE_PRELOAD.allocations = allocations.filter(a => a.userId !== id);
        localStorage.setItem('oracle_allocations', JSON.stringify(window.ORACLE_PRELOAD.allocations));
        toast(`Removed ${name} and ${removedAllocations.length} allocation(s)`, 'success');
    } else {
        toast(`${name} removed from team`, 'success');
    }
    
    // Re-render
    renderTeamPage();
    renderFinancialAnalyzer();
}

function editAllocation(id) {
    showAllocationModal(id);
}

function deleteAllocation(id) {
    if (!confirm('Remove this allocation?')) return;
    const allocations = window.ORACLE_PRELOAD?.allocations || [];
    window.ORACLE_PRELOAD.allocations = allocations.filter(a => a.id !== id);
    localStorage.setItem('oracle_allocations', JSON.stringify(window.ORACLE_PRELOAD.allocations));
    renderTeamPage();
    renderFinancialAnalyzer();
    toast('Allocation removed', 'success');
}

// ============================================================
// MEETINGS (Fireflies Integration)
// ============================================================
// meetings & firefliesConnected already declared at top of file

function renderMeetingsPage() {
    // Load persisted meetings from localStorage if memory is empty
    if (meetings.length === 0) {
        const stored = localStorage.getItem('oracle_meetings');
        if (stored) {
            try {
                meetings = JSON.parse(stored);
                window.ORACLE_MEETINGS = meetings;
                console.log('[Oracle] Loaded', meetings.length, 'meetings from localStorage');
            } catch (e) {
                console.warn('[Oracle] Failed to parse stored meetings');
            }
        }
    }

    // Update stats
    const totalMinutes = meetings.reduce((sum, m) => sum + (m.duration || 0), 0);
    const clientMeetings = meetings.filter(m => m.meetingType === 'client');
    const teamMeetings = meetings.filter(m => m.meetingType === 'team');
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthMeetings = meetings.filter(m => m.date && new Date(m.date) >= startOfMonth);

    document.getElementById('meetingsTotal')?.textContent && (document.getElementById('meetingsTotal').textContent = meetings.length);
    document.getElementById('meetingsClient')?.textContent && (document.getElementById('meetingsClient').textContent = clientMeetings.length);
    document.getElementById('meetingsTeam')?.textContent && (document.getElementById('meetingsTeam').textContent = teamMeetings.length);
    document.getElementById('meetingsHours')?.textContent && (document.getElementById('meetingsHours').textContent = Math.round(totalMinutes / 60) + 'h');
    document.getElementById('meetingsBadge')?.textContent && (document.getElementById('meetingsBadge').textContent = meetings.length);

    // Render meetings list if we have data
    if (meetings.length > 0) {
        renderMeetingsList(meetings);
    }

    // Check if Fireflies API key is stored
    const apiKey = settings.fireflies_api_key || localStorage.getItem('fireflies_api_key');
    if (apiKey) {
        document.getElementById('firefliesApiKey').value = apiKey;
        document.getElementById('firefliesStatus').className = 'status-box success';
        document.getElementById('firefliesStatus').textContent = '✓ API key configured';
        firefliesConnected = true;
    }
}

function populateMeetingsClientFilter() {
    const filter = document.getElementById('meetingsClientFilter');
    if (!filter) return;
    
    filter.innerHTML = '<option value="">All Clients</option>';
    clients.forEach(c => {
        const option = document.createElement('option');
        option.value = c.id;
        option.textContent = c.company || c.name;
        filter.appendChild(option);
    });
}

async function connectFireflies() {
    const apiKey = document.getElementById('firefliesApiKey')?.value.trim();
    if (!apiKey) {
        toast('Please enter a Fireflies API key', 'error');
        return;
    }
    
    toast('Connecting to Fireflies...', 'success');
    
    // Save API key
    settings.fireflies_api_key = apiKey;
    localStorage.setItem('fireflies_api_key', apiKey);
    
    // Test connection by fetching user info
    try {
        const response = await fetch('https://api.fireflies.ai/graphql', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + apiKey
            },
            body: JSON.stringify({
                query: `query { user { name email } }`
            })
        });
        
        const data = await response.json();
        
        if (data.errors) {
            throw new Error(data.errors[0].message);
        }
        
        document.getElementById('firefliesStatus').className = 'status-box success';
        document.getElementById('firefliesStatus').textContent = '✓ Connected as ' + (data.data?.user?.name || data.data?.user?.email);
        firefliesConnected = true;
        toast('Fireflies connected!', 'success');
        
        // Save to settings
        if (currentUser && supabaseClient) {
            await supabaseClient.from('user_settings').upsert({
                user_id: currentUser.id,
                fireflies_api_key: apiKey
            }, { onConflict: 'user_id' });
        }
        
        // Auto-sync meetings
        await syncMeetings();
        
    } catch (err) {
        document.getElementById('firefliesStatus').className = 'status-box error';
        document.getElementById('firefliesStatus').textContent = '✗ Connection failed: ' + err.message;
        toast('Connection failed: ' + err.message, 'error');
    }
}

async function syncMeetings() {
    const apiKey = settings.fireflies_api_key || localStorage.getItem('fireflies_api_key');
    if (!apiKey) {
        toast('Connect Fireflies first', 'error');
        return;
    }
    
    toast('Syncing meetings...', 'success');
    
    try {
        const response = await fetch('https://api.fireflies.ai/graphql', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + apiKey
            },
            body: JSON.stringify({
                query: `query {
                    transcripts(limit: 500) {
                        id
                        title
                        date
                        duration
                        participants
                        summary {
                            overview
                            action_items
                            keywords
                        }
                        sentences {
                            text
                            speaker_name
                        }
                    }
                }`
            })
        });
        
        const data = await response.json();
        
        if (data.errors) {
            throw new Error(data.errors[0].message);
        }
        
        meetings = (data.data?.transcripts || []).map(m => categorizeMeeting(m));

        // Persist meetings to localStorage
        localStorage.setItem('oracle_meetings', JSON.stringify(meetings));

        // Store for AI access
        window.ORACLE_MEETINGS = meetings;

        // Sync meetings to Supabase if available
        if (supabaseClient && currentUser) {
            try {
                const meetingsToSync = meetings.map(m => ({
                    id: m.id,
                    user_id: currentUser.id,
                    title: m.title,
                    date: m.date ? new Date(m.date).toISOString() : null,
                    duration: m.duration || 0,
                    participants: JSON.stringify(m.participants || []),
                    summary_overview: m.summary?.overview || null,
                    summary_action_items: m.summary?.action_items || null,
                    summary_keywords: JSON.stringify(m.summary?.keywords || []),
                    meeting_type: m.meetingType || 'client',
                    metadata: JSON.stringify({ sentences_count: m.sentences?.length || 0 })
                }));
                // Try upsert - table may not exist yet, that's okay
                await supabaseClient.from('meetings').upsert(meetingsToSync, { onConflict: 'id' }).then(({ error }) => {
                    if (error) console.warn('[Oracle] Meetings sync to Supabase skipped (table may not exist):', error.message);
                    else console.log('[Oracle] Meetings synced to Supabase:', meetingsToSync.length);
                });
            } catch (e) {
                console.warn('[Oracle] Meetings Supabase sync failed:', e);
            }
        }

        // Update stats
        const totalMinutes = meetings.reduce((sum, m) => sum + (m.duration || 0), 0);
        const clientMeetings = meetings.filter(m => m.meetingType === 'client');
        const teamMeetings = meetings.filter(m => m.meetingType === 'team');
        
        document.getElementById('meetingsTotal').textContent = meetings.length;
        document.getElementById('meetingsClient')?.textContent && (document.getElementById('meetingsClient').textContent = clientMeetings.length);
        document.getElementById('meetingsTeam')?.textContent && (document.getElementById('meetingsTeam').textContent = teamMeetings.length);
        document.getElementById('meetingsHours').textContent = Math.round(totalMinutes / 60) + 'h';
        document.getElementById('meetingsBadge').textContent = meetings.length;
        
        // Render meetings list
        renderMeetingsList(meetings);
        
        toast('Synced ' + meetings.length + ' meetings (' + clientMeetings.length + ' client, ' + teamMeetings.length + ' team)', 'success');
        
    } catch (err) {
        toast('Sync failed: ' + err.message, 'error');
    }
}

// Categorize meeting as team or client
function categorizeMeeting(meeting) {
    const title = (meeting.title || '').toLowerCase();
    const participants = meeting.participants || [];
    
    // Team indicators
    const teamIndicators = ['team', 'standup', 'stand-up', 'internal', 'sync', 'weekly', 'daily', 'exergy'];
    const isTeamByTitle = teamIndicators.some(ind => title.includes(ind));
    
    // Check if all participants are from exergydesigns.com
    const team = window.ORACLE_PRELOAD?.team || [];
    const teamEmails = team.map(t => t.email.toLowerCase());
    const allTeam = participants.length > 0 && participants.every(p => 
        teamEmails.some(e => (p.email || p || '').toLowerCase().includes('exergy'))
    );
    
    // Client indicators
    const clientIndicators = ['client', 'project', 'kickoff', 'review', 'demo', 'presentation'];
    const isClientByTitle = clientIndicators.some(ind => title.includes(ind));
    
    // Determine type
    let meetingType = 'client'; // Default to client
    if (isTeamByTitle || allTeam) {
        meetingType = 'team';
    }
    
    return {
        ...meeting,
        meetingType,
        isTeam: meetingType === 'team',
        isClient: meetingType === 'client'
    };
}

// Filter meetings by type
let currentMeetingFilter = 'all';

function filterMeetingsByType(type) {
    currentMeetingFilter = type;
    
    // Update button states
    document.getElementById('filterAllMeetings')?.classList.toggle('btn-secondary', type !== 'all');
    document.getElementById('filterAllMeetings')?.style && (document.getElementById('filterAllMeetings').style.background = type === 'all' ? '#111' : '');
    document.getElementById('filterAllMeetings')?.style && (document.getElementById('filterAllMeetings').style.color = type === 'all' ? 'white' : '');
    
    document.getElementById('filterClientMeetings')?.classList.toggle('btn-secondary', type === 'client');
    document.getElementById('filterClientMeetings')?.style && (document.getElementById('filterClientMeetings').style.background = type === 'client' ? '#111' : '');
    document.getElementById('filterClientMeetings')?.style && (document.getElementById('filterClientMeetings').style.color = type === 'client' ? 'white' : '');
    
    document.getElementById('filterTeamMeetings')?.classList.toggle('btn-secondary', type === 'team');
    document.getElementById('filterTeamMeetings')?.style && (document.getElementById('filterTeamMeetings').style.background = type === 'team' ? '#111' : '');
    document.getElementById('filterTeamMeetings')?.style && (document.getElementById('filterTeamMeetings').style.color = type === 'team' ? 'white' : '');
    
    let filtered = meetings;
    if (type === 'client') {
        filtered = meetings.filter(m => m.meetingType === 'client');
    } else if (type === 'team') {
        filtered = meetings.filter(m => m.meetingType === 'team');
    }
    
    renderMeetingsList(filtered);
}

function renderMeetingsList(meetingsToRender) {
    const container = document.getElementById('meetingsList');
    if (!container) return;
    
    if (!meetingsToRender.length) {
        container.innerHTML = '<div class="empty-state"><p>No meetings found. Connect Fireflies.ai to view meeting transcripts.</p></div>';
        return;
    }
    
    container.innerHTML = meetingsToRender.map(m => `
        <div class="list-item meeting-item" data-meeting-id="${m.id}" style="padding: 14px 16px; border-bottom: 1px solid var(--border); cursor: pointer;">
            <div style="display: flex; justify-content: space-between; align-items: start;">
                <div style="flex: 1;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                        <span class="badge ${m.meetingType === 'team' ? 'admin' : 'active'}">${m.meetingType === 'team' ? '🏢 Team' : '👥 Client'}</span>
                        <span style="font-weight: 600;">${escapeHtml(m.title)}</span>
                    </div>
                    <div style="font-size: 12px; color: var(--text-secondary);">
                        ${new Date(m.date).toLocaleDateString('en-ZA', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                        • ${Math.round((m.duration || 0) / 60)} min
                        ${m.participants ? ' • ' + m.participants.length + ' participants' : ''}
                    </div>
                    ${m.summary?.overview ? `<div style="font-size: 13px; color: var(--text-secondary); margin-top: 8px; line-height: 1.5;">${escapeHtml(m.summary.overview.substring(0, 200))}...</div>` : ''}
                </div>
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="20" height="20" style="color: var(--text-secondary);"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
            </div>
        </div>
    `).join('');
}

function filterMeetingsByClient() {
    const clientId = document.getElementById('meetingsClientFilter')?.value;
    
    if (!clientId) {
        renderMeetingsList(meetings);
        return;
    }
    
    const client = clients.find(c => c.id === clientId);
    if (!client) {
        renderMeetingsList(meetings);
        return;
    }
    
    // Filter meetings that mention client name or company
    const filtered = meetings.filter(m => {
        const title = (m.title || '').toLowerCase();
        const clientName = (client.name || '').toLowerCase();
        const company = (client.company || '').toLowerCase();
        return title.includes(clientName) || title.includes(company);
    });
    
    renderMeetingsList(filtered);
}

function showMeetingDetails(meetingId) {
    const meeting = meetings.find(m => m.id === meetingId);
    if (!meeting) return;
    
    // For now, show a toast with summary
    if (meeting.summary?.overview) {
        toast('Summary: ' + meeting.summary.overview.substring(0, 100) + '...', 'success');
    } else {
        toast('No summary available', 'success');
    }
}

// ============================================================
// SCANNED DATA (Admin Only)
// ============================================================
let scannedData = [];
let selectedScan = null;

function loadScannedData() {
    // Load from localStorage (synced from extension)
    const stored = localStorage.getItem('oracle_scans');
    scannedData = stored ? JSON.parse(stored) : [];
    
    // Update stats
    const today = new Date().toDateString();
    const todayScans = scannedData.filter(s => new Date(s.scannedAt).toDateString() === today);
    const pendingScans = scannedData.filter(s => s.status === 'pending');
    const processedScans = scannedData.filter(s => s.status === 'processed');
    
    document.getElementById('scannedTotal')?.textContent && (document.getElementById('scannedTotal').textContent = scannedData.length);
    document.getElementById('scannedToday')?.textContent && (document.getElementById('scannedToday').textContent = todayScans.length);
    document.getElementById('scannedPending')?.textContent && (document.getElementById('scannedPending').textContent = pendingScans.length);
    document.getElementById('scannedProcessed')?.textContent && (document.getElementById('scannedProcessed').textContent = processedScans.length);
    document.getElementById('scannedBadge')?.textContent && (document.getElementById('scannedBadge').textContent = pendingScans.length);
    
    renderScannedDataList(scannedData);
}

function renderScannedDataList(data) {
    const container = document.getElementById('scannedDataList');
    if (!container) return;
    
    if (!data.length) {
        container.innerHTML = `
            <div class="empty-state" style="padding: 32px;">
                <p>No scanned data yet.</p>
                <p style="font-size: 12px; color: var(--text-secondary); margin-top: 8px;">Install the Oracle Scanner Chrome extension to capture data from web pages.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = data.map(scan => {
        const categoryIcons = {
            upwork: '💼',
            invoice: '📄',
            bank: '🏦',
            payslip: '💰',
            expense: '💸',
            project: '📁',
            other: '📋'
        };
        const icon = categoryIcons[scan.category] || '📋';
        const date = new Date(scan.scannedAt);
        const timeAgo = getTimeAgo(date);
        
        return `
            <div class="list-item" style="padding: 12px 16px; border-bottom: 1px solid var(--border); cursor: pointer;" onclick="viewScanDetails('${scan.id}')">
                <div style="display: flex; justify-content: space-between; align-items: start; gap: 12px;">
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                            <span style="font-size: 16px;">${icon}</span>
                            <span class="badge ${scan.category}">${scan.category}</span>
                            <span class="badge ${scan.status}">${scan.status}</span>
                        </div>
                        <div style="font-weight: 500; margin-bottom: 2px;">${escapeHtml(scan.title?.substring(0, 60) || 'Untitled')}${scan.title?.length > 60 ? '...' : ''}</div>
                        <div style="font-size: 11px; color: var(--text-secondary);">
                            ${scan.url ? new URL(scan.url).hostname : 'Unknown source'} • ${timeAgo}
                        </div>
                    </div>
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="20" height="20" style="color: var(--text-secondary); flex-shrink: 0;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                </div>
            </div>
        `;
    }).join('');
}

function filterScannedData() {
    const category = document.getElementById('scannedCategoryFilter')?.value;
    const status = document.getElementById('scannedStatusFilter')?.value;
    
    let filtered = scannedData;
    
    if (category) {
        filtered = filtered.filter(s => s.category === category);
    }
    
    if (status) {
        filtered = filtered.filter(s => s.status === status);
    }
    
    renderScannedDataList(filtered);
}

function viewScanDetails(scanId) {
    selectedScan = scannedData.find(s => s.id === scanId);
    if (!selectedScan) return;
    
    document.getElementById('scanDetailsCard').style.display = 'block';
    document.getElementById('scanDetailsSubtitle').textContent = `Scanned ${new Date(selectedScan.scannedAt).toLocaleString('en-ZA')}`;
    document.getElementById('scanDetailCategory').value = selectedScan.category || 'other';
    document.getElementById('scanDetailNotes').value = selectedScan.notes || '';
    
    // Populate client dropdown
    const clientSelect = document.getElementById('scanDetailClient');
    clientSelect.innerHTML = '<option value="">None</option>';
    clients.forEach(c => {
        const option = document.createElement('option');
        option.value = c.id;
        option.textContent = c.name + (c.company ? ` (${c.company})` : '');
        if (c.id === selectedScan.clientId) option.selected = true;
        clientSelect.appendChild(option);
    });
    
    // Show content
    document.getElementById('scanDetailContent').textContent = selectedScan.content?.substring(0, 5000) || 'No content extracted';
    
    // Show tables
    const tablesDiv = document.getElementById('scanDetailTables');
    if (selectedScan.tables?.length) {
        tablesDiv.innerHTML = selectedScan.tables.map((table, idx) => {
            if (!table.rows?.length) return '';
            return `
                <div style="margin-bottom: 12px;">
                    <div style="font-size: 11px; font-weight: 600; margin-bottom: 4px;">Table ${idx + 1}</div>
                    <table class="data-table" style="width: 100%; font-size: 11px;">
                        ${table.rows.slice(0, 10).map((row, i) => `
                            <tr style="${i === 0 ? 'font-weight: 600; background: var(--grey-100);' : ''}">
                                ${row.map(cell => `<td style="padding: 4px 8px; border: 1px solid var(--border);">${escapeHtml(cell)}</td>`).join('')}
                            </tr>
                        `).join('')}
                    </table>
                    ${table.rows.length > 10 ? `<div style="font-size: 10px; color: var(--text-secondary);">+${table.rows.length - 10} more rows</div>` : ''}
                </div>
            `;
        }).join('');
    } else {
        tablesDiv.innerHTML = '<div style="color: var(--text-secondary); font-size: 12px;">No tables found</div>';
    }
    
    // Scroll to details
    document.getElementById('scanDetailsCard').scrollIntoView({ behavior: 'smooth' });
}

function closeScanDetails() {
    document.getElementById('scanDetailsCard').style.display = 'none';
    selectedScan = null;
}

function processScan() {
    if (!selectedScan) return;
    
    const category = document.getElementById('scanDetailCategory').value;
    const clientId = document.getElementById('scanDetailClient').value;
    const notes = document.getElementById('scanDetailNotes').value;
    
    // Update scan
    selectedScan.category = category;
    selectedScan.clientId = clientId || null;
    selectedScan.notes = notes;
    selectedScan.status = 'processed';
    selectedScan.processedAt = new Date().toISOString();
    
    // Save to localStorage
    localStorage.setItem('oracle_scans', JSON.stringify(scannedData));
    
    // Route data based on category
    if (category === 'upwork') {
        // Extract Upwork data from scan content and merge with earnings
        if (selectedScan.tables?.length) {
            const existingEarnings = window.ORACLE_PRELOAD?.upworkEarnings || [];
            selectedScan.tables.forEach(table => {
                if (!table.rows?.length) return;
                table.rows.slice(1).forEach(row => {
                    if (row.length >= 3) {
                        const amount = parseFloat((row[2] || '').replace(/[^0-9.-]/g, ''));
                        if (!isNaN(amount) && amount > 0) {
                            existingEarnings.unshift({
                                date: row[0] || new Date().toISOString().split('T')[0],
                                client: row[1] || 'Unknown',
                                amount: amount
                            });
                        }
                    }
                });
            });
            window.ORACLE_PRELOAD.upworkEarnings = existingEarnings;
            renderFinancialAnalyzer();
        }
        toast('Upwork data processed. Check Financial Analyzer.', 'success');
    } else if (category === 'invoice') {
        // Store scan reference for invoice review
        toast('Invoice data saved. Review in Invoices tab.', 'success');
    } else if (category === 'bank') {
        toast('Bank statement processed. Check Transactions.', 'success');
    } else {
        toast('Data processed and sorted.', 'success');
    }
    
    closeScanDetails();
    loadScannedData();
}

function archiveScan() {
    if (!selectedScan) return;
    
    selectedScan.status = 'archived';
    localStorage.setItem('oracle_scans', JSON.stringify(scannedData));
    
    toast('Scan archived', 'success');
    closeScanDetails();
    loadScannedData();
}

function deleteScan() {
    if (!selectedScan) return;
    
    if (!confirm('Delete this scan? This cannot be undone.')) return;
    
    scannedData = scannedData.filter(s => s.id !== selectedScan.id);
    localStorage.setItem('oracle_scans', JSON.stringify(scannedData));
    
    toast('Scan deleted', 'success');
    closeScanDetails();
    loadScannedData();
}

async function syncScannedData() {
    toast('Syncing scanned data...', 'success');
    
    // Reload from localStorage (in case extension updated it)
    loadScannedData();
    
    // Try to fetch from Supabase
    if (supabaseClient && currentUser) {
        try {
            const { data, error } = await supabaseClient
                .from('scanned_data')
                .select('*')
                .order('scanned_at', { ascending: false })
                .limit(100);
            
            if (!error && data?.length) {
                // Merge with local data
                const localIds = new Set(scannedData.map(s => s.id));
                const newScans = data.filter(d => !localIds.has(d.scan_id)).map(d => ({
                    id: d.scan_id,
                    category: d.category,
                    title: d.title,
                    url: d.url,
                    scannedAt: d.scanned_at,
                    clientId: d.client_id,
                    notes: d.notes,
                    content: d.content,
                    tables: JSON.parse(d.tables || '[]'),
                    links: JSON.parse(d.links || '[]'),
                    metadata: JSON.parse(d.metadata || '{}'),
                    status: d.status
                }));
                
                if (newScans.length) {
                    scannedData = [...newScans, ...scannedData];
                    localStorage.setItem('oracle_scans', JSON.stringify(scannedData));
                    loadScannedData();
                    toast(`Synced ${newScans.length} new scans from cloud`, 'success');
                } else {
                    toast('All data is up to date', 'success');
                }
            }
        } catch (e) {
            console.warn('Supabase sync failed:', e);
        }
    }
}

function getTimeAgo(date) {
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    if (diff < 604800000) return Math.floor(diff / 86400000) + 'd ago';
    
    return date.toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' });
}

// ============================================================
// LIVE UPDATES (Extension data polling + Storage events)
// ============================================================
let liveUpdateInterval = null;

function setupLiveUpdates() {
    // Listen for localStorage changes from the extension (cross-tab communication)
    window.addEventListener('storage', (e) => {
        if (e.key === 'oracle_scans' && e.newValue) {
            console.log('[Oracle] Live update: New scanned data from extension');
            loadScannedData();
            toast('New data received from scanner', 'success');
        }
        if (e.key === 'oracle_invoices' && e.newValue) {
            console.log('[Oracle] Live update: Invoices updated');
            const stored = JSON.parse(e.newValue || '[]');
            if (stored.length > invoices.length) {
                invoices = stored;
                renderInvoices();
                renderOutstandingInvoices();
                updateDashboard();
                toast('Invoices updated', 'success');
            }
        }
        if (e.key === 'oracle_upwork_live' && e.newValue) {
            console.log('[Oracle] Live update: Upwork data from extension');
            try {
                const upworkData = JSON.parse(e.newValue);
                if (upworkData.earnings?.length) {
                    // Merge new Upwork earnings
                    const existing = window.ORACLE_PRELOAD?.upworkEarnings || [];
                    const existingKeys = new Set(existing.map(e => `${e.date}|${e.client}|${e.amount}`));
                    const newEarnings = upworkData.earnings.filter(e =>
                        !existingKeys.has(`${e.date}|${e.client}|${e.amount}`)
                    );
                    if (newEarnings.length) {
                        window.ORACLE_PRELOAD.upworkEarnings = [...newEarnings, ...existing];
                        renderFinancialAnalyzer();
                        toast(`${newEarnings.length} new Upwork earnings received`, 'success');
                    }
                }
            } catch (e) {
                console.warn('[Oracle] Failed to parse Upwork live data:', e);
            }
        }
    });

    // Poll for extension data changes every 30 seconds
    liveUpdateInterval = setInterval(() => {
        const lastCheck = parseInt(localStorage.getItem('oracle_scans_last_check') || '0');
        const stored = localStorage.getItem('oracle_scans');
        if (stored) {
            const parsed = JSON.parse(stored);
            const newestScan = parsed.reduce((max, s) => {
                const t = new Date(s.scannedAt).getTime();
                return t > max ? t : max;
            }, 0);
            if (newestScan > lastCheck) {
                localStorage.setItem('oracle_scans_last_check', String(newestScan));
                if (lastCheck > 0) {
                    // Only show notification if not first load
                    loadScannedData();
                    console.log('[Oracle] Polling detected new scanned data');
                }
            }
        }
    }, 30000);

    // Periodic sync for shared data (every 20 minutes)
    setInterval(async () => {
        if (!supabaseClient || !currentUser) return;
        
        console.log('[Oracle] Periodic sync: Pulling shared data from Supabase...');
        
        try {
            // Sync time entries (shared across admins)
            const { data: timeData } = await supabaseClient
                .from('time_entries')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100);
            
            if (timeData?.length) {
                const localIds = new Set(timeEntries.map(t => t.id));
                const newEntries = timeData.filter(t => !localIds.has(t.id));
                if (newEntries.length > 0) {
                    timeEntries = [...newEntries, ...timeEntries];
                    localStorage.setItem('oracle_time_entries', JSON.stringify(timeEntries));
                    renderTimeEntries();
                    updateTodayTotal();
                    console.log('[Oracle] Synced', newEntries.length, 'new time entries');
                    if (window.ORACLE_IS_ADMIN) {
                        toast(`↻ Synced ${newEntries.length} new time entries`, 'success');
                    }
                }
            }
            
            // Sync tracker blocks (from desktop time tracker app)
            try {
                await loadTrackerBlocks();
                await loadTrackerTeamMembers();
                updateDashboard();
                renderTeamPage();
                renderFinancialAnalyzer();
                console.log('[Oracle] Tracker data synced');
            } catch (e) {
                console.warn('[Oracle] Tracker sync failed:', e);
            }

            // Sync projects/clients/invoices if admin
            if (window.ORACLE_IS_ADMIN) {
                const { data: projectData } = await supabaseClient
                    .from('projects')
                    .select('*')
                    .order('created_at', { ascending: false });
                
                if (projectData?.length) {
                    const localIds = new Set(projects.map(p => p.id));
                    const newProjects = projectData.filter(p => !localIds.has(p.id));
                    if (newProjects.length > 0) {
                        projects = [...projectData];
                        localStorage.setItem('oracle_projects', JSON.stringify(projects));
                        renderProjects();
                        console.log('[Oracle] Synced projects');
                    }
                }
            }
        } catch (e) {
            console.warn('[Oracle] Periodic sync failed:', e);
        }
    }, 20 * 60 * 1000); // 20 minutes

    console.log('[Oracle] Live updates enabled (storage events + 30s polling + 20min sync)');
}

// ============================================================
// GLOBAL EXPORTS
// ============================================================
window.signInWithGoogle = signInWithGoogle;
window.signOut = signOut;
window.navigateTo = navigateTo;
window.syncData = syncData;
window.saveSettings = saveSettings;
window.showProjectModal = showProjectModal;
window.saveProject = saveProject;
window.editProject = editProject;
window.showClientModal = showClientModal;
window.saveClient = saveClient;
window.editClient = editClient;
window.showInvoiceModal = showInvoiceModal;
window.saveInvoice = saveInvoice;
window.editInvoice = editInvoice;
window.markInvoicePaid = markInvoicePaid;
window.openInvoiceGenerator = openInvoiceGenerator;
window.addLineItem = addLineItem;
window.updateLineItem = updateLineItem;
window.removeLineItem = removeLineItem;
window.toggleTimer = toggleTimer;
window.resetTimer = resetTimer;
window.saveTimeEntry = saveTimeEntry;
window.deleteTimeEntry = deleteTimeEntry;
window.exportTimeEntries = exportTimeEntries;
window.openModal = openModal;
window.closeModal = closeModal;
window.askAI = askAI;
window.sendChat = sendChat;
window.showAllocationModal = showAllocationModal;
window.saveAllocation = saveAllocation;
window.deleteAllocation = deleteAllocation;
window.renderFinancialAnalyzer = renderFinancialAnalyzer;
window.renderTeamPage = renderTeamPage;
window.showTeamMemberModal = showTeamMemberModal;
window.saveTeamMember = saveTeamMember;
window.editTeamMember = editTeamMember;
window.deleteTeamMember = deleteTeamMember;
window.editAllocation = editAllocation;
window.connectFireflies = connectFireflies;
window.syncMeetings = syncMeetings;
window.filterMeetingsByClient = filterMeetingsByClient;
window.showMeetingDetails = showMeetingDetails;
window.renderFreelancerDashboard = renderFreelancerDashboard;
window.getCurrentUserAllocations = getCurrentUserAllocations;
window.showAccessDenied = showAccessDenied;
window.applyViewport = applyViewport;
window.loadScannedData = loadScannedData;
window.filterScannedData = filterScannedData;
window.viewScanDetails = viewScanDetails;
window.closeScanDetails = closeScanDetails;
window.processScan = processScan;
window.archiveScan = archiveScan;
window.deleteScan = deleteScan;
window.syncScannedData = syncScannedData;
window.connectClickUp = connectClickUp;
window.syncClickUpTeam = syncClickUpTeam;
window.connectFirefliesFromSettings = connectFirefliesFromSettings;
window.pullFromCloud = pullFromCloud;
window.connectGoogleDrive = connectGoogleDrive;
window.browseGoogleDrive = browseGoogleDrive;
window.filterMeetingsByType = filterMeetingsByType;
window.categorizeMeeting = categorizeMeeting;
window.showMeetingDetailsPanel = showMeetingDetailsPanel;
window.closeMeetingDetailsPanel = closeMeetingDetailsPanel;
// expose askAI once
window.askAI = askAI;

// ============================================================
// CLICKUP INTEGRATION
// ============================================================
async function connectClickUp() {
    const apiKey = document.getElementById('clickupKey')?.value.trim();
    if (!apiKey) {
        toast('Please enter a ClickUp API token', 'error');
        return;
    }
    
    toast('Connecting to ClickUp...', 'success');
    
    // Save API key
    localStorage.setItem('clickup_api_key', apiKey);
    settings.clickup_api_key = apiKey;
    
    if (window.clickUp) {
        window.clickUp.setApiKey(apiKey);
        const result = await window.clickUp.testConnection();
        
        if (result.success) {
            document.getElementById('clickupStatus').className = 'status-box success';
            document.getElementById('clickupStatus').textContent = '✓ Connected as ' + result.user.username;
            document.getElementById('clickupStatusMain').className = 'status-box success';
            document.getElementById('clickupStatusMain').textContent = '✓ ClickUp connected';
            toast('ClickUp connected!', 'success');
            
            // Auto-sync team
            await syncClickUpTeam();
        } else {
            document.getElementById('clickupStatus').className = 'status-box error';
            document.getElementById('clickupStatus').textContent = '✗ ' + result.error;
            toast('Connection failed: ' + result.error, 'error');
        }
    }
}

async function syncClickUpTeam() {
    if (!window.clickUp?.connected) {
        toast('Connect ClickUp first', 'error');
        return;
    }
    
    toast('Syncing team from ClickUp...', 'success');
    
    try {
        // Get teams/workspaces
        const teams = await window.clickUp.getTeams();
        
        if (!teams.length) {
            toast('No ClickUp workspaces found', 'error');
            return;
        }
        
        // Get members from first team
        const members = await window.clickUp.getTeamMembers(teams[0].id);
        
        // Update Oracle team with ClickUp data
        const existingTeam = window.ORACLE_PRELOAD?.team || [];
        const mergedTeam = [...existingTeam];
        
        members.forEach(m => {
            // Check if member already exists
            const existing = mergedTeam.find(t => t.email?.toLowerCase() === m.email?.toLowerCase());
            if (existing) {
                // Update with ClickUp data
                existing.clickupId = m.id;
                existing.profilePicture = m.profilePicture;
            } else if (m.email?.includes('@exergydesigns.com')) {
                // Add new team member
                mergedTeam.push({
                    id: m.id,
                    email: m.email,
                    name: m.name,
                    role: m.role === 'admin' ? 'admin' : 'freelancer',
                    title: 'Team Member',
                    hourlyRate: 350,
                    currency: 'ZAR',
                    status: 'active',
                    clickupId: m.id,
                    profilePicture: m.profilePicture
                });
            }
        });
        
        // Update preload
        window.ORACLE_PRELOAD.team = mergedTeam;
        window.ORACLE_PRELOAD.clickupTeams = teams;
        window.ORACLE_PRELOAD.clickupMembers = members;
        
        // Save to localStorage
        localStorage.setItem('oracle_team', JSON.stringify(mergedTeam));
        
        // Re-render team page
        renderTeamPage();
        
        toast(`Synced ${members.length} team members from ClickUp`, 'success');
        
    } catch (e) {
        console.error('ClickUp sync error:', e);
        toast('Sync failed: ' + e.message, 'error');
    }
}

async function connectFirefliesFromSettings() {
    const apiKey = document.getElementById('firefliesKeySettings')?.value.trim();
    if (!apiKey) {
        toast('Please enter a Fireflies API key', 'error');
        return;
    }
    
    // Copy to meetings page input and connect
    document.getElementById('firefliesApiKey').value = apiKey;
    await connectFireflies();
    
    // Update settings status
    if (firefliesConnected) {
        document.getElementById('firefliesStatusSettings').className = 'status-box success';
        document.getElementById('firefliesStatusSettings').textContent = '✓ Connected';
        document.getElementById('firefliesStatusMain').className = 'status-box success';
        document.getElementById('firefliesStatusMain').textContent = '✓ Fireflies connected';
    }
}

// ============================================================
// GOOGLE DRIVE INTEGRATION
// ============================================================
async function connectGoogleDrive() {
    const clientId = document.getElementById('gdriveClientId')?.value.trim();
    if (clientId) {
        localStorage.setItem('gdrive_client_id', clientId);
    }
    
    if (!localStorage.getItem('gdrive_client_id')) {
        toast('Please enter a Google OAuth Client ID', 'error');
        return;
    }
    
    toast('Opening Google Sign-in...', 'success');
    
    try {
        if (window.gdrive) {
            const result = await window.gdrive.connect();
            
            if (result.success) {
                document.getElementById('gdriveStatus').className = 'status-box success';
                document.getElementById('gdriveStatus').textContent = '✓ Connected as ' + result.user.email;
                document.getElementById('gdriveStatusMain').className = 'status-box success';
                document.getElementById('gdriveStatusMain').textContent = '✓ Google Drive connected';
                toast('Google Drive connected!', 'success');
            }
        }
    } catch (e) {
        document.getElementById('gdriveStatus').className = 'status-box error';
        document.getElementById('gdriveStatus').textContent = '✗ ' + e.message;
        toast('Connection failed: ' + e.message, 'error');
    }
}

async function browseGoogleDrive() {
    if (!window.gdrive?.connected) {
        toast('Connect Google Drive first', 'error');
        return;
    }
    
    toast('Loading files...', 'success');
    
    try {
        const files = await window.gdrive.listFiles();
        
        // Show files in a modal or alert for now
        const fileList = files.slice(0, 10).map(f => `• ${f.name}`).join('\n');
        toast(`Found ${files.length} files`, 'success');
        
        console.log('[GDrive] Files:', files);
        
    } catch (e) {
        toast('Failed to load files: ' + e.message, 'error');
    }
}

// Initialize integrations on load
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        // ClickUp
        if (window.clickUp) {
            window.clickUp.init().then(() => {
                if (window.clickUp.connected) {
                    const statusEl = document.getElementById('clickupStatusMain');
                    if (statusEl) {
                        statusEl.className = 'status-box success';
                        statusEl.textContent = '✓ ClickUp connected';
                    }
                }
            });
        }
        
        // Google Drive
        if (window.gdrive) {
            window.gdrive.init();
            if (window.gdrive.connected) {
                const statusEl = document.getElementById('gdriveStatusMain');
                if (statusEl) {
                    statusEl.className = 'status-box success';
                    statusEl.textContent = '✓ Google Drive connected';
                }
            }
        }
        
        // Load saved API keys into inputs
        const clickupKey = localStorage.getItem('clickup_api_key');
        if (clickupKey && document.getElementById('clickupKey')) {
            document.getElementById('clickupKey').value = clickupKey;
        }
        
        const gdriveClientId = localStorage.getItem('gdrive_client_id');
        if (gdriveClientId && document.getElementById('gdriveClientId')) {
            document.getElementById('gdriveClientId').value = gdriveClientId;
        }
        
        const firefliesKey = localStorage.getItem('fireflies_api_key');
        if (firefliesKey) {
            if (document.getElementById('firefliesKeySettings')) {
                document.getElementById('firefliesKeySettings').value = firefliesKey;
            }
            if (document.getElementById('firefliesApiKey')) {
                document.getElementById('firefliesApiKey').value = firefliesKey;
            }
        }
        
        // Meeting filter buttons
        document.getElementById('filterAllMeetings')?.addEventListener('click', () => filterMeetingsByType('all'));
        document.getElementById('filterClientMeetings')?.addEventListener('click', () => filterMeetingsByType('client'));
        document.getElementById('filterTeamMeetings')?.addEventListener('click', () => filterMeetingsByType('team'));
        document.getElementById('connectFirefliesBtn')?.addEventListener('click', connectFireflies);
        document.getElementById('syncMeetingsBtn')?.addEventListener('click', syncMeetings);
        document.getElementById('closeMeetingDetails')?.addEventListener('click', closeMeetingDetailsPanel);
        document.getElementById('meetingsClientFilter')?.addEventListener('change', filterMeetingsByClient);
        
        // Meeting item clicks
        document.getElementById('meetingsList')?.addEventListener('click', (e) => {
            const item = e.target.closest('.meeting-item');
            if (item) showMeetingDetailsPanel(item.dataset.meetingId);
        });
        
        // AI chat suggestions
        document.querySelectorAll('.chat-suggestions .suggestion').forEach(btn => {
            btn.addEventListener('click', () => {
                const query = btn.dataset.query;
                if (query) askAI(query);
            });
        });
        
        // AI send button
        document.getElementById('chatSendBtn')?.addEventListener('click', sendChat);
        document.getElementById('chatInput')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendChat();
            }
        });
        
        // CSV file upload
        const csvInput = document.getElementById('csvInput');
        const csvZone = document.getElementById('csvZone');
        
        if (csvInput) {
            csvInput.addEventListener('change', (e) => {
                if (e.target.files[0]) handleCsv(e.target.files[0]);
            });
        }
        
        if (csvZone) {
            csvZone.addEventListener('click', () => csvInput?.click());
            csvZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                csvZone.classList.add('dragover');
            });
            csvZone.addEventListener('dragleave', () => csvZone.classList.remove('dragover'));
            csvZone.addEventListener('drop', (e) => {
                e.preventDefault();
                csvZone.classList.remove('dragover');
                const file = e.dataTransfer.files[0];
                if (file?.name.endsWith('.csv')) handleCsv(file);
            });
        }
        
        // Clear transactions button
        document.getElementById('clearTransactionsBtn')?.addEventListener('click', clearAllTransactions);
        
        // Update transaction count
        updateTxnCount();
    }, 1000);
});

function clearAllTransactions() {
    if (!confirm('Clear all imported transactions? This cannot be undone.')) return;
    
    transactions = [];
    localStorage.removeItem('oracle_transactions');
    
    // Also clear from Supabase if connected
    if (supabaseClient && currentUser) {
        supabaseClient.from('transactions').delete().eq('user_id', currentUser.id)
            .then(() => console.log('[Oracle] Cleared Supabase transactions'))
            .catch(e => console.warn('Failed to clear Supabase:', e));
    }
    
    renderTransactions();
    updateDashboard();
    updateTxnCount();
    toast('Transactions cleared', 'success');
}

function updateTxnCount() {
    const countEl = document.getElementById('txnCount');
    if (countEl) {
        countEl.textContent = `${transactions.length} transactions stored`;
    }
}

// Meeting details panel
function showMeetingDetailsPanel(meetingId) {
    const meeting = meetings.find(m => m.id === meetingId);
    if (!meeting) return;
    
    document.getElementById('meetingDetailsCard').style.display = 'block';
    document.getElementById('meetingDetailTitle').textContent = meeting.title;
    document.getElementById('meetingDetailDate').textContent = new Date(meeting.date).toLocaleDateString('en-ZA', { 
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    }) + ' • ' + Math.round((meeting.duration || 0) / 60) + ' min';
    
    document.getElementById('meetingDetailParticipants').textContent = 
        meeting.participants?.join(', ') || 'No participants recorded';
    
    document.getElementById('meetingDetailSummary').textContent = 
        meeting.summary?.overview || 'No summary available';
    
    document.getElementById('meetingDetailActions').innerHTML = 
        meeting.summary?.action_items 
            ? `<ul style="margin: 0; padding-left: 20px;">${meeting.summary.action_items.split('\n').map(a => `<li>${escapeHtml(a)}</li>`).join('')}</ul>`
            : 'No action items recorded';
    
    document.getElementById('meetingDetailsCard').scrollIntoView({ behavior: 'smooth' });
}

function closeMeetingDetailsPanel() {
    document.getElementById('meetingDetailsCard').style.display = 'none';
}
console.log('[Oracle] Ready');
