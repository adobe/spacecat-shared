/*
 * Copyright 2026 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import BaseModel from '../base/base.model.js';

/**
 * PlgOnboarding - A class representing a PLG onboarding entity.
 * Tracks the self-service onboarding lifecycle for ASO customers.
 *
 * @class PlgOnboarding
 * @extends BaseModel
 */
class PlgOnboarding extends BaseModel {
  static ENTITY_NAME = 'PlgOnboarding';

  static IMS_ORG_ID_PATTERN = /^[a-z0-9]{24}@AdobeOrg$/i;

  static MAX_HOSTNAME_LENGTH = 253; // RFC 1035 DNS name limit

  // Practical cap, chosen for storage and sort-key index depth rather than for any
  // specific browser/URL-bar limit (the domain field is a stored identifier, not a URL).
  static MAX_DOMAIN_LENGTH = 2048;

  // **WARNING for external consumers: do NOT use DOMAIN_PATTERN directly.**
  // This regex is incomplete on its own — it has no length cap, no control-character
  // rejection, no all-numeric-hostname check, no trailing-dot/consecutive-dot path
  // rejection, and no typeof guard. Always call `PlgOnboarding.isValidDomain(value)`
  // which composes this regex with the rest of the validator. The regex is exported
  // only for legacy callers and may become module-private in a future major release.
  //
  // Matches lowercase hostnames (at least one dot required) and an optional subpath
  //   (e.g. nba.com, nba.com/kings, nba.com/us/kings).
  // The final label (TLD) must be alphabetic (>= 2 chars) or punycode (xn--*). This
  //   structurally rejects every IP-literal form: dotted-quad (127.0.0.1), short-form
  //   (127.1), decimal (2130706433), hex (0x7f.0.0.1, 0xa9.254.169.254 → AWS IMDS),
  //   and octal (0177.0.0.1) — and also blocks foo.1-style typos. WHATWG URL would
  //   otherwise canonicalize hex/decimal IPs to their dotted-quad form, bypassing
  //   denylist-based SSRF gates downstream.
  // Rejects: uppercase letters (use normalizeDomain() first), schemes (https://),
  //   ports (:8080), single-label hostnames (localhost, metadata), query strings,
  //   fragments, empty/trailing path segments, and any path segment starting with
  //   a dot (blocks ./, ../, .hidden, ..foo, etc.).
  // Path-qualified domains (nba.com/kings) are distinct sort-key values from the bare
  //   hostname; callers must call normalizeDomain() before findByImsOrgIdAndDomain.
  // Labels must not start or end with a hyphen (RFC 1035).
  // Raw Unicode / IDN must be punycode-encoded before validation (xn-- form is accepted).
  // Percent-encoded path characters (%20 etc.) are not accepted; decode before validation.
  // Underscore is allowed in path segments but not in hostname labels.
  static DOMAIN_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.(?:[a-z]{2,}|xn--[a-z0-9-]+)(\/(?!\.)[a-z0-9._~-]+)*$/;

  // Returns the canonical form of a domain value: lowercased.
  // Note: non-string inputs (null/undefined/number/object) are returned unchanged.
  // Callers MUST also run `isValidDomain(value)` before using the result — calling
  // `normalizeDomain` alone does not guarantee the value is a string or safe to
  // pass to `findByImsOrgIdAndDomain` (which would otherwise treat a non-string
  // sort key as something it isn't).
  static normalizeDomain(value) {
    return typeof value === 'string' ? value.toLowerCase() : value;
  }

  // Complete domain validator used by the schema and intended for external consumers.
  // Layers a typeof guard, case-canonical check, control-character rejection,
  // all-numeric-hostname rejection (defense-in-depth; DOMAIN_PATTERN's alphabetic-TLD
  // requirement already rejects dotted-quad, short-form, decimal, hex, and octal IPs),
  // trailing-dot path-segment rejection, DOMAIN_PATTERN test, and length caps.
  // Note: DOMAIN_PATTERN alone is not sufficient — always prefer this method.
  // Lowercase-only (host AND path) is intentional canonicalization, not a bug. The
  // domain field is part of the dedup sort key on findByImsOrgIdAndDomain; allowing
  // mixed-case paths would let `nba.com/Kings` and `nba.com/kings` create distinct
  // onboarding rows for the same site. Callers should call normalizeDomain() first.
  // This is a syntactic / data-integrity validator, not an SSRF gate. Callers that
  // make outbound fetches must layer their own private-IP and DNS-resolution checks.
  static isValidDomain(value) {
    if (typeof value !== 'string' || value !== value.toLowerCase()) {
      return false;
    }
    // Length caps run BEFORE the regex test so a multi-MB pathological input is
    // rejected in O(1) rather than driving a multi-MB regex scan. The regex itself
    // is linear (no overlapping quantifiers) but external consumers may not bound
    // input size upstream.
    if (value.length > PlgOnboarding.MAX_DOMAIN_LENGTH) {
      return false;
    }
    if (/[^\x21-\x7e]/.test(value)) {
      return false;
    }
    const [hostname, ...pathParts] = value.split('/');
    if (hostname.length > PlgOnboarding.MAX_HOSTNAME_LENGTH) {
      return false;
    }
    if (/^[\d.]+$/.test(hostname)) {
      return false;
    }
    // Reject path segments that are purely dots, end with a dot, or contain
    // consecutive dots (foo., foo.., foo../bar, v1..0). DOMAIN_PATTERN's
    // negative lookahead only blocks segments STARTING with a dot.
    if (pathParts.some((seg) => /\.$/.test(seg) || seg.includes('..'))) {
      return false;
    }
    return PlgOnboarding.DOMAIN_PATTERN.test(value);
  }

  static STATUSES = {
    PRE_ONBOARDING: 'PRE_ONBOARDING',
    IN_PROGRESS: 'IN_PROGRESS',
    ONBOARDED: 'ONBOARDED',
    ERROR: 'ERROR',
    WAITING_FOR_IP_ALLOWLISTING: 'WAITING_FOR_IP_ALLOWLISTING',
    WAITLISTED: 'WAITLISTED',
    INACTIVE: 'INACTIVE',
    REJECTED: 'REJECTED',
    OUTDATED: 'OUTDATED',
  };

  static REVIEW_DECISIONS = {
    BYPASSED: 'BYPASSED',
    UPHELD: 'UPHELD',
    CLOSED: 'CLOSED',
    REOPENED: 'REOPENED',
    OFFBOARDED: 'OFFBOARDED',
    PENDING: 'PENDING',
  };
}

export default PlgOnboarding;
