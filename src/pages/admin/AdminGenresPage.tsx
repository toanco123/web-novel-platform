import { Alert, App, Button, Card, Form, Input, Modal, Popconfirm, Select, Table, Tag } from 'antd'
import { useState } from 'react'
import { Link } from 'react-router'
import { SITE_NAME } from '@/config/site'
import { ADMIN_PAGE_SIZES, adminErrorMessage } from '@/features/admin/api'
import { FilterSelect } from '@/features/admin/components/TableFilters'
import { useDeleteGenre, useMergeGenres, useUpdateGenre } from '@/features/admin/hooks'
import type { GenreWithCount } from '@/features/genres/api'
import { useGenres } from '@/features/genres/hooks'
import { genreSchema } from '@/features/genres/schemas'
import { formatDate } from '@/lib/format'
import { slugify } from '@/lib/slugify'
import { paths } from '@/lib/routes'

const number = new Intl.NumberFormat('vi-VN')

/** Lỗi của một trường theo genreSchema (dùng làm rule của Form antd) */
const zodRule =
  (field: 'name' | 'description') => async (_: unknown, value: string | undefined) => {
    const result = genreSchema.shape[field].safeParse(value ?? '')
    if (!result.success) throw new Error(result.error.issues[0]?.message)
  }

export default function AdminGenresPage() {
  const { data: genres = [], isPending, isError } = useGenres()
  const [q, setQ] = useState('')
  // Thể loại ít và tải cả danh sách một lần nên lọc, sắp xếp, phân trang ngay ở trình duyệt
  const [source, setSource] = useState<'builtin' | 'user' | null>(null)
  const [pageSize, setPageSize] = useState(50)
  const [editing, setEditing] = useState<GenreWithCount | null>(null)
  const [merging, setMerging] = useState<GenreWithCount | null>(null)
  const [mergeInto, setMergeInto] = useState<string | null>(null)
  const [form] = Form.useForm<{ name: string; description: string }>()
  const update = useUpdateGenre()
  const remove = useDeleteGenre()
  const merge = useMergeGenres()
  const { message } = App.useApp()

  const query = slugify(q)
  const shown = genres.filter(
    (g) => (!query || g.slug.includes(query)) && (!source || (source === 'user') === !!g.createdBy),
  )

  const openEdit = (genre: GenreWithCount) => {
    form.setFieldsValue({ name: genre.name, description: genre.description ?? '' })
    setEditing(genre)
  }
  const saveEdit = async () => {
    if (!editing) return
    const values = await form.validateFields()
    update.mutate(
      { slug: editing.slug, ...values },
      {
        onSuccess: () => {
          setEditing(null)
          void message.success('Đã lưu thể loại.')
        },
        onError: (error) => void message.error(adminErrorMessage(error)),
      },
    )
  }
  const saveMerge = () => {
    if (!merging || !mergeInto) return
    const target = genres.find((g) => g.slug === mergeInto)
    merge.mutate(
      { from: merging.slug, into: mergeInto },
      {
        onSuccess: (moved) => {
          setMerging(null)
          void message.success(
            `Đã gộp "${merging.name}" vào "${target?.name}" (${number.format(Number(moved))} truyện được chuyển).`,
          )
        },
        onError: (error) => void message.error(adminErrorMessage(error)),
      },
    )
  }

  return (
    <div className="space-y-6">
      <title>{`Thể loại · Quản trị | ${SITE_NAME}`}</title>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-3xl font-semibold">Thể loại</h1>
        <p className="text-sm text-muted-foreground">{number.format(genres.length)} thể loại</p>
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Input.Search
            className="max-w-xs"
            placeholder="Tìm thể loại"
            aria-label="Tìm thể loại"
            allowClear
            onChange={(e) => setQ(e.target.value)}
          />
          <FilterSelect
            label="Nguồn"
            value={source ?? undefined}
            onChange={setSource}
            options={[
              { value: 'builtin', label: 'Có sẵn' },
              { value: 'user', label: 'Người dùng tạo' },
            ]}
          />
        </div>
        {isError ? (
          <Alert type="error" showIcon title="Không tải được thể loại." />
        ) : (
          <Table<GenreWithCount>
            rowKey="slug"
            loading={isPending}
            dataSource={shown}
            scroll={{ x: 960 }}
            pagination={{
              pageSize,
              pageSizeOptions: ADMIN_PAGE_SIZES,
              showSizeChanger: {
                virtual: false,
                id: 'page-size',
                'aria-label': 'Số dòng mỗi trang',
              },
              hideOnSinglePage: shown.length <= ADMIN_PAGE_SIZES[0],
              showTotal: (total, [from, to]) => `${from}–${to} trong ${number.format(total)}`,
              onShowSizeChange: (_, size) => setPageSize(size),
            }}
            locale={{
              emptyText: q || source ? 'Không có thể loại nào khớp' : 'Chưa có thể loại nào',
            }}
            columns={[
              {
                title: 'Thể loại',
                dataIndex: 'name',
                width: 280,
                sorter: (a, b) => a.name.localeCompare(b.name, 'vi'),
                render: (name: string, g) => (
                  <div className="min-w-0">
                    <Link to={paths.genre(g.slug)} className="font-medium">
                      {name}
                    </Link>
                    {g.description && (
                      <p className="line-clamp-2 text-xs text-muted-foreground">{g.description}</p>
                    )}
                  </div>
                ),
              },
              {
                title: 'Slug',
                dataIndex: 'slug',
                width: 160,
                ellipsis: true,
                render: (slug: string) => <code className="text-xs">{slug}</code>,
              },
              {
                title: 'Truyện công khai',
                dataIndex: 'storyCount',
                align: 'right',
                width: 160,
                sorter: (a, b) => a.storyCount - b.storyCount,
                render: (n: number) => number.format(n),
              },
              {
                title: 'Người tạo',
                key: 'createdBy',
                width: 170,
                ellipsis: true,
                render: (_, g) => (g.createdBy ? g.createdBy.displayName : <Tag>Có sẵn</Tag>),
              },
              {
                title: 'Ngày tạo',
                dataIndex: 'createdAt',
                width: 130,
                // Thể loại có sẵn (không có ngày tạo) luôn ở cuối, dù xếp tăng hay giảm (antd tự đảo
                // kết quả khi xếp giảm nên phải đảo lại phần này)
                sorter: (a, b, order) =>
                  a.createdAt && b.createdAt
                    ? a.createdAt.localeCompare(b.createdAt)
                    : (Number(!a.createdAt) - Number(!b.createdAt)) *
                      (order === 'descend' ? -1 : 1),
                render: (v: string | null) => (v ? formatDate(v) : '–'),
              },
              {
                title: 'Thao tác',
                key: 'actions',
                width: 220,
                className: 'whitespace-nowrap',
                render: (_, g) => (
                  <div className="flex gap-2">
                    <Button size="small" onClick={() => openEdit(g)}>
                      Sửa
                    </Button>
                    <Button
                      size="small"
                      onClick={() => {
                        setMergeInto(null)
                        setMerging(g)
                      }}
                    >
                      Gộp vào…
                    </Button>
                    <Popconfirm
                      title={`Xóa thể loại "${g.name}"?`}
                      description={
                        g.storyCount > 0
                          ? `${number.format(g.storyCount)} truyện công khai sẽ mất thể loại này.`
                          : 'Không truyện công khai nào đang dùng thể loại này.'
                      }
                      okText="Xóa"
                      okButtonProps={{ danger: true }}
                      cancelText="Hủy"
                      onConfirm={() =>
                        remove.mutate(g.slug, {
                          onSuccess: () => void message.success(`Đã xóa "${g.name}".`),
                          onError: (error) => void message.error(adminErrorMessage(error)),
                        })
                      }
                    >
                      <Button size="small" danger>
                        Xóa
                      </Button>
                    </Popconfirm>
                  </div>
                ),
              },
            ]}
          />
        )}
      </Card>

      <Modal
        open={!!editing}
        title={editing && `Sửa thể loại "${editing.name}"`}
        okText="Lưu"
        cancelText="Hủy"
        confirmLoading={update.isPending}
        onOk={() => void saveEdit()}
        onCancel={() => setEditing(null)}
        forceRender
      >
        <p className="mb-4 text-sm text-muted-foreground">
          Đổi tên thì đường dẫn thể loại đổi theo; truyện vẫn giữ thể loại này.
        </p>
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item name="name" label="Tên thể loại" rules={[{ validator: zodRule('name') }]}>
            <Input maxLength={30} />
          </Form.Item>
          <Form.Item
            name="description"
            label="Mô tả"
            rules={[{ validator: zodRule('description') }]}
          >
            <Input.TextArea maxLength={200} showCount autoSize={{ minRows: 2 }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={!!merging}
        title={merging && `Gộp "${merging.name}" vào thể loại khác`}
        okText="Gộp"
        okButtonProps={{ disabled: !mergeInto, danger: true }}
        cancelText="Hủy"
        confirmLoading={merge.isPending}
        onOk={saveMerge}
        onCancel={() => setMerging(null)}
        destroyOnHidden
      >
        <p className="mb-3 text-sm text-muted-foreground">
          Truyện của "{merging?.name}" chuyển sang thể loại được chọn, rồi "{merging?.name}" bị xóa.
          Không hoàn tác được.
        </p>
        <label htmlFor="merge-into" className="mb-1 block text-sm font-medium">
          Gộp vào
        </label>
        <Select
          id="merge-into"
          className="w-full"
          // Danh sách thể loại ngắn: không cần danh sách ảo
          virtual={false}
          showSearch={{ optionFilterProp: 'label' }}
          placeholder="Chọn thể loại"
          value={mergeInto}
          onChange={setMergeInto}
          options={genres
            .filter((g) => g.slug !== merging?.slug)
            .map((g) => ({ value: g.slug, label: g.name }))}
        />
      </Modal>
    </div>
  )
}
