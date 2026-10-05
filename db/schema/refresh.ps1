$ErrorActionPreference = 'Stop'
Write-Host 'ShareMyBill live schema refresh'
Write-Host '==============================='

$envFile = 'E:\Billing App\.env'
$url = (Select-String -Path $envFile -Pattern 'VITE_SUPABASE_URL=(\S+)').Matches[0].Groups[1].Value
$srLine = Select-String -Path $envFile -Pattern '^SUPABASE_SERVICE_ROLE_KEY=(\S+)' -ErrorAction SilentlyContinue
if ($srLine) {
  $plain = $srLine.Matches[0].Groups[1].Value
} else {
  $secure = Read-Host -AsSecureString 'Supabase service role key (not stored)'
  $ptr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  $plain = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
}

$out = Join-Path $PSScriptRoot 'postgrest-openapi.json'
curl.exe -s "$url/rest/v1/" `
  -H "apikey: $plain" `
  -H "Authorization: Bearer $plain" `
  -H 'Accept: application/openapi+json' `
  -o $out

if (-not (Test-Path $out) -or (Get-Item $out).Length -lt 1000) {
  Write-Error "Failed. Inspect $out"
} else {
  Write-Host "Saved live OpenAPI snapshot ($((Get-Item $out).Length) bytes) -> $out"
  Write-Host 'Note: defaults/policies/triggers still come from ./migrations (API cannot see them).'
}