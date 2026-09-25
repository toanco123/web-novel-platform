/** "Bạn đọc Demo" → "BD", "Linh" → "LI" */
export function initials(name: string) {
  const words = name.trim().split(/\s+/)
  const letters = words.length > 1 ? words[0][0] + words[words.length - 1][0] : words[0].slice(0, 2)
  return letters.toUpperCase()
}
