import { createServer } from 'net'
import { describe, expect, it } from 'vitest'
import * as ftp from '../src/main/ftp'

/** server that accepts the socket but never sends the FTP greeting → access() hangs 15s */
function silentServer(): Promise<{ port: number; close: () => void }> {
  return new Promise((resolve) => {
    const srv = createServer(() => {})
    srv.listen(0, '127.0.0.1', () =>
      resolve({
        port: (srv.address() as { port: number }).port,
        close: () => srv.close()
      })
    )
  })
}

describe('cloud DNS address', () => {
  it('recognises the serial, with or without scheme/trailing slash', () => {
    expect(ftp.cloudDnsSerial('dns.loxonecloud.com/504F94ABCDEF')).toBe('504F94ABCDEF')
    expect(ftp.cloudDnsSerial('https://dns.loxonecloud.com/504F94ABCDEF/')).toBe('504F94ABCDEF')
    expect(ftp.cloudDnsSerial('  DNS.LOXONECLOUD.COM/504f94abcdef  ')).toBe('504f94abcdef')
  })

  it('leaves plain hosts alone', () => {
    expect(ftp.cloudDnsSerial('192.168.11.23')).toBeNull()
    expect(ftp.cloudDnsSerial('miniserver.local')).toBeNull()
    expect(ftp.cloudDnsSerial('dns.loxonecloud.com/504F94ABCD')).toBeNull() // too short
    expect(ftp.cloudDnsSerial('evil.com/504F94ABCDEF')).toBeNull()
  })
})

describe('connect cancellation', () => {
  it('disconnect() aborts an in-flight connect instead of waiting out the timeout', async () => {
    const srv = await silentServer()
    const started = Date.now()
    const p = ftp
      .connect({ host: '127.0.0.1', port: srv.port, user: 'a', password: 'b', tls: 'auto' })
      .then(() => 'connected')
      .catch(() => 'rejected')

    await new Promise((r) => setTimeout(r, 300))
    ftp.disconnect()

    expect(await p).toBe('rejected')
    const elapsed = Date.now() - started
    expect(elapsed).toBeLessThan(3000) // without the fix: 2 × 15s TIMEOUT_MS
    srv.close()
  }, 40000)
})
