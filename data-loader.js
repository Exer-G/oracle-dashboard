/**
 * Oracle Dashboard - Data Loader
 * Real data only - no made up projects
 * Last sync: 2026-02-04
 */

window.ORACLE_PRELOAD = {};

// Admin emails with full access
window.ORACLE_ADMIN_EMAILS = ['shuaib@exergydesigns.com', 'oracle@exergydesigns.com'];

// ============================================================
// CLIENTS DATA (from invoices.json)
// ============================================================
window.ORACLE_PRELOAD.clients = [
    { id: "1767583962814", name: "Jason Dispenza", company: "Edge Energy", email: "jasond@edge-gogreen.com", phone: "888-586-3343" },
    { id: "1767647113580", name: "Amir", company: "Trulap fitness", phone: "+971 58 555 2995" },
    { id: "1767964384021", name: "Ann Kelly", company: "Group ABR. SA", email: "annkelly_b@hotmail.com", phone: "+1 (514) 654-4784" },
    { id: "1768000001", name: "Aster De Vlack", company: "Masterworkx bv", email: "Contact@masterworkx.com", phone: "+32 472 66 65 89", address: "Jan Baptiste boterdaelestraat 3 001 gent belgium" },
    { id: "1768555770707", name: "Justin Eugene Evans", company: "EvansWerks", email: "justin.evans@evanswerks.com", phone: "+1 (505) 803-5305" },
    { id: "1768606859003", name: "Dr Zieg Webber", company: "Orthoglide", email: "ziegwebber@gmail.com", phone: "+27 82 444 7547", address: "119 Bram Fischer Dr, Ferndale, Randburg, Gauteng, 2194, ZAF" },
    { id: "1769561878272", name: "Ethan Lai", company: "Eli Projects" },
    { id: "1769692042149", name: "Tim Horlick" },
    { id: "1769692839091", name: "Dan Harbut", company: "American Backflow & Fire Prevention", phone: "+1 (847) 875-1301" }
];

// ============================================================
// PROJECTS - Empty until real projects are added
// ============================================================
window.ORACLE_PRELOAD.projects = [];

// ============================================================
// INVOICES DATA (from exerinv.netlify.app)
// ============================================================
window.ORACLE_PRELOAD.invoices = [
    // PENDING
    { id: "1769692839091", invoice_number: "INV-2026-01-236", date: "2026-01-29", client_name: "Dan Harbut", client_company: "American Backflow & Fire Prevention", currency: "USD", subtotal: 1044, zar_total: 16704, status: "pending", payment_method: "yoco" },
    { id: "1769691955312", invoice_number: "INV-2026-01-601", date: "2026-01-29", client_name: "Aster De Vlack", client_company: "Masterworkx bv", currency: "USD", subtotal: 950.25, zar_total: 15204, status: "pending" },
    { id: "1769691939904", invoice_number: "INV-2026-01-618", date: "2026-01-29", client_name: "Tim Horlick", currency: "USD", subtotal: 1599.75, zar_total: 25596, status: "pending" },
    { id: "1769691924494", invoice_number: "INV-2026-01-628", date: "2026-01-29", client_name: "Justin Eugene Evans", client_company: "EvansWerks", currency: "USD", subtotal: 4000, zar_total: 64000, status: "pending" },
    { id: "1768607028058", invoice_number: "INV-2026-01-198", date: "2026-01-16", client_name: "Dr Zieg Webber", client_company: "Orthoglide", currency: "ZAR", subtotal: 37400, zar_total: 37400, status: "pending" },
    { id: "1768599155806", invoice_number: "INV-2026-01-105", date: "2026-01-16", client_name: "Ann Kelly", client_company: "Group ABR. SA", currency: "USD", subtotal: 1620, zar_total: 26730, status: "pending" },
    // PAID
    { id: "1769561878273", invoice_number: "INV-2026-01-660", date: "2026-01-28", client_name: "Ethan Lai", client_company: "Eli Projects", currency: "USD", subtotal: 240, zar_total: 3960, status: "paid" },
    { id: "1768606651179", invoice_number: "INV-2026-01-463", date: "2026-01-16", client_name: "Aster De Vlack", client_company: "Masterworkx bv", currency: "USD", subtotal: 950, zar_total: 15675, status: "paid" },
    { id: "1768559165692", invoice_number: "INV-2026-01-757", date: "2026-01-16", client_name: "Ann Kelly", client_company: "Group ABR. SA", currency: "USD", subtotal: 2380, zar_total: 44030, status: "paid" },
    { id: "1768555995376", invoice_number: "INV-2026-01-556", date: "2026-01-16", client_name: "Justin Eugene Evans", client_company: "EvansWerks", currency: "ZAR", subtotal: 11262.98, zar_total: 11262.98, status: "paid" },
    { id: "1767964437916", invoice_number: "INV-2026-01-054", date: "2026-01-09", client_name: "Ann Kelly", client_company: "Group ABR. SA", currency: "USD", subtotal: 2000, zar_total: 33520, status: "paid" },
    { id: "1767964384021", invoice_number: "INV-2026-01-143", date: "2026-01-09", client_name: "Ann Kelly", client_company: "Group ABR. SA", currency: "USD", subtotal: 2176, zar_total: 36469.76, status: "paid" }
];

// ============================================================
// TEAM MEMBERS (Real team)
// ============================================================
window.ORACLE_PRELOAD.team = [
    { id: 'shuaib', email: 'shuaib@exergydesigns.com', name: 'Shuaib Badat', role: 'admin', title: 'Founder & Lead Engineer', hourlyRate: 75, currency: 'USD', status: 'active' },
    { id: 'oracle', email: 'oracle@exergydesigns.com', name: 'Oracle', role: 'admin', title: 'AI Assistant', hourlyRate: 0, currency: 'USD', status: 'active' },
    { id: 'shuaib-personal', email: 'shuaibnbadat@gmail.com', name: 'Shuaib Badat', role: 'freelancer', title: 'Founder (Personal Account)', hourlyRate: 75, currency: 'USD', status: 'active' },
    { id: 'ebrahim', email: 'ebrahim@exergydesigns.com', name: 'Ebrahim Malick', role: 'freelancer', title: 'Engineer', hourlyRate: 350, currency: 'ZAR', status: 'active' },
    { id: 'yusuf-m', email: 'yusuf.moola@exergydesigns.com', name: 'Yusuf Moola', role: 'freelancer', title: 'Engineer', hourlyRate: 350, currency: 'ZAR', status: 'active' },
    { id: 'bogdan', email: 'bogdan@exergydesigns.com', name: 'Bogdan Dirlosan', role: 'freelancer', title: 'CAD Specialist', hourlyRate: 25, currency: 'USD', status: 'active' },
    { id: 'yusuf-e', email: 'yusuf.essa@exergydesigns.com', name: 'Yusuf Essa', role: 'freelancer', title: 'Engineer', hourlyRate: 350, currency: 'ZAR', status: 'active' },
    { id: 'ismaeel', email: 'ismaeel@exergydesigns.com', name: 'Ismaeel Motala', role: 'freelancer', title: 'Engineer', hourlyRate: 350, currency: 'ZAR', status: 'active' }
];

// ============================================================
// ALLOCATIONS - Empty until assigned
// ============================================================
window.ORACLE_PRELOAD.allocations = [];

// ============================================================
// UPWORK EARNINGS (Last updated: 2026-02-05)
// ============================================================
window.ORACLE_PRELOAD.upworkEarnings = [
    // February 2026
    { date: '2026-02-04', client: 'Smartmirror LLC', amount: 80.00, hours: 1.00 },
    { date: '2026-02-04', client: 'Wes Lovegrove', amount: 270.00, hours: 6.00 },
    { date: '2026-02-04', client: 'ABFP', amount: 1258.67, hours: 19.67 },
    { date: '2026-02-04', client: 'EDGE Energy', amount: 1426.67, hours: 17.83 },
    { date: '2026-02-04', client: 'Avi Greenboim', amount: 200.00, hours: 4.00 },
    // January 2026
    { date: '2026-01-23', client: 'Wes Lovegrove', amount: 195.00, hours: 4.33 },
    { date: '2026-01-23', client: 'ABFP', amount: 1280.00, hours: 20.00 },
    { date: '2026-01-23', client: 'EDGE Energy', amount: 1600.00, hours: 20.00 },
    { date: '2026-01-23', client: 'Avi Greenboim', amount: 91.67, hours: 1.83 },
    { date: '2026-01-21', client: 'Will', amount: 660.00, hours: 12.00 },
    { date: '2026-01-21', client: 'Wes Lovegrove', amount: 352.50, hours: 7.83 },
    { date: '2026-01-21', client: 'ABFP', amount: 650.67, hours: 10.17 },
    { date: '2026-01-21', client: 'EDGE Energy', amount: 1600.00, hours: 20.00 },
    { date: '2026-01-21', client: 'Avi Greenboim', amount: 33.33, hours: 0.67 },
    { date: '2026-01-14', client: 'Will', amount: 265.83, hours: 4.83 },
    { date: '2026-01-14', client: 'Justin K', amount: 240.00, hours: 3.00 },
    { date: '2026-01-14', client: 'Wes Lovegrove', amount: 247.50, hours: 5.50 },
    { date: '2026-01-14', client: 'ABFP', amount: 821.33, hours: 12.83 },
    { date: '2026-01-14', client: 'EDGE Energy', amount: 853.33, hours: 10.67 },
    { date: '2026-01-10', client: 'Tarek Sibai', amount: 40.00, hours: 0.63 },
    { date: '2026-01-07', client: 'Wes Lovegrove', amount: 360.00, hours: 8.00 },
    { date: '2026-01-07', client: 'ABFP', amount: 1258.67, hours: 19.67 },
    { date: '2026-01-07', client: 'Johan Neethling', amount: 470.00, hours: 7.83 },
    { date: '2026-01-07', client: 'EDGE Energy', amount: 1453.33, hours: 18.17 },
    { date: '2026-01-03', client: 'Yusrie Lombard', amount: 2000.00, hours: 26.67 },
    // December 2025
    { date: '2025-12-31', client: 'Adel Alh', amount: 133.33, hours: 1.67 },
    { date: '2025-12-26', client: 'ABFP', amount: 1269.33, hours: 19.83 },
    { date: '2025-12-26', client: 'Johan Neethling', amount: 540.00, hours: 9.00 },
    { date: '2025-12-26', client: 'EDGE Energy', amount: 1573.33, hours: 19.67 },
    { date: '2025-12-26', client: 'Persy Booths UG', amount: 250.00, hours: 4.17 }
];

// Calculate Upwork totals from earnings data
(function computeUpworkTotals() {
    const earnings = window.ORACLE_PRELOAD.upworkEarnings || [];
    if (!earnings.length) return;

    const upworkFeeRate = 0.10; // 10% Upwork fee
    const vatRate = 0.15; // 15% VAT on fees

    let totalGross = 0;
    let totalHours = 0;
    const byClient = {};
    const byMonth = {};

    earnings.forEach(e => {
        const gross = e.amount || 0;
        const fee = gross * upworkFeeRate;
        const vat = fee * vatRate;
        const net = gross - fee - vat;
        const hours = e.hours || (gross / 64); // Estimate hours at $64/hr if not provided

        totalGross += gross;
        totalHours += hours;

        // By client
        const client = e.client || 'Unknown';
        if (!byClient[client]) byClient[client] = { gross: 0, net: 0, hours: 0 };
        byClient[client].gross += gross;
        byClient[client].net += net;
        byClient[client].hours += hours;

        // By month
        const month = e.date ? e.date.substring(0, 7) : 'unknown';
        if (!byMonth[month]) byMonth[month] = { gross: 0, net: 0, hours: 0 };
        byMonth[month].gross += gross;
        byMonth[month].net += net;
        byMonth[month].hours += hours;
    });

    const totalFees = totalGross * upworkFeeRate;
    const totalVAT = totalFees * vatRate;
    const totalNet = totalGross - totalFees - totalVAT;

    window.ORACLE_PRELOAD.upworkTotals = {
        totalGross,
        totalNet,
        totalHours,
        totalFees,
        totalVAT,
        byClient,
        byMonth,
        total: totalGross
    };

    // Also add project/type/net fields to earnings for display
    window.ORACLE_PRELOAD.upworkEarnings = earnings.map(e => ({
        ...e,
        project: e.project || (e.client || 'Unknown') + ' work',
        type: e.type || 'Hourly',
        hours: e.hours || (e.amount / 64),
        net: (e.amount || 0) * (1 - upworkFeeRate - upworkFeeRate * vatRate)
    }));
})();

// Calculate totals
const pendingInvoices = window.ORACLE_PRELOAD.invoices.filter(i => i.status === 'pending');
const paidInvoices = window.ORACLE_PRELOAD.invoices.filter(i => i.status === 'paid');

window.ORACLE_PRELOAD.invoiceTotals = {
    totalPending: pendingInvoices.reduce((sum, i) => sum + i.zar_total, 0),
    totalPaid: paidInvoices.reduce((sum, i) => sum + i.zar_total, 0),
    countPending: pendingInvoices.length,
    countPaid: paidInvoices.length
};

// ============================================================
// UPWORK OPPORTUNITIES (Auto-synced)
// ============================================================
window.ORACLE_PRELOAD.upworkOpportunities = [
    {
        "title": "Experienced CAD/Mechanical Designer for Precision Enclosure",
        "hourlyRate": 90,
        "description": "Create premium two-piece precision enclosure with DFM standards. CAD expertise required.",
        "clientRating": 0,
        "clientPaymentVerified": true,
        "clientReviews": 0,
        "clientSpent": 0,
        "proposals": "Less than 5",
        "url": "https://www.upwork.com/jobs/Experienced-CAD-Mechanical-Designer-for-Precision-Enclosure",
        "posted": "5 minutes ago",
        "scannedAt": "2026-02-05T22:26:47.154Z",
        "score": 6
    },
    {
        "title": "Product Design and Fabrication Documentation Specialist",
        "hourlyRate": 90,
        "description": "Industrial designer / CAD specialist for modular architectural system. Manufacturing-ready drawings required.",
        "clientRating": 0,
        "clientPaymentVerified": true,
        "clientReviews": 0,
        "clientSpent": 0,
        "proposals": "Less than 5",
        "url": "https://www.upwork.com/jobs/Product-Design-and-Fabrication-Documentation-Specialist",
        "posted": "yesterday",
        "scannedAt": "2026-02-05T22:26:47.154Z",
        "score": 7
    }
];

console.log('[Oracle] Data loaded:', {
    clients: window.ORACLE_PRELOAD.clients.length,
    invoices: window.ORACLE_PRELOAD.invoices.length,
    team: window.ORACLE_PRELOAD.team.length,
    pending: 'R' + window.ORACLE_PRELOAD.invoiceTotals.totalPending.toLocaleString()
});
