import * as fs           from 'fs'
import type { Readable } from 'node:stream'

import { ComputerVisionClient }  from '@azure/cognitiveservices-computervision'
import { GetReadResultResponse } from '@azure/cognitiveservices-computervision/esm/models'
import { ApiKeyCredentials }     from '@azure/ms-rest-js'

const AZURE_KEY =      process.env.AZURE_KEY!
const AZURE_ENDPOINT = process.env.AZURE_ENDPOINT!
const FILE_PATH =      './image/ocr-sample.png'

async function main() {
  const azure = new ComputerVisionClient(
    new ApiKeyCredentials({ inHeader: { 'Ocp-Apim-Subscription-Key': AZURE_KEY } }),
    AZURE_ENDPOINT
  )

  // 画像ファイルを読み込む
  const imageStream = fs.createReadStream(FILE_PATH)
  const imageBuffer = await streamToBuffer(imageStream)

  // Azure に OCR リクエストを送信する
  const readInStreamResult = await azure.readInStream(imageBuffer, { language: 'ja' })
  const operationId        = readInStreamResult.operationLocation.split('/').pop()!

  // OCR 結果を取得する
  const ocrResult = await pollUntilSucceeded(azure, operationId)

  const ocrText = ocrResult.analyzeResult!.readResults.reduce((text, page) => {
    const pageText = page.lines.reduce((lineText, line) => lineText + line.text + '\n', '')
    return text + pageText
  }, '')

  console.debug({ ocrText })
}

/**
 * 指定した操作IDに対する結果が成功するまでポーリングする。
 */
async function pollUntilSucceeded(
  azure:       ComputerVisionClient,
  operationId: string
): Promise<GetReadResultResponse> {
  const result = await azure.getReadResult(operationId)
  console.debug(`ocr: ${result.status}`)

  if (result.status !== 'succeeded') {
    await new Promise(resolve => setTimeout(resolve, 5000))
    return pollUntilSucceeded(azure, operationId)
  }
  return result
}

/**
 * ReadableStream を Buffer に変換する。
 */
async function streamToBuffer(readableStream: Readable): Promise<Buffer> {
  const chunks: any[] = []
  for await (const chunk of readableStream) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

main().catch(console.error)
