/**
 * Utils Module Index
 * 
 * Central export point for all utility modules in the codebase.
 */

// Core Utilities
export * from './logger';
export * from './errors';
export * from './async';
export * from './fs';
export * from './path';
export * from './string';
export * from './object';
export * from './array';
export * from './hash';
export * from './time';
export * from './validation';

// Re-export with namespace for convenience
import * as logger from './logger';
import * as errors from './errors';
import * as asyncUtils from './async';
import * as fsUtils from './fs';
import * as pathUtils from './path';
import * as stringUtils from './string';
import * as objectUtils from './object';
import * as arrayUtils from './array';
import * as hashUtils from './hash';
import * as timeUtils from './time';
import * as validationUtils from './validation';

export const utils = {
  logger,
  errors,
  async: asyncUtils,
  fs: fsUtils,
  path: pathUtils,
  string: stringUtils,
  object: objectUtils,
  array: arrayUtils,
  hash: hashUtils,
  time: timeUtils,
  validation: validationUtils,
};

export default utils;
