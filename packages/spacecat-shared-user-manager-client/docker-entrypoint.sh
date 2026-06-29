#!/bin/sh
#
# Copyright 2026 Adobe. All rights reserved.
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
#
# POSIX sh (busybox ash), NOT bash: the runtime image no longer ships bash. bash was here only for
# `wait -n` (return when the first background job exits), which ash lacks; we poll the two PIDs
# instead (see the loop below). Everything else is plain POSIX.
set -eu

# Forward termination to the whole process group so a `docker stop` tears down both children. EXIT
# is included so the surviving process is reaped when the script exits after one dies, not only on a
# signal-driven `docker stop`.
trap 'kill 0' INT TERM EXIT

node mock/run.js &
mock_pid=$!

# Wait for the mock to bind before starting Caddy, so proxied requests never 502 in the gap
# between Caddy coming up and the mock binding :4010. Bounded (~10s) and tied to the mock's
# liveness: if the mock exits before it binds, fail fast instead of looping forever.
# __dump is auth-exempt, so no token is needed for the readiness probe.
mock_url="http://127.0.0.1:${MOCK_PORT:-4010}/enterprise/users/api/__dump"
mock_ready=
for _ in $(seq 1 50); do
  # --max-time 1 caps each probe so the ~10s budget is by contract, not at the mercy of the OS
  # connect timeout if the socket is open-but-hung.
  if curl -sf --max-time 1 "$mock_url" >/dev/null 2>&1; then mock_ready=1; break; fi
  kill -0 "$mock_pid" 2>/dev/null || { echo "mock exited before binding ${mock_url}" >&2; exit 1; }
  sleep 0.2
done
# Fail loudly on a timeout (mock alive but unresponsive) rather than starting Caddy into the very
# 502 gap this probe exists to prevent. The HEALTHCHECK would catch it downstream, but failing here
# is louder and faster.
[ -n "$mock_ready" ] || { echo "mock did not become ready within timeout: ${mock_url}" >&2; exit 1; }

caddy run --config /etc/caddy/Caddyfile --adapter caddyfile &
caddy_pid=$!

# POSIX sh has no `wait -n`, so poll until EITHER child exits, then propagate the status of the one
# that died. The 1s granularity is irrelevant for a test mock; the surviving child is torn down by
# the EXIT trap on the `exit` below.
while kill -0 "$mock_pid" 2>/dev/null && kill -0 "$caddy_pid" 2>/dev/null; do
  sleep 1
done
status=0
if ! kill -0 "$mock_pid" 2>/dev/null; then
  wait "$mock_pid" || status=$?   # mock died first — propagate its status
else
  wait "$caddy_pid" || status=$?  # caddy died first — propagate its status
fi
exit "$status"
