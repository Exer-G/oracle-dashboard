/**
 * Oracle Dashboard - Fireflies.ai Integration
 * Handles meeting data, teammates, and AI-powered suggestions
 */

class FirefliesIntegration {
    constructor(apiKey) {
        // Hardcoded API key as fallback
        this.apiKey = apiKey || 'd356c451-294e-4aac-8182-d1516e4d8890';
        this.endpoint = '/.netlify/functions/fireflies-proxy';
        this.teammates = [];
        this.meetings = [];
        this.transcripts = new Map();
    }
    
    // ============================================================
    // GraphQL Queries (via Netlify proxy to avoid CORS)
    // ============================================================
    
    async query(graphqlQuery, variables = {}) {
        try {
            const response = await fetch(this.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': this.apiKey
                },
                body: JSON.stringify({
                    query: graphqlQuery,
                    variables
                })
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('[Fireflies] API error:', response.status, errorText);
                throw new Error(`Fireflies API error: ${response.status}`);
            }
            
            const data = await response.json();
            if (data.errors) {
                console.error('[Fireflies] GraphQL errors:', data.errors);
                throw new Error(data.errors[0]?.message || 'GraphQL query failed');
            }
            
            return data.data;
        } catch (error) {
            console.error('[Fireflies] Query error:', error);
            throw error;
        }
    }
    
    // ============================================================
    // Fetch Meetings & Transcripts
    // ============================================================
    
    async fetchMeetings(limit = 50) {
        const query = `
            query Transcripts($limit: Int!) {
                transcripts(limit: $limit) {
                    id
                    title
                    date
                    duration
                    organizer_email
                    participants
                    meeting_attendees {
                        displayName
                        email
                    }
                    summary {
                        keywords
                        action_items
                        overview
                        shorthand_bullet
                    }
                    sentences {
                        text
                        speaker_name
                        start_time
                    }
                }
            }
        `;
        
        const data = await this.query(query, { limit });
        this.meetings = data.transcripts || [];
        
        // Extract all teammates from meetings
        this.extractTeammates();
        
        // Store transcripts
        this.meetings.forEach(meeting => {
            this.transcripts.set(meeting.id, meeting);
        });
        
        console.log(`[Fireflies] Loaded ${this.meetings.length} meetings, ${this.teammates.length} teammates`);
        return this.meetings;
    }
    
    // ============================================================
    // Extract Teammates
    // ============================================================
    
    extractTeammates() {
        const teammateMap = new Map();
        
        this.meetings.forEach(meeting => {
            // From meeting_attendees
            if (meeting.meeting_attendees) {
                meeting.meeting_attendees.forEach(attendee => {
                    const email = attendee.email?.toLowerCase() || '';
                    const name = attendee.displayName || attendee.email || 'Unknown';
                    
                    if (email && !teammateMap.has(email)) {
                        teammateMap.set(email, {
                            name,
                            email,
                            meetingCount: 0,
                            lastSeen: null,
                            actionItems: []
                        });
                    }
                    
                    if (email) {
                        const teammate = teammateMap.get(email);
                        teammate.meetingCount++;
                        
                        const meetingDate = new Date(meeting.date);
                        if (!teammate.lastSeen || meetingDate > teammate.lastSeen) {
                            teammate.lastSeen = meetingDate;
                        }
                    }
                });
            }
            
            // From participants array (backup)
            if (meeting.participants) {
                meeting.participants.forEach(email => {
                    const cleanEmail = email.toLowerCase();
                    if (!teammateMap.has(cleanEmail)) {
                        teammateMap.set(cleanEmail, {
                            name: email.split('@')[0],
                            email: cleanEmail,
                            meetingCount: 1,
                            lastSeen: new Date(meeting.date),
                            actionItems: []
                        });
                    }
                });
            }
        });
        
        this.teammates = Array.from(teammateMap.values())
            .filter(t => t.email && !t.email.includes('noreply'))
            .sort((a, b) => b.meetingCount - a.meetingCount);
        
        return this.teammates;
    }
    
    // ============================================================
    // Get Action Items for Teammate
    // ============================================================
    
    getActionItemsForTeammate(email) {
        const actions = [];
        
        this.meetings.forEach(meeting => {
            if (!meeting.summary?.action_items) return;
            
            // Check if teammate was in this meeting
            const wasPresent = meeting.meeting_attendees?.some(a => 
                a.email?.toLowerCase() === email.toLowerCase()
            ) || meeting.participants?.some(p => 
                p.toLowerCase() === email.toLowerCase()
            );
            
            if (wasPresent) {
                // action_items can be string or array
                const items = Array.isArray(meeting.summary.action_items) 
                    ? meeting.summary.action_items 
                    : (typeof meeting.summary.action_items === 'string' 
                        ? [meeting.summary.action_items] 
                        : []);
                
                items.forEach(item => {
                    if (item && item.trim()) {
                        actions.push({
                            meetingId: meeting.id,
                            meetingTitle: meeting.title,
                            meetingDate: meeting.date,
                            action: item,
                            assignedTo: this.extractAssignee(item) || email
                        });
                    }
                });
            }
        });
        
        return actions;
    }
    
    extractAssignee(actionItem) {
        // Try to extract assignee from action item text
        // Patterns: "@name", "John will", "assigned to Sarah"
        const patterns = [
            /@(\w+)/,
            /(\w+)\s+will\s+/i,
            /assigned\s+to\s+(\w+)/i,
            /(\w+)\s+to\s+/i
        ];
        
        for (const pattern of patterns) {
            const match = actionItem.match(pattern);
            if (match) return match[1];
        }
        
        return null;
    }
    
    // ============================================================
    // AI Suggestions for Teammates
    // ============================================================
    
    async generateSuggestions(claudeApiKey) {
        if (!claudeApiKey) {
            console.warn('[Fireflies] No Claude API key provided');
            return [];
        }
        
        const suggestions = [];
        
        for (const teammate of this.teammates) {
            const actionItems = this.getActionItemsForTeammate(teammate.email);
            const recentMeetings = this.getMeetingsForTeammate(teammate.email, 5);
            
            if (recentMeetings.length === 0) continue;
            
            // Build context
            const context = {
                name: teammate.name,
                email: teammate.email,
                recentMeetings: recentMeetings.map(m => ({
                    title: m.title,
                    date: m.date,
                    keywords: m.summary?.keywords,
                    overview: m.summary?.overview
                })),
                actionItems: actionItems.map(a => a.action),
                totalMeetings: teammate.meetingCount
            };
            
            suggestions.push({
                teammate: teammate.email,
                name: teammate.name,
                context,
                message: this.generateSimpleSuggestion(context)
            });
        }
        
        return suggestions;
    }
    
    generateSimpleSuggestion(context) {
        const { name, recentMeetings, actionItems } = context;
        
        if (actionItems.length > 0) {
            return `${name} has ${actionItems.length} pending action item${actionItems.length > 1 ? 's' : ''} from recent meetings. Top priority: "${actionItems[0]}"`;
        }
        
        if (recentMeetings.length > 0) {
            const latest = recentMeetings[0];
            const keywords = latest.keywords?.slice(0, 3).join(', ') || 'project updates';
            return `${name} recently discussed: ${keywords}. Follow up on action items from "${latest.title}".`;
        }
        
        return `${name} attended ${context.totalMeetings} meetings. Check in on progress.`;
    }
    
    getMeetingsForTeammate(email, limit = 10) {
        return this.meetings
            .filter(meeting => 
                meeting.meeting_attendees?.some(a => 
                    a.email?.toLowerCase() === email.toLowerCase()
                ) || meeting.participants?.some(p => 
                    p.toLowerCase() === email.toLowerCase()
                )
            )
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, limit);
    }
    
    // ============================================================
    // Get Full Meeting Context for AI
    // ============================================================
    
    getMeetingContext(meetingId) {
        const meeting = this.transcripts.get(meetingId);
        if (!meeting) return null;
        
        return {
            id: meeting.id,
            title: meeting.title,
            date: meeting.date,
            duration: meeting.duration,
            organizer: meeting.organizer_email,
            attendees: meeting.meeting_attendees?.map(a => a.displayName) || [],
            summary: meeting.summary?.overview,
            keywords: meeting.summary?.keywords,
            actionItems: meeting.summary?.action_items,
            transcript: meeting.sentences?.map(s => 
                `[${s.speaker_name}]: ${s.text}`
            ).join('\n')
        };
    }
    
    getAllMeetingsContext() {
        return this.meetings.map(m => ({
            id: m.id,
            title: m.title,
            date: m.date,
            attendees: m.meeting_attendees?.map(a => a.displayName) || [],
            summary: m.summary?.overview,
            keywords: m.summary?.keywords,
            actionItems: m.summary?.action_items
        }));
    }
    
    // ============================================================
    // Search Meetings
    // ============================================================
    
    searchMeetings(query) {
        const lowerQuery = query.toLowerCase();
        return this.meetings.filter(meeting => {
            const searchText = [
                meeting.title,
                meeting.summary?.overview,
                meeting.summary?.keywords?.join(' '),
                meeting.meeting_attendees?.map(a => a.displayName).join(' ')
            ].join(' ').toLowerCase();
            
            return searchText.includes(lowerQuery);
        });
    }
}

// Export
if (typeof window !== 'undefined') {
    window.FirefliesIntegration = FirefliesIntegration;
}

console.log('[Oracle] Fireflies integration loaded');
