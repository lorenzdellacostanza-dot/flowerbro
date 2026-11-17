# Database di Flower Bro!

Spring Boot legge il catalogo e registra gli ordini in PostgreSQL. Le migrazioni Flyway creano lo schema e caricano i 12 prodotti iniziali. Il servizio account usa SQLite.

## Avvio locale

Con Docker Desktop aperto, esegui questo comando dalla cartella `backend`.

```powershell
.\Start-Database.ps1
```

Lo script avvia PostgreSQL, applica le migrazioni, configura l’utente applicativo ed esporta il certificato pubblico locale. Genera i segreti mancanti e riutilizza quelli esistenti. Il volume `pgdata` conserva i dati quando fermi il container con `docker compose stop db`.

| Impostazione | Valore |
| --- | --- |
| Host e porta | `127.0.0.1:5433` |
| Database | `flowerbro` |
| Utente applicativo | `flowerbro_app` |
| Password applicativa | `FLOWERBRO_APP_DB_PASSWORD` nel file locale `.env` |
| Modalità TLS | `verify-full` |
| Certificato pubblico locale | `.tls/ca.crt` |

In JDBC usa `jdbc:postgresql://127.0.0.1:5433/flowerbro` con le proprietà `sslmode=verify-full` e `sslrootcert` impostata sul percorso del certificato. L’utente `flowerbro` è riservato alle migrazioni e all’amministrazione locale. Per una sessione amministrativa nel container, esegui `docker compose exec db psql -W -U flowerbro -d flowerbro`. [Configurazione TLS per pgJDBC](https://jdbc.postgresql.org/documentation/ssl/)

Avvia Spring Boot con `.\gradlew.bat bootRun` dalla stessa cartella dopo aver generato la chiave degli account con `npm run setup:local` in `frontend`. Spring legge la configurazione PostgreSQL da `backend/.env` e le chiavi per gli ordini da `backend/.env.crypto`.

## Protezione dei dati

- PostgreSQL richiede SCRAM-SHA-256. Le connessioni TCP richiedono TLS. La porta sul computer è esposta solo sull’indirizzo locale.
- Il ruolo applicativo legge il catalogo, aggiorna le disponibilità e scrive gli ordini. Un ruolo distinto amministra lo schema e le migrazioni.
- `PersonalDataCrypto` cifra i dati di consegna con AES-256-GCM. La chiave HMAC identifica le ripetizioni dello stesso invio.
- Conserva le chiavi originali per poter leggere gli ordini e riconoscere i tentativi già registrati. Il file `.env.crypto` è escluso da Git.

## Configurazione di produzione

Applica le [migrazioni Flyway](src/main/resources/db/migration) e configura il ruolo applicativo nel database di destinazione. Imposta queste variabili per Spring Boot.

| Variabile | Uso |
| --- | --- |
| `FLOWERBRO_DB_HOST` | Host di PostgreSQL presente nel certificato TLS |
| `FLOWERBRO_DB_PORT` | Porta di PostgreSQL, predefinita `5433` |
| `FLOWERBRO_DB_NAME` | Nome del database, predefinito `flowerbro` |
| `FLOWERBRO_APP_DB_USER` | Ruolo applicativo, predefinito `flowerbro_app` |
| `FLOWERBRO_APP_DB_PASSWORD` | Password del ruolo applicativo |
| `FLOWERBRO_DB_CA_CERT` | Percorso del certificato CA fidato |
| `FLOWERBRO_ORDER_DATA_KEY` | Chiave AES degli ordini, 32 byte in Base64 |
| `FLOWERBRO_EMAIL_LOOKUP_KEY` | Chiave HMAC, altri 32 byte in Base64 |

## Dati degli ordini

Ogni riga conserva nome, prezzo e quantità al momento dell’ordine. La vista `order_totals` contiene il riepilogo. `orders.delivery_ciphertext` contiene i dati di consegna cifrati. Per i prodotti con `stock_quantity` valorizzato, il salvataggio scala la disponibilità nella stessa transazione.

Per aggiornare i pacchetti PostgreSQL dell’immagine locale, ricostruisci il servizio con `docker compose build --pull --no-cache db` ed esegui di nuovo lo script di avvio.
