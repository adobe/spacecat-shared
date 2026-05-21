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

  // Practical cap covering common browser (2000-2083) and CDN limits.
  static MAX_DOMAIN_LENGTH = 2048;

  // Matches lowercase hostnames (at least one dot required) and an optional subpath
  //   (e.g. nba.com, nba.com/kings, nba.com/us/kings).
  // Rejects: uppercase letters (use normalizeDomain() first), schemes (https://),
  //   bare IPv4 hostnames (127.0.0.1, 127.0.0.1/path — the negative lookahead is
  //   anchored to slash/end-of-string so legitimate hosts like 1.2.3.4.example.com
  //   and nip.io-style wildcard DNS (192.168.1.1.nip.io) are still accepted; see
  //   schema validator for all-numeric hostname check covering short forms like
  //   127.1), ports (:8080), single-label hostnames (localhost, metadata), query
  //   strings, fragments, empty/trailing path segments, and any path segment
  //   starting with a dot (blocks ./, ../, .hidden, ..foo, etc.).
  // Path-qualified domains (nba.com/kings) are distinct sort-key values from the bare
  //   hostname; callers must call normalizeDomain() before findByImsOrgIdAndDomain.
  // Labels must not start or end with a hyphen (RFC 1035).
  // Raw Unicode / IDN must be punycode-encoded before validation (xn-- form is accepted).
  // Percent-encoded path characters (%20 etc.) are not accepted; decode before validation.
  // Underscore is allowed in path segments but not in hostname labels.
  static DOMAIN_PATTERN = /^(?!\d+(\.\d+){3}(?:\/|$))[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+(\/(?!\.)[a-z0-9._~-]+)*$/;

  // Returns the canonical form of a domain value: lowercased.
  // Must be called on any user-supplied value before passing it to the domain
  // attribute validator or to findByImsOrgIdAndDomain to prevent duplicate records.
  static normalizeDomain(value) {
    return typeof value === 'string' ? value.toLowerCase() : value;
  }

  // Complete domain validator used by the schema and intended for external consumers.
  // Layers a typeof guard, case-canonical check, control-character rejection,
  // all-numeric-hostname rejection (covers short-form IPs like 127.1 and 2130706433),
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
    if (/[^\x21-\x7e]/.test(value)) {
      return false;
    }
    const [hostname, ...pathParts] = value.split('/');
    if (/^[\d.]+$/.test(hostname)) {
      return false;
    }
    // Reject path segments that are purely dots, end with a dot, or contain
    // consecutive dots (foo., foo.., foo../bar, v1..0). DOMAIN_PATTERN's
    // negative lookahead only blocks segments STARTING with a dot.
    if (pathParts.some((seg) => /\.$/.test(seg) || seg.includes('..'))) {
      return false;
    }
    return PlgOnboarding.DOMAIN_PATTERN.test(value)
      && hostname.length <= PlgOnboarding.MAX_HOSTNAME_LENGTH
      && value.length <= PlgOnboarding.MAX_DOMAIN_LENGTH;
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
  };
}

export default PlgOnboarding;
