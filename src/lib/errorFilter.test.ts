import { AdminError } from '@/features/admin/shared'
import { AuthError } from '@/features/auth/shared'
import { ChapterNotSavedError } from '@/features/offline/readChapter'
import { StudioError } from '@/features/studio/shared'
import { goOffline } from '@/test/offline'
import { scrubUrl, shouldReport, shouldSendEvent, toReportable } from './errorFilter'

const dbError = (code: string) => ({ code, message: 'lỗi', details: 'chi tiết', hint: null })

describe('shouldReport', () => {
  test('lỗi nghiệp vụ của feature không gửi', () => {
    expect(shouldReport(new StudioError('story_limit'))).toBe(false)
    expect(shouldReport(new AuthError('invalid_credentials', 'Sai mật khẩu'))).toBe(false)
    expect(shouldReport(new AdminError('forbidden'))).toBe(false)
    expect(shouldReport(new ChapterNotSavedError())).toBe(false)
  })

  test('lỗi feature mã unknown vẫn gửi (lỗi lạ đã bị gói lại)', () => {
    expect(shouldReport(new AuthError('unknown', 'Có lỗi xảy ra'))).toBe(true)
  })

  test('lỗi DB: luật nghiệp vụ, trùng khóa, trang vượt tổng không gửi; lỗi khác thì gửi', () => {
    expect(shouldReport(dbError('P0001'))).toBe(false)
    expect(shouldReport(dbError('23505'))).toBe(false)
    expect(shouldReport(dbError('PGRST103'))).toBe(false)
    expect(shouldReport(dbError('42501'))).toBe(true)
    expect(shouldReport(dbError('22P02'))).toBe(true)
  })

  test('supabase-js gặp lỗi mạng (trả object có message lỗi fetch) thì không gửi', () => {
    expect(
      shouldReport({ code: '', message: 'TypeError: Failed to fetch', details: '', hint: '' }),
    ).toBe(false)
  })

  test('lỗi mạng và lỗi tải file JS sau khi web lên bản mới không gửi', () => {
    expect(shouldReport(new TypeError('Failed to fetch'))).toBe(false)
    expect(shouldReport(new TypeError('Load failed'))).toBe(false)
    expect(shouldReport(new TypeError('NetworkError when attempting to fetch resource.'))).toBe(
      false,
    )
    expect(
      shouldReport(new TypeError('Failed to fetch dynamically imported module: /assets/a.js')),
    ).toBe(false)
    expect(shouldReport(new TypeError('Importing a module script failed.'))).toBe(false)
  })

  test('đang offline thì không gửi gì', () => {
    goOffline()
    expect(shouldReport(new Error('x is undefined'))).toBe(false)
  })

  test('lỗi code bình thường thì gửi', () => {
    expect(shouldReport(new TypeError("Cannot read properties of undefined (reading 'id')"))).toBe(
      true,
    )
    expect(shouldReport('chuỗi lạ')).toBe(true)
  })
})

describe('scrubUrl', () => {
  test('ẩn mã đăng nhập trong query (link xác nhận email, OAuth)', () => {
    expect(scrubUrl('https://web.vn/auth/callback?code=abc123&next=%2Flibrary')).toBe(
      'https://web.vn/auth/callback?code=[đã ẩn]&next=%2Flibrary',
    )
    expect(scrubUrl('https://web.vn/reset-password?token_hash=xyz&type=recovery')).toBe(
      'https://web.vn/reset-password?token_hash=[đã ẩn]&type=recovery',
    )
  })

  test('ẩn token trong hash', () => {
    expect(
      scrubUrl('https://web.vn/reset-password#access_token=a.b.c&expires_in=3600&refresh_token=r1'),
    ).toBe(
      'https://web.vn/reset-password#access_token=[đã ẩn]&expires_in=3600&refresh_token=[đã ẩn]',
    )
  })

  test('giữ nguyên URL không có token, kể cả tham số có đuôi giống tên token', () => {
    const url = 'https://web.vn/search?q=ma&page=2#error_code=otp_expired'
    expect(scrubUrl(url)).toBe(url)
  })
})

describe('toReportable', () => {
  test('lỗi PostgREST dạng object đổi thành Error có mã trong message', () => {
    const { error, extra } = toReportable(dbError('42501'))
    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('PostgrestError')
    expect(error.message).toBe('42501: lỗi')
    expect(extra).toEqual({ code: '42501', details: 'chi tiết', hint: null })
  })

  test('Error giữ nguyên, giá trị khác bọc thành Error', () => {
    const original = new Error('hỏng')
    expect(toReportable(original).error).toBe(original)
    expect(toReportable('chuỗi lạ').error.message).toBe('chuỗi lạ')
  })
})

describe('shouldSendEvent (lỗi Sentry tự bắt)', () => {
  test('dùng lỗi gốc nên lỗi feature mã unknown vẫn gửi, mã nghiệp vụ thì không', () => {
    const event = { exception: { values: [{ type: 'AuthError', value: 'x' }] } }
    expect(shouldSendEvent(event, { originalException: new AuthError('unknown', 'x') })).toBe(true)
    expect(shouldSendEvent(event, { originalException: new StudioError('story_limit') })).toBe(
      false,
    )
  })

  test('không có lỗi gốc thì dựng lại từ event', () => {
    const event = {
      exception: { values: [{ type: 'TypeError', value: 'Failed to fetch' }] },
    }
    expect(shouldSendEvent(event)).toBe(false)
  })
})
