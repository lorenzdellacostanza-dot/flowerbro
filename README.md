# Flower Bro

## Avvio in locale

Servono un JDK 25 LTS e una versione di Node.js compatibile con Angular
(22.22.3+, 24.15.0+ o 26.x). Il Gradle Wrapper è incluso nel progetto.
Su Windows, imposta `JAVA_HOME` sulla cartella del JDK 25 se nel terminale
`java -version` indica una versione precedente.

Dalla cartella del progetto, prepara il frontend e la chiave locale.

```sh
cd frontend
npm ci
npm run setup:local
```

In un secondo terminale, entra in `backend` e avvia Spring Boot.

```powershell
.\gradlew.bat bootRun
```

Su macOS e Linux usa `./gradlew bootRun`. Quando il backend è in ascolto,
esegui `npm start` nel terminale aperto in `frontend` e visita
[localhost:4200](http://localhost:4200/).

Per provare Angular SSR in locale, esegui `npm run build` e
`npm run serve:ssr:frontend` da `frontend` con il backend avviato, poi apri
[127.0.0.1:4000](http://127.0.0.1:4000/).

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
`npm run serve:ssr:frontend`. Il checkout è una simulazione. La verifica
dell’indirizzo email e il recupero password richiedono l’integrazione
di un servizio email.
