/*
 * Declaration-level compile test for the Site `contentAiConfig` API.
 * Guards that the published `SiteConfig` type exposes the runtime contract
 * (getContentAiConfig / updateContentAiConfig / state.contentAiConfig), so
 * typed consumers can compile against it.
 */
import type { SiteConfig } from '../../src/models/site/index.js';

declare const config: SiteConfig;

// Getter is declared and typed.
const current: { name?: string; index?: string } | undefined = config.getContentAiConfig();
void current;

// state carries the declared contentAiConfig shape.
const stateShape: { name?: string; index?: string } | undefined = config.state.contentAiConfig;
void stateShape;

// Setter accepts name, index, both, and no fields.
config.updateContentAiConfig({ name: 'source-name' });
config.updateContentAiConfig({ index: 'legacy-index' });
config.updateContentAiConfig({ name: 'source-name', index: 'legacy-index' });
config.updateContentAiConfig({});

// @ts-expect-error - name must be a string
config.updateContentAiConfig({ name: 123 });

// @ts-expect-error - unknown fields are not part of the contract
config.updateContentAiConfig({ nope: 'x' });

export {};
