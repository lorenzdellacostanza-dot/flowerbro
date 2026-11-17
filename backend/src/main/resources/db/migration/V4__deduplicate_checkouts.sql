ALTER TABLE orders
    ADD COLUMN checkout_key uuid UNIQUE,
    ADD COLUMN checkout_hash bytea,
    ADD CONSTRAINT orders_checkout_hash_valid CHECK (
        (checkout_key IS NULL AND checkout_hash IS NULL)
        OR (checkout_key IS NOT NULL AND checkout_hash IS NOT NULL AND octet_length(checkout_hash) = 32)
    );
