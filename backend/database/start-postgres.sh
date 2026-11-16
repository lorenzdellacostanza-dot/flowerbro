#!/bin/sh
set -eu

tls_dir=/var/lib/postgresql/tls
trust_dir=/etc/flowerbro/trust

install -d -m 0700 -o postgres -g postgres "$tls_dir"
if [ ! -s "$tls_dir/server.crt" ] || [ ! -s "$tls_dir/server.key" ]; then
    (
        umask 077
        openssl req -x509 -newkey rsa:3072 -sha256 -noenc -days 3650 \
            -subj '/CN=Flower Bro local database' \
            -addext 'subjectAltName=DNS:db,DNS:localhost,IP:127.0.0.1' \
            -keyout "$tls_dir/server.key.new" -out "$tls_dir/server.crt.new"
    )
    install -m 0600 -o postgres -g postgres "$tls_dir/server.key.new" "$tls_dir/server.key"
    install -m 0644 -o postgres -g postgres "$tls_dir/server.crt.new" "$tls_dir/server.crt"
    rm -f "$tls_dir/server.key.new" "$tls_dir/server.crt.new"
fi

install -d -m 0755 "$trust_dir"
install -m 0644 "$tls_dir/server.crt" "$trust_dir/ca.crt"

exec /usr/local/bin/docker-entrypoint.sh "$@"
