import express, { type Request, type Response } from 'express';
import { createHash } from 'node:crypto';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { openAuthStore, sessionLifetimeSeconds } from './auth-store';

const attemptsWindowMs = 15 * 60 * 1000;
const maxRateLimitEntries = 20_000;
const maxConcurrentAuth = 4;
const sessionTokenPattern = /^[A-Za-z0-9_-]{43}$/;

export function readPublicOrigin(): URL | undefined {
  const configured = process.env['FLOWERBRO_ORIGIN'];
  if (!configured) return undefined;

  const url = new URL(configured);
  if (url.protocol !== 'https:' || configured !== url.origin) {
    throw new Error('FLOWERBRO_ORIGIN deve essere l’origine HTTPS, senza percorso.');
  }
  return url;
}

export function createAccountApi(publicOrigin: URL | undefined) {
  const router = express.Router();
  const cookieName = publicOrigin ? '__Host-flowerbro-session' : 'flowerbro-session-local';
  const cookieOptions = {
    path: '/',
    httpOnly: true,
    sameSite: 'strict' as const,
    secure: !!publicOrigin,
  };
  const attempts = new Map<string, { count: number; expiresAt: number }>();
  let lastCleanup = 0;
  let concurrentAuth = 0;
  let store: ReturnType<typeof openAuthStore> | undefined;

  function initialize() {
    if (store) return store;
    const encodedKey = process.env['FLOWERBRO_DATA_KEY'] ?? '';
    const key = Buffer.from(encodedKey, 'base64url');
    if (key.length !== 32 || key.toString('base64url') !== encodedKey) {
      throw new Error('FLOWERBRO_DATA_KEY deve contenere una chiave base64url di 32 byte.');
    }
    const configuredPath = process.env['FLOWERBRO_DB_PATH'];
    if (publicOrigin && (!configuredPath || !isAbsolute(configuredPath))) {
      throw new Error('FLOWERBRO_DB_PATH deve essere un percorso assoluto in produzione.');
    }
    const databasePath = resolve(configuredPath || '../.flowerbro/auth.sqlite');
    const pathFromFrontend = relative(process.cwd(), databasePath);
    if (
      pathFromFrontend !== '..' &&
      !pathFromFrontend.startsWith('..' + sep) &&
      !isAbsolute(pathFromFrontend)
    ) {
      throw new Error('Il database deve trovarsi fuori dalla directory del frontend.');
    }
    store = openAuthStore(databasePath, key);
    return store;
  }

  function takeAttempt(key: string, limit: number): boolean {
    const now = Date.now();
    if (now - lastCleanup >= 60_000) {
      for (const [id, entry] of attempts) {
        if (entry.expiresAt <= now) attempts.delete(id);
      }
      lastCleanup = now;
    }
    const entry = attempts.get(key);
    if (entry && entry.expiresAt > now) {
      if (entry.count >= limit) return false;
      entry.count++;
      return true;
    }
    if (!entry && attempts.size >= maxRateLimitEntries) return false;
    attempts.set(key, { count: 1, expiresAt: now + attemptsWindowMs });
    return true;
  }

  function getToken(req: Request): string | undefined {
    const cookie = req
      .get('cookie')
      ?.split(';')
      .find((part) => part.trimStart().startsWith(cookieName + '='));
    const token = cookie?.trim().slice(cookieName.length + 1);
    return token && sessionTokenPattern.test(token) ? token : undefined;
  }

  function isSameOrigin(req: Request): boolean {
    const origin = req.get('origin');
    if (publicOrigin) return origin === publicOrigin.origin;
    const host = req.get('host');
    return (
      !!host &&
      /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/.test(host) &&
      origin === 'http://' + host
    );
  }

  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  router.get('/', (req, res) => {
    const fetchSite = req.get('sec-fetch-site');
    if (
      (req.get('origin') && !isSameOrigin(req)) ||
      fetchSite === 'cross-site' ||
      fetchSite === 'same-site'
    ) {
      res.status(403).json({ error: 'Richiesta non autorizzata.' });
      return;
    }
    const token = getToken(req);
    const profile = token ? initialize().profile(token) : null;
    if (token && !profile) res.clearCookie(cookieName, cookieOptions);
    res.json({ profile });
  });

  router.post(
    ['/register', '/login', '/logout'],
    (req, res, next) => {
      if (!isSameOrigin(req)) {
        res.status(403).json({ error: 'Richiesta non autorizzata.' });
        return;
      }
      if (!req.is('application/json')) {
        res.status(415).json({ error: 'Formato della richiesta non supportato.' });
        return;
      }
      next();
    },
    express.json({ limit: '4kb', inflate: false }),
  );

  async function authenticate(req: Request, res: Response, mode: 'login' | 'register') {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const registering = mode === 'register';
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const emailValid =
      email.length <= 254 &&
      /^[^\s@<>\u0000-\u001f\u007f]+@[^\s@<>\u0000-\u001f\u007f]+\.[^\s@<>\u0000-\u001f\u007f]+$/u.test(
        email,
      );

    if (!emailValid || !password || password.length > 128) {
      res.status(400).json({ error: 'Inserisci un’email e una password valide.' });
      return;
    }
    if (
      registering &&
      (!name ||
        name.length > 80 ||
        /[\u0000-\u001f\u007f]/u.test(name) ||
        [...password].length < 15)
    ) {
      res.status(400).json({ error: 'Inserisci un nome e una password di almeno 15 caratteri.' });
      return;
    }

    if (concurrentAuth >= maxConcurrentAuth) {
      res
        .set('Retry-After', '2')
        .status(429)
        .json({ error: 'Troppe richieste. Riprova tra poco.' });
      return;
    }
    const emailKey = 'login:email:' + createHash('sha256').update(email).digest('base64url');
    if (
      !takeAttempt(mode + ':ip:' + ip, registering ? 10 : 25) ||
      (!registering && !takeAttempt(emailKey, 8))
    ) {
      res
        .set('Retry-After', String(attemptsWindowMs / 1000))
        .status(429)
        .json({ error: 'Troppi tentativi. Riprova tra qualche minuto.' });
      return;
    }

    concurrentAuth++;
    try {
      const auth = initialize();
      const previousToken = getToken(req);
      const result = registering
        ? await auth.register({ name, email }, password, previousToken)
        : await auth.signIn(email, password, previousToken);
      if (!result) {
        if (registering)
          res.status(409).json({ error: 'Registrazione non riuscita con questi dati.' });
        else res.status(401).json({ error: 'Email o password errata.' });
        return;
      }
      if (!registering) attempts.delete(emailKey);
      res.cookie(cookieName, result.token, {
        ...cookieOptions,
        maxAge: sessionLifetimeSeconds * 1000,
      });
      res.status(registering ? 201 : 200).json({ profile: result.profile });
    } finally {
      concurrentAuth--;
    }
  }

  router.post('/register', (req, res) => authenticate(req, res, 'register'));
  router.post('/login', (req, res) => authenticate(req, res, 'login'));

  router.post('/logout', (req, res) => {
    const token = getToken(req);
    if (token) initialize().signOut(token);
    res.clearCookie(cookieName, cookieOptions).status(204).end();
  });

  router.use((_req, res) => {
    res.status(404).json({ error: 'Pagina non trovata.' });
  });

  router.use(((error, _req, res, _next) => {
    if (error?.status === 400 || error?.status === 413 || error?.status === 415) {
      res.status(error.status).json({ error: 'Richiesta non valida.' });
      return;
    }
    // The JSON parser's errors can contain the original request body.
    console.error('Errore interno dell’API account.');
    res.status(500).json({ error: 'Servizio account momentaneamente non disponibile.' });
  }) as express.ErrorRequestHandler);

  return { router, initialize };
}
