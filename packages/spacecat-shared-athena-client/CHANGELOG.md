## [@adobe/spacecat-shared-athena-client-v1.9.3](https://github.com/adobe/spacecat-shared/compare/@adobe/spacecat-shared-athena-client-v1.9.2...@adobe/spacecat-shared-athena-client-v1.9.3) (2026-02-25)

### Bug Fixes

* temporal series month/week wrap-around and add year to query pipeline ([#1376](https://github.com/adobe/spacecat-shared/issues/1376)) ([b15cfd7](https://github.com/adobe/spacecat-shared/commit/b15cfd705809612c4ad69bbdc09d87c06687dcb6))

# [@adobe/spacecat-shared-athena-client-v1.9.2](https://github.com/adobe/spacecat-shared/compare/@adobe/spacecat-shared-athena-client-v1.9.1...@adobe/spacecat-shared-athena-client-v1.9.2) (2026-01-19)


### Bug Fixes

* added function getTrafficTypeAnalysisTemplate to athena client ([#1266](https://github.com/adobe/spacecat-shared/issues/1266)) ([1103cbb](https://github.com/adobe/spacecat-shared/commit/1103cbbc7893fc209d4dc3e07feb64372d8e77e8))

# [@adobe/spacecat-shared-athena-client-v1.9.1](https://github.com/adobe/spacecat-shared/compare/@adobe/spacecat-shared-athena-client-v1.9.0...@adobe/spacecat-shared-athena-client-v1.9.1) (2025-12-08)


### Bug Fixes

* use updated shared utils ([#1226](https://github.com/adobe/spacecat-shared/issues/1226)) ([ac8b015](https://github.com/adobe/spacecat-shared/commit/ac8b0159128257f107e08a6b868b69ebe66312d2))

# [@adobe/spacecat-shared-athena-client-v1.9.0](https://github.com/adobe/spacecat-shared/compare/@adobe/spacecat-shared-athena-client-v1.8.4...@adobe/spacecat-shared-athena-client-v1.9.0) (2025-12-08)


### Features

* **audit-url:** add URL store data model and data access ([#1211](https://github.com/adobe/spacecat-shared/issues/1211)) ([a7e458e](https://github.com/adobe/spacecat-shared/commit/a7e458e91d4f1aa93b7243cea5361f028ef2b7db))

# [@adobe/spacecat-shared-athena-client-v1.8.4](https://github.com/adobe/spacecat-shared/compare/@adobe/spacecat-shared-athena-client-v1.8.3...@adobe/spacecat-shared-athena-client-v1.8.4) (2025-12-05)


### Bug Fixes

* consent banner queries temporal series ([#1219](https://github.com/adobe/spacecat-shared/issues/1219)) ([c5c48ef](https://github.com/adobe/spacecat-shared/commit/c5c48ef7d5d4c1caedbf2344a7baf812364ae299))

# [@adobe/spacecat-shared-athena-client-v1.8.3](https://github.com/adobe/spacecat-shared/compare/@adobe/spacecat-shared-athena-client-v1.8.2...@adobe/spacecat-shared-athena-client-v1.8.3) (2025-12-04)


### Bug Fixes

* month query passes 0 week ([#1215](https://github.com/adobe/spacecat-shared/issues/1215)) ([1821efd](https://github.com/adobe/spacecat-shared/commit/1821efda813b681f2eb9eab164ad5da1c9d3f59f))

# [@adobe/spacecat-shared-athena-client-v1.8.2](https://github.com/adobe/spacecat-shared/compare/@adobe/spacecat-shared-athena-client-v1.8.1...@adobe/spacecat-shared-athena-client-v1.8.2) (2025-12-03)


### Bug Fixes

* fix query for PTRv2 weekly trend ([#1209](https://github.com/adobe/spacecat-shared/issues/1209)) ([5a8fa92](https://github.com/adobe/spacecat-shared/commit/5a8fa9226ec7ab9dd022f022fc2ed930155dec9f))

# [@adobe/spacecat-shared-athena-client-v1.8.1](https://github.com/adobe/spacecat-shared/compare/@adobe/spacecat-shared-athena-client-v1.8.0...@adobe/spacecat-shared-athena-client-v1.8.1) (2025-12-03)


### Bug Fixes

* expose traffic_loss in result mapper for consent-banner ([#1208](https://github.com/adobe/spacecat-shared/issues/1208)) ([2b89f67](https://github.com/adobe/spacecat-shared/commit/2b89f6754ebc9766b8853ece11fa99dbb2c6a1c5))

# [@adobe/spacecat-shared-athena-client-v1.8.0](https://github.com/adobe/spacecat-shared/compare/@adobe/spacecat-shared-athena-client-v1.7.6...@adobe/spacecat-shared-athena-client-v1.8.0) (2025-12-02)


### Features

* added query for PTRv2 ([#1205](https://github.com/adobe/spacecat-shared/issues/1205)) ([e291c2d](https://github.com/adobe/spacecat-shared/commit/e291c2d028bf20cc5851116d201a2d6c7c925d65))

# [@adobe/spacecat-shared-athena-client-v1.7.6](https://github.com/adobe/spacecat-shared/compare/@adobe/spacecat-shared-athena-client-v1.7.5...@adobe/spacecat-shared-athena-client-v1.7.6) (2025-11-28)


### Bug Fixes

* package lock ([#1185](https://github.com/adobe/spacecat-shared/issues/1185)) ([d0708cc](https://github.com/adobe/spacecat-shared/commit/d0708cc8b7cbbea35a4440d684db2b3613240469))

# [@adobe/spacecat-shared-athena-client-v1.7.5](https://github.com/adobe/spacecat-shared/compare/@adobe/spacecat-shared-athena-client-v1.7.4...@adobe/spacecat-shared-athena-client-v1.7.5) (2025-11-28)


### Bug Fixes

* optimize query for page views ([#1178](https://github.com/adobe/spacecat-shared/issues/1178)) ([94c64ee](https://github.com/adobe/spacecat-shared/commit/94c64ee79dffc19a10b9f48ba77b5cf0c36af52f))

# [@adobe/spacecat-shared-athena-client-v1.7.4](https://github.com/adobe/spacecat-shared/compare/@adobe/spacecat-shared-athena-client-v1.7.3...@adobe/spacecat-shared-athena-client-v1.7.4) (2025-11-27)


### Bug Fixes

* change trafficLoss type to double and remove 0 from enum values ([#1175](https://github.com/adobe/spacecat-shared/issues/1175)) ([28411de](https://github.com/adobe/spacecat-shared/commit/28411de6a3cad22f6e2b69f15f81b2afca8b8f2b))

# [@adobe/spacecat-shared-athena-client-v1.7.3](https://github.com/adobe/spacecat-shared/compare/@adobe/spacecat-shared-athena-client-v1.7.2...@adobe/spacecat-shared-athena-client-v1.7.3) (2025-11-26)


### Bug Fixes

* consent banner traffic loss calculation ([#1165](https://github.com/adobe/spacecat-shared/issues/1165)) ([afce5c7](https://github.com/adobe/spacecat-shared/commit/afce5c7f2ec5d50ece74c6f12cacd0af0cec4c67))

# [@adobe/spacecat-shared-athena-client-v1.7.2](https://github.com/adobe/spacecat-shared/compare/@adobe/spacecat-shared-athena-client-v1.7.1...@adobe/spacecat-shared-athena-client-v1.7.2) (2025-11-26)


### Bug Fixes

* refactor consent-banner queries by date type, update page-views, and add tests ([#1145](https://github.com/adobe/spacecat-shared/issues/1145)) ([e451f5a](https://github.com/adobe/spacecat-shared/commit/e451f5a6117f4c68a26c96b8eaa4cace15b4b19f))

# [@adobe/spacecat-shared-athena-client-v1.7.1](https://github.com/adobe/spacecat-shared/compare/@adobe/spacecat-shared-athena-client-v1.7.0...@adobe/spacecat-shared-athena-client-v1.7.1) (2025-11-21)


### Bug Fixes

* consent-banner weekly traffic loss query ([#1143](https://github.com/adobe/spacecat-shared/issues/1143)) ([ac6fc5f](https://github.com/adobe/spacecat-shared/commit/ac6fc5f43a91b5d5a5e339b2ae8a1e58e2f1f56b))

# [@adobe/spacecat-shared-athena-client-v1.7.0](https://github.com/adobe/spacecat-shared/compare/@adobe/spacecat-shared-athena-client-v1.6.2...@adobe/spacecat-shared-athena-client-v1.7.0) (2025-11-20)


### Features

* consent-banner weekly traffic loss query ([#1139](https://github.com/adobe/spacecat-shared/issues/1139)) ([f5a1d7d](https://github.com/adobe/spacecat-shared/commit/f5a1d7d31c39a6d8b67e2f6d1cf3f23a85b8cd91))

# [@adobe/spacecat-shared-athena-client-v1.6.2](https://github.com/adobe/spacecat-shared/compare/@adobe/spacecat-shared-athena-client-v1.6.1...@adobe/spacecat-shared-athena-client-v1.6.2) (2025-11-19)


### Bug Fixes

* consent-banner query improvements ([#1131](https://github.com/adobe/spacecat-shared/issues/1131)) ([e8b4e0a](https://github.com/adobe/spacecat-shared/commit/e8b4e0a80b60ad21f0f30b87c87ca9e04d1bdb79))

# [@adobe/spacecat-shared-athena-client-v1.6.1](https://github.com/adobe/spacecat-shared/compare/@adobe/spacecat-shared-athena-client-v1.6.0...@adobe/spacecat-shared-athena-client-v1.6.1) (2025-11-18)


### Bug Fixes

* consent-banner query improvements ([#1126](https://github.com/adobe/spacecat-shared/issues/1126)) ([bb50e92](https://github.com/adobe/spacecat-shared/commit/bb50e9234e0ba35bbdaf1e61b6dca61ae44f9dfb))

# [@adobe/spacecat-shared-athena-client-v1.6.0](https://github.com/adobe/spacecat-shared/compare/@adobe/spacecat-shared-athena-client-v1.5.0...@adobe/spacecat-shared-athena-client-v1.6.0) (2025-11-15)


### Features

* consent-banner page views ([#1121](https://github.com/adobe/spacecat-shared/issues/1121)) ([b64e358](https://github.com/adobe/spacecat-shared/commit/b64e35881cef5f7abb94e49c5e93e97df6bf3a72))

# [@adobe/spacecat-shared-athena-client-v1.5.0](https://github.com/adobe/spacecat-shared/compare/@adobe/spacecat-shared-athena-client-v1.4.1...@adobe/spacecat-shared-athena-client-v1.5.0) (2025-11-14)


### Features

* consent-banner page views ([#1112](https://github.com/adobe/spacecat-shared/issues/1112)) ([c0c93ac](https://github.com/adobe/spacecat-shared/commit/c0c93ac8ada82af8eb30f64c1e39f6a3c50acaae))

# [@adobe/spacecat-shared-athena-client-v1.4.1](https://github.com/adobe/spacecat-shared/compare/@adobe/spacecat-shared-athena-client-v1.4.0...@adobe/spacecat-shared-athena-client-v1.4.1) (2025-11-13)


### Bug Fixes

* consent-banner traffic-loss query ([#1108](https://github.com/adobe/spacecat-shared/issues/1108)) ([a330be5](https://github.com/adobe/spacecat-shared/commit/a330be57a2dd3ed07a93af8e21d2c16d28f18e8c))

# [@adobe/spacecat-shared-athena-client-v1.4.0](https://github.com/adobe/spacecat-shared/compare/@adobe/spacecat-shared-athena-client-v1.3.7...@adobe/spacecat-shared-athena-client-v1.4.0) (2025-11-12)


### Features

* add consent-banner data analysis with traffic loss estimation ([#1099](https://github.com/adobe/spacecat-shared/issues/1099)) ([c1f3b86](https://github.com/adobe/spacecat-shared/commit/c1f3b8693be7a0f5e8723a7e2e0b67ed7a5abf4f))

# [@adobe/spacecat-shared-athena-client-v1.3.7](https://github.com/adobe/spacecat-shared/compare/@adobe/spacecat-shared-athena-client-v1.3.6...@adobe/spacecat-shared-athena-client-v1.3.7) (2025-11-07)


### Bug Fixes

* add additional page views summary data ([#1086](https://github.com/adobe/spacecat-shared/issues/1086)) ([03bab15](https://github.com/adobe/spacecat-shared/commit/03bab15f2e54f2ffdd1a8bed23a5dc34d17eeace))

# [@adobe/spacecat-shared-athena-client-v1.3.6](https://github.com/adobe/spacecat-shared/compare/@adobe/spacecat-shared-athena-client-v1.3.5...@adobe/spacecat-shared-athena-client-v1.3.6) (2025-11-07)


### Bug Fixes

* **athena:** Update HighOrganic Traffic athena query ([#1078](https://github.com/adobe/spacecat-shared/issues/1078)) ([2b4c7af](https://github.com/adobe/spacecat-shared/commit/2b4c7afa4fdb64c2eee88ca5105a9f1ff1054ad5))

# [@adobe/spacecat-shared-athena-client-v1.3.5](https://github.com/adobe/spacecat-shared/compare/@adobe/spacecat-shared-athena-client-v1.3.4...@adobe/spacecat-shared-athena-client-v1.3.5) (2025-10-29)


### Bug Fixes

* athena query for weekly drop aggregation ([#1057](https://github.com/adobe/spacecat-shared/issues/1057)) ([4f2f2e3](https://github.com/adobe/spacecat-shared/commit/4f2f2e3ec1d3bbd4ba60f6b87d79d919ba7bafdd))

# [@adobe/spacecat-shared-athena-client-v1.3.4](https://github.com/adobe/spacecat-shared/compare/@adobe/spacecat-shared-athena-client-v1.3.3...@adobe/spacecat-shared-athena-client-v1.3.4) (2025-10-28)


### Bug Fixes

* weekly traffic drop report params ([#1051](https://github.com/adobe/spacecat-shared/issues/1051)) ([16a90e2](https://github.com/adobe/spacecat-shared/commit/16a90e21c74c75b3b8a8e32bf1b3ae3d3f3e0e98))

# [@adobe/spacecat-shared-athena-client-v1.3.3](https://github.com/adobe/spacecat-shared/compare/@adobe/spacecat-shared-athena-client-v1.3.2...@adobe/spacecat-shared-athena-client-v1.3.3) (2025-10-25)


### Bug Fixes

* athena weekly traffic drop query ([#1049](https://github.com/adobe/spacecat-shared/issues/1049)) ([0cfc5e8](https://github.com/adobe/spacecat-shared/commit/0cfc5e8e7a51fa2099ab5f7e8e9aa5d3b4a1a2c1))

# [@adobe/spacecat-shared-athena-client-v1.3.2](https://github.com/adobe/spacecat-shared/compare/@adobe/spacecat-shared-athena-client-v1.3.1...@adobe/spacecat-shared-athena-client-v1.3.2) (2025-10-21)


### Bug Fixes

* update weekly report queries ([#1032](https://github.com/adobe/spacecat-shared/issues/1032)) ([0f43b1b](https://github.com/adobe/spacecat-shared/commit/0f43b1bbedefc6bc6a7116fc25b15f44de2e5cc3))

# [@adobe/spacecat-shared-athena-client-v1.3.1](https://github.com/adobe/spacecat-shared/compare/@adobe/spacecat-shared-athena-client-v1.3.0...@adobe/spacecat-shared-athena-client-v1.3.1) (2025-10-20)


### Bug Fixes

* **athena-client:** refactor athena query client and weekly reports ([#1027](https://github.com/adobe/spacecat-shared/issues/1027)) ([6c11fef](https://github.com/adobe/spacecat-shared/commit/6c11fef2f17a320d26a49fd66e1d49a0d24d68f4))

# [@adobe/spacecat-shared-athena-client-v1.3.0](https://github.com/adobe/spacecat-shared/compare/@adobe/spacecat-shared-athena-client-v1.2.4...@adobe/spacecat-shared-athena-client-v1.3.0) (2025-10-17)


### Features

* **athena:** add traffic acquisition reports for RUM dashboard ([#1007](https://github.com/adobe/spacecat-shared/issues/1007)) ([db2f1e5](https://github.com/adobe/spacecat-shared/commit/db2f1e5fef0c67b2d3f98be3dcfe96f79b8f3afb))

# [@adobe/spacecat-shared-athena-client-v1.2.4](https://github.com/adobe/spacecat-shared/compare/@adobe/spacecat-shared-athena-client-v1.2.3...@adobe/spacecat-shared-athena-client-v1.2.4) (2025-10-14)


### Bug Fixes

* update shared dependencies ([#996](https://github.com/adobe/spacecat-shared/issues/996)) ([ffa0abe](https://github.com/adobe/spacecat-shared/commit/ffa0abef7f1d7ea3f22bcfd39a6dd0b71d84fd6e))

# [@adobe/spacecat-shared-athena-client-v1.2.3](https://github.com/adobe/spacecat-shared/compare/@adobe/spacecat-shared-athena-client-v1.2.2...@adobe/spacecat-shared-athena-client-v1.2.3) (2025-10-07)


### Bug Fixes

* update shared dependencies ([#974](https://github.com/adobe/spacecat-shared/issues/974)) ([4b80e7d](https://github.com/adobe/spacecat-shared/commit/4b80e7d9c391db61215b98cb1f5b5f6aeab9a2d5))

# [@adobe/spacecat-shared-athena-client-v1.2.2](https://github.com/adobe/spacecat-shared/compare/@adobe/spacecat-shared-athena-client-v1.2.1...@adobe/spacecat-shared-athena-client-v1.2.2) (2025-10-04)


### Bug Fixes

* update shared dependencies ([#971](https://github.com/adobe/spacecat-shared/issues/971)) ([58f7dd2](https://github.com/adobe/spacecat-shared/commit/58f7dd236f45ba6dbb5c5e3fb2b326f3107d8f2b))

# [@adobe/spacecat-shared-athena-client-v1.2.1](https://github.com/adobe/spacecat-shared/compare/@adobe/spacecat-shared-athena-client-v1.2.0...@adobe/spacecat-shared-athena-client-v1.2.1) (2025-09-23)


### Bug Fixes

* update shared dependencies ([#945](https://github.com/adobe/spacecat-shared/issues/945)) ([d6b3c58](https://github.com/adobe/spacecat-shared/commit/d6b3c5856b0e5a9da8f3f03f3d5ac0e32ac1d5da))

# [@adobe/spacecat-shared-athena-client-v1.2.0](https://github.com/adobe/spacecat-shared/compare/@adobe/spacecat-shared-athena-client-v1.1.1...@adobe/spacecat-shared-athena-client-v1.2.0) (2025-09-18)


### Features

* **athena-client:** weekly summary query for broken backlinks ([#931](https://github.com/adobe/spacecat-shared/issues/931)) ([2e7f950](https://github.com/adobe/spacecat-shared/commit/2e7f950e43f6a6e11a77105f39313e54ecc9fd45))

# [@adobe/spacecat-shared-athena-client-v1.1.1](https://github.com/adobe/spacecat-shared/compare/@adobe/spacecat-shared-athena-client-v1.1.0...@adobe/spacecat-shared-athena-client-v1.1.1) (2025-09-17)


### Bug Fixes

* add missing export ([#933](https://github.com/adobe/spacecat-shared/issues/933)) ([2c0d1a3](https://github.com/adobe/spacecat-shared/commit/2c0d1a38f4f2f6ae444bc65e7bde60e5a14e28db))

# [@adobe/spacecat-shared-athena-client-v1.1.0](https://github.com/adobe/spacecat-shared/compare/@adobe/spacecat-shared-athena-client-v1.0.2...@adobe/spacecat-shared-athena-client-v1.1.0) (2025-09-16)


### Features

* athena client module ([#917](https://github.com/adobe/spacecat-shared/issues/917)) ([e1a88f7](https://github.com/adobe/spacecat-shared/commit/e1a88f712a0eea8c6785b69f9b2eda71eda959f3))

# [@adobe/spacecat-shared-athena-client-v1.0.2](https://github.com/adobe/spacecat-shared/compare/@adobe/spacecat-shared-athena-client-v1.0.1...@adobe/spacecat-shared-athena-client-v1.0.2) (2025-09-10)


### Bug Fixes

* update shared dependencies ([#907](https://github.com/adobe/spacecat-shared/issues/907)) ([c1d7c9d](https://github.com/adobe/spacecat-shared/commit/c1d7c9d3acf93e2a3e600fbb68e0f61ecb5f41b9))

# [@adobe/spacecat-shared-athena-client-v1.0.1](https://github.com/adobe/spacecat-shared/compare/@adobe/spacecat-shared-athena-client-v1.0.0...@adobe/spacecat-shared-athena-client-v1.0.1) (2025-09-02)


### Bug Fixes

* update shared dependencies ([#896](https://github.com/adobe/spacecat-shared/issues/896)) ([5a2f17a](https://github.com/adobe/spacecat-shared/commit/5a2f17a3f4b6a5aeba92f09f8e3b7abe0af92a00))

# @adobe/spacecat-shared-athena-client-v1.0.0 (2025-08-28)


### Features

* athena client ([#887](https://github.com/adobe/spacecat-shared/issues/887)) ([7b55ef1](https://github.com/adobe/spacecat-shared/commit/7b55ef182a45ee07e0ad38cf82e13cab67fb6f3b))
