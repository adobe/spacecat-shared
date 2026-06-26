# Runnable-server form of the stateful Project Engine Counterfact mock, served over HTTPS.
#
# The published client ships only `src/` (`files: ["src"]`), so the mock never reaches consumers
# via npm. This image is how a cross-repo e2e suite (spacecat-api-service) consumes the mock — the
# same way spacecat-shared-data-access consumes the mysticat-data-service image for its IT tests.
#
# api-service's transport rejects any non-https base URL (rest-transport.js `baseUrl()` throws 503
# on a non-`https:` scheme), and Counterfact only speaks plain HTTP, so this image runs Caddy as a
# TLS terminator in front of the mock. TLS is satisfied for real, not bypassed.
#
# Build context = THIS package dir. The package has no in-monorepo dependencies (only openapi-fetch
# + public devDeps incl. counterfact), so a standalone `npm install` resolves everything without
# the monorepo. `npm run docker:build` invokes this from the package dir.
FROM node:24-alpine

# caddy   — TLS terminator in front of the plain-HTTP mock
# openssl — mints the self-signed cert at BUILD time (no private key is committed to this public repo)
# bash    — entrypoint uses `wait -n` (not available in busybox ash)
# curl    — HEALTHCHECK probe
RUN apk add --no-cache caddy openssl bash curl

WORKDIR /app

# Deps first for layer caching. counterfact is a devDependency but is REQUIRED at runtime
# (mock/run.js spawns its CLI), so a full install — not --omit=dev — is intentional.
# --legacy-peer-deps: a standalone install (no monorepo lockfile) otherwise ERESOLVE-fails on a
# build-time-only devDep peer range (openapi-typescript wants typescript@^5, the package pins 6) that
# the hoisted monorepo install tolerates. openapi-typescript/typescript are unused at runtime.
COPY package.json ./
RUN npm install --no-audit --no-fund --ignore-scripts --legacy-peer-deps

# Mock source + spec + overlay tooling.
COPY mock ./mock
COPY spec ./spec
COPY scripts ./scripts

# Bake build/openapi3.json — the gitignored intermediate the runner requires. Only the
# convert + overlay steps are needed to serve; generate:ts/generate:pydantic produce committed
# artifacts and need Python, neither of which is needed at runtime.
RUN npm run spec:convert && npm run spec:overlay

# Self-signed cert for https://…:8443, minted at build time so no key lives in this public repo.
# SANs cover every host the cert is reached by:
#   localhost / 127.0.0.1 → test process on the host (local dev + non-containerized CI)
#   project-engine-mock   → reached by docker/compose service alias from a containerized CI job
# 100-year lifetime so it never silently expires. Test-only: it carries no real trust — consumers
# disable verification (NODE_TLS_REJECT_UNAUTHORIZED=0) for the e2e process. See docs/mock-docker.md.
RUN mkdir -p /etc/tls && openssl req -x509 -newkey rsa:2048 -nodes \
      -keyout /etc/tls/key.pem -out /etc/tls/cert.pem \
      -days 36500 -subj "/CN=project-engine-mock" \
      -addext "subjectAltName=DNS:localhost,DNS:project-engine-mock,IP:127.0.0.1"

COPY Caddyfile /etc/caddy/Caddyfile
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# 8443 (TLS) is the ONLY exposed surface. The mock's plain-HTTP 4010 stays internal: its __* control
# routes are unauthenticated and /__dump returns the entire store, so the image must only ever be
# reached over loopback / on an ephemeral CI runner, never a shared host (see docs/mock-docker.md).
EXPOSE 8443

HEALTHCHECK --interval=5s --timeout=3s --start-period=30s --retries=10 \
  CMD curl -ksf https://localhost:8443/enterprise/projects/api/__dump >/dev/null || exit 1

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
