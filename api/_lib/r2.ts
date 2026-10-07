// Lưu file âm thanh của Giọng AI lên Cloudflare R2 (API tương thích S3, ký bằng aws4fetch).
// Bucket đọc công khai qua tên miền riêng (TTS_PUBLIC_BASE_URL). Plan: documents/plan-giong-ai.md
import { AwsClient } from 'aws4fetch'

export type R2Config = {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
  /** Địa chỉ công khai của bucket, vd https://audio.example.com */
  publicBaseUrl: string
}

const TIMEOUT_MS = 10_000

export function createR2(config: R2Config) {
  const client = new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    service: 's3',
    region: 'auto',
  })
  const base = `https://${config.accountId}.r2.cloudflarestorage.com/${config.bucket}`
  return {
    async put(key: string, bytes: Uint8Array<ArrayBuffer>) {
      const response = await client.fetch(`${base}/${key}`, {
        method: 'PUT',
        body: bytes,
        headers: {
          'content-type': 'audio/mpeg',
          // Tên file theo hash nội dung nên không bao giờ đổi
          'cache-control': 'public, max-age=31536000, immutable',
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      if (!response.ok) throw new Error(`R2 trả mã ${response.status}`)
    },
    publicUrl: (key: string) => `${config.publicBaseUrl.replace(/\/+$/, '')}/${key}`,
  }
}
