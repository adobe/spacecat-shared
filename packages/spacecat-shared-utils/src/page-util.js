/*
 * Copyright 2024 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

/* c8 ignore start */
/**
 * Get the sections of the page for EDS page.
 * @param {Document} document - The document root of the page.
 * @returns {Array<Element>} - The sections of the page.
 */
function getEDSSections(document) {
  const mainElement = document.querySelector('body > main');
  if (!mainElement || !mainElement.children || mainElement.children.length === 0) {
    return [];
  }
  // all the direct children of the main element with class section are sections
  const sections = Array.from(mainElement.children).filter((child) => child.classList.contains('section'));
  return sections;
}

/**
 * Get the blocks of EDS page.
 * @param {Document} document - The document root of the page.
 * @returns {Array<Element>} - The blocks of the page.
 */
function getEDSBlocks(document) {
  const mainElement = document.querySelector('body > main');
  if (!mainElement || !mainElement.children || mainElement.children.length === 0) {
    return [];
  }
  const blocks = [];
  // Process all children of main's children (2 levels deep)
  Array.from(mainElement.children).forEach((level1Child) => {
    Array.from(level1Child.children).forEach((level2Child) => {
      // If it's a wrapper, get its first child, otherwise use the element itself
      const blockElement = level2Child.getAttribute('class')?.includes('-wrapper') && level2Child.children.length > 0
        ? level2Child.children[0]
        : level2Child;
      if (blockElement) {
        blocks.push(blockElement);
      }
    });
  });
  return blocks;
}

export { getEDSSections, getEDSBlocks };
/* c8 ignore stop */
