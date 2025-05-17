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

const PAGE_CLASSIFICATION_MAP = {
  'wilson.com': {
    'homepage | Homepage': /^https:\/\/www\.wilson\.com(\/[a-z]{2}-[a-z]{2})?\/?$/,
    'productdetail | Product Detail Pages': /^https:\/\/www\.wilson\.com(\/[a-z]{2}-[a-z]{2})?\/product\/[a-z0-9-]+$/,
    'productlistpage | Category Pages': /^https:\/\/www\.wilson\.com(\/[a-z]{2}-[a-z]{2})?\/(tennis|baseball|softball|golf|basketball|custom|sportswear|accessories|gloves|footwear|sale|apparel|bags|protective|equipment|deals|football|volleyball|pickleball|padel|fastpitch|shoes|specialty-shops|official-partnerships)(\/|$)/,
    'search | Search Results': /^https:\/\/www\.wilson\.com(\/[a-z]{2}-[a-z]{2})?\/search(\?.*)?$/,
    'checkout | Checkout Pages': /^https:\/\/www\.wilson\.com(\/[a-z]{2}-[a-z]{2})?\/checkout(\/|$)/,
    'accountandorders | Login / Account / Wishlist / Order Pages': /^https:\/\/www\.wilson\.com(\/[a-z]{2}-[a-z]{2})?\/(login|account|register|customer|wishlist|d2x|sales)(\/|$|\/.*)/,
    'blog | Blog Articles': /^https:\/\/www\.wilson\.com(\/[a-z]{2}-[a-z]{2})?\/blog\/.+$/,
    'blog | Blog Homepage': /^https:\/\/www\.wilson\.com(\/[a-z]{2}-[a-z]{2})?\/blog(\/|$)/,
    'support | Support / Help / Warranty': /^https:\/\/www\.wilson\.com(\/[a-z]{2}-[a-z]{2})?\/(support|warranty|contact|returns|faqs|size-guide|explore\/help(\/.*)?)(\/|$)/,
    'legal | Legal / Terms / Privacy': /^https:\/\/www\.wilson\.com(\/[a-z]{2}-[a-z]{2})?\/(terms|privacy|cookie-policy|accessibility|legal-notices|explore\/terms-and-conditions|explore\/legal)(\/|$)/,
    'about | About / Brand / Company Info': /^https:\/\/www\.wilson\.com(\/[a-z]{2}-[a-z]{2})?\/(about|careers|store-locator|explore\/(about-us|careers|sportswear\/our-stores|first-responders-discount|healthcare-worker-discount|tennis\/wilson-athletes|football\/ada-ohio-factory))(\/|$)/,
    'landingpage | Promo / Campaign / Landing Pages': /^https:\/\/www\.wilson\.com(\/[a-z]{2}-[a-z]{2})?\/(customize|custom-builder|landing\/[a-z0-9-]+|explore\/basketball\/airless-prototype|explore\/forms\/.*|explore\/shoes\/.*|explore\/sportswear\/lookbook)(\/|$)/,
    'contentpage | Content Pages': /^https:\/\/www\.wilson\.com(\/[a-z]{2}-[a-z]{2})?\/(technology|team-dealers|partnerships|ambassadors|history|giftcard\/balance)(\/|$)/,
    '404 | 404 Not Found': /^https:\/\/www\.wilson\.com(\/[a-z]{2}-[a-z]{2})?\/404(\/|$)/,
    'other | Other Pages': /.*/,
  },
  'volvotrucks.us': {
    'homepage | Homepage': /^https:\/\/www\.volvotrucks\.us\/(home\/?)?$/,
    'productlistpage | Trucks Overview': /^https:\/\/www\.volvotrucks\.us\/trucks(\/|$|\?)/,
    'productdetailpage | Truck Detail Pages': /^https:\/\/www\.volvotrucks\.us\/trucks\/[a-z0-9-]+(\/|$|\?)/,
    'configurator | Truck Builder': /^https:\/\/www\.volvotrucks\.us\/truck-builder(\/|$|\?)/,
    'comparevehiclespage | Truck Comparison': /^https:\/\/www\.volvotrucks\.us\/trucks\/compare(\/|$|\?)/,
    'services | All Truck Services (Excluding Fleet)': /^https:\/\/www\.volvotrucks\.us\/services\/(?!fleet-management)([a-z0-9-]+)?(\/|$)/,
    'fleetpage | Fleet Management Services': /^https:\/\/www\.volvotrucks\.us\/services\/fleet-management(\/|$|\/.*)/,
    'events | News & Events': /^https:\/\/www\.volvotrucks\.us\/news-stories(\/|$|\/.*)/,
    'dealershippage | Find Dealer': /^https:\/\/www\.volvotrucks\.us\/find-dealer(\/|$|\?)/,
    'support | Customer Support': /^https:\/\/www\.volvotrucks\.us\/contact-us(\/|$)/,
    'about | About Volvo Trucks': /^https:\/\/www\.volvotrucks\.us\/about-us(\/|$|\?)/,
    'legal | Legal / Privacy / Cookies': /^https:\/\/www\.volvotrucks\.us\/(privacy|legal-notice|cookie-policy|terms-and-conditions)(\/|$)/,
    'careers | Careers': /^https:\/\/www\.volvogroup\.com\/en-en\/careers(\/|$|\/.*)/,
    'other | Other Pages': /.*/,
  },
};

export function classifyPage(pageUrl) {
  const domain = new URL(pageUrl).hostname?.replace('www.', '');
  const domainMappings = PAGE_CLASSIFICATION_MAP[domain];
  for (const [key, value] of Object.entries(domainMappings)) {
    if (value.test(pageUrl)) {
      return key;
    }
  }
  return 'other | Other Pages';
}
