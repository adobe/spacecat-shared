/*
 * Copyright 2023 Adobe. All rights reserved.
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
 * Wraps a function with an example middleware that prints hello world.
 *
 * @param {UniversalFunction} func the universal function
 * @param {ExampleOptions} [opts] Options
 * @returns {function(*, *): Promise<*>} an universal function with the added middleware.
 */
export default function example(func, opts = {}) {
  const { name } = opts;
  return async (request, context) => {
    const x = 50 * 3;
    console.log(`Hello world, ${name} [${x}]!`);
    return func(request, context);
  };
}
