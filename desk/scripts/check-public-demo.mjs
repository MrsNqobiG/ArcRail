// Guard for the public demo (run after `npm run build`; exit 1 on any finding).
// 1. No blockchain, custody, wallet or key-handling library is declared, installed or imported.
// 2. The built site loads nothing from another host, and names no host outside the allowlist.
// Usage: node scripts/check-public-demo.mjs [--root <desk dir>]
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const i = process.argv.indexOf('--root')
const root = resolve(i > 0 ? process.argv[i + 1] : new URL('..', import.meta.url).pathname)

// Hashing (@noble/hashes) is allowed; signing, key derivation and chain clients are not.
const FORBIDDEN_PKGS =
  /^(viem|ethers|web3|web3-[a-z-]+|ox|abitype|wagmi|@wagmi\/|@dfns\/|@circle-fin\/|@solana\/|bitcoinjs-lib|@noble\/curves|@noble\/secp256k1|@noble\/ed25519|@scure\/bip32|@scure\/bip39|@ethereumjs\/|ethereumjs-|@metamask\/|@walletconnect\/|@coinbase\/|@reown\/|elliptic|secp256k1|tweetnacl|hdkey|@safe-global\/|alchemy-sdk|@alch\/)(\/|$)/
const ALLOWED_HOSTS = new Set([
  'explorer.testnet.arc.io', // link text only; unreachable while nothing is live
  'react.dev', // React's own error-message links
  'www.w3.org', // SVG/XML namespaces
])
const TEXT_EXT = /\.(html?|m?js|css|svg|json|webmanifest|txt|xml|map)$/i
const findings = []

function files(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? files(p) : [p]
  })
}
const rel = (f) => f.slice(root.length + 1)

// --- 1. packages and imports -------------------------------------------------
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'))
for (const name of [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})]) {
  if (FORBIDDEN_PKGS.test(name)) findings.push(`package.json depends on ${name}`)
}
for (const key of Object.keys(lock.packages ?? {})) {
  const name = key.replace(/^.*node_modules\//, '')
  if (key && FORBIDDEN_PKGS.test(name)) findings.push(`package-lock.json installs ${name}`)
}
const IMPORT_RE = /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)['"`]([^'"`]+)['"`]/g
for (const f of files(join(root, 'src'))) {
  for (const m of readFileSync(f, 'utf8').matchAll(IMPORT_RE)) {
    if (FORBIDDEN_PKGS.test(m[1])) findings.push(`${rel(f)} imports ${m[1]}`)
  }
}

// --- 2. hosts in the built site ----------------------------------------------
// Any "//host" (optionally with a scheme, escaped slashes or user@), where host is a
// dotted name, localhost, an IPv4 literal or a bracketed IPv6 literal. The host must
// end at a character that cannot continue a hostname, so template literals
// (`https://x${v}`), concatenation ('https://x'+v) and ports are all caught.
const HOST_RE =
  /(?:[a-z][a-z0-9+.-]*:)?(?:\\?\/){2}(?:[^\s"'`<>\\/@]+@)?(\[[0-9a-f:.]+\]|localhost|(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z][a-z0-9-]*|\d{1,3}(?:\.\d{1,3}){3})(?![a-z0-9.-])/gi
// Any explicit network scheme, whatever follows it: catches a host split across a
// string concatenation ("https://ev"+"il.com") because the visible part is not allowlisted.
const SCHEME_RE = /\b(?:https?|wss?|ftp):(?:\\?\/){2}(?:[^\s"'`<>\\/@]+@)?([^\s"'`<>\\/?#:]*)/gi
// External loads in HTML/SVG: src/href/srcset/action/poster/data pointing off-site, quoted or not.
const LOAD_RE = /\b(?:src|href|srcset|action|poster|data|xlink:href)\s*=\s*["']?\s*(?:[a-z][a-z0-9+.-]*:)?\/\//gi
const CSS_LOAD_RE = /(?:url\(\s*["']?|@import\s+["']?)\s*(?:[a-z][a-z0-9+.-]*:)?\/\//gi

const dist = join(root, 'dist')
for (const f of files(dist)) {
  if (!TEXT_EXT.test(f)) continue
  const text = readFileSync(f, 'utf8')
  for (const m of text.matchAll(HOST_RE)) {
    const host = m[1].toLowerCase()
    if (!ALLOWED_HOSTS.has(host)) findings.push(`${rel(f)} names host ${host}`)
  }
  for (const m of text.matchAll(SCHEME_RE)) {
    const host = m[1].toLowerCase()
    if (!ALLOWED_HOSTS.has(host)) findings.push(`${rel(f)} has a URL to ${host || '(empty host)'}`)
  }
  if (/\.(html?|svg)$/i.test(f)) {
    for (const m of text.matchAll(LOAD_RE)) findings.push(`${rel(f)} loads an external resource: ${m[0]}`)
  }
  for (const m of text.matchAll(CSS_LOAD_RE)) findings.push(`${rel(f)} loads an external stylesheet or asset: ${m[0]}`)
}

if (findings.length) {
  console.error(`public-demo guard: ${new Set(findings).size} finding(s)`)
  for (const x of [...new Set(findings)]) console.error(`  - ${x}`)
  process.exit(1)
}
console.log('public-demo guard: OK (no chain/custody libraries, no external loads, hosts within allowlist)')
