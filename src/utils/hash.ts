/**
 * Hash Utilities Module
 * 
 * Provides comprehensive hashing utilities including cryptographic hashes,
 * non-cryptographic hashes, and checksum operations.
 */

import { createHash, randomBytes, createHmac, pbkdf2Sync, scryptSync } from 'crypto';

// ============================================================================
// Types and Interfaces
// ============================================================================

export type HashAlgorithm =
  | 'md5'
  | 'sha1'
  | 'sha224'
  | 'sha256'
  | 'sha384'
  | 'sha512'
  | 'sha3-224'
  | 'sha3-256'
  | 'sha3-384'
  | 'sha3-512';

export type Encoding = 'hex' | 'base64' | 'base64url' | 'buffer';

export interface HashOptions {
  algorithm?: HashAlgorithm;
  encoding?: Encoding;
}

export interface HmacOptions extends HashOptions {
  secret: string;
}

export interface Pbkdf2Options {
  salt?: string;
  iterations?: number;
  keyLength?: number;
  digest?: string;
}

export interface ScryptOptions {
  salt?: string;
  keyLength?: number;
  cost?: number;
  blockSize?: number;
  parallelization?: number;
}

export interface HashResult {
  hash: string;
  salt?: string;
}

// ============================================================================
// Cryptographic Hashes
// ============================================================================

export function hash(
  data: string | Buffer,
  options: HashOptions = {}
): string {
  const { algorithm = 'sha256', encoding = 'hex' } = options;

  const hasher = createHash(algorithm);
  hasher.update(data);

  if (encoding === 'buffer') {
    throw new Error('Use hashBuffer for buffer output');
  }

  return hasher.digest(encoding);
}

export function hashBuffer(
  data: string | Buffer,
  algorithm: HashAlgorithm = 'sha256'
): Buffer {
  const hasher = createHash(algorithm);
  hasher.update(data);
  return hasher.digest();
}

export function hmac(
  data: string | Buffer,
  options: HmacOptions
): string {
  const { secret, algorithm = 'sha256', encoding = 'hex' } = options;

  const hmacer = createHmac(algorithm, secret);
  hmacer.update(data);

  if (encoding === 'buffer') {
    throw new Error('Use hmacBuffer for buffer output');
  }

  return hmacer.digest(encoding);
}

export function hmacBuffer(
  data: string | Buffer,
  secret: string,
  algorithm: HashAlgorithm = 'sha256'
): Buffer {
  const hmacer = createHmac(algorithm, secret);
  hmacer.update(data);
  return hmacer.digest();
}

export function md5(data: string | Buffer): string {
  return hash(data, { algorithm: 'md5' });
}

export function sha1(data: string | Buffer): string {
  return hash(data, { algorithm: 'sha1' });
}

export function sha256(data: string | Buffer): string {
  return hash(data, { algorithm: 'sha256' });
}

export function sha512(data: string | Buffer): string {
  return hash(data, { algorithm: 'sha512' });
}

// ============================================================================
// Password Hashing
// ============================================================================

export function hashPassword(
  password: string,
  options: Pbkdf2Options = {}
): HashResult {
  const {
    salt = generateSalt(),
    iterations = 100000,
    keyLength = 64,
    digest = 'sha512',
  } = options;

  const hash = pbkdf2Sync(password, salt, iterations, keyLength, digest).toString('hex');

  return {
    hash: `${salt}$${iterations}$${hash}`,
    salt,
  };
}

export function verifyPassword(password: string, hashedPassword: string): boolean {
  const parts = hashedPassword.split('$');

  if (parts.length !== 3) {
    return false;
  }

  const [salt, iterationsStr, hash] = parts;
  const iterations = parseInt(iterationsStr, 10);

  if (isNaN(iterations)) {
    return false;
  }

  const computed = pbkdf2Sync(password, salt, iterations, hash.length / 2, 'sha512').toString('hex');

  return timingSafeEqual(hash, computed);
}

export function hashPasswordScrypt(
  password: string,
  options: ScryptOptions = {}
): HashResult {
  const {
    salt = generateSalt(),
    keyLength = 64,
    cost = 16384,
    blockSize = 8,
    parallelization = 1,
  } = options;

  const hash = scryptSync(password, salt, keyLength, {
    N: cost,
    r: blockSize,
    p: parallelization,
  }).toString('hex');

  return {
    hash: `${salt}$${cost}$${blockSize}$${parallelization}$${hash}`,
    salt,
  };
}

export function verifyPasswordScrypt(password: string, hashedPassword: string): boolean {
  const parts = hashedPassword.split('$');

  if (parts.length !== 5) {
    return false;
  }

  const [salt, costStr, blockSizeStr, parallelizationStr, hash] = parts;
  const cost = parseInt(costStr, 10);
  const blockSize = parseInt(blockSizeStr, 10);
  const parallelization = parseInt(parallelizationStr, 10);

  if (isNaN(cost) || isNaN(blockSize) || isNaN(parallelization)) {
    return false;
  }

  const computed = scryptSync(password, salt, hash.length / 2, {
    N: cost,
    r: blockSize,
    p: parallelization,
  }).toString('hex');

  return timingSafeEqual(hash, computed);
}

// ============================================================================
// Salt Generation
// ============================================================================

export function generateSalt(length: number = 16): string {
  return randomBytes(length).toString('hex');
}

export function generateRandomString(length: number = 32): string {
  return randomBytes(Math.ceil(length / 2))
    .toString('hex')
    .slice(0, length);
}

export function generateSecureToken(length: number = 32): string {
  return randomBytes(length).toString('base64url');
}

export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (randomBytes(1)[0] & 0x0f) >> (c === 'x' ? 0 : 1);
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ============================================================================
// Non-Cryptographic Hashes
// ============================================================================

export function djb2(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
  }
  return hash >>> 0;
}

export function sdbm(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + (hash << 6) + (hash << 16) - hash;
  }
  return hash >>> 0;
}

export function fnv1a(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return hash >>> 0;
}

export function murmur3(str: string, seed: number = 0): number {
  const c1 = 0xcc9e2d51;
  const c2 = 0x1b873593;
  const r1 = 15;
  const r2 = 13;
  const m = 5;
  const n = 0xe6546b64;

  let hash = seed;
  let k;

  for (let i = 0; i < str.length - (str.length % 4); i += 4) {
    k = (str.charCodeAt(i) & 0xff) |
      ((str.charCodeAt(i + 1) & 0xff) << 8) |
      ((str.charCodeAt(i + 2) & 0xff) << 16) |
      ((str.charCodeAt(i + 3) & 0xff) << 24);

    k = (k * c1) & 0xffffffff;
    k = (k << r1) | (k >>> (32 - r1));
    k = (k * c2) & 0xffffffff;

    hash ^= k;
    hash = ((hash << r2) | (hash >>> (32 - r2))) & 0xffffffff;
    hash = (hash * m + n) & 0xffffffff;
  }

  // Handle remaining bytes
  k = 0;
  switch (str.length % 4) {
    case 3:
      k ^= (str.charCodeAt(str.length - 3) & 0xff) << 16;
    // fallthrough
    case 2:
      k ^= (str.charCodeAt(str.length - 2) & 0xff) << 8;
    // fallthrough
    case 1:
      k ^= str.charCodeAt(str.length - 1) & 0xff;
      k = (k * c1) & 0xffffffff;
      k = (k << r1) | (k >>> (32 - r1));
      k = (k * c2) & 0xffffffff;
      hash ^= k;
  }

  hash ^= str.length;
  hash ^= hash >>> 16;
  hash = (hash * 0x85ebca6b) & 0xffffffff;
  hash ^= hash >>> 13;
  hash = (hash * 0xc2b2ae35) & 0xffffffff;
  hash ^= hash >>> 16;

  return hash >>> 0;
}

// ============================================================================
// Checksums
// ============================================================================

export function crc32(str: string): number {
  const table: number[] = [];
  let c;

  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }

  let crc = 0 ^ -1;
  for (let i = 0; i < str.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ str.charCodeAt(i)) & 0xff];
  }

  return (crc ^ -1) >>> 0;
}

export function adler32(str: string): number {
  let a = 1;
  let b = 0;

  for (let i = 0; i < str.length; i++) {
    a = (a + str.charCodeAt(i)) % 65521;
    b = (b + a) % 65521;
  }

  return ((b << 16) | a) >>> 0;
}

export function checksum(data: string | Buffer, algorithm: HashAlgorithm = 'sha256'): string {
  return hash(data, { algorithm });
}

// ============================================================================
// File Hashes
// ============================================================================

import { createReadStream } from 'fs';
import { Readable } from 'stream';

export async function hashFile(
  filePath: string,
  algorithm: HashAlgorithm = 'sha256'
): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash(algorithm);
    const stream = createReadStream(filePath);

    stream.on('error', reject);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

export async function hashStream(
  stream: Readable,
  algorithm: HashAlgorithm = 'sha256'
): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash(algorithm);

    stream.on('error', reject);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

// ============================================================================
// Object Hashing
// ============================================================================

export function hashObject(
  obj: Record<string, unknown>,
  algorithm: HashAlgorithm = 'sha256'
): string {
  const sorted = sortKeys(obj);
  const serialized = JSON.stringify(sorted);
  return hash(serialized, { algorithm });
}

function sortKeys(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sortKeys);
  }

  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj as Record<string, unknown>).sort()) {
    sorted[key] = sortKeys((obj as Record<string, unknown>)[key]);
  }

  return sorted;
}

// ============================================================================
// Consistent Hashing
// ============================================================================

export class ConsistentHash {
  private ring: Map<number, string> = new Map();
  private nodes: Set<string> = new Set();
  private virtualNodes: number;

  constructor(nodes: string[] = [], virtualNodes: number = 150) {
    this.virtualNodes = virtualNodes;
    for (const node of nodes) {
      this.addNode(node);
    }
  }

  addNode(node: string): void {
    if (this.nodes.has(node)) {
      return;
    }

    this.nodes.add(node);

    for (let i = 0; i < this.virtualNodes; i++) {
      const hash = murmur3(`${node}:${i}`);
      this.ring.set(hash, node);
    }
  }

  removeNode(node: string): void {
    if (!this.nodes.has(node)) {
      return;
    }

    this.nodes.delete(node);

    for (let i = 0; i < this.virtualNodes; i++) {
      const hash = murmur3(`${node}:${i}`);
      this.ring.delete(hash);
    }
  }

  getNode(key: string): string | undefined {
    if (this.ring.size === 0) {
      return undefined;
    }

    const hash = murmur3(key);
    const sortedHashes = Array.from(this.ring.keys()).sort((a, b) => a - b);

    // Find the first node with hash >= key hash
    for (const nodeHash of sortedHashes) {
      if (nodeHash >= hash) {
        return this.ring.get(nodeHash);
      }
    }

    // Wrap around to the first node
    return this.ring.get(sortedHashes[0]);
  }

  getNodes(): string[] {
    return Array.from(this.nodes);
  }
}

// ============================================================================
// Bloom Filter (Simple Implementation)
// ============================================================================

export class BloomFilter {
  private bits: boolean[];
  private size: number;
  private hashFunctions: number;

  constructor(expectedItems: number, falsePositiveRate: number = 0.01) {
    this.size = Math.ceil(-(expectedItems * Math.log(falsePositiveRate)) / (Math.log(2) ** 2));
    this.hashFunctions = Math.ceil((this.size / expectedItems) * Math.log(2));
    this.bits = new Array(this.size).fill(false);
  }

  add(item: string): void {
    for (let i = 0; i < this.hashFunctions; i++) {
      const hash = murmur3(`${item}:${i}`);
      const index = hash % this.size;
      this.bits[index] = true;
    }
  }

  mightContain(item: string): boolean {
    for (let i = 0; i < this.hashFunctions; i++) {
      const hash = murmur3(`${item}:${i}`);
      const index = hash % this.size;
      if (!this.bits[index]) {
        return false;
      }
    }
    return true;
  }

  clear(): void {
    this.bits.fill(false);
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

export function hashToInt(hash: string, max: number): number {
  const num = parseInt(hash.slice(0, 8), 16);
  return num % max;
}

export function combineHashes(hashes: string[]): string {
  return sha256(hashes.join(''));
}

// ============================================================================
// Default Export
// ============================================================================

export default {
  hash,
  hashBuffer,
  hmac,
  hmacBuffer,
  md5,
  sha1,
  sha256,
  sha512,
  hashPassword,
  verifyPassword,
  hashPasswordScrypt,
  verifyPasswordScrypt,
  generateSalt,
  generateRandomString,
  generateSecureToken,
  generateUUID,
  djb2,
  sdbm,
  fnv1a,
  murmur3,
  crc32,
  adler32,
  checksum,
  hashFile,
  hashStream,
  hashObject,
  ConsistentHash,
  BloomFilter,
  timingSafeEqual,
  hashToInt,
  combineHashes,
};
