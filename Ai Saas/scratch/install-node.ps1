$targetDir = "C:\Users\Atul\Desktop\Ai Saas\node-portable"
if (!(Test-Path $targetDir)) {
    New-Item -ItemType Directory -Path $targetDir
}
$zipPath = Join-Path $targetDir "node.zip"
Write-Host "Downloading Node.js..."
Invoke-WebRequest -Uri "https://nodejs.org/dist/v20.14.0/node-v20.14.0-win-x64.zip" -OutFile $zipPath

Write-Host "Extracting Node.js..."
Expand-Archive -Path $zipPath -DestinationPath $targetDir -Force
Remove-Item $zipPath

$nodeBinPath = Join-Path $targetDir "node-v20.14.0-win-x64"
Write-Host "Adding Node.js to User PATH..."
$oldPath = [System.Environment]::GetEnvironmentVariable("PATH", "User")
if ($oldPath -notlike "*node-v20.14.0-win-x64*") {
    $newPath = $oldPath + ";" + $nodeBinPath
    [System.Environment]::SetEnvironmentVariable("PATH", $newPath, "User")
    Write-Host "PATH updated successfully!"
} else {
    Write-Host "PATH is already configured."
}
Write-Host "Installation completed! Please restart your terminal/VS Code."
