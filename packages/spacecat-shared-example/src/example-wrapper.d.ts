/*
 * Copyright 2021 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import { UniversalFunction } from '@adobe/helix-universal';

/**
 * Options for the wrap function
 */
export declare interface ExampleOptions {

  /**
   * Your name.
   * @default 'SomeBody'
   */
  name?:string;
}

/**
 * Example middleware prints hello world to the console.
 * @example <caption></caption>
 *
 * ```js
 * const { wrap } = require('@adobe/helix-shared');
 * const { example } = require('@adobe/spacecat-shared');
 *
 * async function main(req, context) {
 *   const { enc } = context;
 *
 *   //…my action cod using 'env'…
 * }
 *
 * module.exports.main = wrap(main)
 *   .with(example);
 * ```
 *
 * @function bodyData
 * @param {UniversalFunction} fn - original universal function
 * @param {ExampleOptions} [opts] - optional options.
 * @returns {UniversalFunction} a new function that wraps the original one.
 */
export declare function example(fn: UniversalFunction, opts: SecretsOptions): UniversalFunction;
