const fs = require('fs');
const path = require('path');

const csvPath = 'C:\\Users\\shuai\\OneDrive\\Documents\\001 Exergy Designs\\001 company resources\\001 Exergy Tools\\fin\\upwork earnings.csv';
const csv = fs.readFileSync(csvPath, 'utf-8');

const lines = csv.split('\n').slice(1); // Skip header
const earnings = [];

lines.forEach(line => {
    if (!line.trim()) return;
    
    // Simple CSV parsing (handles quoted fields)
    const matches = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g);
    if (!matches || matches.length < 16) return;
    
    const date = matches[0].replace(/"/g, '').trim();
    const txType = matches[2].replace(/"/g, '').trim();
    const client = matches[11].replace(/"/g, '').trim();
    const amount = parseFloat(matches[15].replace(/"/g, '').replace(/,/g, ''));
    const desc2 = matches[6].replace(/"/g, '').trim();
    
    if (txType === 'Hourly' && !isNaN(amount) && amount > 0) {
        // Extract hours from description
        const hoursMatch = desc2.match(/([\d.]+)\s+hours?\s+x/i);
        const hours = hoursMatch ? parseFloat(hoursMatch[1]) : amount / 64;
        
        earnings.push({
            date: new Date(date).toISOString().split('T')[0],
            client,
            amount,
            hours
        });
    }
});

// Sort by date descending
earnings.sort((a, b) => new Date(b.date) - new Date(a.date));

// Output as JavaScript array for data-loader.js
console.log('window.ORACLE_PRELOAD.upworkEarnings = [');
earnings.forEach((e, i) => {
    const comma = i < earnings.length - 1 ? ',' : '';
    console.log(`    { date: '${e.date}', client: '${e.client}', amount: ${e.amount.toFixed(2)}, hours: ${e.hours.toFixed(2)} }${comma}`);
});
console.log('];');
