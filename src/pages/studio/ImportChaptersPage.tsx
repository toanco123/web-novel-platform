import { FileText, TriangleAlert } from 'lucide-react'
import { useState, type DragEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import { NotFound } from '@/components/common/NotFound'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { SITE_NAME } from '@/config/site'
import { FormAlert } from '@/features/auth/components/FormAlert'
import { StudioBreadcrumb } from '@/features/studio/components/StudioBreadcrumb'
import { studioErrorMessage } from '@/features/studio/errors'
import { useImportChapters, useMyChapters, useMyStory } from '@/features/studio/hooks'
import { parseChapters, readChapterFile, type ParseResult } from '@/features/studio/parseChapters'
import { countWords } from '@/features/studio/schemas'
import { paths } from '@/lib/routes'
import { cn } from '@/lib/utils'

const number = new Intl.NumberFormat('vi-VN')

export default function ImportChaptersPage() {
  const { storyId = '' } = useParams()
  const story = useMyStory(storyId)
  const chapters = useMyChapters(storyId)
  const importMutation = useImportChapters(storyId)
  const navigate = useNavigate()
  const [file, setFile] = useState<{ name: string; result: ParseResult } | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [publish, setPublish] = useState(false)
  const [dragging, setDragging] = useState(false)

  if (story.isPending || chapters.isPending)
    return <div className="h-64 animate-pulse rounded-xl bg-muted" />
  if (!story.data)
    return <NotFound message="Không tìm thấy truyện này trong khu Sáng tác của bạn." />

  const start = (chapters.data?.at(-1)?.number ?? 0) + 1
  const parsed = file?.result.chapters ?? []
  const invalid = parsed.some((c) => c.problem)
  const totalWords = parsed.reduce((sum, c) => sum + countWords(c.content), 0)

  async function handleFile(f: File | undefined) {
    if (!f) return
    setFileError(null)
    try {
      setFile({ name: f.name, result: parseChapters(await readChapterFile(f)) })
    } catch (e) {
      setFile(null)
      setFileError(e instanceof Error ? e.message : 'Không đọc được file này.')
    }
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    void handleFile(e.dataTransfer.files[0])
  }

  return (
    <>
      <title>{`Nhập chương từ file | ${story.data.title} | ${SITE_NAME}`}</title>
      <StudioBreadcrumb
        items={[
          { label: 'Sáng tác', to: paths.studio },
          { label: story.data.title, to: paths.studioStory(storyId) },
          { label: 'Nhập từ file' },
        ]}
      />
      <h1 className="font-heading text-4xl font-semibold">Nhập chương từ file .txt</h1>
      <p className="mt-1 mb-8 max-w-prose text-muted-foreground">
        Mỗi chương bắt đầu bằng một dòng tiêu đề như <code>Chương 1: Gặp lại</code>. Chương mới được
        đánh số tiếp nối, bắt đầu từ chương {start}.
      </p>

      <label
        htmlFor="import-file"
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={cn(
          'flex max-w-2xl cursor-pointer flex-col items-center gap-1.5 rounded-xl border border-dashed px-4 py-8 text-center text-sm transition-colors hover:border-primary/60 has-focus-visible:border-ring has-focus-visible:ring-3 has-focus-visible:ring-ring/40',
          dragging && 'border-primary bg-primary/5',
        )}
      >
        <FileText className="size-7 text-muted-foreground" aria-hidden />
        {file ? (
          <span>
            Đã chọn <strong>{file.name}</strong>.{' '}
            <span className="font-medium text-rose-gold underline">Chọn file khác</span>
          </span>
        ) : (
          <span>
            Kéo file vào đây hoặc{' '}
            <span className="font-medium text-rose-gold underline">chọn file .txt</span>
          </span>
        )}
        <span className="text-xs text-muted-foreground">Mã hóa UTF-8, tối đa 2 MB.</span>
        <input
          id="import-file"
          type="file"
          accept=".txt,text/plain"
          className="sr-only"
          onChange={(e) => {
            void handleFile(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </label>
      {fileError && (
        <div className="mt-4 max-w-2xl">
          <FormAlert>{fileError}</FormAlert>
        </div>
      )}

      {file && (
        <section aria-labelledby="preview-title" className="mt-10">
          <h2 id="preview-title" className="font-heading text-2xl font-semibold">
            Xem trước: {parsed.length} chương, {number.format(totalWords)} chữ
          </h2>

          {file.result.warnings.length > 0 && (
            <ul className="mt-4 max-w-3xl space-y-2" aria-label="Cảnh báo">
              {file.result.warnings.map((w) => (
                <li
                  key={w}
                  className="flex gap-2.5 rounded-lg border border-rose-gold/40 bg-rose-gold/10 px-3.5 py-2.5 text-sm"
                >
                  <TriangleAlert className="mt-0.5 size-4 shrink-0 text-rose-gold" aria-hidden />
                  {w}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-5 overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    Lưu thành
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    Tiêu đề
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">
                    Số chữ
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    Mở đầu
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {parsed.map((c, i) => (
                  <tr key={i} className={cn(c.problem && 'bg-destructive/5')}>
                    <td className="px-4 py-2.5 whitespace-nowrap tabular-nums">
                      Chương {start + i}
                      {c.sourceNumber !== null && c.sourceNumber !== start + i && (
                        <span className="block text-xs text-muted-foreground">
                          (file ghi {c.sourceNumber})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {c.title || (
                        <span className="text-muted-foreground italic">Chưa đặt tên</span>
                      )}
                      {c.problem && (
                        <span className="block text-xs text-destructive">{c.problem}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {number.format(countWords(c.content))}
                    </td>
                    <td className="max-w-xs px-4 py-2.5 text-muted-foreground">
                      <span className="line-clamp-1">{c.content.split('\n')[0]}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex max-w-3xl flex-col gap-4">
            <label className="flex items-center gap-3 text-sm">
              <Checkbox checked={publish} onCheckedChange={(v) => setPublish(v === true)} />
              Xuất bản ngay các chương này (bỏ chọn để lưu dạng nháp)
            </label>
            {importMutation.isError && (
              <FormAlert>{studioErrorMessage(importMutation.error)}</FormAlert>
            )}
            {invalid && (
              <p className="text-sm text-destructive">
                Sửa các chương được đánh dấu đỏ trong file rồi chọn lại file.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                className="h-10 rounded-full px-5"
                disabled={invalid || parsed.length === 0 || importMutation.isPending}
                onClick={() =>
                  importMutation.mutate(
                    { items: parsed.map(({ title, content }) => ({ title, content })), publish },
                    { onSuccess: () => navigate(paths.studioStory(storyId)) },
                  )
                }
              >
                {importMutation.isPending ? 'Đang thêm…' : `Thêm ${parsed.length} chương`}
              </Button>
              <Button
                variant="ghost"
                className="h-10 rounded-full px-5"
                onClick={() => setFile(null)}
              >
                Bỏ file này
              </Button>
            </div>
          </div>
        </section>
      )}
    </>
  )
}
