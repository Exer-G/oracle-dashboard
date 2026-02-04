/**
 * Oracle Dashboard - ClickUp Integration
 * Fetches team members, workspaces, and tasks from ClickUp API
 */

const CLICKUP_API_BASE = 'https://api.clickup.com/api/v2';

class ClickUpIntegration {
    constructor() {
        this.apiKey = null;
        this.teams = [];
        this.members = [];
        this.spaces = [];
        this.connected = false;
    }
    
    async init() {
        // Load API key from settings
        this.apiKey = localStorage.getItem('clickup_api_key') || window.ORACLE_SETTINGS?.clickup_api_key;
        
        if (this.apiKey) {
            await this.testConnection();
        }
    }
    
    setApiKey(key) {
        this.apiKey = key;
        localStorage.setItem('clickup_api_key', key);
    }
    
    async testConnection() {
        try {
            const response = await this.request('/user');
            if (response.user) {
                this.connected = true;
                console.log('[ClickUp] Connected as:', response.user.username);
                return { success: true, user: response.user };
            }
            return { success: false, error: 'Invalid response' };
        } catch (e) {
            this.connected = false;
            console.error('[ClickUp] Connection failed:', e);
            return { success: false, error: e.message };
        }
    }
    
    async request(endpoint, options = {}) {
        if (!this.apiKey) {
            throw new Error('ClickUp API key not configured');
        }
        
        const response = await fetch(`${CLICKUP_API_BASE}${endpoint}`, {
            ...options,
            headers: {
                'Authorization': this.apiKey,
                'Content-Type': 'application/json',
                ...options.headers
            }
        });
        
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`ClickUp API error: ${response.status} - ${error}`);
        }
        
        return response.json();
    }
    
    // Get all teams/workspaces
    async getTeams() {
        const data = await this.request('/team');
        this.teams = data.teams || [];
        return this.teams;
    }
    
    // Get team members from a workspace
    async getTeamMembers(teamId) {
        if (!teamId && this.teams.length) {
            teamId = this.teams[0].id;
        }
        
        const team = await this.request(`/team/${teamId}`);
        this.members = team.team?.members || [];
        
        // Format members for Oracle
        return this.members.map(m => ({
            id: m.user.id,
            email: m.user.email,
            name: m.user.username,
            profilePicture: m.user.profilePicture,
            role: m.user.role === 1 ? 'admin' : 'member',
            initials: m.user.initials,
            color: m.user.color
        }));
    }
    
    // Get spaces in a team
    async getSpaces(teamId) {
        if (!teamId && this.teams.length) {
            teamId = this.teams[0].id;
        }
        
        const data = await this.request(`/team/${teamId}/space`);
        this.spaces = data.spaces || [];
        return this.spaces;
    }
    
    // Get folders in a space
    async getFolders(spaceId) {
        const data = await this.request(`/space/${spaceId}/folder`);
        return data.folders || [];
    }
    
    // Get lists in a folder or space
    async getLists(folderId) {
        const data = await this.request(`/folder/${folderId}/list`);
        return data.lists || [];
    }
    
    async getSpaceLists(spaceId) {
        const data = await this.request(`/space/${spaceId}/list`);
        return data.lists || [];
    }
    
    // Get tasks from a list
    async getTasks(listId, options = {}) {
        const params = new URLSearchParams({
            archived: 'false',
            include_closed: options.includeClosed ? 'true' : 'false',
            ...options
        });
        
        const data = await this.request(`/list/${listId}/task?${params}`);
        return data.tasks || [];
    }
    
    // Get tasks assigned to a specific user
    async getTasksByAssignee(teamId, userId) {
        const params = new URLSearchParams({
            assignees: [userId],
            include_closed: 'false'
        });
        
        const data = await this.request(`/team/${teamId}/task?${params}`);
        return data.tasks || [];
    }
    
    // Get time tracked on tasks
    async getTimeEntries(teamId, options = {}) {
        const params = new URLSearchParams({
            start_date: options.startDate || Date.now() - (7 * 24 * 60 * 60 * 1000), // Last 7 days
            end_date: options.endDate || Date.now()
        });
        
        if (options.assignee) {
            params.append('assignee', options.assignee);
        }
        
        const data = await this.request(`/team/${teamId}/time_entries?${params}`);
        return data.data || [];
    }
    
    // Create a task
    async createTask(listId, task) {
        return this.request(`/list/${listId}/task`, {
            method: 'POST',
            body: JSON.stringify(task)
        });
    }
    
    // Update a task
    async updateTask(taskId, updates) {
        return this.request(`/task/${taskId}`, {
            method: 'PUT',
            body: JSON.stringify(updates)
        });
    }
    
    // Add time entry
    async addTimeEntry(teamId, entry) {
        return this.request(`/team/${teamId}/time_entries`, {
            method: 'POST',
            body: JSON.stringify(entry)
        });
    }
    
    // Get workspace summary
    async getWorkspaceSummary(teamId) {
        if (!teamId && this.teams.length) {
            teamId = this.teams[0].id;
        }
        
        const [team, spaces] = await Promise.all([
            this.request(`/team/${teamId}`),
            this.getSpaces(teamId)
        ]);
        
        return {
            team: team.team,
            members: team.team?.members || [],
            spaces: spaces,
            memberCount: team.team?.members?.length || 0,
            spaceCount: spaces.length
        };
    }
}

// Create global instance
window.clickUp = new ClickUpIntegration();

// Export for use in app.js
window.ClickUpIntegration = ClickUpIntegration;

console.log('[ClickUp] Integration module loaded');
