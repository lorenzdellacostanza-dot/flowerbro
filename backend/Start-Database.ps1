$ErrorActionPreference = 'Stop'

function New-FlowerBroSecret {
    $bytes = New-Object byte[] 32
    $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $generator.GetBytes($bytes)
        [Convert]::ToBase64String($bytes)
    }
    finally {
        $generator.Dispose()
    }
}

function Invoke-FlowerBroCompose {
    & docker compose @args
    if ($LASTEXITCODE -ne 0) {
        throw "Docker Compose non ha completato l'operazione."
    }
}

Push-Location -LiteralPath $PSScriptRoot
try {
    $utf8 = [System.Text.UTF8Encoding]::new($false)
    $databaseEnv = Join-Path $PSScriptRoot '.env'
    $cryptoEnv = Join-Path $PSScriptRoot '.env.crypto'
    $settings = if (Test-Path -LiteralPath $databaseEnv) {
        [System.IO.File]::ReadAllText($databaseEnv)
    } else {
        "FLOWERBRO_DB_PORT=5433" + [Environment]::NewLine
    }
    $originalSettings = $settings

    foreach ($variable in 'FLOWERBRO_DB_PASSWORD', 'FLOWERBRO_APP_DB_PASSWORD') {
        $pattern = '(?m)^' + [regex]::Escape($variable) + '[ \t]*=[ \t]*(?<value>[^\r\n]*)'
        $entry = [regex]::Match($settings, $pattern)
        $value = $entry.Groups['value'].Value.Trim()
        if ($value -and $value -notin @('""', "''") -and -not $value.StartsWith('#')) {
            continue
        }

        $line = $variable + '=' + (New-FlowerBroSecret)
        if ($entry.Success) {
            $settings = $settings.Remove($entry.Index, $entry.Length).Insert($entry.Index, $line)
        } else {
            if ($settings -and -not $settings.EndsWith([string][char]10)) {
                $settings += [Environment]::NewLine
            }
            $settings += $line + [Environment]::NewLine
        }
    }
    if ($settings -ne $originalSettings) {
        [System.IO.File]::WriteAllText($databaseEnv, $settings, $utf8)
    }

    Invoke-FlowerBroCompose up -d --build --wait --wait-timeout 60 db
    Invoke-FlowerBroCompose run --rm -T --no-deps migrate
    Invoke-FlowerBroCompose run --rm -T --no-deps provision

    New-Item -ItemType Directory -Path '.tls' -Force | Out-Null
    Invoke-FlowerBroCompose cp db:/etc/flowerbro/trust/ca.crt .tls/ca.crt

    if (-not (Test-Path -LiteralPath $cryptoEnv)) {
        $check = 'PGPASSWORD="$POSTGRES_PASSWORD" psql -X -w -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atqc ''SELECT EXISTS (SELECT 1 FROM accounts) OR EXISTS (SELECT 1 FROM orders)'''
        $hasPersonalData = $check | & docker compose exec -T db sh
        if ($LASTEXITCODE -ne 0) {
            throw "Impossibile verificare se il database contiene dati personali."
        }
        if ("$hasPersonalData".Trim() -ne 'f') {
            throw "Il database contiene dati personali. Ripristina il file .env.crypto originale."
        }

        $stream = [System.IO.File]::Open($cryptoEnv, [System.IO.FileMode]::CreateNew)
        try {
            $writer = [System.IO.StreamWriter]::new($stream, $utf8)
            try {
                $writer.WriteLine('FLOWERBRO_DATA_KEY=' + (New-FlowerBroSecret))
                $writer.WriteLine('FLOWERBRO_EMAIL_LOOKUP_KEY=' + (New-FlowerBroSecret))
            }
            finally {
                $writer.Dispose()
            }
        }
        finally {
            $stream.Dispose()
        }
    }

    Write-Output 'Database Flower Bro! pronto. Certificato locale in .tls/ca.crt.'
}
finally {
    Pop-Location
}
