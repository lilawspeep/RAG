import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// jsdom does not implement element scrolling.
Element.prototype.scrollTo ??= function scrollTo() {};
Element.prototype.scrollIntoView ??= function scrollIntoView() {};

afterEach(() => {
  cleanup();
  localStorage.clear();
});
