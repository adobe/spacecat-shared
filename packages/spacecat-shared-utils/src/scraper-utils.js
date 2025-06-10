import { PutObjectCommand } from '@aws-sdk/client-s3';
import { hasText } from './functions.js';

/**
 * Generates storage path for scraped content that matches run-sqs.js expectations
 */
export function getScrapedContentPath(siteId, url, prefix = 'scrapes') {
    const urlObj = new URL(url);
    const urlPath = urlObj.pathname.replace(/\/$/, '') || '/';
    return `${prefix}/${siteId}${urlPath}/scrape.json`;
}

/**
 * Stores scraped content in S3 in the format expected by run-sqs.js
 */
export async function storeScrapedContent(s3Client, bucketName, siteId, url, content, options = {}) {
    const { prefix = 'scrapes' } = options;

    const filePath = getScrapedContentPath(siteId, url, prefix);

    const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: filePath,
        Body: JSON.stringify(content),
        ContentType: 'application/json',
    });

    await s3Client.send(command);
    console.log(`Successfully stored scraped content at: ${filePath}`);

    return filePath;
}

/**
 * Simple web scraper function
 */
export async function scrapeUrl(url, options = {}) {
    const {
        customHeaders = {},
        timeout = 15000,
        userAgent = 'SpaceCat-Scraper/1.0'
    } = options;

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': userAgent,
                ...customHeaders,
            },
            signal: AbortSignal.timeout(timeout),
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const rawBody = await response.text();
        const finalUrl = response.url;

        return {
            finalUrl,
            status: response.status,
            headers: Object.fromEntries(response.headers.entries()),
            rawBody,
            scrapeTime: Date.now(),
            scrapedAt: new Date().toISOString(),
        };
    } catch (error) {
        throw new Error(`Failed to scrape ${url}: ${error.message}`);
    }
}

/**
 * Batch scrape multiple URLs and store them in S3
 */
export async function scrapeAndStoreUrls(s3Client, bucketName, siteId, urls, options = {}) {
    const results = [];

    for (const url of urls) {
        try {
            console.log(`Scraping: ${url}`);
            const scrapeResult = await scrapeUrl(url, options);

            const contentToStore = {
                finalUrl: scrapeResult.finalUrl,
                scrapeResult,
                userAgent: options.userAgent || 'SpaceCat-Scraper/1.0',
                scrapeTime: scrapeResult.scrapeTime,
                scrapedAt: scrapeResult.scrapedAt,
            };

            const storagePath = await storeScrapedContent(
                s3Client,
                bucketName,
                siteId,
                url,
                contentToStore,
                options
            );

            results.push({
                url,
                finalUrl: scrapeResult.finalUrl,
                status: 'COMPLETE',
                location: storagePath,
                scrapeResult,
            });

        } catch (error) {
            console.error(`Failed to scrape ${url}:`, error);
            results.push({
                url,
                status: 'FAILED',
                error: error.message,
            });
        }
    }

    return results;
} 