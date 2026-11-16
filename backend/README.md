# Database di Flower Bro!

PostgreSQL contiene il catalogo, gli account e gli ordini. Le migrazioni Flyway creano lo schema, caricano i 12 prodotti del frontend e proteggono i dati personali.

## Avvio locale

Con Docker Desktop aperto, esegui dalla cartella `backend`:

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

## Protezione dei dati

- PostgreSQL richiede SCRAM-SHA-256. Le connessioni TCP richiedono TLS. La porta sul computer è esposta solo sull’indirizzo locale.
- Il ruolo applicativo legge il catalogo e gestisce account, preferiti, carrelli e ordini con permessi specifici. Lo schema e le migrazioni sono amministrati da un ruolo distinto.
- Il modulo Java `PersonalDataCrypto` usa AES-256-GCM per cifrare nome ed email dell’account e i dati di consegna prima di scriverli nel database. Le colonne cifrate contengono byte. La ricerca dell’account usa un HMAC-SHA-256 dell’email normalizzata, con una chiave distinta.
- `password_hash` accetta hash bcrypt o Argon2id. Il servizio di registrazione genera l’hash con Spring Security prima della scrittura. [Salvataggio delle password in Spring Security](https://docs.spring.io/spring-security/reference/features/authentication/password-storage.html)
- Le chiavi applicative sono in `.env.crypto`, separato da PostgreSQL e da Git. Conserva una copia protetta delle chiavi originali se salvi dati reali. Servono per recuperare i dati e cercare gli account.

## Integrazione con Spring Boot

Le migrazioni si trovano in [`src/main/resources/db/migration`](src/main/resources/db/migration). Esegui le migrazioni con lo script di avvio e configura Spring Boot con l’utente applicativo della tabella.

In registrazione, valida i dati e scrivi il nome e l’email cifrati in `name_ciphertext` e `email_ciphertext`. Salva il risultato di `emailLookup` in `email_lookup` per la ricerca e l’unicità dell’account. In checkout, valida il destinatario, l’email, l’indirizzo, il CAP, il paese e il biglietto, quindi serializzali in JSON e cifrali in `delivery_ciphertext` con `Field.ORDER_DELIVERY`.

Salva ordine e righe nella stessa transazione. Ogni riga conserva nome e prezzo al momento dell’acquisto. La vista `order_totals` calcola subtotale, spedizione e totale. Prezzi e quantità del catalogo restano leggibili dal sito.

Per aggiornare i pacchetti PostgreSQL dell’immagine locale, ricostruisci il servizio con `docker compose build --pull --no-cache db` ed esegui di nuovo lo script di avvio.
