# Runnable-server form of the stateful User Manager Counterfact mock, served over HTTPS.
#
# The published client ships only `src/` (`files: ["src"]`), so the mock never reaches consumers
# via npm. This image is how a cross-repo e2e suite (spacecat-api-service) consumes the mock — the
# same way spacecat-shared-data-access consumes the mysticat-data-service image for its IT tests.
#
# api-service's transport rejects any non-https base URL (rest-transport.js `baseUrl()` throws 503
# on a non-`https:` scheme), and Counterfact only speaks plain HTTP, so this image runs Caddy as a
# TLS terminator in front of the mock. TLS is satisfied for real, not bypassed.
#
# Build context = THIS package dir. The package has no in-monorepo dependencies, so a standalone
# install resolves everything without the monorepo. `npm run docker:build` invokes this from the
# package dir.
#
# Two stages keep the runtime image lean: the BUILDER carries the full dev toolchain (to convert +
# overlay the vendored swagger and mint the cert); the RUNTIME stage ships only the mock engine
# (counterfact), the built spec, the cert, and Caddy/curl — none of the build/test toolchain.

# Pinned to the multi-arch index digest of node:24-alpine for reproducibility (works on amd64 CI
# and arm64 local alike). Bump the digest deliberately when upgrading the base.
FROM node:24-alpine@sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd AS builder

# openssl is BUILD-ONLY: it mints the self-signed cert below, which is then copied into the runtime
# stage. The runtime stage never needs openssl.
RUN apk add --no-cache openssl

WORKDIR /app

# Full install (incl. devDeps) so spec:convert / spec:overlay can run. --legacy-peer-deps: a
# standalone install (no monorepo lockfile) otherwise ERESOLVE-fails on a build-only devDep peer
# range (openapi-typescript wants typescript@^5, the package pins 6) that the hoisted monorepo
# install tolerates. openapi-typescript/typescript are unused at runtime.
COPY package.json ./
RUN npm install --no-audit --no-fund --ignore-scripts --legacy-peer-deps

# Bake build/openapi3.json — the gitignored intermediate the runner requires. Only the convert +
# overlay steps are needed to serve; generate:ts/generate:pydantic produce committed artifacts and
# need Python, neither of which is needed to run the mock.
COPY spec ./spec
COPY scripts ./scripts
RUN npm run spec:convert && npm run spec:overlay

# Self-signed cert for https://…:8443, minted at build time so no key lives in this public repo.
# SANs cover every host the cert is reached by:
#   localhost / 127.0.0.1 → test process on the host (local dev + non-containerized CI)
#   user-manager-client-mock     → reached by docker/compose service alias from a containerized CI job
# 100-year lifetime so it never silently expires. Test-only: it carries no real trust — consumers
# disable verification (NODE_TLS_REJECT_UNAUTHORIZED=0) for the e2e process. See docs/mock-docker.md.
RUN mkdir -p /etc/tls && openssl req -x509 -newkey rsa:2048 -nodes \
      -keyout /etc/tls/key.pem -out /etc/tls/cert.pem \
      -days 36500 -subj "/CN=user-manager-client-mock" \
      -addext "subjectAltName=DNS:localhost,DNS:user-manager-client-mock,IP:127.0.0.1"


# ---- runtime stage -------------------------------------------------------------------------------
FROM node:24-alpine@sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd

# caddy — TLS terminator in front of the plain-HTTP mock
# curl  — HEALTHCHECK probe
# (openssl and bash are intentionally NOT installed: cert minting happens in the builder, and the
#  entrypoint is POSIX sh.)
RUN apk add --no-cache caddy curl

WORKDIR /app

# Runtime deps only. counterfact is the mock's runtime engine (mock/run.js spawns its CLI) but stays
# a devDependency in package.json so consumers of the PUBLISHED client (files: ["src"]) do NOT
# inherit it and its ~100 MB build toolchain. The image installs it explicitly here instead: we
# derive a throwaway runtime-only manifest that promotes counterfact into `dependencies` (pinned to
# the exact version package.json declares — single source of truth, no drift) and drops every
# devDependency. With the devDeps gone the ERESOLVE conflict is gone too, so no --legacy-peer-deps.
COPY package.json ./
RUN node -e "const p=require('./package.json'); const cf=p.devDependencies&&p.devDependencies.counterfact; if(!cf){console.error('counterfact missing from devDependencies'); process.exit(1);} require('fs').writeFileSync('package.json', JSON.stringify({ name: p.name, version: p.version, type: p.type, dependencies: { ...p.dependencies, counterfact: cf } }, null, 2));" \
 && npm install --no-audit --no-fund --ignore-scripts --omit=dev \
 && npm cache clean --force \
 && find node_modules -type f \( -name '*.map' -o -name '*.md' -o -name '*.markdown' -o -name '*.d.ts' \) ! -iname 'LICENSE*' ! -iname 'COPYING*' -delete
# ^ npm cache clean + strip runtime-irrelevant files from the dep tree, in the same layer so they
#   never reach the image: source maps (debug-only), docs, and *.d.ts TYPE DECLARATIONS (type-only,
#   never executed — counterfact's runtime transpiler is transpile-only, verified by the smoke test).
#   LICENSE/COPYING files are kept for 3rd-party license compliance — including the `.md` ones, hence
#   the `! -iname` excludes. *.ts SOURCE files and package test dirs are left alone (small, and
#   counterfact's runtime transpile path isn't worth risking for the MB). The node -e guard fails the
#   build loudly if counterfact ever leaves devDependencies (rather than shipping a broken mock).

# Mock source + the built spec. spec/ and scripts/ are build-only (convert/overlay already ran in
# the builder), so the runtime image carries only the materialization inputs the runner reads:
# mock/** and build/openapi3.json.
COPY mock ./mock
COPY --from=builder /app/build/openapi3.json ./build/openapi3.json
# --chown=node so caddy (which runs as the unprivileged `node` user below) can read the TLS key
# without widening its mode. The key is a build-time self-signed test cert with no real trust.
COPY --from=builder --chown=node:node /etc/tls /etc/tls

COPY Caddyfile /etc/caddy/Caddyfile
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Run as the unprivileged `node` user (uid 1000, present in the base image) rather than root. Only
# /app must be writable — the runner materializes handlers into /app/.counterfact at boot — so we
# chown just the /app DIR (not -R: a recursive chown would duplicate the whole node_modules tree
# into a new layer). node_modules/build/mock stay root-owned and are read-only at runtime; the
# world-readable default perms let `node` read them. HOME is set so caddy's storage path is writable.
ENV HOME=/home/node
RUN chown node:node /app
USER node

# 8443 (TLS) is the ONLY exposed surface. The mock's plain-HTTP 4010 stays internal: its __* control
# routes are unauthenticated and /__dump returns the entire store, so the image must only ever be
# reached over loopback / on an ephemeral CI runner, never a shared host (see docs/mock-docker.md).
EXPOSE 8443

HEALTHCHECK --interval=5s --timeout=3s --start-period=30s --retries=10 \
  CMD curl -ksf https://localhost:8443/enterprise/users/api/__dump >/dev/null || exit 1

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
