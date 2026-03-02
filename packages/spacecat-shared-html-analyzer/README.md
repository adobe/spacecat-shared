# Spacecat Shared - HTML Analyzer

Analyze HTML content visibility for AI crawlers and citations. Compare what humans see on websites versus what AI models (ChatGPT, Perplexity, etc.) can read when crawling pages for citations.

## Installation

```bash
npm install @adobe/spacecat-shared-html-analyzer
```

## Usage

```javascript
import { 
  analyzeTextComparison, 
  calculateStats, 
  calculateBothScenarioStats
} from '@adobe/spacecat-shared-html-analyzer';

// Compare initial HTML (what crawlers see) vs rendered HTML (what users see)
const originalHtml = '<html><body><h1>Title</h1></body></html>';
const currentHtml = '<html><body><h1>Title</h1><p>Dynamic content loaded by JS</p></body></html>';

// Full text analysis (original chrome extension logic)
const analysis = await analyzeTextComparison(originalHtml, currentHtml);
console.log(analysis.textRetention); // 0.5 (50% text retention)
console.log(analysis.wordDiff); // Detailed word differences

// Basic comparison statistics
const stats = await calculateStats(originalHtml, currentHtml);
console.log(stats.citationReadability); // 50 (50% of content visible to AI)
console.log(stats.contentIncreaseRatio); // 2.3 (2.3x more content in rendered)

// Both scenarios (with/without nav filtering)
const bothStats = await calculateBothScenarioStats(originalHtml, currentHtml);
console.log(bothStats.withNavFooterIgnored.contentGain); // "2.3x"
console.log(bothStats.withoutNavFooterIgnored.missingWords); // Number of missing words
```

## Environment Support

This package works in both Node.js and browser environments (including Chrome extensions):

- **Node.js**: Uses Cheerio for robust HTML parsing
- **Browser/Chrome Extensions**: Uses native DOMParser with automatic fallback

## API Reference

### Main Functions

#### `analyzeTextComparison(initHtml, finHtml, ignoreNavFooter)`

Comprehensive text analysis between two HTML versions (original chrome extension logic).

**Parameters:**
- `initHtml` (string): HTML as seen by crawlers/AI
- `finHtml` (string): HTML as seen by users (fully loaded)
- `ignoreNavFooter` (boolean, default: true): Remove nav/footer elements

**Returns:** Promise<Object> with text comparison data, diffs, and retention metrics

#### `calculateStats(originalHtml, currentHtml, ignoreNavFooter)`

Get basic comparison statistics (original chrome extension logic).

**Parameters:**
- `originalHtml` (string): Initial HTML content
- `currentHtml` (string): Final HTML content
- `ignoreNavFooter` (boolean, default: true): Whether to ignore navigation/footer elements

**Returns:** Promise<Object> with wordDiff, contentIncreaseRatio, and citationReadability

#### `calculateBothScenarioStats(originalHtml, currentHtml)`

Get comparison statistics for both nav/footer scenarios (original chrome extension logic).

**Parameters:**
- `originalHtml` (string): Initial HTML content
- `currentHtml` (string): Final HTML content

**Returns:** Promise<Object> with statistics for both withNavFooterIgnored and withoutNavFooterIgnored scenarios

### Utility Functions

#### Content Processing
- `stripTagsToText(htmlContent, ignoreNavFooter)`: Extract plain text from HTML
- `filterHtmlContent(htmlContent, ignoreNavFooter, returnText)`: Advanced HTML filtering
- `tokenize(text, mode)`: Smart text tokenization
- `extractWordCount(htmlContent, ignoreNavFooter)`: Get word counts

#### Diff Analysis
- `diffTokens(text1, text2, mode)`: Generate LCS-based diff
- `generateDiffReport(text1, text2, mode)`: Comprehensive diff statistics

## Technical Implementation

### LCS Algorithm
Uses optimized Longest Common Subsequence with integer mapping for 3-5x faster comparisons.

### Smart Tokenization
- **URL Preservation**: Protects URLs during normalization
- **Punctuation Handling**: Normalizes spacing while preserving meaning
- **Unicode Placeholders**: Uses private Unicode characters for safe replacements

### Performance Characteristics
- **Time Complexity**: O(mn) - optimal for LCS
- **Memory Usage**: ~40MB for 100K tokens
- **Content Limit**: Handles up to 500KB smoothly

## Build Scripts

### Standard Build
```bash
npm run build
```

### Chrome Extension Bundle
Generate a minified bundle for Chrome extensions:
```bash
npm run build:chrome
```

This creates `dist/html-analyzer.min.js` that can be included directly in Chrome extension manifest files. The bundle exposes `HTMLAnalyzer` globally.

## Version Information

To check the current package version:

### In Node.js
```javascript
import packageJson from '@adobe/spacecat-shared-html-analyzer/package.json';
console.log('Version:', packageJson.version);
```

### In Browser/Chrome Extension
```javascript
// After loading the bundle
console.log('Version:', HTMLAnalyzer.version); // "1.0.0"
console.log('Build target:', HTMLAnalyzer.buildFor); // "chrome-extension"
```

The version follows [Semantic Versioning (SemVer)](https://semver.org/) - see `package.json` for the official version.

## Testing

```bash
npm test
```

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE.txt](LICENSE.txt) file for details.
