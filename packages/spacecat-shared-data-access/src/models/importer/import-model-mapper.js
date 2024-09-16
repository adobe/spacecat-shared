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

/**
 * Map the properties of the source object into the target object based on the mapping array.
 *
 * @param {object} sourceObj The source object.
 * @param {array} mapping An array of arrays in the format of either
 * ['modelPropertyKey', ['apiPropertyKey'] or ['modelPropertyKey', modelToApiFn()]
 */
function mappingReducer(sourceObj, mapping) {
  const sourceMapIndex = 0;
  const targetMapIndex = 1;

  return mapping.reduce((targetObj, mapEntry) => {
    if (sourceObj[mapEntry[sourceMapIndex]] === undefined) {
      return targetObj;
    }

    if (typeof mapEntry[targetMapIndex] === 'function') {
      const result = mapEntry[targetMapIndex](sourceObj[mapEntry[sourceMapIndex]]);
      Object.assign(targetObj, result);
    } else {
      // eslint-disable-next-line no-param-reassign
      targetObj[mapEntry[targetMapIndex]] = sourceObj[mapEntry[sourceMapIndex]];
    }

    return targetObj;
  }, {});
}

/**
 * Map the model object to a plain old object based on the model map. If the source
 * object does not contain a key that is specified in the mapping array, that key
 * will not be included in the resulting object.
 *
 * @param {object} model The model to convert to a POJO
 * @param {array} modelMap Map mapping array that contains multiple arrays. The nested arrays
 * containing key mappings between objects.
 * Inner array format can be either ['modelPropertyKey', ['apiPropertyKey'] or
 * ['modelPropertyKey', modelToApiFn()]
 */
export function map(model, modelMap) {
  return mappingReducer(model, modelMap);
}
