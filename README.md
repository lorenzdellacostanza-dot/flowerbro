# Flower Bro

## Avvio in locale

Servono Docker, un JDK 25 LTS e una versione di Node.js compatibile con Angular
(22.22.3+, 24.15.0+ o 26.x). Il Gradle Wrapper è incluso nel progetto.
Su Windows, imposta `JAVA_HOME` sulla cartella del JDK 25 se nel terminale
`java -version` indica una versione precedente.

Dalla cartella del progetto, prepara il frontend e la chiave locale.

```sh
cd frontend
npm ci
npm run setup:local
```

Con Docker Desktop aperto, entra in `backend` in un secondo terminale.
Prepara PostgreSQL e avvia Spring Boot.

```powershell
.\Start-Database.ps1
.\gradlew.bat bootRun
```

Su macOS e Linux puoi avviare il database con `pwsh ./Start-Database.ps1`
e Spring Boot con `./gradlew bootRun`. Quando il backend è in ascolto,
esegui `npm start` nel terminale aperto in `frontend` e visita
[localhost:4200](http://localhost:4200/).

Per provare Angular SSR in locale, esegui `npm run build` e
`npm run serve:ssr:frontend` da `frontend` con il backend avviato, poi apri
[127.0.0.1:4000](http://127.0.0.1:4000/).

## Architettura MVC

- Nel **Model**, `AccountService` applica le regole di autenticazione
  e usa `AccountStore` per leggere e scrivere profili e sessioni in SQLite.
  Il catalogo e gli ordini sono in PostgreSQL. Il browser conserva il carrello
  e i preferiti.
- La **View** usa i template HTML di Angular per mostrare profili, fiori,
  carrello e conferma dell’ordine.
- Nel ruolo di **Controller**, `AccountController` gestisce le richieste di Spring MVC,
  delega al servizio account e restituisce JSON. `StoreController` espone il
  catalogo e riceve gli ordini. I componenti TypeScript
  gestiscono gli eventi dei template e invocano i servizi Angular.

## Account e database

Il backend Java espone registrazione, login, profilo e logout. Angular chiama
l’API sulla stessa origine e il suo server SSR inoltra le richieste a Spring Boot
su loopback. Il backend ascolta su `127.0.0.1:8080` per impostazione predefinita.

Java riutilizza `.flowerbro/auth.sqlite` e la chiave già presente in
`frontend/.env`. Gli account e le sessioni del backend precedente sono
compatibili. Conserva la chiave separatamente dai backup del database. Il file
`.env` e il database sono esclusi da Git.

Le password sono salvate come hash scrypt con salt casuale. Nome ed email
sono cifrati con AES-256-GCM. L’indice dell’email usa HMAC e il database
conserva solo l’hash del token di sessione. Il cookie è HttpOnly e
SameSite=Strict, con Secure in produzione. La sessione scade dopo sette giorni
e il logout la revoca. Registrazione e login hanno limiti di frequenza.

## Catalogo e ordini

`GET /api/catalog` legge da PostgreSQL prodotti attivi, disponibilità, tag e
occasioni. `POST /api/orders` ricontrolla i prezzi e le quantità, cifra i dati
di consegna e registra l’ordine e le sue righe nella stessa transazione. Il
checkout mostra il numero salvato e il totale calcolato dal server. Ogni
ordine entra nello stato `pending`.

Vedi la [guida del database](backend/README.md) per la configurazione di
PostgreSQL, le migrazioni e le chiavi di cifratura.

## Messa online

Avvia un’istanza Java e il server Angular SSR sullo stesso host. Usa un disco
privato e persistente per SQLite. Metti Angular SSR dietro un reverse proxy
HTTPS che reindirizzi HTTP a HTTPS e inoltri il dominio canonico in `Host`,
sovrascrivendo `X-Forwarded-Proto` e `X-Forwarded-For` con protocollo e indirizzo
reali. Il server Angular SSR ascolta su `127.0.0.1:4000` per impostazione predefinita.

Imposta le variabili nell’ambiente dei rispettivi servizi.

| Variabile | Servizio | Valore |
| --- | --- | --- |
| `FLOWERBRO_ORIGIN` | Java e Angular SSR | Origine HTTPS del sito, per esempio `https://flowerbro.example` |
| `FLOWERBRO_BACKEND_PORT` | Java e Angular SSR | Porta interna del backend, predefinita `8080` |
| `FLOWERBRO_DB_PATH` | Java | Percorso assoluto del file SQLite sul volume privato, fuori dalla directory del frontend |
| `FLOWERBRO_DATA_KEY` | Java | Chiave base64url di 32 byte, nel gestore dei segreti dell’host |
| `SPRING_PROFILES_ACTIVE` | Java | `production` |
| `NODE_ENV` | Angular SSR | `production` |
| `PORT` | Angular SSR | Porta del server SSR, predefinita `4000` |

Mantieni la stessa chiave e lo stesso volume tra i rilasci. Per una nuova
installazione puoi generare una chiave con
`node -p "require('node:crypto').randomBytes(32).toString('base64url')"`.

Da `backend`, esegui `./gradlew bootJar` (su Windows `.\gradlew.bat bootJar`) e
avvia il pacchetto con Java 25.

```sh
java --enable-native-access=ALL-UNNAMED -jar build/libs/flowerbro-backend.jar
```

Da `frontend`, esegui `npm ci --include=dev`, `npm run build` e
`npm run serve:ssr:frontend`. Per pagamenti, spedizioni, verifica dell’email e
recupero password, l’installazione richiede servizi dedicati.
