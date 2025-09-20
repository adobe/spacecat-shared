# Spacecat Shared - HTML Analyzer

Analyze HTML content visibility for AI crawlers and citations. Compare what humans see on websites versus what AI models (ChatGPT, Perplexity, etc.) can read when crawling pages for citations.

## Installation

```bash
npm install @adobe/spacecat-shared-html-analyzer
```

## Usage

```javascript
import { analyzeVisibility, quickCompare, getCitationReadiness } from '@adobe/spacecat-shared-html-analyzer';

// Compare initial HTML (what crawlers see) vs rendered HTML (what users see)
const initialHtml = '<html><body><h1>Title</h1></body></html>';
const renderedHtml = '<html><body><h1>Title</h1><p>Dynamic content loaded by JS</p></body></html>';

// Full analysis
const analysis = await analyzeVisibility(initialHtml, renderedHtml);
console.log(analysis.visibilityScore); // { score: 75, category: "good", description: "..." }
console.log(analysis.metrics.citationReadability); // 50 (50% of content visible to AI)

// Quick comparison
const quick = await quickCompare(initialHtml, renderedHtml);
console.log(quick.contentGain); // 2.3 (2.3x more content in rendered)

// Citation readiness
const readiness = await getCitationReadiness(initialHtml, renderedHtml);
console.log(readiness.recommendations); // Array of optimization suggestions
```

## Environment Support

This package works in both Node.js and browser environments (including Chrome extensions):

- **Node.js**: Uses Cheerio for robust HTML parsing
- **Browser/Chrome Extensions**: Uses native DOMParser with automatic fallback

## API Reference

### Main Functions

#### `analyzeVisibility(initialHtml, renderedHtml, options)`

Comprehensive analysis of content visibility between two HTML versions.

**Parameters:**
- `initialHtml` (string): HTML as seen by crawlers/AI
- `renderedHtml` (string): HTML as seen by users (fully loaded)
- `options` (object, optional):
  - `ignoreNavFooter` (boolean, default: true): Remove nav/footer elements
  - `includeScore` (boolean, default: true): Include visibility score

**Returns:** Promise<Object> with metrics, visibility score, and analysis data

#### `quickCompare(html1, html2, options)`

Fast comparison for basic metrics.

**Returns:** Promise<Object> with word counts, content gain, and similarity

#### `getCitationReadiness(initialHtml, renderedHtml, options)`

Get citation-focused analysis with recommendations.

**Returns:** Promise<Object> with score, category, description, and recommendations

### Utility Functions

#### Content Processing
- `stripTagsToText(htmlContent, ignoreNavFooter)`: Extract plain text from HTML
- `filterHtmlContent(htmlContent, ignoreNavFooter, returnText)`: Advanced HTML filtering
- `tokenize(text, mode)`: Smart text tokenization
- `extractWordCount(htmlContent, ignoreNavFooter)`: Get word counts

#### Diff Analysis
- `diffTokens(text1, text2, mode)`: Generate LCS-based diff
- `generateDiffReport(text1, text2, mode)`: Comprehensive diff statistics
- `calculateSimilarity(text1, text2, mode)`: Calculate similarity percentage

## Use Cases

### AI Content Optimization
```javascript
// Check if your content is properly crawlable by AI models
const readiness = await getCitationReadiness(staticHtml, dynamicHtml);
if (readiness.score < 70) {
  console.log("Consider implementing SSR for better AI visibility");
  console.log(readiness.recommendations);
}
```

### SEO Analysis
```javascript
// Analyze content differences for SEO optimization
const analysis = await analyzeVisibility(initialHtml, renderedHtml);
console.log(`Content gain: ${analysis.metrics.contentGain}x`);
console.log(`Missing from crawlers: ${analysis.metrics.missingWords} words`);
```

### Performance Monitoring
```javascript
// Monitor how much content loads after initial page render
const metrics = await quickCompare(serverHtml, clientHtml);
if (metrics.contentGain > 3) {
  console.log("High content gain - consider server-side rendering");
}
```

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

## Testing

```bash
npm test
```

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE.txt](LICENSE.txt) file for details.
