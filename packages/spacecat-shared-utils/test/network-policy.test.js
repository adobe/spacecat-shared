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

import { expect } from 'chai';
import { isNonPublicHostname } from '../src/network-policy.js';

describe('isNonPublicHostname', () => {
  // IPv4 loopback
  it('blocks 127.0.0.1 (loopback)', () => {
    expect(isNonPublicHostname('127.0.0.1')).to.be.true;
  });

  it('blocks 127.255.255.255 (loopback range end)', () => {
    expect(isNonPublicHostname('127.255.255.255')).to.be.true;
  });

  // IPv4 private ranges
  it('blocks 10.0.0.1 (private 10/8)', () => {
    expect(isNonPublicHostname('10.0.0.1')).to.be.true;
  });

  it('blocks 172.16.0.1 (private 172.16/12)', () => {
    expect(isNonPublicHostname('172.16.0.1')).to.be.true;
  });

  it('blocks 172.31.255.255 (private 172.16/12 range end)', () => {
    expect(isNonPublicHostname('172.31.255.255')).to.be.true;
  });

  it('blocks 192.168.1.1 (private 192.168/16)', () => {
    expect(isNonPublicHostname('192.168.1.1')).to.be.true;
  });

  // IPv4 link-local
  it('blocks 169.254.169.254 (link-local AWS metadata)', () => {
    expect(isNonPublicHostname('169.254.169.254')).to.be.true;
  });

  // IPv4 INADDR_ANY
  it('blocks 0.0.0.0 (INADDR_ANY)', () => {
    expect(isNonPublicHostname('0.0.0.0')).to.be.true;
  });

  // localhost (domain name)
  it('blocks localhost', () => {
    expect(isNonPublicHostname('localhost')).to.be.true;
  });

  it('blocks LOCALHOST (case insensitive)', () => {
    expect(isNonPublicHostname('LOCALHOST')).to.be.true;
  });

  it('blocks localhost. (trailing dot)', () => {
    expect(isNonPublicHostname('localhost.')).to.be.true;
  });

  // IPv6 loopback
  it('blocks [::1] (IPv6 loopback with brackets)', () => {
    expect(isNonPublicHostname('[::1]')).to.be.true;
  });

  it('blocks ::1 (IPv6 loopback without brackets)', () => {
    expect(isNonPublicHostname('::1')).to.be.true;
  });

  // IPv6 INADDR_ANY
  it('blocks [::] (IPv6 INADDR_ANY)', () => {
    expect(isNonPublicHostname('[::]')).to.be.true;
  });

  // IPv6 link-local
  it('blocks [fe80::1] (IPv6 link-local)', () => {
    expect(isNonPublicHostname('[fe80::1]')).to.be.true;
  });

  // IPv6 ULA
  it('blocks [fc00::1] (IPv6 ULA)', () => {
    expect(isNonPublicHostname('[fc00::1]')).to.be.true;
  });

  it('blocks [fd00::1] (IPv6 ULA fd::/8)', () => {
    expect(isNonPublicHostname('[fd00::1]')).to.be.true;
  });

  // IPv4-mapped IPv6
  it('blocks [::ffff:127.0.0.1] (IPv4-mapped loopback)', () => {
    expect(isNonPublicHostname('[::ffff:127.0.0.1]')).to.be.true;
  });

  it('blocks [::ffff:10.0.0.1] (IPv4-mapped private)', () => {
    expect(isNonPublicHostname('[::ffff:10.0.0.1]')).to.be.true;
  });

  // Boundary: just outside 172.16/12 range
  it('allows 172.15.255.255 (just below private range)', () => {
    expect(isNonPublicHostname('172.15.255.255')).to.be.false;
  });

  it('allows 172.32.0.1 (just above private range)', () => {
    expect(isNonPublicHostname('172.32.0.1')).to.be.false;
  });

  // Public addresses that must not be blocked
  it('allows 1.1.1.1 (Cloudflare DNS)', () => {
    expect(isNonPublicHostname('1.1.1.1')).to.be.false;
  });

  it('allows 8.8.8.8 (Google DNS)', () => {
    expect(isNonPublicHostname('8.8.8.8')).to.be.false;
  });

  it('allows 93.184.216.34 (example.com)', () => {
    expect(isNonPublicHostname('93.184.216.34')).to.be.false;
  });

  // Domain names (not IP literals) are always allowed through
  it('allows example.com (public domain)', () => {
    expect(isNonPublicHostname('example.com')).to.be.false;
  });

  it('allows www.adobe.com (public domain)', () => {
    expect(isNonPublicHostname('www.adobe.com')).to.be.false;
  });

  // Trailing dot on domain (not localhost) is allowed
  it('allows example.com. (trailing dot on public domain)', () => {
    expect(isNonPublicHostname('example.com.')).to.be.false;
  });
});
