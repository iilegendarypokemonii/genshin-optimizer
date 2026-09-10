/** One recognized text line with its bounding box, from the Rust `ocr_screenshot` command. */
export interface OcrLine {
  text: string
  x: number
  y: number
  w: number
  h: number
}

export interface OcrOutput {
  lines: OcrLine[]
  imageW: number
  imageH: number
}

export interface OcrError {
  kind: 'OcrUnavailable' | 'BadPath' | 'ReadError' | 'DecodeError' | 'OcrFailed'
  message: string
}
