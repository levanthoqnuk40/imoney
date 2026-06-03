$url = 'https://jajiwnantexqfmjpdxiw.supabase.co'
$headers = @{
  'apikey' = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imphaml3bmFudGV4cWZtanBkeGl3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyMjg1ODUsImV4cCI6MjA4MzgwNDU4NX0.x-wiKahaQamxq3BOy8RO9a1Nsv90YkbEbueI_-kHgpE'
  'Authorization' = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imphaml3bmFudGV4cWZtanBkeGl3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyMjg1ODUsImV4cCI6MjA4MzgwNDU4NX0.x-wiKahaQamxq3BOy8RO9a1Nsv90YkbEbueI_-kHgpE'
}
try {
    $events = Invoke-RestMethod -Uri "$url/rest/v1/expense_events?select=*" -Headers $headers -Method Get
    $participants = Invoke-RestMethod -Uri "$url/rest/v1/expense_participants?select=*" -Headers $headers -Method Get
    $splits = Invoke-RestMethod -Uri "$url/rest/v1/expense_splits?select=*" -Headers $headers -Method Get

    $out = ""
    $out += "--- EVENTS ---`r`n" + ($events | ConvertTo-Json -Depth 3) + "`r`n`r`n"
    $out += "--- PARTICIPANTS ---`r`n" + ($participants | ConvertTo-Json -Depth 3) + "`r`n`r`n"
    $out += "--- SPLITS ---`r`n" + ($splits | ConvertTo-Json -Depth 3) + "`r`n`r`n"

    Set-Content -Path 'scratch/db_state.txt' -Value $out
    Write-Host "Done!"
} catch {
    Write-Error $_.Exception.Message
}
