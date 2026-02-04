# Oracle Dashboard 🔮

**Business Intelligence Platform for Exergy Designs**

A comprehensive dashboard for managing finances, projects, clients, invoices, and team collaboration with real-time sync and AI-powered insights.

![Version](https://img.shields.io/badge/version-2.0-blue)
![License](https://img.shields.io/badge/license-Private-red)
![Status](https://img.shields.io/badge/status-Production-green)

**🌐 Live Demo:** [oracle7.netlify.app](https://oracle7.netlify.app/)

---

## ✨ Features

### 💰 Financial Management
- **Invoice Tracking** - Create, manage, and track invoices with automatic calculations
- **Payment Reconciliation** - Match payments with invoices and track outstanding amounts
- **Transaction Import** - Import bank statements (Standard Bank CSV format)
- **Upwork Integration** - Track freelance earnings and client payments
- **Multi-Currency Support** - USD/ZAR with automatic conversion

### 📊 Project Management
- **Project Tracking** - Monitor active projects with status updates
- **Budget Allocation** - Set and track project budgets vs actual spend
- **Time Tracking** - Built-in time tracker with project assignment
- **Real-Time Sync** - Instant synchronization across all devices via Supabase

### 🤝 Team Collaboration
- **Fireflies.ai Integration** - Automatic meeting transcript import
- **Teammate Tracking** - Monitor team member participation and activity
- **Action Items** - Extract and track action items from meetings
- **Notice Board** - AI-powered suggestions for team members

### 🤖 AI Assistant
- **Claude-Powered Chat** - Context-aware business intelligence assistant
- **Meeting Context** - References Fireflies meeting data in conversations
- **Financial Insights** - Ask questions about revenue, expenses, and trends
- **Project Guidance** - Get recommendations based on meeting discussions

### 📈 Analytics
- **Revenue Visualization** - Charts and graphs for financial trends
- **Client Analytics** - Track profitability by client
- **Time Analytics** - Billable hours and productivity metrics
- **Transaction Categorization** - Automatic classification of bank transactions

---

## 🚀 Recent Updates (v2.0)

### All 5 Critical Fixes Implemented ✅

1. **CSV Parser Fix** - Now captures ALL transactions including the last row
2. **Fireflies Integration** - Complete meeting data with teammates and action items
3. **Real-Time Sync** - Supabase subscriptions for instant cross-device updates
4. **AI Enhancement** - Claude assistant now has full meeting context
5. **Budget Tracking** - Project budget allocation and spend tracking

---

## 🛠️ Tech Stack

- **Frontend:** Vanilla JavaScript, HTML5, CSS3
- **Backend:** Supabase (PostgreSQL + Real-time subscriptions)
- **AI:** Anthropic Claude API (Sonnet 4.5)
- **Integrations:**
  - Fireflies.ai GraphQL API
  - ClickUp API
  - Google Drive API
  - Yoco Payments API
- **Deployment:** Netlify
- **Charts:** Chart.js

---

## 📦 Installation

### Prerequisites
- Node.js (for local development)
- Supabase account
- Netlify account (for deployment)

### Quick Start

1. **Clone the repository:**
```bash
git clone https://github.com/Exer-G/oracle-dashboard.git
cd oracle-dashboard
```

2. **Set up API keys:**
```bash
cp data/api_keys.json.example data/api_keys.json
# Edit data/api_keys.json with your API keys
```

3. **Configure Supabase:**
   - Update `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `app.js`
   - Run the SQL schemas in `supabase-schema-v2.sql`

4. **Deploy to Netlify:**
```bash
netlify deploy --prod --dir .
```

5. **Open in browser:**
   - Visit your Netlify URL
   - Sign in with Google OAuth

---

## 🔑 Required API Keys

Create `data/api_keys.json` with:

```json
{
  "claude": "sk-ant-api03-...",        // Anthropic Claude API
  "yocoSecret": "sk_live_...",         // Yoco payment gateway
  "yocoPublic": "pk_live_...",         // Yoco public key
  "yocoLive": "yoco_live_..."          // Yoco live key
}
```

Also configure in `config.js`:
- **Fireflies API Key** - For meeting integration
- **ClickUp API Token** - For task management
- **Google OAuth Client ID** - For authentication

---

## 📊 Database Schema

The system uses Supabase PostgreSQL with the following tables:

- **clients** - Customer/client information
- **projects** - Project tracking with budget allocation
- **invoices** - Invoice management with line items
- **payments** - Payment records and reconciliation
- **transactions** - Bank transaction imports
- **time_entries** - Time tracking data

Run `supabase-schema-v2.sql` to set up the database.

---

## 🎨 Features Deep Dive

### CSV Import
Supports two formats:
1. **Standard Bank Statements** - Auto-categorizes transactions
2. **Upwork Earnings** - Tracks freelance income by client

### Fireflies Integration
```javascript
// Fetches meetings with full context
const fireflies = new FirefliesIntegration(apiKey);
await fireflies.fetchMeetings(50);
const teammates = fireflies.teammates;
const meetings = fireflies.meetings;
```

### Real-Time Sync
```javascript
// Automatic updates across all devices
setupRealtimeSubscriptions();
// Projects, clients, and invoices sync instantly
```

### AI Chat
The Claude assistant has access to:
- All financial data (invoices, payments, transactions)
- Complete meeting history and transcripts
- Team member activity and action items
- Project status and allocations

---

## 🔒 Security

- **OAuth Authentication** - Google Sign-In only
- **Row Level Security** - Supabase RLS policies per user
- **API Key Protection** - Never commit `api_keys.json` to git
- **HTTPS Only** - All communication encrypted
- **Secret Scanning** - GitHub push protection enabled

---

## 🚧 Development

### Project Structure
```
oracle-dashboard/
├── index.html              # Main UI
├── app.js                  # Core application logic
├── fireflies.js            # Fireflies.ai integration
├── csv-parser.js           # Transaction import logic
├── data-loader.js          # Preloaded data management
├── config.js               # Configuration and API keys
├── styles.css              # UI styling
├── data/
│   ├── clients.json        # Sample client data
│   ├── invoices.json       # Sample invoice data
│   └── api_keys.json       # API credentials (gitignored)
├── netlify/functions/      # Serverless functions
└── supabase-*.sql          # Database schemas
```

### Local Development
```bash
# Serve locally
python -m http.server 8000
# or
npx live-server
```

### Testing
- Open console and check for `[Oracle] Ready` message
- Verify Fireflies loading: `[Fireflies] Loaded X meetings`
- Test real-time sync by opening in two browser windows

---

## 📖 Usage Guide

### First Time Setup
1. Sign in with Google (use `shuaib@exergydesigns.com`)
2. Go to **Settings** and configure API keys
3. Upload CSV files via **Upload** page
4. Create clients in **Clients** page
5. Generate invoices in **Invoices** page

### Daily Usage
- **Dashboard** - Quick overview of finances
- **Time Tracker** - Log hours to projects
- **AI Assistant** - Ask questions about business data
- **Meetings** - Review Fireflies transcripts

---

## 🤝 Contributing

This is a private repository for Exergy Designs. Internal contributions welcome!

### Development Workflow
1. Create feature branch: `git checkout -b feature/new-feature`
2. Make changes and test
3. Commit: `git commit -m "Add new feature"`
4. Push: `git push origin feature/new-feature`
5. Deploy to Netlify for testing

---

## 📝 License

**Private** - © 2026 Exergy Designs. All rights reserved.

---

## 🙏 Credits

Built by **Oracle AI** for **Exergy Designs**

**Powered by:**
- [Supabase](https://supabase.com/) - Database and auth
- [Anthropic Claude](https://www.anthropic.com/) - AI assistant
- [Fireflies.ai](https://fireflies.ai/) - Meeting intelligence
- [Netlify](https://www.netlify.com/) - Hosting and deployment

---

## 📞 Support

For issues or questions, contact:
- **Email:** shuaib@exergydesigns.com
- **GitHub Issues:** [Create an issue](https://github.com/Exer-G/oracle-dashboard/issues)

---

**⚡ Deployed at:** [oracle7.netlify.app](https://oracle7.netlify.app/)

*Last updated: February 5, 2026*
