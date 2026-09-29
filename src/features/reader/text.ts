/** Tốc độ đọc trung bình: dùng cho "khoảng N phút đọc" và làm mốc 1× của tự động cuộn */
export const WORDS_PER_MINUTE = 220

export const countWords = (text: string) => text.split(/\s+/).filter(Boolean).length
