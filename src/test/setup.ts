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

// jsdom thiếu matchMedia mà Ant Design (Grid, Layout) dùng để theo dõi kích thước màn hình
window.matchMedia ??= (query: string) =>
  ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList

// jsdom không tính bố cục; ProseMirror (trình soạn chương Tiptap) cần các hàm đo vị trí này
const emptyRect = () => new DOMRect(0, 0, 0, 0)
const emptyRects = () => Object.assign([], { item: () => null }) as unknown as DOMRectList
Range.prototype.getBoundingClientRect ??= emptyRect
Range.prototype.getClientRects ??= emptyRects
document.elementFromPoint ??= () => null
