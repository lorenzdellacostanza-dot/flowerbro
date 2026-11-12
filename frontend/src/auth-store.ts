import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  hkdfSync,
  randomBytes,
  scrypt,
  timingSafeEqual,
} from 'node:crypto';
import { closeSync, constants, fchmodSync, fstatSync, mkdirSync, openSync } from 'node:fs';
import { dirname } from 'node:path';

export interface AccountProfile {
  name: string;
  email: string;
}

interface AuthenticatedAccount {
  profile: AccountProfile;
  token: string;
}

interface AuthStore {
  register(
    profile: AccountProfile,
    password: string,
    previousToken?: string,
  ): Promise<AuthenticatedAccount | null>;
  signIn(
    email: string,
    password: string,
    previousToken?: string,
  ): Promise<AuthenticatedAccount | null>;
  profile(token: string): AccountProfile | null;
  signOut(token: string): void;
  close(): void;
}

export const sessionLifetimeSeconds = 7 * 24 * 60 * 60;

const nonceSize = 12;
const tagSize = 16;
const passwordHashSize = 32;
const scryptOptions = { N: 2 ** 15, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };

function prepareDatabaseFile(path: string): void {
  if (path === ':memory:') return;

  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const noFollow = process.platform === 'win32' ? 0 : constants.O_NOFOLLOW;
  const descriptor = openSync(path, constants.O_CREAT | constants.O_RDWR | noFollow, 0o600);
  try {
    if (!fstatSync(descriptor).isFile()) {
      throw new Error('The auth database must be a regular file.');
    }
    if (process.platform !== 'win32') fchmodSync(descriptor, 0o600);
  } finally {
    closeSync(descriptor);
  }
}

function deriveKey(rootKey: Buffer, purpose: string): Buffer {
  return Buffer.from(hkdfSync('sha256', rootKey, '', purpose, 32));
}

function hashPassword(password: string, salt: Uint8Array): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, passwordHashSize, scryptOptions, (error, hash) => {
      if (error) reject(error);
      else resolve(hash);
    });
  });
}

function hashToken(token: string): Buffer | null {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  return createHash('sha256').update(token).digest();
}

function currentSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export function openAuthStore(path: string, rootKey: Buffer): AuthStore {
  if (rootKey.length !== 32) {
    throw new Error('The auth encryption key must contain 32 bytes.');
  }

  const profileKey = deriveKey(rootKey, 'flowerbro/auth/profile-encryption/v1');
  const emailKey = deriveKey(rootKey, 'flowerbro/auth/email-lookup/v1');
  const expectedKeyCheck = deriveKey(rootKey, 'flowerbro/auth/database-key-check/v1');
  const dummySalt = randomBytes(16);
  const dummyHash = randomBytes(passwordHashSize);

  // node:sqlite requires its prefix, which Angular's server bundler removes from static imports.
  const { DatabaseSync } = process.getBuiltinModule('node:sqlite');
  prepareDatabaseFile(path);
  const database = new DatabaseSync(path, { timeout: 5000, enableForeignKeyConstraints: true });

  function transaction<T>(operation: () => T): T {
    database.exec('BEGIN IMMEDIATE');
    try {
      const result = operation();
      database.exec('COMMIT');
      return result;
    } catch (error) {
      if (database.isTransaction) database.exec('ROLLBACK');
      throw error;
    }
  }

  try {
    database.exec('PRAGMA trusted_schema = OFF;');
    transaction(() => {
      database.exec(`
        CREATE TABLE IF NOT EXISTS accounts (
          email_lookup BLOB PRIMARY KEY CHECK(length(email_lookup) = 32),
          encrypted_profile BLOB NOT NULL,
          password_salt BLOB NOT NULL CHECK(length(password_salt) = 16),
          password_hash BLOB NOT NULL CHECK(length(password_hash) = 32)
        ) STRICT, WITHOUT ROWID;
        CREATE TABLE IF NOT EXISTS sessions (
          token_hash BLOB PRIMARY KEY CHECK(length(token_hash) = 32),
          email_lookup BLOB NOT NULL REFERENCES accounts(email_lookup) ON DELETE CASCADE,
          expires_at INTEGER NOT NULL
        ) STRICT, WITHOUT ROWID;
        CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
        CREATE TABLE IF NOT EXISTS auth_metadata (
          name TEXT PRIMARY KEY, value BLOB NOT NULL
        ) STRICT, WITHOUT ROWID;
      `);

      const keyCheck = database
        .prepare("SELECT value FROM auth_metadata WHERE name = 'key_check'")
        .get()?.['value'];
      if (keyCheck === undefined && !database.prepare('SELECT 1 FROM accounts LIMIT 1').get()) {
        database
          .prepare("INSERT INTO auth_metadata (name, value) VALUES ('key_check', ?)")
          .run(expectedKeyCheck);
      } else if (
        !(keyCheck instanceof Uint8Array) ||
        keyCheck.length !== expectedKeyCheck.length ||
        !timingSafeEqual(keyCheck, expectedKeyCheck)
      ) {
        throw new Error('The auth encryption key does not match this database.');
      }
    });

    const insertAccount = database.prepare(`
      INSERT INTO accounts (email_lookup, encrypted_profile, password_salt, password_hash)
      VALUES (?, ?, ?, ?) ON CONFLICT (email_lookup) DO NOTHING
    `);
    const selectAccount = database.prepare(
      'SELECT encrypted_profile, password_salt, password_hash FROM accounts WHERE email_lookup = ?',
    );
    const insertSession = database.prepare(
      'INSERT INTO sessions (token_hash, email_lookup, expires_at) VALUES (?, ?, ?)',
    );
    const selectSession = database.prepare(`
      SELECT accounts.encrypted_profile, sessions.email_lookup
      FROM sessions JOIN accounts USING (email_lookup)
      WHERE token_hash = ? AND expires_at > ?
    `);
    const deleteSession = database.prepare('DELETE FROM sessions WHERE token_hash = ?');
    const deleteExpiredSessions = database.prepare('DELETE FROM sessions WHERE expires_at <= ?');
    deleteExpiredSessions.run(currentSeconds());

    function emailLookup(email: string): Buffer {
      return createHmac('sha256', emailKey).update(email).digest();
    }

    function encryptProfile(profile: AccountProfile, lookup: Buffer): Buffer {
      const nonce = randomBytes(nonceSize);
      const cipher = createCipheriv('aes-256-gcm', profileKey, nonce);
      cipher.setAAD(lookup);
      const encrypted = Buffer.concat([
        cipher.update(JSON.stringify(profile), 'utf8'),
        cipher.final(),
      ]);
      return Buffer.concat([nonce, cipher.getAuthTag(), encrypted]);
    }

    function decryptProfile(value: Uint8Array, lookup: Uint8Array): AccountProfile {
      const decipher = createDecipheriv('aes-256-gcm', profileKey, value.subarray(0, nonceSize));
      decipher.setAAD(lookup);
      decipher.setAuthTag(value.subarray(nonceSize, nonceSize + tagSize));
      const decrypted = Buffer.concat([
        decipher.update(value.subarray(nonceSize + tagSize)),
        decipher.final(),
      ]);
      return JSON.parse(decrypted.toString('utf8')) as AccountProfile;
    }

    function signOut(token: string): void {
      const hash = hashToken(token);
      if (hash) deleteSession.run(hash);
    }

    function createSession(lookup: Buffer, previousToken?: string): string {
      const token = randomBytes(32).toString('base64url');
      const now = currentSeconds();
      deleteExpiredSessions.run(now);
      if (previousToken) signOut(previousToken);
      insertSession.run(
        createHash('sha256').update(token).digest(),
        lookup,
        now + sessionLifetimeSeconds,
      );
      return token;
    }

    return {
      async register(profile, password, previousToken) {
        const normalizedProfile = { name: profile.name, email: profile.email.trim().toLowerCase() };
        const lookup = emailLookup(normalizedProfile.email);
        const salt = randomBytes(16);
        const hash = await hashPassword(password, salt);
        const encrypted = encryptProfile(normalizedProfile, lookup);
        return transaction(() => {
          if (!insertAccount.run(lookup, encrypted, salt, hash).changes) return null;
          return { profile: normalizedProfile, token: createSession(lookup, previousToken) };
        });
      },

      async signIn(email, password, previousToken) {
        const lookup = emailLookup(email.trim().toLowerCase());
        const account = selectAccount.get(lookup);
        const salt = account?.['password_salt'];
        const expectedHash = account?.['password_hash'];
        const encrypted = account?.['encrypted_profile'];
        const hash = await hashPassword(password, salt instanceof Uint8Array ? salt : dummySalt);
        const matches = timingSafeEqual(
          hash,
          expectedHash instanceof Uint8Array ? expectedHash : dummyHash,
        );
        if (!matches || !(encrypted instanceof Uint8Array)) return null;
        const profile = decryptProfile(encrypted, lookup);
        return transaction(() => ({ profile, token: createSession(lookup, previousToken) }));
      },

      profile(token) {
        const hash = hashToken(token);
        if (!hash) return null;
        const session = selectSession.get(hash, currentSeconds());
        const value = session?.['encrypted_profile'];
        const lookup = session?.['email_lookup'];
        if (!(value instanceof Uint8Array) || !(lookup instanceof Uint8Array)) return null;
        return decryptProfile(value, lookup);
      },

      signOut,
      close: () => database.close(),
    };
  } catch (error) {
    database.close();
    throw error;
  }
}
