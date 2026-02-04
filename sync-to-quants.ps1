# Oracle Dashboard - Sync Data to Quants Folder
# This script copies the latest Oracle data files to your Quants folder for backup

$QuantsFolder = "C:\Users\shuai\OneDrive\Documents\001 Exergy Designs\001 company resources\002 Quants"
$DownloadsFolder = "$env:USERPROFILE\Downloads"
$DashboardData = "C:\Users\shuai\clawd\oracle-dashboard\data"

Write-Host "Oracle Data Sync" -ForegroundColor Cyan
Write-Host "================`n" -ForegroundColor Cyan

# 1. Copy any oracle-data-*.json from Downloads to Quants
$oracleFiles = Get-ChildItem -Path $DownloadsFolder -Filter "oracle-data-*.json" -ErrorAction SilentlyContinue
if ($oracleFiles) {
    Write-Host "Found Oracle data files in Downloads:" -ForegroundColor Yellow
    foreach ($file in $oracleFiles) {
        Write-Host "  - $($file.Name)" -ForegroundColor Gray
        Copy-Item $file.FullName -Destination $QuantsFolder -Force
    }
    Write-Host "Copied to Quants folder`n" -ForegroundColor Green
} else {
    Write-Host "No oracle-data-*.json files found in Downloads`n" -ForegroundColor Gray
}

# 2. Copy source data files to Quants as backup
$timestamp = Get-Date -Format "yyyy-MM-dd"
$backupFolder = Join-Path $QuantsFolder "oracle-backup-$timestamp"

if (Test-Path $DashboardData) {
    Write-Host "Backing up dashboard data..." -ForegroundColor Yellow
    
    if (!(Test-Path $backupFolder)) {
        New-Item -ItemType Directory -Path $backupFolder | Out-Null
    }
    
    Copy-Item "$DashboardData\*" -Destination $backupFolder -Force -Recurse
    Write-Host "Backed up to: $backupFolder`n" -ForegroundColor Green
}

# 3. Show summary
Write-Host "Quants folder contents:" -ForegroundColor Cyan
Get-ChildItem $QuantsFolder | Select-Object Name, LastWriteTime, Length | Format-Table -AutoSize

Write-Host "`nDone! Your Oracle data is synced." -ForegroundColor Green
