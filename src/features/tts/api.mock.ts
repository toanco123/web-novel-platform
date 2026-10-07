// Giọng AI giả: mọi đoạn có chữ đều "có sẵn" một clip im lặng ngắn. Cần đăng nhập như bản thật.
import { requireUser } from '@/features/auth/api'
import { getChapter } from '@/features/chapters/api'
import { blockTexts, parseContent } from '@/features/chapters/richText'
import { SILENT_AUDIO } from '@/features/reader/speech/silentAudio'
import { ttsMock } from '@/mocks/tts'
import { type TtsManifest, type TtsRequest, TtsError } from './shared'

export async function fetchClips(request: TtsRequest): Promise<TtsManifest> {
  ttsMock.requests.push(request)
  await requireUser().catch(() => {
    throw new TtsError('unauthenticated')
  })
  if (ttsMock.fail) throw new TtsError(ttsMock.fail)
  const chapter = await getChapter(request.slug, request.chapter)
  if (!chapter) throw new TtsError('not_found')
  const paragraphs = blockTexts(parseContent(chapter.content))
  if (request.total !== undefined && request.total !== paragraphs.length) {
    throw new TtsError('content_changed')
  }
  const clip = (text: string) => (/[\p{L}\p{N}]/u.test(text) ? [SILENT_AUDIO] : [])
  return {
    total: paragraphs.length,
    title: request.title ? [SILENT_AUDIO] : null,
    paragraphs: paragraphs.map(clip),
  }
}
