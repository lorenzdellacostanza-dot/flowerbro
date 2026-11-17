import express, { type ErrorRequestHandler, type Request, type Response } from 'express';
import { request, type OutgoingHttpHeaders } from 'node:http';
import { isIP } from 'node:net';
import { readBackendPort } from './backend-port';

const accountPath = '/api/account';
const forwardedHeaders = ['host', 'origin', 'sec-fetch-site', 'content-type', 'cookie'] as const;
const responseHeaders = ['content-type', 'retry-after', 'set-cookie'] as const;

export function createApiProxy(publicOrigin: URL | undefined) {
  const port = readBackendPort();
  const router = express.Router();
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  function forward(req: Request, res: Response, method: 'GET' | 'POST', path: string) {
    const body = method === 'POST' && Buffer.isBuffer(req.body) ? req.body : undefined;
    const headers: OutgoingHttpHeaders = {};

    for (const name of forwardedHeaders) {
      const value = req.get(name);
      if (value !== undefined) headers[name] = value;
    }
    if (method === 'POST') headers['content-length'] = body?.length ?? 0;
    if (publicOrigin) {
      headers['x-forwarded-proto'] = 'https';
      const ip = req.ip && isIP(req.ip) ? req.ip : req.socket.remoteAddress;
      if (ip && isIP(ip)) headers['x-forwarded-for'] = ip;
    }

    function unavailable() {
      if (res.destroyed) return;
      if (res.headersSent) {
        res.destroy();
        return;
      }
      res.status(502).json({ error: 'Il servizio è momentaneamente non disponibile. Riprova tra poco.' });
    }

    const upstream = request(
      {
        host: '127.0.0.1',
        port,
        method,
        path,
        headers,
        signal: AbortSignal.timeout(15_000),
      },
      (response) => {
        const status = response.statusCode ?? 502;
        const json = response.headers['content-type']?.split(';', 1)[0] === 'application/json';
        if ((status >= 300 && status < 400) || (status !== 204 && !json)) {
          response.resume();
          unavailable();
          return;
        }
        for (const name of responseHeaders) {
          const value = response.headers[name];
          if (value !== undefined) res.set(name, value);
        }
        response.once('error', unavailable);
        response.pipe(res.status(status));
      },
    );
    upstream.once('error', unavailable);
    res.once('close', () => {
      if (!res.writableFinished) upstream.destroy();
    });
    upstream.end(body);
  }

  router.get('/account', (req, res) => forward(req, res, 'GET', accountPath));

  const readAccount = express.raw({ type: () => true, limit: '4kb', inflate: false });
  for (const action of ['register', 'login', 'logout']) {
    router.post('/account/' + action, readAccount, (req, res) =>
      forward(req, res, 'POST', accountPath + '/' + action),
    );
  }

  router.get('/catalog', (req, res) => forward(req, res, 'GET', '/api/catalog'));
  const readOrder = express.raw({ type: () => true, limit: '16kb', inflate: false });
  router.post('/orders', readOrder, (req, res) => forward(req, res, 'POST', '/api/orders'));

  router.use((_req, res) => {
    res.status(404).json({ error: 'Pagina non trovata.' });
  });

  const handleRequestError: ErrorRequestHandler = (error, _req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }
    const status = [400, 413, 415].includes(error?.status) ? error.status : 500;
    res.status(status).json({ error: 'Richiesta non valida.' });
  };
  router.use(handleRequestError);

  return router;
}
