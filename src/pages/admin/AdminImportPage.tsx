import { Alert, Button, Card, Input, Select, Tag, Upload } from 'antd'
import { FileUp } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { Link } from 'react-router'
import { SITE_NAME } from '@/config/site'
import {
  BULK_MAX_FILES,
  BulkImportError,
  type BulkImportResult,
  type BulkStoryDraft,
  draftErrors,
  importableChapters,
  readStoryFile,
} from '@/features/admin/bulkImport'
import { useImportStory } from '@/features/admin/hooks'
import { useGenres } from '@/features/genres/hooks'
import { studioErrorMessage } from '@/features/studio/errors'
import { DESCRIPTION_MAX } from '@/features/studio/schemas'
import { paths } from '@/lib/routes'
import type { StoryStatus } from '@/types/story'

const number = new Intl.NumberFormat('vi-VN')

type RowState =
  | { state: 'idle' }
  | { state: 'running' }
  | { state: 'done'; result: BulkImportResult }
  | { state: 'error'; message: string; storyId: string | null }

type Row = BulkStoryDraft & { progress: RowState }

const statusOptions: { value: StoryStatus; label: string }[] = [
  { value: 'completed', label: 'Hoàn thành' },
  { value: 'ongoing', label: 'Đang ra' },
]

export default function AdminImportPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [fileErrors, setFileErrors] = useState<string[]>([])
  const [running, setRunning] = useState(false)
  const [bulk, setBulk] = useState<{
    authorName: string
    genreSlugs: string[]
    status?: StoryStatus
  }>({ authorName: '', genreSlugs: [] })
  const { data: genres = [] } = useGenres()
  const importStory = useImportStory()
  const genreOptions = genres.map((g) => ({ value: g.slug, label: g.name }))

  const addFiles = async (files: File[]) => {
    const room = BULK_MAX_FILES - rows.length
    const errors: string[] = []
    if (files.length > room) {
      errors.push(
        `Mỗi lần nhập tối đa ${BULK_MAX_FILES} file; đã bỏ ${files.length - room} file thừa.`,
      )
    }
    const drafts: Row[] = []
    for (const [i, file] of files.slice(0, Math.max(0, room)).entries()) {
      try {
        const draft = await readStoryFile(file, `${Date.now()}-${i}-${file.name}`)
        drafts.push({ ...draft, progress: { state: 'idle' } })
      } catch (error) {
        errors.push(`${file.name}: ${error instanceof Error ? error.message : 'không đọc được.'}`)
      }
    }
    setFileErrors(errors)
    setRows((current) => [...current, ...drafts])
  }

  const patch = (key: string, change: Partial<BulkStoryDraft>) =>
    setRows((current) =>
      current.map((r) =>
        // Sửa hàng đã nhập lỗi thì cho nhập lại
        r.key === key
          ? {
              ...r,
              ...change,
              progress: r.progress.state === 'done' ? r.progress : { state: 'idle' },
            }
          : r,
      ),
    )
  const setProgress = (key: string, progress: RowState) =>
    setRows((current) => current.map((r) => (r.key === key ? { ...r, progress } : r)))

  const applyToAll = () =>
    setRows((current) =>
      current.map((r) =>
        r.progress.state === 'done'
          ? r
          : {
              ...r,
              authorName: bulk.authorName.trim() || r.authorName,
              genreSlugs: bulk.genreSlugs.length ? bulk.genreSlugs : r.genreSlugs,
              status: bulk.status ?? r.status,
            },
      ),
    )

  const pending = rows.filter((r) => r.progress.state !== 'done')
  const invalid = pending.filter((r) => Object.keys(draftErrors(r)).length > 0)

  // Nhập lần lượt: một truyện lỗi không dừng các truyện khác
  const runImport = async () => {
    setRunning(true)
    for (const row of pending) {
      setProgress(row.key, { state: 'running' })
      try {
        const result = await importStory.mutateAsync(row)
        setProgress(row.key, { state: 'done', result })
      } catch (error) {
        setProgress(row.key, {
          state: 'error',
          message: error instanceof BulkImportError ? error.message : studioErrorMessage(error),
          storyId: error instanceof BulkImportError ? error.storyId : null,
        })
      }
    }
    setRunning(false)
  }

  const done = rows.filter((r) => r.progress.state === 'done').length

  return (
    <div className="space-y-6">
      <title>{`Nhập truyện · Quản trị | ${SITE_NAME}`}</title>
      <div>
        <h1 className="font-heading text-3xl font-semibold">Nhập truyện hàng loạt</h1>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          Mỗi file .txt (mã UTF-8, tối đa 2 MB) là một truyện. Tên file thành tên truyện, chương
          tách theo dòng "Chương 1: Tiêu đề". Phần trước chương đầu tiên được dùng làm giới thiệu.
          Truyện đứng tên tài khoản của bạn, hiển thị tên tác giả gốc; sửa tiếp được trong khu Sáng
          tác.
        </p>
      </div>
      <Alert
        type="warning"
        showIcon
        title="Chỉ nhập truyện bạn có quyền đăng (truyện của bạn, đã được tác giả cho phép, hoặc hết thời hạn bản quyền)."
      />

      <Upload.Dragger
        multiple
        accept=".txt,text/plain"
        showUploadList={false}
        disabled={running}
        // Tự đọc file ở trình duyệt, không upload lên đâu cả
        beforeUpload={(file, list) => {
          if (file === list[0]) void addFiles(list)
          return Upload.LIST_IGNORE
        }}
      >
        <div className="flex flex-col items-center gap-2 py-4">
          <FileUp className="size-8 text-muted-foreground" aria-hidden />
          <p>Kéo các file .txt vào đây hoặc bấm để chọn</p>
          <p className="text-xs text-muted-foreground">Tối đa {BULK_MAX_FILES} file mỗi lần</p>
        </div>
      </Upload.Dragger>
      {fileErrors.length > 0 && (
        <Alert
          type="error"
          showIcon
          title="Một số file không đọc được"
          description={
            <ul className="list-disc pl-4">
              {fileErrors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          }
        />
      )}

      {rows.length > 0 && (
        <>
          <Card size="small" title="Áp dụng cho tất cả truyện chưa nhập">
            <div className="grid gap-3 md:grid-cols-[1fr_2fr_10rem_auto] md:items-end">
              <label className="space-y-1 text-sm">
                <span className="font-medium">Tác giả gốc</span>
                <Input
                  value={bulk.authorName}
                  maxLength={60}
                  onChange={(e) => setBulk({ ...bulk, authorName: e.target.value })}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Thể loại</span>
                <Select
                  mode="multiple"
                  // Danh sách thể loại ngắn: không cần danh sách ảo
                  virtual={false}
                  maxCount={5}
                  className="w-full"
                  showSearch={{ optionFilterProp: 'label' }}
                  options={genreOptions}
                  value={bulk.genreSlugs}
                  onChange={(genreSlugs) => setBulk({ ...bulk, genreSlugs })}
                  aria-label="Thể loại cho tất cả"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Tiến độ</span>
                <Select
                  className="w-full"
                  allowClear
                  options={statusOptions}
                  value={bulk.status}
                  onChange={(status) => setBulk({ ...bulk, status })}
                  aria-label="Tiến độ cho tất cả"
                />
              </label>
              <Button onClick={applyToAll} disabled={running}>
                Áp dụng
              </Button>
            </div>
          </Card>

          <div className="space-y-4">
            {rows.map((row) => (
              <DraftCard
                key={row.key}
                row={row}
                genreOptions={genreOptions}
                disabled={running || row.progress.state === 'done'}
                onChange={(change) => patch(row.key, change)}
                onRemove={() => setRows((current) => current.filter((r) => r.key !== row.key))}
              />
            ))}
          </div>

          <div className="sticky bottom-0 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-4">
            <Button
              type="primary"
              size="large"
              loading={running}
              disabled={pending.length === 0 || invalid.length > 0}
              onClick={() => void runImport()}
            >
              Nhập {number.format(pending.length)} truyện
            </Button>
            <span className="text-sm text-muted-foreground">
              {invalid.length > 0
                ? `Còn ${invalid.length} truyện cần sửa trước khi nhập.`
                : done > 0
                  ? `Đã nhập ${done}/${rows.length} truyện.`
                  : 'Truyện được nhập và xuất bản lần lượt.'}
            </span>
          </div>
        </>
      )}
    </div>
  )
}

function DraftCard({
  row,
  genreOptions,
  disabled,
  onChange,
  onRemove,
}: {
  row: Row
  genreOptions: { value: string; label: string }[]
  disabled: boolean
  onChange: (change: Partial<BulkStoryDraft>) => void
  onRemove: () => void
}) {
  const errors = row.progress.state === 'done' ? {} : draftErrors(row)
  const usable = importableChapters(row).length
  const skipped = row.chapters.length - usable
  const id = (field: string) => `${row.key}-${field}`

  return (
    <Card
      size="small"
      title={
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate">{row.fileName}</span>
          <ProgressTag progress={row.progress} />
        </span>
      }
      extra={
        row.progress.state !== 'done' && (
          <Button size="small" type="text" danger disabled={disabled} onClick={onRemove}>
            Bỏ
          </Button>
        )
      }
    >
      <div className="grid gap-3 md:grid-cols-2">
        <Field id={id('title')} label="Tên truyện" error={errors.title}>
          <Input
            id={id('title')}
            value={row.title}
            maxLength={120}
            disabled={disabled}
            status={errors.title ? 'error' : undefined}
            onChange={(e) => onChange({ title: e.target.value })}
          />
        </Field>
        <Field id={id('author')} label="Tác giả gốc" error={errors.authorName}>
          <Input
            id={id('author')}
            value={row.authorName}
            maxLength={60}
            disabled={disabled}
            placeholder="Trống: hiện tên tài khoản của bạn"
            onChange={(e) => onChange({ authorName: e.target.value })}
          />
        </Field>
        <Field id={id('genres')} label="Thể loại (1–5)" error={errors.genreSlugs}>
          <Select
            id={id('genres')}
            mode="multiple"
            virtual={false}
            maxCount={5}
            className="w-full"
            showSearch={{ optionFilterProp: 'label' }}
            options={genreOptions}
            value={row.genreSlugs}
            disabled={disabled}
            status={errors.genreSlugs ? 'error' : undefined}
            onChange={(genreSlugs) => onChange({ genreSlugs })}
          />
        </Field>
        <Field id={id('status')} label="Tiến độ">
          <Select
            id={id('status')}
            className="w-full"
            options={statusOptions}
            value={row.status}
            disabled={disabled}
            onChange={(status) => onChange({ status })}
          />
        </Field>
        <div className="md:col-span-2">
          <Field id={id('description')} label="Giới thiệu" error={errors.description}>
            <Input.TextArea
              id={id('description')}
              value={row.description}
              maxLength={DESCRIPTION_MAX}
              showCount
              autoSize={{ minRows: 2, maxRows: 6 }}
              disabled={disabled}
              status={errors.description ? 'error' : undefined}
              onChange={(e) => onChange({ description: e.target.value })}
            />
          </Field>
        </div>
      </div>

      <div className="mt-3 space-y-1 text-sm">
        <p>
          {number.format(usable)} chương sẽ được nhập
          {skipped > 0 && (
            <span className="text-destructive">
              , {number.format(skipped)} chương bị bỏ qua (quá ngắn hoặc quá dài)
            </span>
          )}
          .
        </p>
        {errors.chapters && <p className="text-destructive">{errors.chapters}</p>}
        {row.warnings.map((w) => (
          <p key={w} className="text-muted-foreground">
            {w}
          </p>
        ))}
        {row.progress.state === 'done' && (
          <p>
            <Link to={paths.story(row.progress.result.slug)}>Xem trang truyện</Link>
            {' · '}
            <Link to={paths.studioStory(row.progress.result.id)}>Mở trong khu Sáng tác</Link>
          </p>
        )}
        {row.progress.state === 'error' && (
          <p className="text-destructive">
            {row.progress.message}
            {row.progress.storyId && (
              <>
                {' '}
                <Link to={paths.studioStory(row.progress.storyId)}>Mở truyện nháp</Link>
              </>
            )}
          </p>
        )}
      </div>
    </Card>
  )
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string
  label: string
  error?: string
  children: ReactNode
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

function ProgressTag({ progress }: { progress: RowState }) {
  switch (progress.state) {
    case 'running':
      return <Tag color="processing">Đang nhập…</Tag>
    case 'done':
      return <Tag color="green">Đã nhập</Tag>
    case 'error':
      return <Tag color="red">Lỗi</Tag>
    default:
      return null
  }
}
