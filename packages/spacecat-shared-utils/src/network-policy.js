/*
 * Copyright 2025 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import ipaddr from 'ipaddr.js';

/**
 * IP ranges that should never be fetched from a Lambda (SSRF guard).
 * ipaddr.js range() returns these strings for non-public addresses.
 */
const BLOCKED_RANGES = new Set([
  'loopback', // 127.0.0.0/8, ::1
  'private', // 10/8, 172.16/12, 192.168/16
  'linkLocal', // 169.254/16, fe80::/10
  'uniqueLocal', // fc00::/7 (IPv6 ULA)
  'unspecified', // 0.0.0.0, ::
  'carrierGradeNat', // 100.64.0.0/10
  'broadcast', // 255.255.255.255/32
  'multicast', // 224.0.0.0/4, ff00::/8
  'reserved', // 240.0.0.0/4
  '6to4', // 2002::/16
  'teredo', // 2001::/32
  'rfc6052', // 64:ff9b::/96
]);

/**
 * Returns true if the hostname is a non-public address that must not be fetched.
 * Covers: loopback, private ranges, link-local, IPv6 ULA, INADDR_ANY, localhost,
 * IPv4-mapped IPv6, and trailing-dot variants. DNS-based rebinding is out of scope.
 *
 * Used by detectBotBlocker and resolveCanonicalUrl to guard against SSRF on
 * attacker-supplied URLs. Both functions import from here so any fix is applied once.
 *
 * @param {string} hostname - Parsed hostname from new URL(). May include brackets for IPv6.
 * @returns {boolean} True if the hostname must be blocked.
 */
export function isNonPublicHostname(hostname) {
  // Strip trailing dot (e.g. "localhost." -> "localhost")
  const h = hostname.replace(/\.$/, '');

  // Strip IPv6 brackets (e.g. "[::1]" -> "::1")
  const bare = h.startsWith('[') && h.endsWith(']') ? h.slice(1, -1) : h;

  if (bare.toLowerCase() === 'localhost') {
    return true;
  }

  if (!ipaddr.isValid(bare)) {
    return false; // domain names (not IP literals) are allowed through
  }

  try {
    const addr = ipaddr.parse(bare);
    // IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1): evaluate the embedded IPv4 range
    if (addr.kind() === 'ipv6' && addr.isIPv4MappedAddress()) {
      return BLOCKED_RANGES.has(addr.toIPv4Address().range());
    }
    return BLOCKED_RANGES.has(addr.range());
  /* c8 ignore next 3 */
  } catch {
    return false;
  }
}
