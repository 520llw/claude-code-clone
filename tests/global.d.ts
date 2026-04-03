import type { MockFS } from './mocks/MockFS';

declare global {
  var mockFS: MockFS;
}

export {};
