LOCK TABLE accounts, orders IN ACCESS EXCLUSIVE MODE;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM accounts) OR EXISTS (SELECT 1 FROM orders) THEN
        RAISE EXCEPTION 'Gli account e gli ordini esistenti richiedono una migrazione dei dati con la chiave applicativa.';
    END IF;
END;
$$;

-- Format v1: version byte, 12-byte nonce, ciphertext and 16-byte GCM tag.
CREATE DOMAIN encrypted_text AS bytea
    CHECK (octet_length(VALUE) >= 30 AND substring(VALUE FROM 1 FOR 1) = '\x01'::bytea);

ALTER TABLE accounts
    DROP COLUMN name,
    DROP COLUMN email,
    ADD COLUMN name_ciphertext encrypted_text NOT NULL,
    ADD COLUMN email_ciphertext encrypted_text NOT NULL,
    ADD COLUMN email_lookup bytea NOT NULL CHECK (octet_length(email_lookup) = 32),
    ADD CONSTRAINT accounts_email_lookup_unique UNIQUE (email_lookup),
    ADD CONSTRAINT accounts_password_hash_format CHECK (
        password_hash ~ '^(\{bcrypt\})?\$2[aby]\$(1[0-9]|2[0-9]|3[01])\$[./A-Za-z0-9]{53}$'
        OR password_hash ~ '^(\{argon2(@SpringSecurity_v5_8)?\})?\$argon2id\$v=19\$m=[1-9][0-9]*,t=[1-9][0-9]*,p=[1-9][0-9]*\$[A-Za-z0-9+/]{22,}\$[A-Za-z0-9+/]{43,}$'
    );

ALTER TABLE orders
    DROP CONSTRAINT orders_italian_postal_code,
    DROP COLUMN recipient_name,
    DROP COLUMN contact_email,
    DROP COLUMN street_address,
    DROP COLUMN city,
    DROP COLUMN postal_code,
    DROP COLUMN country_code,
    DROP COLUMN gift_message,
    ADD COLUMN delivery_ciphertext encrypted_text NOT NULL;
