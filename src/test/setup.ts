import '@testing-library/jest-dom/vitest'

// jsdom thiếu một số API mà Radix UI dùng (menu, dropdown)
Element.prototype.hasPointerCapture ??= () => false
Element.prototype.releasePointerCapture ??= () => {}
Element.prototype.scrollIntoView ??= () => {}
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}
