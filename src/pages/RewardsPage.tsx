import { CalendarCheck, Ticket } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Container } from '@/components/common/Container'
import { Pagination } from '@/components/common/Pagination'
import { RequireAuth } from '@/components/common/RequireAuth'
import { SectionError } from '@/components/common/SectionHeading'
import { Seo } from '@/components/common/Seo'
import { Skeleton } from '@/components/ui/skeleton'
import { SITE_NAME } from '@/config/site'
import {
  CHECKIN_BONUS_REWARD,
  CHECKIN_REWARD,
  type LedgerEntry,
  ledgerText,
  VOTE_MIN_ACCOUNT_AGE_DAYS,
} from '@/features/rewards/api'
import { CheckInCard } from '@/features/rewards/components/CheckInCard'
import { RewardBloom } from '@/features/rewards/components/RewardBloom'
import { useTicketHistory } from '@/features/rewards/hooks'
import { paths } from '@/lib/routes'
import { cn } from '@/lib/utils'

const card = 'min-w-0 flex-1 basis-[22rem] rounded-3xl border bg-card p-6'

export default function RewardsPage() {
  return (
    <Container className="max-w-5xl py-10">
      <Seo title={`Phiếu đề cử | ${SITE_NAME}`} noindex />
      <h1 className="font-heading text-4xl font-semibold">Phiếu đề cử</h1>
      <p className="mt-1 max-w-xl text-muted-foreground">
        Điểm danh mỗi ngày để nhận phiếu, rồi dùng phiếu đề cử những truyện bạn muốn nhiều người
        biết tới.
      </p>
      <RequireAuth fallback={<RewardsSkeleton />}>
        <div className="mt-8 flex flex-wrap gap-5">
          <section aria-label="Điểm danh" className={cn(card, 'basis-[26rem]')}>
            <CheckInCard showRewardsLink={false} />
          </section>
          <HowItWorks />
        </div>
        <TicketHistory />
      </RequireAuth>
    </Container>
  )
}

function RewardsSkeleton() {
  return (
    <div className="mt-8 space-y-8" aria-busy aria-label="Đang tải phiếu đề cử">
      <div className="flex flex-wrap gap-5">
        <Skeleton className="h-[30rem] min-w-0 flex-1 basis-[26rem] rounded-3xl" />
        <Skeleton className="h-[30rem] min-w-0 flex-1 basis-[22rem] rounded-3xl" />
      </div>
      <Skeleton className="h-72 rounded-2xl" />
    </div>
  )
}

function HowItWorks() {
  return (
    <section aria-labelledby="how-it-works" className={cn(card, 'flex flex-col gap-5')}>
      <h2 id="how-it-works" className="font-heading text-[1.75rem] leading-tight font-semibold">
        Cách nhận và dùng phiếu
      </h2>
      <ul className="space-y-4">
        <Rule
          icon={<CalendarCheck className="size-5 text-neon" aria-hidden />}
          title={`Điểm danh mỗi ngày: +${CHECKIN_REWARD} phiếu`}
        >
          Ngày tính theo giờ Việt Nam, mỗi ngày một lần.
        </Rule>
        <Rule
          icon={<RewardBloom className="size-6" center="fill-white" />}
          iconClassName="bg-wine"
          title={`Đủ 7 ngày liền: +${CHECKIN_BONUS_REWARD} phiếu`}
        >
          Lỡ một ngày thì chuỗi bắt đầu lại từ ngày 1.
        </Rule>
        <Rule
          icon={<Ticket className="size-5 text-rose-gold" aria-hidden />}
          title="Đề cử truyện bạn thích"
        >
          Bấm "Đề cử" ở trang truyện. Truyện nhiều phiếu lên bảng{' '}
          <Link to={paths.rankingVotes} className="text-rose-gold hover:underline">
            Đề cử tuần
          </Link>
          .
        </Rule>
      </ul>
      <p className="mt-auto rounded-xl bg-muted p-3.5 text-sm leading-relaxed text-muted-foreground">
        Phiếu không hết hạn và không đổi ra tiền. Tài khoản tạo đủ {VOTE_MIN_ACCOUNT_AGE_DAYS} ngày
        mới đề cử được.
      </p>
    </section>
  )
}

function Rule({
  icon,
  iconClassName,
  title,
  children,
}: {
  icon: ReactNode
  iconClassName?: string
  title: string
  children: ReactNode
}) {
  return (
    <li className="flex gap-3.5">
      <span
        className={cn(
          'grid size-10 shrink-0 place-items-center rounded-xl bg-secondary',
          iconClassName,
        )}
      >
        {icon}
      </span>
      <span className="space-y-0.5">
        <strong className="block font-semibold">{title}</strong>
        <span className="block text-sm leading-relaxed text-muted-foreground">{children}</span>
      </span>
    </li>
  )
}

// en-GB: "07/10" và "14:45" (vi-VN ghi ngày tháng bằng dấu gạch và đặt giờ trước)
const dayMonth = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit' })
const hourMinute = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' })
/** "07/10 14:45" */
const dateTime = (date: Date) => `${dayMonth.format(date)} ${hourMinute.format(date)}`

function TicketHistory() {
  const [params] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const { data, isPending, isError, isPlaceholderData } = useTicketHistory(page)

  return (
    <section aria-labelledby="ticket-history" className="mt-10 space-y-4">
      <h2 id="ticket-history" className="font-heading text-3xl font-semibold">
        Lịch sử phiếu
      </h2>
      {isError ? (
        <SectionError />
      ) : isPending ? (
        <Skeleton className="h-72 rounded-2xl" />
      ) : data.total === 0 ? (
        <p className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
          Chưa có giao dịch nào. Điểm danh để nhận phiếu đầu tiên.
        </p>
      ) : (
        <>
          {/* relative: sr-only của bảng không thoát ra ngoài vùng cuộn ngang (CLAUDE.md) */}
          <div className="relative overflow-x-auto rounded-2xl border bg-card">
            <table
              aria-busy={isPlaceholderData}
              className={cn('w-full min-w-[34rem] text-sm', isPlaceholderData && 'opacity-60')}
            >
              <thead className="text-left text-xs tracking-wider text-muted-foreground uppercase">
                <tr>
                  <th scope="col" className="px-5 py-3.5 font-semibold">
                    Thời gian
                  </th>
                  <th scope="col" className="px-5 py-3.5 font-semibold">
                    Nội dung
                  </th>
                  <th scope="col" className="px-5 py-3.5 text-right font-semibold">
                    Thay đổi
                  </th>
                  <th scope="col" className="px-5 py-3.5 text-right font-semibold">
                    Số dư
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((entry) => (
                  <HistoryRow key={entry.id} entry={entry} />
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={data.page}
            pageCount={data.pageCount}
            searchFor={(p) => (p > 1 ? `?page=${p}` : '?')}
            label="Phân trang lịch sử phiếu"
            preventScrollReset
          />
        </>
      )}
    </section>
  )
}

function HistoryRow({ entry }: { entry: LedgerEntry }) {
  const plus = entry.amount > 0
  return (
    <tr className="border-t border-border/60">
      <td className="px-5 py-4 whitespace-nowrap text-muted-foreground tabular-nums">
        <time dateTime={entry.createdAt}>{dateTime(new Date(entry.createdAt))}</time>
      </td>
      <td className="px-5 py-4">
        <span className="flex items-center gap-2.5">
          <span
            aria-hidden
            className={cn('size-2 shrink-0 rounded-full', plus ? 'bg-neon' : 'bg-rose-gold')}
          />
          <span>
            {ledgerText(entry)}
            {entry.story && (
              <>
                {' '}
                <Link to={paths.story(entry.story.slug)} className="text-rose-gold hover:underline">
                  {entry.story.title}
                </Link>
              </>
            )}
          </span>
        </span>
      </td>
      <td
        className={cn(
          'px-5 py-4 text-right font-semibold whitespace-nowrap tabular-nums',
          plus ? 'text-neon' : 'text-foreground',
        )}
      >
        {plus ? '+' : '−'}
        {Math.abs(entry.amount)}
      </td>
      <td className="px-5 py-4 text-right text-muted-foreground tabular-nums">
        {entry.balanceAfter}
      </td>
    </tr>
  )
}
