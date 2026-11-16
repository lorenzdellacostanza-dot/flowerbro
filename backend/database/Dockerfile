FROM postgres:18

# Install PostgreSQL minor updates from the signed PGDG repository in the base image.
RUN apt-get update \
    && apt-get install -y --no-install-recommends postgresql-18 postgresql-client-18 libpq5 \
    && rm -rf /var/lib/apt/lists/*
