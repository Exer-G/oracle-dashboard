/**
 * Oracle Dashboard - CSV Parsers
 * Handles Upwork earnings and Standard Bank statements
 */

// ============================================================
// UPWORK CSV PARSER
// ============================================================
function parseUpworkCSV(csvText) {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return { earnings: [], totals: {} };
    
    const headers = parseCSVLine(lines[0]);
    const earnings = [];
    const totals = { byClient: {}, byMonth: {}, total: 0, hours: 0 };
    
    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length < 5) continue;
        
        const row = {};
        headers.forEach((h, idx) => {
            row[h.toLowerCase().replace(/\s+/g, '_')] = values[idx] || '';
        });
        
        // Parse date
        const dateStr = row.date || '';
        const date = parseUpworkDate(dateStr);
        
        // Get amount
        const amountStr = row['amount_$'] || row.amount || '0';
        const amount = parseFloat(amountStr.replace(/[,$]/g, '')) || 0;
        
        // Get transaction type
        const type = row.transaction_type || row.type || '';
        
        // Only count earnings (Hourly, Fixed Price, Bonus)
        const isEarning = ['Hourly', 'Fixed Price', 'Bonus'].includes(type);
        
        // Get client
        const client = row.client_team || row.client || '';
        
        // Get hours if hourly
        let hours = 0;
        if (type === 'Hourly') {
            const desc = row.description_1 || row['description_2'] || '';
            const hoursMatch = desc.match(/([\d.]+)\s*hours?/i);
            if (hoursMatch) hours = parseFloat(hoursMatch[1]);
        }
        
        const earning = {
            date: date,
            dateStr: dateStr,
            transactionId: row.transaction_id || '',
            type: type,
            description: row.transaction_summary || row.description || '',
            client: client,
            amount: amount,
            hours: hours,
            isEarning: isEarning
        };
        
        earnings.push(earning);
        
        // Aggregate totals for earnings only
        if (isEarning && amount > 0) {
            totals.total += amount;
            totals.hours += hours;
            
            if (client) {
                totals.byClient[client] = (totals.byClient[client] || 0) + amount;
            }
            
            if (date) {
                const month = date.toISOString().substring(0, 7);
                totals.byMonth[month] = (totals.byMonth[month] || 0) + amount;
            }
        }
    }
    
    return { earnings, totals };
}

function parseUpworkDate(dateStr) {
    // Format: "Feb 4, 2026"
    try {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) return date;
    } catch (e) {}
    return null;
}

// ============================================================
// STANDARD BANK CSV PARSER
// ============================================================
function parseStandardBankCSV(csvText, accountType = 'business') {
    const lines = csvText.trim().split('\n');
    const transactions = [];
    const totals = { income: 0, expenses: 0, fees: 0, byCategory: {} };
    
    let currentDate = null;
    let currentDesc = '';
    let currentAmount = 0;
    let currentBalance = 0;
    let currentType = '';
    
    // Helper function to save current transaction
    const saveTransaction = () => {
        if (currentDate && currentDesc) {
            const transaction = classifyTransaction({
                date: currentDate,
                description: currentDesc,
                amount: currentAmount,
                balance: currentBalance,
                type: currentType
            });
            
            transactions.push(transaction);
            
            // Update totals
            if (transaction.isIncome) {
                totals.income += Math.abs(transaction.amount);
            } else if (transaction.isFee) {
                totals.fees += Math.abs(transaction.amount);
            } else {
                totals.expenses += Math.abs(transaction.amount);
            }
            
            const cat = transaction.category || 'other';
            totals.byCategory[cat] = (totals.byCategory[cat] || 0) + Math.abs(transaction.amount);
        }
    };
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // Skip header row
        if (line.startsWith('Date,') || line.startsWith('"Date')) continue;
        
        // Parse the messy format where all data is in first column
        // Format: "DD MMM YY DESCRIPTION AMOUNT BALANCE\nTRANSACTION TYPE"
        
        // Check if this is a transaction type line (second line of a transaction)
        const isTypeLine = /^[A-Z\s]+$/.test(line.replace(/"/g, '').trim()) && 
                          !line.includes(',') && 
                          line.length < 50;
        
        if (isTypeLine) {
            currentType = line.replace(/"/g, '').trim();
            
            // Save the transaction
            saveTransaction();
            
            // Reset
            currentDate = null;
            currentDesc = '';
            currentAmount = 0;
            currentBalance = 0;
            currentType = '';
            continue;
        }
        
        // Parse main transaction line
        // First, clean the line
        let cleanLine = line.replace(/"/g, '').replace(/,None,None,None/g, '');
        
        // Skip opening balance
        if (cleanLine.includes('STATEMENT OPENING BALANCE')) continue;
        
        // Try to extract: DD MMM YY at start
        const dateMatch = cleanLine.match(/^(\d{2}\s+[A-Za-z]{3}\s+\d{2})\s+(.+)/);
        if (dateMatch) {
            const dateStr = dateMatch[1];
            const rest = dateMatch[2];
            
            // Parse date
            currentDate = parseStdBankDate(dateStr);
            
            // Extract description and amounts from rest
            // Look for amounts (negative or positive numbers)
            const amountMatch = rest.match(/(-?[\d,]+\.\d{2})\s+(-?[\d,]+\.\d{2})$/);
            if (amountMatch) {
                currentAmount = parseFloat(amountMatch[1].replace(/,/g, ''));
                currentBalance = parseFloat(amountMatch[2].replace(/,/g, ''));
                currentDesc = rest.substring(0, rest.lastIndexOf(amountMatch[1])).trim();
            } else {
                // Single amount
                const singleMatch = rest.match(/(-?[\d,]+\.\d{2})$/);
                if (singleMatch) {
                    currentAmount = parseFloat(singleMatch[1].replace(/,/g, ''));
                    currentDesc = rest.substring(0, rest.lastIndexOf(singleMatch[1])).trim();
                } else {
                    currentDesc = rest.trim();
                }
            }
        }
    }
    
    // Save any remaining transaction at end of file
    saveTransaction();
    
    console.log(`[CSV Parser] Parsed ${transactions.length} transactions`);
    return { transactions, totals };
}

function parseStdBankDate(dateStr) {
    // Format: "04 Aug 25"
    try {
        const parts = dateStr.trim().split(/\s+/);
        if (parts.length === 3) {
            const day = parseInt(parts[0]);
            const monthStr = parts[1];
            let year = parseInt(parts[2]);
            
            // Convert 2-digit year
            if (year < 100) year += 2000;
            
            const months = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, 
                           Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
            const month = months[monthStr];
            
            if (!isNaN(day) && month !== undefined) {
                return new Date(year, month, day);
            }
        }
    } catch (e) {}
    return null;
}

function classifyTransaction(txn) {
    const desc = (txn.description + ' ' + txn.type).toUpperCase();
    
    // Income patterns
    const incomePatterns = [
        'TELETRANSMISSION INWARD',
        'CREDIT TRANSFER',
        'IB PAYMENT FROM',
        'IB TRANSFER FROM',
        'REAL TIME TRANSFER FROM'
    ];
    
    // Fee patterns
    const feePatterns = [
        'FEE IMMEDIATE PAYMENT',
        'FEE: PAYSHAP',
        'FEE-TELETRANSMISSION',
        'FEE: PAYMENT CONFIRM',
        'FEE: ELECTRICITY',
        'FEE - INSTANT MONEY',
        'FEE: MYUPDATES',
        'MONTHLY MANAGEMENT FEE'
    ];
    
    // Known entities
    const entities = {
        'EVANSWERKS': 'EvansWerks',
        'AYANDA CAPITAL': 'Ayanda Capital',
        'SENSIFY': 'Sensify UK',
        'ORTHOGLIDE': 'Orthoglide',
        'YOCO': 'Yoco',
        'UPWORK': 'Upwork',
        'BUILD VOLUME': 'Build Volume',
        'DISCOVERY': 'Discovery',
        'OLD MUTUAL': 'Old Mutual'
    };
    
    let isIncome = incomePatterns.some(p => desc.includes(p)) && txn.amount > 0;
    let isFee = feePatterns.some(p => desc.includes(p));
    let category = 'other';
    let entity = null;
    
    // Find known entity
    for (const [key, name] of Object.entries(entities)) {
        if (desc.includes(key)) {
            entity = name;
            break;
        }
    }
    
    // Categorize
    if (isFee) category = 'fee';
    else if (desc.includes('INSURANCE')) category = 'insurance';
    else if (desc.includes('ELECTRICITY')) category = 'utilities';
    else if (desc.includes('CHEQUE CARD')) category = 'card_purchase';
    else if (desc.includes('PAYSHAP') || desc.includes('IMMEDIATE PAYMENT')) category = 'payment';
    else if (desc.includes('IB PAYMENT') || desc.includes('IB TRANSFER')) category = 'transfer';
    else if (isIncome) category = 'income';
    
    return {
        ...txn,
        isIncome,
        isFee,
        category,
        entity,
        dateFormatted: txn.date ? txn.date.toLocaleDateString('en-ZA') : ''
    };
}

// ============================================================
// CSV LINE PARSER (handles quoted fields)
// ============================================================
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    
    result.push(current.trim());
    return result;
}

// ============================================================
// EXPORT
// ============================================================
window.parseUpworkCSV = parseUpworkCSV;
window.parseStandardBankCSV = parseStandardBankCSV;
window.parseCSVLine = parseCSVLine;

console.log('[Oracle] CSV parsers loaded');
