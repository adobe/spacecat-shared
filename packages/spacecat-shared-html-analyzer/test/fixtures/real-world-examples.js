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

/**
 * Real-world HTML examples for testing noscript handling
 * Based on common patterns found in production websites
 */

export const realWorldExamples = {
  // E-commerce site with product images and fallback text
  ecommerce: {
    name: 'E-commerce Product Page',
    description: 'Product page with image lazy loading and noscript fallbacks',
    serverSide: `
      <html>
        <head><title>Product: Blue Widget</title></head>
        <body>
          <nav>Home | Shop | Cart</nav>
          <main>
            <h1>Blue Widget</h1>
            <div class="product-images">
              <noscript>
                <img src="product-blue-widget.jpg" alt="Blue Widget Product Image">
                <p>JavaScript required for image gallery</p>
              </noscript>
              <div class="lazy-load" data-src="product-blue-widget.jpg"></div>
            </div>
            <div class="product-description">
              <p>High-quality blue widget for all your needs.</p>
              <p>Price: $29.99</p>
              <button class="add-to-cart">Add to Cart</button>
            </div>
            <div class="reviews">
              <noscript>
                <p>Enable JavaScript to view customer reviews</p>
              </noscript>
              <div id="reviews-container"></div>
            </div>
          </main>
          <footer>© 2025 Widget Store</footer>
        </body>
      </html>
    `,
    clientSide: `
      <html>
        <head><title>Product: Blue Widget</title></head>
        <body>
          <nav>Home | Shop | Cart</nav>
          <main>
            <h1>Blue Widget</h1>
            <div class="product-images">
              <noscript>
                <img src="product-blue-widget.jpg" alt="Blue Widget Product Image">
                <p>JavaScript required for image gallery</p>
              </noscript>
              <img src="product-blue-widget.jpg" alt="Blue Widget" class="loaded">
              <div class="gallery">
                <img src="widget-angle1.jpg" alt="View 1">
                <img src="widget-angle2.jpg" alt="View 2">
              </div>
            </div>
            <div class="product-description">
              <p>High-quality blue widget for all your needs.</p>
              <p>Price: $29.99</p>
              <button class="add-to-cart">Add to Cart</button>
            </div>
            <div class="reviews">
              <noscript>
                <p>Enable JavaScript to view customer reviews</p>
              </noscript>
              <div id="reviews-container">
                <h3>Customer Reviews (4.5/5)</h3>
                <div class="review">Great product! - John</div>
                <div class="review">Works perfectly - Sarah</div>
              </div>
            </div>
          </main>
          <footer>© 2025 Widget Store</footer>
        </body>
      </html>
    `,
    expectedDiff: {
      contentAdded: ['Customer Reviews', 'Great product', 'Works perfectly'],
      contentFromNoscript: ['JavaScript required for image gallery', 'Enable JavaScript to view customer reviews'],
    },
  },

  // News site with analytics and tracking
  newsArticle: {
    name: 'News Article with Tracking',
    description: 'News article with analytics pixels in noscript',
    serverSide: `
      <html>
        <head><title>Breaking News: Important Event</title></head>
        <body>
          <header>
            <nav>News | Sports | Weather</nav>
          </header>
          <article>
            <h1>Breaking News: Important Event</h1>
            <p class="byline">By Jane Reporter | January 22, 2025</p>
            <noscript>
              <img src="https://analytics.example.com/pixel.gif?page=article123" alt="" width="1" height="1">
              <p>For the full interactive experience, please enable JavaScript</p>
            </noscript>
            <div class="article-content">
              <p>This is the main article content that is always visible.</p>
              <p>It contains important information about the event.</p>
              <p>More details will be revealed as the story develops.</p>
            </div>
            <noscript>
              <div class="fallback-comments">
                <p>Comments require JavaScript. Email us at feedback@news.example.com</p>
              </div>
            </noscript>
            <div id="comments-section"></div>
          </article>
          <footer>© 2025 News Network</footer>
        </body>
      </html>
    `,
    clientSide: `
      <html>
        <head><title>Breaking News: Important Event</title></head>
        <body>
          <header>
            <nav>News | Sports | Weather</nav>
          </header>
          <article>
            <h1>Breaking News: Important Event</h1>
            <p class="byline">By Jane Reporter | January 22, 2025</p>
            <noscript>
              <img src="https://analytics.example.com/pixel.gif?page=article123" alt="" width="1" height="1">
              <p>For the full interactive experience, please enable JavaScript</p>
            </noscript>
            <div class="article-content">
              <p>This is the main article content that is always visible.</p>
              <p>It contains important information about the event.</p>
              <p>More details will be revealed as the story develops.</p>
            </div>
            <noscript>
              <div class="fallback-comments">
                <p>Comments require JavaScript. Email us at feedback@news.example.com</p>
              </div>
            </noscript>
            <div id="comments-section">
              <h3>Comments (15)</h3>
              <div class="comment">First comment here</div>
              <div class="comment">Another perspective</div>
              <div class="comment">I disagree with this</div>
            </div>
          </article>
          <footer>© 2025 News Network</footer>
        </body>
      </html>
    `,
    expectedDiff: {
      contentAdded: ['Comments (15)', 'First comment here', 'Another perspective'],
      contentFromNoscript: ['For the full interactive experience', 'Comments require JavaScript'],
    },
  },

  // SPA with server-side rendering
  spaApplication: {
    name: 'SPA with SSR',
    description: 'Single Page Application with server-side rendering fallback',
    serverSide: `
      <html>
        <head><title>Dashboard</title></head>
        <body>
          <header>
            <h1>My Dashboard</h1>
            <nav>Overview | Settings | Logout</nav>
          </header>
          <noscript>
            <div class="noscript-warning" style="background: #fff3cd; padding: 20px; border: 2px solid #856404;">
              <h2>JavaScript Required</h2>
              <p>This application requires JavaScript to function properly.</p>
              <p>Please enable JavaScript in your browser settings and reload the page.</p>
              <p>For assistance, contact support@example.com</p>
            </div>
          </noscript>
          <main id="app">
            <div class="ssr-content">
              <section>
                <h2>Welcome Back!</h2>
                <p>Loading your dashboard...</p>
              </section>
            </div>
          </main>
          <footer>© 2025 Dashboard App</footer>
        </body>
      </html>
    `,
    clientSide: `
      <html>
        <head><title>Dashboard</title></head>
        <body>
          <header>
            <h1>My Dashboard</h1>
            <nav>Overview | Settings | Logout</nav>
          </header>
          <noscript>
            <div class="noscript-warning" style="background: #fff3cd; padding: 20px; border: 2px solid #856404;">
              <h2>JavaScript Required</h2>
              <p>This application requires JavaScript to function properly.</p>
              <p>Please enable JavaScript in your browser settings and reload the page.</p>
              <p>For assistance, contact support@example.com</p>
            </div>
          </noscript>
          <main id="app">
            <div class="dashboard-widgets">
              <section class="widget">
                <h2>Welcome Back!</h2>
                <p>You have 5 new notifications</p>
              </section>
              <section class="widget">
                <h3>Recent Activity</h3>
                <ul>
                  <li>Logged in from New York</li>
                  <li>Updated profile settings</li>
                  <li>Completed task: Review documents</li>
                </ul>
              </section>
              <section class="widget">
                <h3>Quick Stats</h3>
                <p>Tasks completed: 42</p>
                <p>Messages: 12 unread</p>
              </section>
            </div>
          </main>
          <footer>© 2025 Dashboard App</footer>
        </body>
      </html>
    `,
    expectedDiff: {
      contentAdded: ['5 new notifications', 'Recent Activity', 'Quick Stats', 'Tasks completed'],
      contentFromNoscript: ['JavaScript Required', 'This application requires JavaScript'],
      criticalNoscriptWarning: true,
    },
  },

  // Accessibility-focused site
  accessibilityFirst: {
    name: 'Accessibility-First Site',
    description: 'Site with progressive enhancement and accessibility fallbacks',
    serverSide: `
      <html>
        <head><title>Accessible Forms</title></head>
        <body>
          <header>
            <h1>Contact Form</h1>
            <nav>Home | Contact | About</nav>
          </header>
          <main>
            <noscript>
              <div role="alert" style="background: #d1ecf1; padding: 15px; border: 1px solid #bee5eb;">
                <p><strong>Notice:</strong> This form works without JavaScript.</p>
                <p>We've designed this form to be fully functional with or without JavaScript enabled.</p>
              </div>
            </noscript>
            <form method="POST" action="/submit">
              <h2>Get in Touch</h2>
              <div class="form-group">
                <label for="name">Name:</label>
                <input type="text" id="name" name="name" required>
                <noscript>
                  <small>This field is required. Please fill it out.</small>
                </noscript>
              </div>
              <div class="form-group">
                <label for="email">Email:</label>
                <input type="email" id="email" name="email" required>
                <noscript>
                  <small>Please enter a valid email address.</small>
                </noscript>
              </div>
              <div class="form-group">
                <label for="message">Message:</label>
                <textarea id="message" name="message" required></textarea>
              </div>
              <button type="submit">Send Message</button>
            </form>
          </main>
          <footer>© 2025 Accessible Site</footer>
        </body>
      </html>
    `,
    clientSide: `
      <html>
        <head><title>Accessible Forms</title></head>
        <body>
          <header>
            <h1>Contact Form</h1>
            <nav>Home | Contact | About</nav>
          </header>
          <main>
            <noscript>
              <div role="alert" style="background: #d1ecf1; padding: 15px; border: 1px solid #bee5eb;">
                <p><strong>Notice:</strong> This form works without JavaScript.</p>
                <p>We've designed this form to be fully functional with or without JavaScript enabled.</p>
              </div>
            </noscript>
            <form method="POST" action="/submit" class="enhanced">
              <h2>Get in Touch</h2>
              <p class="form-hint">Real-time validation enabled</p>
              <div class="form-group">
                <label for="name">Name:</label>
                <input type="text" id="name" name="name" required>
                <noscript>
                  <small>This field is required. Please fill it out.</small>
                </noscript>
                <span class="validation-message" aria-live="polite"></span>
              </div>
              <div class="form-group">
                <label for="email">Email:</label>
                <input type="email" id="email" name="email" required>
                <noscript>
                  <small>Please enter a valid email address.</small>
                </noscript>
                <span class="validation-message" aria-live="polite"></span>
              </div>
              <div class="form-group">
                <label for="message">Message:</label>
                <textarea id="message" name="message" required></textarea>
                <span class="char-counter">0 characters</span>
              </div>
              <button type="submit">Send Message</button>
            </form>
          </main>
          <footer>© 2025 Accessible Site</footer>
        </body>
      </html>
    `,
    expectedDiff: {
      contentAdded: ['Real-time validation enabled', 'characters'],
      contentFromNoscript: ['This form works without JavaScript', 'This field is required'],
      preservesAccessibility: true,
    },
  },

  // Cookie consent banner
  gdprCompliant: {
    name: 'GDPR-Compliant Site',
    description: 'Site with cookie consent and noscript tracking alternatives',
    serverSide: `
      <html>
        <head><title>Privacy-Aware Blog</title></head>
        <body>
          <header>
            <h1>Tech Blog</h1>
            <nav>Articles | About | Privacy</nav>
          </header>
          <noscript>
            <div class="cookie-notice" style="background: #f8f9fa; padding: 15px; border-bottom: 2px solid #dee2e6;">
              <p><strong>Privacy Notice:</strong> This site uses cookies for basic functionality.</p>
              <p>By continuing to use this site, you consent to our use of essential cookies.</p>
              <p>No tracking or analytics cookies will be set without JavaScript.</p>
            </div>
          </noscript>
          <main>
            <article>
              <h2>Understanding Web Performance</h2>
              <p class="meta">Published: January 22, 2025 | 5 min read</p>
              <p>Web performance is crucial for user experience and SEO.</p>
              <p>Here are the key metrics you should monitor:</p>
              <ul>
                <li>First Contentful Paint (FCP)</li>
                <li>Largest Contentful Paint (LCP)</li>
                <li>Time to Interactive (TTI)</li>
              </ul>
              <p>Let's dive into each metric in detail.</p>
            </article>
            <noscript>
              <aside class="no-js-notice">
                <p>Related articles and recommendations require JavaScript.</p>
                <p>Browse our <a href="/archive">article archive</a> manually.</p>
              </aside>
            </noscript>
            <aside id="recommendations"></aside>
          </main>
          <footer>© 2025 Tech Blog</footer>
        </body>
      </html>
    `,
    clientSide: `
      <html>
        <head><title>Privacy-Aware Blog</title></head>
        <body>
          <header>
            <h1>Tech Blog</h1>
            <nav>Articles | About | Privacy</nav>
          </header>
          <noscript>
            <div class="cookie-notice" style="background: #f8f9fa; padding: 15px; border-bottom: 2px solid #dee2e6;">
              <p><strong>Privacy Notice:</strong> This site uses cookies for basic functionality.</p>
              <p>By continuing to use this site, you consent to our use of essential cookies.</p>
              <p>No tracking or analytics cookies will be set without JavaScript.</p>
            </div>
          </noscript>
          <main>
            <article>
              <h2>Understanding Web Performance</h2>
              <p class="meta">Published: January 22, 2025 | 5 min read</p>
              <p>Web performance is crucial for user experience and SEO.</p>
              <p>Here are the key metrics you should monitor:</p>
              <ul>
                <li>First Contentful Paint (FCP)</li>
                <li>Largest Contentful Paint (LCP)</li>
                <li>Time to Interactive (TTI)</li>
              </ul>
              <p>Let's dive into each metric in detail.</p>
            </article>
            <noscript>
              <aside class="no-js-notice">
                <p>Related articles and recommendations require JavaScript.</p>
                <p>Browse our <a href="/archive">article archive</a> manually.</p>
              </aside>
            </noscript>
            <aside id="recommendations">
              <h3>You Might Also Like</h3>
              <ul>
                <li><a href="/article2">Core Web Vitals Explained</a></li>
                <li><a href="/article3">Optimizing Images for the Web</a></li>
                <li><a href="/article4">JavaScript Performance Tips</a></li>
              </ul>
            </aside>
          </main>
          <footer>© 2025 Tech Blog</footer>
        </body>
      </html>
    `,
    expectedDiff: {
      contentAdded: ['You Might Also Like', 'Core Web Vitals Explained'],
      contentFromNoscript: ['Privacy Notice', 'No tracking or analytics cookies'],
    },
  },
};

