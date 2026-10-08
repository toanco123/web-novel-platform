// Bản bìa nhỏ: jsdom không vẽ ảnh thật, nên giả createImageBitmap và canvas
import { makeCoverThumb } from './image'

afterEach(() => vi.restoreAllMocks())

test('makeCoverThumb: vẽ lại ảnh bìa 480×720 thành 320×480, xuất WebP', async () => {
  const close = vi.fn()
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async () => ({ width: 480, height: 720, close })),
  )
  const drawImage = vi.fn()
  const getContext = vi
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockReturnValue({ drawImage } as unknown as CanvasRenderingContext2D)
  const toDataURL = vi
    .spyOn(HTMLCanvasElement.prototype, 'toDataURL')
    .mockReturnValue('data:image/webp;base64,BB')

  const thumb = await makeCoverThumb('data:image/webp;base64,AAAA')
  expect(thumb).toBe('data:image/webp;base64,BB')
  const canvas = getContext.mock.contexts[0] as HTMLCanvasElement
  expect([canvas.width, canvas.height]).toEqual([320, 480])
  // Cùng tỉ lệ 2:3 nên lấy trọn ảnh gốc
  expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 480, 720, 0, 0, 320, 480)
  expect(toDataURL).toHaveBeenCalledWith('image/webp', 0.8)
  expect(close).toHaveBeenCalled()
  vi.unstubAllGlobals()
})
