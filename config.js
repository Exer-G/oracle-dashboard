// Oracle Dashboard Configuration
const ORACLE_CONFIG = {
  // ClickUp Configuration
  clickup: {
    apiKey: 'pk_254571368_IDVBGBUNBFLCM1D5BVZ49UIDWJQK70M4',
    exergyTeamId: '90121341501', // Only fetch from Exergy Designs
    // Other teams (excluded): ABR Group: 90121337793, Air Battery: 90121324773
  },
  
  // Fireflies Configuration
  fireflies: {
    apiKey: 'd356c451-294e-4aac-8182-d1516e4d8890',
    graphqlEndpoint: 'https://api.fireflies.ai/graphql'
  },
  
  // Yoco Payment Configuration
  yoco: {
    publicKey: 'pk_live_ed5bfee0TqjEHBb898a2',
    defaultPaymentLink: 'https://pay.yoco.com/r/2QzZOv'
  },
  
  // Company Info
  company: {
    name: 'Exergy Designs',
    email: 'shuaib@exergydesigns.com',
    bank: 'Standard Bank',
    accountNum: '10195499563',
    branchCode: '051001',
    swift: 'SBZAZAJJ',
  },
  
  // Gateway Configuration
  // Uses ngrok tunnel for remote access
  gateway: {
    url: 'wss://nonphrenetic-filiberto-unthoughtful.ngrok-free.dev',
    token: localStorage.getItem('oracle_gateway_token') || 'fc2faa3cea4bff794483f41b0249f057d935663896051aa5'
  },
  
  // Financial Data Paths (local references)
  financials: {
    upworkCsv: 'data/upwork earnings.csv',
    businessCsv: 'data/business account.csv',
    personalCsv: 'data/Personal_Account_6_Months.csv'
  },
  
  // Theme
  theme: {
    primary: '#c9a962',      // Exergy gold
    primaryBright: '#e8c877',
    copper: '#b87333',
    background: '#0a0a0f',
    card: '#12121a',
    elevated: '#1a1a25'
  }
};

// Export for use
if (typeof window !== 'undefined') {
  window.ORACLE_CONFIG = ORACLE_CONFIG;
}
