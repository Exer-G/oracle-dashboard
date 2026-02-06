// Oracle Dashboard - Google Calendar Integration
// ============================================================

const CALENDAR_CONFIG = {
    apiKey: '', // Not needed with OAuth
    discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'],
    scopes: 'https://www.googleapis.com/auth/calendar.readonly'
};

let calendarInitialized = false;
let calendarEvents = [];

// ============================================================
// CALENDAR INITIALIZATION
// ============================================================

async function initCalendar() {
    if (calendarInitialized) return true;
    
    try {
        // Check if gapi is loaded
        if (typeof gapi === 'undefined') {
            console.log('[Calendar] Loading Google API client...');
            await loadGoogleApiScript();
        }
        
        await new Promise((resolve, reject) => {
            gapi.load('client', { callback: resolve, onerror: reject });
        });
        
        await gapi.client.init({
            discoveryDocs: CALENDAR_CONFIG.discoveryDocs
        });
        
        calendarInitialized = true;
        console.log('[Calendar] Initialized successfully');
        return true;
    } catch (error) {
        console.error('[Calendar] Init failed:', error);
        return false;
    }
}

function loadGoogleApiScript() {
    return new Promise((resolve, reject) => {
        if (document.querySelector('script[src*="apis.google.com/js/api.js"]')) {
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://apis.google.com/js/api.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// ============================================================
// FETCH CALENDAR EVENTS
// ============================================================

async function fetchCalendarEvents(days = 14) {
    if (!calendarInitialized) {
        const success = await initCalendar();
        if (!success) return [];
    }
    
    // Get access token from Supabase session
    const session = await supabaseClient.auth.getSession();
    const accessToken = session?.data?.session?.provider_token;
    
    if (!accessToken) {
        console.warn('[Calendar] No access token - user needs to re-authenticate with calendar scope');
        return [];
    }
    
    // Set the access token for gapi
    gapi.client.setToken({ access_token: accessToken });
    
    const now = new Date();
    const maxDate = new Date(now.getTime() + (days * 24 * 60 * 60 * 1000));
    
    try {
        const response = await gapi.client.calendar.events.list({
            calendarId: 'primary',
            timeMin: now.toISOString(),
            timeMax: maxDate.toISOString(),
            showDeleted: false,
            singleEvents: true,
            maxResults: 50,
            orderBy: 'startTime'
        });
        
        calendarEvents = response.result.items || [];
        console.log(`[Calendar] Fetched ${calendarEvents.length} events`);
        
        // Cache events
        localStorage.setItem('oracle_calendar_events', JSON.stringify({
            events: calendarEvents,
            fetchedAt: Date.now()
        }));
        
        return calendarEvents;
    } catch (error) {
        console.error('[Calendar] Fetch failed:', error);
        
        // Try cached events
        const cached = localStorage.getItem('oracle_calendar_events');
        if (cached) {
            const { events } = JSON.parse(cached);
            calendarEvents = events;
            return events;
        }
        
        return [];
    }
}

// ============================================================
// RENDER CALENDAR WIDGET
// ============================================================

function renderCalendarWidget(containerId = 'calendarWidget') {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    if (calendarEvents.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="padding: 24px; text-align: center;">
                <div style="font-size: 32px; margin-bottom: 8px;">📅</div>
                <p style="color: var(--grey-500); font-size: 13px;">No upcoming events</p>
                <button onclick="syncCalendar()" class="btn btn-secondary" style="margin-top: 12px; font-size: 12px;">
                    Sync Calendar
                </button>
            </div>
        `;
        return;
    }
    
    const now = new Date();
    const today = now.toDateString();
    const tomorrow = new Date(now.getTime() + 86400000).toDateString();
    
    // Group events by day
    const grouped = {};
    calendarEvents.forEach(event => {
        const start = event.start.dateTime || event.start.date;
        const date = new Date(start);
        const dayKey = date.toDateString();
        
        let label = dayKey;
        if (dayKey === today) label = 'Today';
        else if (dayKey === tomorrow) label = 'Tomorrow';
        else label = date.toLocaleDateString('en-ZA', { weekday: 'short', month: 'short', day: 'numeric' });
        
        if (!grouped[label]) grouped[label] = [];
        grouped[label].push(event);
    });
    
    let html = `
        <div class="calendar-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h3 style="font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: var(--grey-400);">
                Upcoming Events
            </h3>
            <button onclick="syncCalendar()" class="btn-icon" title="Refresh">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 12a9 9 0 11-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
                    <path d="M21 3v5h-5"/>
                </svg>
            </button>
        </div>
        <div class="calendar-events" style="display: flex; flex-direction: column; gap: 16px; max-height: 400px; overflow-y: auto;">
    `;
    
    Object.entries(grouped).forEach(([day, events]) => {
        html += `
            <div class="calendar-day">
                <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: var(--accent-gold); margin-bottom: 8px;">
                    ${day}
                </div>
                <div style="display: flex; flex-direction: column; gap: 8px;">
        `;
        
        events.forEach(event => {
            const start = event.start.dateTime || event.start.date;
            const startDate = new Date(start);
            const isAllDay = !event.start.dateTime;
            
            const time = isAllDay ? 'All day' : startDate.toLocaleTimeString('en-ZA', { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: false 
            });
            
            // Determine event type/color
            let typeColor = 'var(--accent-gold)';
            let typeIcon = '📅';
            const summary = (event.summary || '').toLowerCase();
            
            if (summary.includes('meeting') || summary.includes('call')) {
                typeColor = 'var(--info)';
                typeIcon = '📞';
            } else if (summary.includes('deadline') || summary.includes('due')) {
                typeColor = 'var(--danger)';
                typeIcon = '⚠️';
            } else if (summary.includes('review') || summary.includes('check')) {
                typeColor = 'var(--warning)';
                typeIcon = '👁️';
            } else if (summary.includes('invoice') || summary.includes('payment')) {
                typeColor = 'var(--success)';
                typeIcon = '💰';
            }
            
            html += `
                <div class="calendar-event" style="
                    display: flex;
                    gap: 12px;
                    padding: 12px;
                    background: var(--grey-800);
                    border-radius: 8px;
                    border-left: 3px solid ${typeColor};
                    cursor: pointer;
                    transition: all 0.2s;
                " onmouseover="this.style.background='var(--grey-700)'" onmouseout="this.style.background='var(--grey-800)'"
                   onclick="window.open('${event.htmlLink}', '_blank')">
                    <div style="font-size: 16px;">${typeIcon}</div>
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                            ${event.summary || 'No title'}
                        </div>
                        <div style="font-size: 12px; color: var(--grey-500); margin-top: 2px;">
                            ${time}${event.location ? ` • ${event.location}` : ''}
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += '</div></div>';
    });
    
    html += '</div>';
    container.innerHTML = html;
}

// ============================================================
// SYNC FUNCTIONS
// ============================================================

async function syncCalendar() {
    toast('Syncing calendar...', 'info');
    
    const events = await fetchCalendarEvents(14);
    
    if (events.length > 0) {
        renderCalendarWidget();
        toast(`Synced ${events.length} events`, 'success');
    } else {
        toast('No events found or sync failed', 'warning');
    }
}

// Load cached events on startup
function loadCachedCalendarEvents() {
    const cached = localStorage.getItem('oracle_calendar_events');
    if (cached) {
        try {
            const { events, fetchedAt } = JSON.parse(cached);
            const age = Date.now() - fetchedAt;
            
            // Use cache if less than 30 minutes old
            if (age < 30 * 60 * 1000) {
                calendarEvents = events;
                console.log(`[Calendar] Loaded ${events.length} cached events`);
                return events;
            }
        } catch (e) {
            console.warn('[Calendar] Failed to load cache');
        }
    }
    return [];
}

// ============================================================
// INVOICE SYNC HELPERS
// ============================================================

// Match calendar events to invoices/projects
function matchEventsToInvoices(events, invoices) {
    const matches = [];
    
    events.forEach(event => {
        const summary = (event.summary || '').toLowerCase();
        
        // Look for invoice numbers in event title
        const invoiceMatch = summary.match(/inv[- ]?(\d+)/i) || summary.match(/#(\d+)/);
        if (invoiceMatch) {
            const invoice = invoices.find(inv => 
                inv.invoice_number?.includes(invoiceMatch[1]) ||
                inv.id?.toString() === invoiceMatch[1]
            );
            if (invoice) {
                matches.push({ event, invoice, type: 'invoice' });
            }
        }
        
        // Look for project names
        if (window.projects) {
            const project = window.projects.find(p => 
                summary.includes(p.name?.toLowerCase()) ||
                summary.includes(p.code?.toLowerCase())
            );
            if (project) {
                matches.push({ event, project, type: 'project' });
            }
        }
    });
    
    return matches;
}

// Create calendar event for invoice due date
async function createInvoiceDueEvent(invoice) {
    if (!invoice.due_date) return null;
    
    const session = await supabaseClient.auth.getSession();
    const accessToken = session?.data?.session?.provider_token;
    
    if (!accessToken) {
        console.warn('[Calendar] No access token for creating event');
        return null;
    }
    
    gapi.client.setToken({ access_token: accessToken });
    
    try {
        const response = await gapi.client.calendar.events.insert({
            calendarId: 'primary',
            resource: {
                summary: `💰 Invoice Due: ${invoice.invoice_number} - ${invoice.client_name}`,
                description: `Amount: ${invoice.currency || 'ZAR'} ${invoice.total?.toFixed(2) || invoice.amount?.toFixed(2)}\n\nOracle Invoice: ${invoice.id}`,
                start: {
                    date: invoice.due_date
                },
                end: {
                    date: invoice.due_date
                },
                reminders: {
                    useDefault: false,
                    overrides: [
                        { method: 'popup', minutes: 1440 }, // 1 day before
                        { method: 'popup', minutes: 60 }    // 1 hour before
                    ]
                },
                colorId: '11' // Red
            }
        });
        
        console.log('[Calendar] Created invoice due event:', response.result.id);
        toast('Added invoice due date to calendar', 'success');
        return response.result;
    } catch (error) {
        console.error('[Calendar] Failed to create event:', error);
        toast('Failed to add to calendar', 'error');
        return null;
    }
}

// Export for use
if (typeof window !== 'undefined') {
    window.initCalendar = initCalendar;
    window.fetchCalendarEvents = fetchCalendarEvents;
    window.renderCalendarWidget = renderCalendarWidget;
    window.syncCalendar = syncCalendar;
    window.loadCachedCalendarEvents = loadCachedCalendarEvents;
    window.createInvoiceDueEvent = createInvoiceDueEvent;
    window.calendarEvents = calendarEvents;
}
