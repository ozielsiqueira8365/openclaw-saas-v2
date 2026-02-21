# Teste correto no PowerShell - EXECUTE ESTE COMANDO

$uri = "https://SEU-DOMINIO.railway.app/v1/chat"
$key = "oc_live_SUA_KEY_AQUI"

# Cria o body como hashtable e converte para JSON
$body = @{
    message = "teste de mensagem do powershell"
} | ConvertTo-Json

Write-Host "Enviando: $body"

try {
    $response = Invoke-RestMethod -Uri $uri -Method POST -Headers @{
        "Authorization" = "Bearer $key"
        "Content-Type" = "application/json"
    } -Body $body
    
    Write-Host "Resposta:" -ForegroundColor Green
    $response | ConvertTo-Json
} catch {
    Write-Host "Erro:" -ForegroundColor Red
    $_.Exception.Message
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $reader.BaseStream.Position = 0
        $reader.DiscardBufferedData()
        $reader.ReadToEnd()
    }
}