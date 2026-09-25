export const countWords = (text: string) => text.split(/\s+/).filter(Boolean).length

/** Tách đoạn theo dòng trống; nội dung luôn là văn bản thuần, không render HTML */
export const toParagraphs = (content: string) =>
  content
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
