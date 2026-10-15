import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js'

/** Browser-safe stand-in for the one `node:crypto` call the engine makes: createHash('sha256').update(s).digest('hex'). */
export function createHash(algorithm: 'sha256') {
  if (algorithm !== 'sha256') throw new Error(`unsupported hash ${String(algorithm)}`)
  const parts: string[] = []
  const api = {
    update(data: string) {
      parts.push(data)
      return api
    },
    digest(encoding: 'hex') {
      if (encoding !== 'hex') throw new Error(`unsupported encoding ${String(encoding)}`)
      return bytesToHex(sha256(utf8ToBytes(parts.join(''))))
    },
  }
  return api
}
