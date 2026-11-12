import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';
import { createAccountApi, readPublicOrigin } from './account-api';

const browserDistFolder = join(import.meta.dirname, '../browser');
const isServerEntry = isMainModule(import.meta.url) || !!process.env['pm_id'];
const productionMode = process.env['NODE_ENV'] === 'production';
const publicOrigin = readPublicOrigin();
if (isServerEntry && productionMode && !publicOrigin) {
  throw new Error('FLOWERBRO_ORIGIN è obbligatorio in produzione.');
}
const accountApi = createAccountApi(publicOrigin);
const app = express();
const angularApp = new AngularNodeAppEngine(
  publicOrigin
    ? {
        allowedHosts: [publicOrigin.hostname],
        trustProxyHeaders: ['x-forwarded-proto', 'x-forwarded-for'],
      }
    : undefined,
);

app.disable('x-powered-by');
app.disable('etag');
if (publicOrigin) app.set('trust proxy', 'loopback');

app.use((req, res, next) => {
  if (productionMode && !publicOrigin) {
    res.sendStatus(503);
    return;
  }
  if (publicOrigin && (!req.secure || req.get('host') !== publicOrigin.host)) {
    res.status(400).send('Richiesta non valida.');
    return;
  }
  if (publicOrigin) res.set('Strict-Transport-Security', 'max-age=31536000');
  res.set({
    'Content-Security-Policy':
      "base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'",
    'Referrer-Policy': 'same-origin',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
  });
  next();
});

app.use('/api/account', accountApi.router);
app.use('/api', (_req, res) => {
  res.set('Cache-Control', 'no-store').status(404).json({ error: 'Pagina non trovata.' });
});

app.use(['/login', '/registrati', '/profilo', '/checkout'], (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
    .catch(next);
});

if (isServerEntry) {
  accountApi.initialize();
  const port = Number(process.env['PORT'] || 4000);
  app.listen(port, '127.0.0.1', (error) => {
    if (error) throw error;
    console.log('Flower Bro in ascolto su http://127.0.0.1:' + port);
  });
}

export const reqHandler = createNodeRequestHandler(app);
