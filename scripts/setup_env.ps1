$global:VerbosePreference = 'SilentlyContinue'
Set-ExecutionPolicy Unrestricted -Force
iex ((New-Object System.Net.WebClient).DownloadString('https://boxstarter.org/bootstrapper.ps1'))
Get-Boxstarter -Force
Install-BoxstarterPackage https://github.com/Ra2-IFV/node/raw/refs/heads/fix_bootstrap/tools/bootstrap/windows_boxstarter -DisableReboots
choco install upx -y --force --no-color --no-progress
RefreshEnv