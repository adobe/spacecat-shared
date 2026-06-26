#!/usr/bin/env bash
#
# Copyright 2025 Adobe. All rights reserved.
# This file is licensed to you under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License. You may obtain a copy
# of the License at http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software distributed under
# the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
# OF ANY KIND, either express or implied. See the License for the specific language
# governing permissions and limitations under the License.
#
# Boots the two processes that make up the image:
#   1. the Counterfact mock (plain HTTP on MOCK_PORT, default 4010) — mock/run.js
#   2. Caddy, terminating TLS on :8443 and reverse-proxying to the mock
#
# Exits as soon as EITHER process exits, so a dead component stops the container (the healthcheck /
# orchestrator then fails fast) instead of the container lingering half-up with a 502-ing proxy.
set -euo pipefail

# Forward termination to the whole process group so a `docker stop` tears down both children.
trap 'kill 0' INT TERM

node mock/run.js &
caddy run --config /etc/caddy/Caddyfile --adapter caddyfile &

# `wait -n` returns when the first background job exits; propagate its status.
wait -n
exit $?
