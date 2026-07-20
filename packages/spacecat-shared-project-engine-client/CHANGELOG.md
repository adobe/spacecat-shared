## [@adobe/spacecat-shared-project-engine-client-v1.13.0](https://github.com/adobe/spacecat-shared/compare/@adobe/spacecat-shared-project-engine-client-v1.12.0...@adobe/spacecat-shared-project-engine-client-v1.13.0) (2026-07-20)

### Features

* **project-engine-client:** intent-named facade over the openapi-fetch client (LLMO-5977) ([#1823](https://github.com/adobe/spacecat-shared/issues/1823)) ([eef51fd](https://github.com/adobe/spacecat-shared/commit/eef51fd950b49e6a2b5c040d544f44a7491c756d))

## [@adobe/spacecat-shared-project-engine-client-v1.12.0](https://github.com/adobe/spacecat-shared/compare/@adobe/spacecat-shared-project-engine-client-v1.11.0...@adobe/spacecat-shared-project-engine-client-v1.12.0) (2026-07-16)

### Features

* **project-engine-client:** add requestTimeoutMs per-attempt request deadline (LLMO-5979) ([#1819](https://github.com/adobe/spacecat-shared/issues/1819)) ([f745d3c](https://github.com/adobe/spacecat-shared/commit/f745d3c1ec436c70290f46c86a4c9f9885359dcb))

## [@adobe/spacecat-shared-project-engine-client-v1.11.0](https://github.com/adobe/spacecat-shared/compare/@adobe/spacecat-shared-project-engine-client-v1.10.1...@adobe/spacecat-shared-project-engine-client-v1.11.0) (2026-07-15)

### Features

* **project-engine-client:** mock the in-place prompt rename with 409 on text collision ([#1814](https://github.com/adobe/spacecat-shared/issues/1814)) ([816e613](https://github.com/adobe/spacecat-shared/commit/816e61315dcc5351d3494d26c0e354918ca750e0))

## [@adobe/spacecat-shared-project-engine-client-v1.10.1](https://github.com/adobe/spacecat-shared/compare/@adobe/spacecat-shared-project-engine-client-v1.10.0...@adobe/spacecat-shared-project-engine-client-v1.10.1) (2026-07-13)

### Bug Fixes

* **project-engine-client:** enforce https:// on the brand_urls mock ([#1778](https://github.com/adobe/spacecat-shared/issues/1778)) ([46c4860](https://github.com/adobe/spacecat-shared/commit/46c48604834162415046af8a2aaca4fa12b60940)), closes [serenity-docs#25](https://github.com/adobe/serenity-docs/issues/25) [serenity-docs#25](https://github.com/adobe/serenity-docs/issues/25) [#2748](https://github.com/adobe/spacecat-shared/issues/2748) [#737](https://github.com/adobe/spacecat-shared/issues/737) [#2748](https://github.com/adobe/spacecat-shared/issues/2748) [#737](https://github.com/adobe/spacecat-shared/issues/737) [#2748](https://github.com/adobe/spacecat-shared/issues/2748)

## [@adobe/spacecat-shared-project-engine-client-v1.10.0](https://github.com/adobe/spacecat-shared/compare/@adobe/spacecat-shared-project-engine-client-v1.9.0...@adobe/spacecat-shared-project-engine-client-v1.10.0) (2026-07-10)

### Features

* **project-engine-client:** model dimension-root tags in the mock ([#1799](https://github.com/adobe/spacecat-shared/issues/1799)) ([5d482a1](https://github.com/adobe/spacecat-shared/commit/5d482a1dd2262d7c1341925ab7f29cb2ab5cb381))

## [@adobe/spacecat-shared-project-engine-client-v1.9.0](https://github.com/adobe/spacecat-shared/compare/@adobe/spacecat-shared-project-engine-client-v1.8.0...@adobe/spacecat-shared-project-engine-client-v1.9.0) (2026-07-06)

### Features

* **project-engine-client:** re-vendor Semrush swagger; retire CR9/CR10, slim CR16 ([#1772](https://github.com/adobe/spacecat-shared/issues/1772)) ([8e63f1a](https://github.com/adobe/spacecat-shared/commit/8e63f1af63339a9b8b6cb5c7fd65481098956326))

## [@adobe/spacecat-shared-project-engine-client-v1.8.0](https://github.com/adobe/spacecat-shared/compare/@adobe/spacecat-shared-project-engine-client-v1.7.1...@adobe/spacecat-shared-project-engine-client-v1.8.0) (2026-07-03)

### Features

* **project-engine-client:** add GET /v1/url/resolve to the vendored client + mock ([#1771](https://github.com/adobe/spacecat-shared/issues/1771)) ([e8f22b7](https://github.com/adobe/spacecat-shared/commit/e8f22b75db738a6c10f48796a521d55a8b79f2e3)), closes [#737](https://github.com/adobe/spacecat-shared/issues/737) [serenity-docs#25](https://github.com/adobe/serenity-docs/issues/25) [serenity-docs#25](https://github.com/adobe/serenity-docs/issues/25)

## [@adobe/spacecat-shared-project-engine-client-v1.7.1](https://github.com/adobe/spacecat-shared/compare/@adobe/spacecat-shared-project-engine-client-v1.7.0...@adobe/spacecat-shared-project-engine-client-v1.7.1) (2026-07-02)

### Bug Fixes

* **project-engine-client:** retype aio-create-prompt-v2's 200 response (CR14) ([#1765](https://github.com/adobe/spacecat-shared/issues/1765)) ([33315e1](https://github.com/adobe/spacecat-shared/commit/33315e1bcd3d7d789aaec9e1a72c12e69bfa7799)), closes [#1764](https://github.com/adobe/spacecat-shared/issues/1764) [#1764](https://github.com/adobe/spacecat-shared/issues/1764)

## [@adobe/spacecat-shared-project-engine-client-v1.7.0](https://github.com/adobe/spacecat-shared/compare/@adobe/spacecat-shared-project-engine-client-v1.6.0...@adobe/spacecat-shared-project-engine-client-v1.7.0) (2026-07-02)

### Features

* **project-engine-client:** URL-safe tag ids + id-based prompt-write mock routes ([#1764](https://github.com/adobe/spacecat-shared/issues/1764)) ([97b9079](https://github.com/adobe/spacecat-shared/commit/97b907986c6236e0bd0a752763ab4c03757ae3fa)), closes [#1760](https://github.com/adobe/spacecat-shared/issues/1760) [#1760](https://github.com/adobe/spacecat-shared/issues/1760)

## [@adobe/spacecat-shared-project-engine-client-v1.6.0](https://github.com/adobe/spacecat-shared/compare/@adobe/spacecat-shared-project-engine-client-v1.5.0...@adobe/spacecat-shared-project-engine-client-v1.6.0) (2026-07-01)

### Features

* **project-engine-client:** model 1-level nested AIO tags in the mock ([#1758](https://github.com/adobe/spacecat-shared/issues/1758)) ([a040b45](https://github.com/adobe/spacecat-shared/commit/a040b459b50b0e7fa02d098034f75b2936fb0497)), closes [serenity-docs#21](https://github.com/adobe/serenity-docs/issues/21)

## [@adobe/spacecat-shared-project-engine-client-v1.5.0](https://github.com/adobe/spacecat-shared/compare/@adobe/spacecat-shared-project-engine-client-v1.4.1...@adobe/spacecat-shared-project-engine-client-v1.5.0) (2026-07-01)

### Features

* **project-engine-client:** fold serenity sub-workspace fixtures into the baked mock seed ([#1759](https://github.com/adobe/spacecat-shared/issues/1759)) ([1522237](https://github.com/adobe/spacecat-shared/commit/1522237a0f883ae1c0740adcf2774375ab7f22cb))

## [@adobe/spacecat-shared-project-engine-client-v1.4.1](https://github.com/adobe/spacecat-shared/compare/@adobe/spacecat-shared-project-engine-client-v1.4.0...@adobe/spacecat-shared-project-engine-client-v1.4.1) (2026-06-30)

### Bug Fixes

* **project-engine-client:** resolve added AI model to real catalog name/icon in mock ([#1753](https://github.com/adobe/spacecat-shared/issues/1753)) ([0b74bc0](https://github.com/adobe/spacecat-shared/commit/0b74bc0c5443371f500f622cc96862371849c342))

## [@adobe/spacecat-shared-project-engine-client-v1.4.0](https://github.com/adobe/spacecat-shared/compare/@adobe/spacecat-shared-project-engine-client-v1.3.2...@adobe/spacecat-shared-project-engine-client-v1.4.0) (2026-06-30)

### Features

* **project-engine-client:** make project AIO tags a stateful mock resource ([#1752](https://github.com/adobe/spacecat-shared/issues/1752)) ([91f7d25](https://github.com/adobe/spacecat-shared/commit/91f7d253cd93ddf29d29ac3bdef226f15109014f))

## [@adobe/spacecat-shared-project-engine-client-v1.3.2](https://github.com/adobe/spacecat-shared/compare/@adobe/spacecat-shared-project-engine-client-v1.3.1...@adobe/spacecat-shared-project-engine-client-v1.3.2) (2026-06-29)

### Bug Fixes

* **project-engine-client, user-manager-client:** round-trip created+published market + live-fidelity sweep ([#1745](https://github.com/adobe/spacecat-shared/issues/1745)) ([#1746](https://github.com/adobe/spacecat-shared/issues/1746)) ([d3d823c](https://github.com/adobe/spacecat-shared/commit/d3d823c58f155ffa35258ff40c16b2b6f4fe2d56)), closes [#1742](https://github.com/adobe/spacecat-shared/issues/1742)

## [@adobe/spacecat-shared-project-engine-client-v1.3.1](https://github.com/adobe/spacecat-shared/compare/@adobe/spacecat-shared-project-engine-client-v1.3.0...@adobe/spacecat-shared-project-engine-client-v1.3.1) (2026-06-29)

### Bug Fixes

* **project-engine-client:** bypass Counterfact 406 on empty-body 2xx mock acks ([#1744](https://github.com/adobe/spacecat-shared/issues/1744)) ([17e6107](https://github.com/adobe/spacecat-shared/commit/17e6107d0ec3802a57c8349f5034541bac834d0a))

## [@adobe/spacecat-shared-project-engine-client-v1.3.0](https://github.com/adobe/spacecat-shared/compare/@adobe/spacecat-shared-project-engine-client-v1.2.0...@adobe/spacecat-shared-project-engine-client-v1.3.0) (2026-06-26)

### Features

* **project-engine-client:** publish stateful mock as an HTTPS Docker image (LLMO-5460) ([#1732](https://github.com/adobe/spacecat-shared/issues/1732)) ([5ba100f](https://github.com/adobe/spacecat-shared/commit/5ba100fb55bd89e92e18125cc1c2ba0df59fa5b3))

## [@adobe/spacecat-shared-project-engine-client-v1.2.0](https://github.com/adobe/spacecat-shared/compare/@adobe/spacecat-shared-project-engine-client-v1.1.1...@adobe/spacecat-shared-project-engine-client-v1.2.0) (2026-06-26)

### Features

* **project-engine-client:** stateful mock core — store, resource ops, seeds (LLMO-5460) ([#1665](https://github.com/adobe/spacecat-shared/issues/1665)) ([5cf66c1](https://github.com/adobe/spacecat-shared/commit/5cf66c13a109c288217a4a87f2626939c3be035e)), closes [#1660](https://github.com/adobe/spacecat-shared/issues/1660) [#1661](https://github.com/adobe/spacecat-shared/issues/1661)

## [@adobe/spacecat-shared-project-engine-client-v1.1.1](https://github.com/adobe/spacecat-shared/compare/@adobe/spacecat-shared-project-engine-client-v1.1.0...@adobe/spacecat-shared-project-engine-client-v1.1.1) (2026-06-23)

### Bug Fixes

* **project-engine-client:** correct workspace-id param location (CR4) + publish to npm ([#1706](https://github.com/adobe/spacecat-shared/issues/1706)) ([50f52dc](https://github.com/adobe/spacecat-shared/commit/50f52dcb6ab40c9c551624d77c7a17b34e092250))

## [@adobe/spacecat-shared-project-engine-client-v1.1.0](https://github.com/adobe/spacecat-shared/compare/@adobe/spacecat-shared-project-engine-client-v1.0.0...@adobe/spacecat-shared-project-engine-client-v1.1.0) (2026-06-23)

### Features

* **project-engine-client:** typed client wrapper + IMS Bearer auth + retry + spec-correction overlay (LLMO-5461) ([#1661](https://github.com/adobe/spacecat-shared/issues/1661)) ([0465ab0](https://github.com/adobe/spacecat-shared/commit/0465ab0e2897a32b64f377241750c8ea0762f0e7))

## @adobe/spacecat-shared-project-engine-client-v1.0.0 (2026-06-12)

### Features

* **project-engine-client:** foundation — vendor spec + generation pipeline (LLMO-5461) ([#1660](https://github.com/adobe/spacecat-shared/issues/1660)) ([1182df9](https://github.com/adobe/spacecat-shared/commit/1182df96d0b7db0557a974843966febb8c9f746e))
