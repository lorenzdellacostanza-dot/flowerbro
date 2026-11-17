import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { readBackendPort } from '../backend-port';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';
import { CATALOG_URL } from './services/flower.service';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    { provide: CATALOG_URL, useFactory: () => 'http://127.0.0.1:' + readBackendPort() + '/api/catalog' },
  ]
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
