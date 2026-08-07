import type { StatRecord } from '../src/shared/types'

/**
 * Builds Loxone stat files byte-by-byte, independently of the parser, so
 * round-trip tests aren't circular. `variant` picks which of the two
 * community stride models the file is written with.
 */
export interface BuildOpts {
  uuid?: string
  suffix?: number
  yyyymm?: string
  name?: string
  valueCount: number
  variant?: 'loxstatedit' | 'sarnau'
  controlType?: number
  records: StatRecord[]
  /** override the u16 uuid fragments written into every record */
  frags?: [number, number]
}

export function strideFor(valueCount: number, variant: 'loxstatedit' | 'sarnau'): number {
  if (variant === 'loxstatedit') return 8 + 8 * valueCount + (valueCount > 1 ? 8 : 0)
  const slots = valueCount <= 1 ? 1 : valueCount <= 3 ? 3 : valueCount <= 7 ? 7 : 10
  return 8 + slots * 8
}

export function buildStatFile(opts: BuildOpts): { fileName: string; buf: Buffer } {
  const uuid = opts.uuid ?? '10f7ca5e-01e3-15b2-ffff8caa2f4b3d5c'
  const yyyymm = opts.yyyymm ?? '202401'
  const fileName = `${uuid}${opts.suffix ? `_${opts.suffix}` : ''}.${yyyymm}`
  const variant = opts.variant ?? 'loxstatedit'
  const stride = strideFor(opts.valueCount, variant)

  const groups = uuid.split('-')
  const [frag1, frag2] = opts.frags ?? [parseInt(groups[2], 16), parseInt(groups[1], 16)]

  const nameBytes = Buffer.from(opts.name ?? 'Test statistic', 'utf8')
  const fixed = Buffer.alloc(12)
  fixed.writeUInt16LE(opts.valueCount, 0)
  fixed.writeUInt16LE(0x8000, 2)
  fixed.writeUInt32LE(opts.controlType ?? 42, 4)
  fixed.writeInt32LE(nameBytes.length, 8)
  const rawHeader = Buffer.concat([fixed, nameBytes, Buffer.from([0])])
  const dataStart = Math.ceil(rawHeader.length / stride) * stride

  const buf = Buffer.alloc(dataStart + opts.records.length * stride)
  rawHeader.copy(buf)
  let off = dataStart
  for (const r of opts.records) {
    buf.writeUInt16LE(frag1, off)
    buf.writeUInt16LE(frag2, off + 2)
    buf.writeUInt32LE(r.ts, off + 4)
    r.values.forEach((v, i) => buf.writeDoubleLE(v, off + 8 + i * 8))
    off += stride
  }
  return { fileName, buf }
}

/** seconds since the Loxone epoch (2009-01-01 UTC) for an ISO date string */
export function loxTs(iso: string): number {
  return Date.parse(iso) / 1000 - 1230768000
}

/** n records at a fixed interval starting at `startIso` */
export function makeRecords(
  n: number,
  valueCount: number,
  startIso = '2024-01-01T00:00:00Z',
  intervalSec = 600
): StatRecord[] {
  const start = loxTs(startIso)
  return Array.from({ length: n }, (_, i) => ({
    ts: start + i * intervalSec,
    values: Array.from({ length: valueCount }, (_, v) => Math.sin(i / 10 + v) * 100)
  }))
}
