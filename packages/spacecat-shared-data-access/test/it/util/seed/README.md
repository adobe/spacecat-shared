# SQL Seed Data

## Overview
`seed-data.sql` is auto-generated from the JS test fixtures. It provides a faster
alternative to JS-based seeding for integration tests.

## Usage
Set `IT_SEED_MODE=sql` to use SQL seeding instead of the default JS seeding:
```
IT_SEED_MODE=sql npm run test:it
```

## Regenerating
After changing JS fixtures, regenerate the SQL seed:
1. Start the Docker stack: `docker compose -f test/it/util/docker-compose.yml up -d`
2. Run JS seeding (via test suite or manually)
3. Generate: `node test/it/util/seed/generate-seed-sql.js`
