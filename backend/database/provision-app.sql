BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'flowerbro_app') THEN
        CREATE ROLE flowerbro_app;
    END IF;
END;
$$;

ALTER ROLE flowerbro_app WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
REVOKE CONNECT, TEMPORARY ON DATABASE flowerbro FROM PUBLIC;
GRANT CONNECT ON DATABASE flowerbro TO flowerbro_app;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO flowerbro_app;

GRANT SELECT ON products, product_origins, tags, product_tags, occasions, occasion_tags, order_totals
    TO flowerbro_app;

GRANT SELECT ON accounts TO flowerbro_app;
GRANT INSERT (name_ciphertext, email_ciphertext, email_lookup, password_hash),
      UPDATE (name_ciphertext, email_ciphertext, email_lookup, password_hash)
    ON accounts TO flowerbro_app;

GRANT SELECT, INSERT, DELETE ON favorites TO flowerbro_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON carts, cart_items TO flowerbro_app;
GRANT SELECT, INSERT ON orders, order_items TO flowerbro_app;
GRANT UPDATE (status) ON orders TO flowerbro_app;
GRANT USAGE ON SEQUENCE accounts_id_seq, orders_id_seq, order_items_id_seq TO flowerbro_app;

\password flowerbro_app

COMMIT;
