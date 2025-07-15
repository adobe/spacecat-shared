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

import type { UniversalContext } from '@adobe/helix-universal';

/**
 * Robots.txt data structure
 */
export interface RobotsData {
    url: string;
    content: string;
}

/**
 * Video entry in sitemap
 */
export interface VideoEntry {
    title: string;
    description?: string;
    thumbnail_loc?: string;
    content_loc?: string;
    duration?: string;
    rating?: string;
    view_count?: string;
    publication_date?: string;
    family_friendly?: string;
    category?: string;
    tag?: string[];
}

/**
 * Image entry in sitemap
 */
export interface ImageEntry {
    loc?: string;
    caption?: string;
    title?: string;
    license?: string;
}

/**
 * Alternate language entry in sitemap
 */
export interface AlternateEntry {
    rel?: string;
    hreflang?: string;
    href?: string;
}

/**
 * URL entry with full metadata (used in hierarchical children and flat entries)
 */
export interface UrlEntry {
    url: string;
    lastmod?: string;
    changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
    priority?: number;
    videos: VideoEntry[];
    images: ImageEntry[];
    alternates: AlternateEntry[];
}

/**
 * Sitemap entry in raw data
 */
export interface SitemapEntry {
    url: string;
    content: string;
    type: string;
    fetchedAt: string;
}

/**
 * Sitemap index entry in raw data
 */
export interface SitemapIndexEntry {
    url: string;
    content: string;
    type: string;
    fetchedAt: string;
}

/**
 * Raw sitemap data structure
 */
export interface RawSitemapData {
    robots: RobotsData | null;
    sitemaps: SitemapEntry[];
    sitemap_index: SitemapIndexEntry[];
}

/**
 * Hierarchical sitemap entry (can be a sitemap index, sitemap, or URL)
 */
export interface HierarchicalSitemapEntry {
    url: string;
    type?: string;
    children?: Array<HierarchicalSitemapEntry | UrlEntry>;
    lastmod?: string;
    changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
    priority?: number;
    videos?: VideoEntry[];
    images?: ImageEntry[];
    alternates?: AlternateEntry[];
}

/**
 * Hierarchical sitemap data structure
 */
export interface HierarchicalSitemapData {
    root: string;
    sitemaps: HierarchicalSitemapEntry[];
}

/**
 * Flat sitemap URL entry with metadata
 */
export type FlatSitemapEntry = UrlEntry

/**
 * Flat sitemap data structure
 */
export interface FlatSitemapData {
    entries: FlatSitemapEntry[];
}

/**
 * Sitemap Client for accessing website sitemap data with specific helper methods.
 */
export default class SitemapClient {
  public readonly siteId: string;

  public readonly context: UniversalContext;

  public readonly log: UniversalContext['log'];

  /**
     * Creates a new SitemapClient instance
     * @param siteId - The site ID
     * @param context - The universal context object
     */
  constructor(siteId: string, context: UniversalContext);

  /**
     * Gets the robots.txt data
     * @returns Robots.txt data with url and content, or null if not available
     */
  getRobots(): Promise<RobotsData | null>;

  /**
     * Gets a sitemap or sitemap index by URL
     * @param url - The URL to search for
     * @returns The sitemap/index object or null if not found
     */
  getByUrl(url: string): Promise<SitemapEntry | SitemapIndexEntry | null>;

  /**
     * Gets all sitemaps (urlset type)
     * @returns Array of sitemap objects
     */
  getAllSitemaps(): Promise<SitemapEntry[]>;

  /**
     * Gets all sitemap indices (sitemapindex type)
     * @returns Array of sitemap index objects
     */
  getAllIndeces(): Promise<SitemapIndexEntry[]>;

  /**
     * Gets all sitemap URLs (from both sitemaps and indices)
     * @returns Array of all sitemap URLs
     */
  getSitemapUrls(): Promise<string[]>;

  /**
     * Gets the direct children of a sitemap in the hierarchical structure
     * @param url - The sitemap URL to find children for
     * @returns Array of child sitemap objects, or empty array if not found
     */
  getSitemapChildren(url: string): Promise<HierarchicalSitemapEntry[]>;

  /**
     * Gets the parent of a sitemap in the hierarchical structure
     * @param url - The sitemap URL to find parent for
     * @returns Parent sitemap object, or null if not found or is root
     */
  getSitemapParent(url: string): Promise<HierarchicalSitemapEntry | null>;

  /**
     * Gets all page URLs from the flat sitemap data
     * @returns Array of all page URLs
     */
  getAllUrls(): Promise<string[]>;

  /**
     * Gets all URL entries with full metadata from the flat sitemap data
     * @returns Array of all URL entries with metadata
     */
  getAllEntries(): Promise<FlatSitemapEntry[]>;

  /**
     * Gets metadata for a specific URL from the flat sitemap data
     * @param url - The URL to get metadata for
     * @returns URL metadata object, or null if not found
     */
  getUrlMetadata(url: string): Promise<FlatSitemapEntry | null>;
}
