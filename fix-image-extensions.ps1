# Fix image extensions: rename all .jpg files in the 3 image subfolders to .png
# (Their actual content is PNG. The HTML has been updated to reference .png too.)
#
# How to run:
#   1. Open PowerShell
#   2. cd "C:\Users\sasuk\OneDrive\Desktop\portal"
#   3. powershell -ExecutionPolicy Bypass -File .\fix-image-extensions.ps1

$ErrorActionPreference = "Stop"
$base = "C:\Users\sasuk\OneDrive\Desktop\portal\images"

$renamed = 0
foreach ($sub in @("accessories", "enclosures", "electrical")) {
    $folder = Join-Path $base $sub
    if (-not (Test-Path $folder)) { continue }

    Get-ChildItem -Path $folder -File -Filter "*.jpg" | ForEach-Object {
        $newName = $_.Name -replace '\.jpg$', '.png'
        $newPath = Join-Path $_.DirectoryName $newName
        if (Test-Path $newPath) {
            Write-Host "  SKIP (target exists): $sub\$($_.Name)" -ForegroundColor DarkGray
        } else {
            Rename-Item -Path $_.FullName -NewName $newName
            Write-Host "  $sub\$($_.Name) -> $newName" -ForegroundColor Green
            $renamed++
        }
    }
}

Write-Host ""
Write-Host "Renamed $renamed files." -ForegroundColor Cyan
Write-Host "Now hard-refresh the module pages in your browser (Ctrl+F5)."
