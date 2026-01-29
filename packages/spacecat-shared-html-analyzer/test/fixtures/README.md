# Real-World HTML Test Fixtures

These fixtures represent common website patterns to ensure markdown rendering works correctly in your extension.

## Purpose

Automated tests to verify what gets rendered when you view different types of websites in markdown view.

## Available Fixtures

### 1. E-commerce (`ecommerce`)
Product pages with lazy-loaded images and customer reviews.
- **Server-side**: Shows noscript fallback messages
- **Client-side**: Shows loaded images and reviews

### 2. News Articles (`newsArticle`)
News content with analytics pixels and comment sections.
- **Server-side**: Shows analytics pixels in noscript
- **Client-side**: Shows loaded comments

### 3. SPA Applications (`spaApplication`)
Single-page apps that heavily rely on JavaScript.
- **Server-side**: Shows critical "JavaScript Required" warning
- **Client-side**: Shows full app content

### 4. Accessibility-First (`accessibilityFirst`)
Forms designed to work with or without JavaScript.
- **Server-side**: Shows helpful noscript notices
- **Client-side**: Shows enhanced validation features

### 5. GDPR-Compliant (`gdprCompliant`)
Sites with privacy notices and cookie consent.
- **Server-side**: Shows privacy notice in noscript
- **Client-side**: Shows recommendations and features

## What Gets Tested

Each fixture verifies:
- ✅ **Server-side rendering** includes noscript fallback content (what crawlers see)
- ✅ **Client-side rendering** excludes noscript content (what users see)
- ✅ **Markdown conversion** works correctly for both versions
- ✅ **Expected content** appears where it should

## Running Tests

```bash
# Run all markdown rendering tests
npm test -- --grep "Real-World Markdown Rendering"

# Run specific site type
npm test -- --grep "E-commerce"
npm test -- --grep "News Articles"
npm test -- --grep "SPA"
```

## Adding New Fixtures

1. Add your HTML example to `real-world-examples.js`:

```javascript
export const realWorldExamples = {
  myExample: {
    name: 'My Example Site',
    description: 'Brief description',
    serverSide: `<html>...</html>`,  // What crawlers see
    clientSide: `<html>...</html>`,  // What users see
    expectedDiff: {
      contentAdded: ['Dynamic', 'Content'],
      contentFromNoscript: ['Fallback', 'Text'],
    },
  },
};
```

2. Tests will automatically verify:
   - Server-side includes noscript content
   - Client-side excludes noscript content
   - Expected additions appear

## Expected Differences

Each fixture defines what should differ between server and client:

- `contentAdded`: Content that appears only on client-side (e.g., "Customer Reviews", "Comments")
- `contentFromNoscript`: Content from `<noscript>` tags that appears only server-side

## Quick Reference

| Site Type | Key Difference |
|-----------|---------------|
| E-commerce | Reviews loaded dynamically |
| News | Comments added client-side |
| SPA | Full app vs. loading state |
| Accessibility | Enhanced vs. basic form |
| GDPR | Recommendations vs. notices |

---

These fixtures ensure your markdown view renders correctly for real-world websites!

