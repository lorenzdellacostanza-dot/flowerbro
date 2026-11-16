import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';

try {
  const key = randomBytes(32).toString('base64url');
  writeFileSync(new URL('../.env', import.meta.url), 'FLOWERBRO_DATA_KEY=' + key + '\n', {
    flag: 'wx',
    mode: 0o600,
  });
  console.log('Configurazione locale creata.');
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
  console.log('Configurazione locale già presente.');
}
