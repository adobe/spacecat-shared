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

import fs from 'node:fs/promises';
import { Console } from 'node:console';
import { z } from 'zod';

const SRC_DIR = new URL('../src', import.meta.url).pathname;
const PY_DIR = new URL('../gen/py', import.meta.url).pathname;

const log = new Console({ stdout: process.stderr, stderr: process.stderr });

async function genCode() {
  const pending = [];
  await setupPyDir();
  for await (const file of fs.glob('**/*.js', { cwd: SRC_DIR })) {
    pending.push(convertFile(`${SRC_DIR}/${file}`));
  }

  await Promise.all(pending);
}

async function setupPyDir() {
  try {
    await fs.rm(PY_DIR, { recursive: true, force: true });
  } catch (e) {
    // ignore
  }
  await fs.mkdir(PY_DIR, { recursive: true });
  await fs.writeFile(`${PY_DIR}/_common.py`, PY_COMMON_FILE);
}

async function convertFile(srcFile) {
  const niceFile = srcFile.slice(SRC_DIR.length + 1);
  const pyFile = `${niceFile.replace(/\.js$/, '.py').replace(/-/g, '_')}`;
  log.info('Converting %s to %s', niceFile, pyFile);
  let mod;
  try {
    mod = await import(srcFile);
  } catch (e) {
    log.error('  ERROR importing %s: %s', niceFile, e);
    process.exitCode = 1;
    return;
  }

  const fileWriter = new PydanticFileWriter(pyFile.split('/').length - 1);
  for (const [k, v] of Object.entries(mod)) {
    if (!(v instanceof z.ZodObject)) {
      log.warn('  SKIPPING %s export %s: not a ZodObject', niceFile, k);
      continue;
    }

    fileWriter.startClass(k).writeAttrs(v.shape);
  }

  await fs.mkdir(`${PY_DIR}/${pyFile.replace(/\/[^\/]+$/, '')}`, { recursive: true });
  await fs.writeFile(`${PY_DIR}/${pyFile}`, fileWriter.finish());
}

class PydanticFileWriter {
  /** @type {Array<PydanticClassWriter>} */
  #classWriters = [];

  /** @type {string} */
  #schemaImport;

  /** @param {number} depth */
  constructor(depth) {
    this.#schemaImport = `from ${'.'.repeat(depth)}._common import schema`;
    this.imports = new ImportMap();
  }

  /** @param {string} name */
  startClass(name) {
    const classWriter = new PydanticClassWriter(name, this);
    this.#classWriters.push(classWriter);
    return classWriter;
  }

  finish() {
    let contents = PY_FILE_HEADER + '\n\n';
    for (const [module, names] of this.imports) {
      contents += `from ${module} import ${[...names].sort().join(', ')}\n`;
    }
    contents += '\n';
    contents += this.#schemaImport;
    contents += '\n\n';
    for (const classWriter of this.#classWriters) {
      contents += classWriter.finish();
    }
    return contents;
  }
}

/**
 * @typedef {object} AttrOptions
 * @property {boolean} [optional]
 * @property {boolean} [nullable]
 */

class PydanticClassWriter {
  /**
   * @type {string}
   * @readonly
   */
  #name;

  /**
   * @type {PydanticFileWriter}
   * @readonly
   */
  #fileWriter;

  /** @type {number} */
  #indentLevel;

  /** @type {Array<string>} */
  #attrs = [];

  /**
   * @type {Array<PydanticClassWriter>}
   * @readonly
   */
  #innerClasses = [];

  /**
   * @param {string} className
   * @param {PydanticFileWriter} fileWriter
   * @param {number} [indentLevel]
   */
  constructor(className, fileWriter, indentLevel = 0) {
    this.#name = className;
    this.#fileWriter = fileWriter;
    this.#indentLevel = indentLevel;
  }

  /** @param {Record<string, z.core.$ZodLooseShape>} attrs */
  writeAttrs(attrs) {
    for (const [attrName, shape] of Object.entries(attrs)) {
      this.writeAttr(attrName, shape);
    }
    return this;
  }

  /**
   * @param {string} attrName
   * @param {z.core.$ZodLooseShape} shape
   */
  writeAttr(attrName, shape) {
    const { type, options } = this.#attrType(shape, attrName);
    let attr = `${toPyName(attrName)}: ${type}`;
    if (options.optional) {
      attr += ' | None = None';
    } else if (options.nullable) {
      attr += ' | None';
    }

    this.#attrs.push(`${indent(this.#indentLevel + 1)}${attr}\n`);
    return this;
  }

  finish() {
    const idnt = indent(this.#indentLevel)
    let contents = idnt;
    contents += '@schema\n'
    contents += idnt;
    contents += `class ${this.#name}:\n`;
    for (const inner of this.#innerClasses) {
      contents += inner.finish();
    }
    contents += this.#attrs.join('') || 'pass';
    contents += '\n';
    return contents;
  }

  /**
   * @param {z.core.$ZodLooseShape} shape
   * @param {string} jsName
   * @param {AttrOptions} [options]
   * @returns {{ type: string, options: AttrOptions }}
   */
  #attrType(shape, jsName, options = {}) {
    if (shape instanceof z.ZodOptional) {
      return this.#attrType(shape.def.innerType, jsName, { ...options, optional: true });
    }
    if (shape instanceof z.ZodNullable) {
      return this.#attrType(shape.def.innerType, jsName, { ...options, nullable: true });
    }

    if (shape instanceof z.ZodBoolean) {
      return { type: 'bool', options };
    }
    if (shape instanceof z.ZodString) {
      return { type: 'str', options };
    }
    if (shape instanceof z.ZodNumber) {
      return { type: 'float', options };
    }
    if (shape instanceof z.ZodBigInt) {
      return { type: 'int', options };
    }
    if (shape instanceof z.ZodISODate) {
      this.#fileWriter.imports.get('datetime').add('datetime');
      return { type: 'datetime', options };
    }
    if (shape instanceof z.ZodUUID) {
      this.#fileWriter.imports.get('uuid').add('UUID');
      return { type: 'UUID', options };
    }
    if (shape instanceof z.ZodURL) {
      let type = 'AnyUrl';
      if (`${shape.def.protocol}` === '/^https?$/') {
        type = 'HttpUrl';
      }
      this.#fileWriter.imports.get('pydantic').add(type);
      return { type, options };
    }
    if (shape instanceof z.ZodLiteral) {
      const { values } = shape.def;
      const type = values.map(literalToPyType).join(' | ');
      return { type: JSON.stringify(values[0]), options };
    }
    if (shape instanceof z.ZodUnion) {
      const { options: os } = shape;
      if (os.every((o) => o instanceof z.ZodLiteral)) {
        this.#fileWriter.imports.get('typing').add('Literal');
        const literals = os.flatMap(o => o.def.values.map(literalToPyType));
        return { type: `Literal[${literals.join(', ')}]`, options };
      } else {
        const types = os.map((o, i) => this.#attrType(o, `inner${i}`).type);
        return { type: types.join(' | '), options };
      }
    }
    if (shape instanceof z.ZodObject) {
      const className = jsName.replace(/^./, c => c.toUpperCase())
      this.#innerClasses.push(
        new PydanticClassWriter(
          className,
          this.#fileWriter,
          this.#indentLevel + 1,
        ).writeAttrs(shape.shape),
      );
      return { type: className, options };
    }
    log.error('Unsupported Zod type:', shape);
    process.exit(1);
  }
}

/**
 * @extends Map<string, Set<string>>
 */
class ImportMap extends Map {
  /**
   * @param {string} key
   * @override
   */
  get(key) {
    return super.get(key) ?? this.#insert(key);
  }

  /** @param {string} name */
  #insert(name) {
    /** @type {Set<string>} */
    const set = new Set();
    this.set(name, set);
    return set;
  }
}

/** @param {number} indentLevel */
function indent(indentLevel) {
  return '    '.repeat(indentLevel);
}

/** @param {string} jsName  */
function toPyName(jsName) {
  return jsName.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

/** @param {AttrOptions} options */
function optionsModifier({ nullable, optional }) {
  if (optional) {
    return ' | None = None';
  }
  if (nullable) {
    return ' | None';
  }
  return '';
}

/** @param {z.core.util.Literal} literal */
function literalToPyType(literal) {
  if (literal === true) return 'True';
  if (literal === false) return 'False';
  if (literal === null) return 'None';
  if (literal === undefined) return 'None'; // hm...
  if (typeof literal === 'string') return JSON.stringify(literal);
  return `${literal}`;
}


genCode().catch((err) => {
  log.error(err);
  process.exit(1);
});

const PY_FILE_HEADER = `
# ADOBE CONFIDENTIAL
#
# Copyright ${new Date().getFullYear()} Adobe
# All Rights Reserved.
#
# NOTICE:  All information contained herein is, and remains
# the property of Adobe and its suppliers, if any. The intellectual
# and technical concepts contained herein are proprietary to Adobe
# and its suppliers and are protected by all applicable intellectual
# property laws, including trade secret and copyright laws.
# Dissemination of this information or reproduction of this material
# is strictly forbidden unless prior written permission is obtained
# from Adobe.`.trimStart();

const PY_COMMON_FILE = `
${PY_FILE_HEADER}

from pydantic import ConfigDict
from pydantic.dataclasses import dataclass
from pydantic.alias_generators import to_camel

CONFIG = ConfigDict(
  alias_generator = to_camel,
  validate_by_alias=True,
  validate_by_name=True,
)

def schema(cls):
  return dataclass(cls, config=CONFIG)
`.trimStart();

