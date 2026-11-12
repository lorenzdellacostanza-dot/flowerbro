# Flower Bro

## Avvio in locale

Usa Node.js 22.22.3+, 24.15.0+ o 26.x.

```sh
cd frontend
npm ci
npm run setup:local
npm start
```

Apri [localhost:4200](http://localhost:4200/). Il database SQLite viene creato in
`.flowerbro/auth.sqlite` alla prima registrazione o al primo login. Per provare la build
SSR locale, esegui `npm run build` e `npm run serve:ssr:frontend` da `frontend`, poi apri
[127.0.0.1:4000](http://127.0.0.1:4000/).

`npm run setup:local` genera una chiave casuale in `frontend/.env` al primo avvio.
Il file `.env` e il database sono esclusi da Git. Conserva la chiave separatamente
dai backup del database. I profili demo esistenti nel browser vengono rimossi
quando si apre l’app aggiornata. Per usare il nuovo login occorre registrarsi.

## Account

Il browser usa l’API Express sulla stessa origine. Le password sono salvate
come hash scrypt con salt casuale. Nome ed email sono cifrati con AES-256-GCM e
l’indice per la ricerca dell’email è calcolato con HMAC. Il database conserva solo
l’hash del token di sessione. Il cookie è HttpOnly e SameSite=Strict, con Secure
in produzione. La sessione scade dopo sette giorni e il logout la revoca.
Registrazione e login hanno limiti di frequenza.

## Messa online

La build richiede un host in grado di eseguire Node.js con un disco persistente.
Il server ascolta su `127.0.0.1:4000` (porta personalizzabile con `PORT`).
Esegui un’istanza del server dietro un reverse proxy HTTPS sullo stesso host.
Il proxy deve reindirizzare HTTP a HTTPS e inoltrare il dominio canonico in
`Host`, sovrascrivendo `X-Forwarded-Proto` e `X-Forwarded-For` con protocollo
e indirizzo reali. Usa un volume privato e persistente per il database.

Imposta queste variabili nell’ambiente del server.

| Variabile | Valore |
| --- | --- |
| `NODE_ENV` | `production` |
| `FLOWERBRO_ORIGIN` | Origine HTTPS del sito, per esempio `https://flowerbro.example` |
| `FLOWERBRO_DB_PATH` | Percorso assoluto del file SQLite sul volume privato, fuori dalla directory del frontend |
| `FLOWERBRO_DATA_KEY` | Chiave base64url di 32 byte, nel gestore dei segreti dell’host |

Per creare la chiave di produzione nel tuo ambiente sicuro, esegui questo comando.

```sh
node -p "require('node:crypto').randomBytes(32).toString('base64url')"
```

Da `frontend`, esegui `npm ci`, `npm run build` e `npm run serve:ssr:frontend`.
Mantieni la stessa chiave e lo stesso volume tra i rilasci. Il checkout è una
simulazione. La verifica dell’indirizzo email e il recupero password richiedono
l’integrazione di un servizio email.
