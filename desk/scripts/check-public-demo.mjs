// Guard for the public demo (run after `npm run build`; exit 1 on any finding).
// 1. No blockchain, custody or wallet library is imported or installed.
// 2. The built site loads nothing from another host, and names no host outside the allowlist.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const FORBIDDEN_PKGS = /^(viem|ethers|web3|@dfns\/|@circle-fin\/|@wagmi\/|wagmi|@solana\/|bitcoinjs)/
const ALLOWED_HOSTS = new Set([
  'arcrail-demo.local', // in-page API shim (never leaves the browser)
  'explorer.testnet.arc.io', // link text only; unreachable while nothing is live
  'react.dev', // React's own error-message links
  'www.w3.org', // SVG namespace
])
const findings = []

function files(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? files(p) : [p]
  })
}

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'))
for (const name of [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})]) {
  if (FORBIDDEN_PKGS.test(name)) findings.push(`package.json depends on ${name}`)
}
for (const key of Object.keys(lock.packages ?? {})) {
  const name = key.replace(/^.*node_modules\//, '')
  if (key && FORBIDDEN_PKGS.test(name)) findings.push(`package-lock.json installs ${name}`)
}
for (const f of files(join(root, 'src'))) {
  for (const m of readFileSync(f, 'utf8').matchAll(/from\s+['"]([^'"]+)['"]/g)) {
    if (FORBIDDEN_PKGS.test(m[1])) findings.push(`${f.slice(root.length)} imports ${m[1]}`)
  }
}

const dist = join(root, 'dist')
for (const f of files(dist)) {
  if (!/\.(html|js|css)$/.test(f)) continue
  const text = readFileSync(f, 'utf8')
  for (const m of text.matchAll(/(?:https?:)?\/\/([a-z0-9.-]+\.[a-z]{2,})(?=[/:"'`)\s?#]|$)/gi)) {
    const host = m[1].toLowerCase()
    if (!ALLOWED_HOSTS.has(host)) findings.push(`${f.slice(root.length)} names host ${host}`)
  }
  for (const m of text.matchAll(/<(?:link|script)[^>]+(?:href|src)="(https?:)?\/\//gi)) {
    findings.push(`${f.slice(root.length)} loads an external resource: ${m[0].slice(0, 80)}`)
  }
}

if (findings.length) {
  console.error(`public-demo guard: ${findings.length} finding(s)`)
  for (const x of [...new Set(findings)]) console.error(`  - ${x}`)
  process.exit(1)
}
console.log('public-demo guard: OK (no chain/custody libraries, no external loads, hosts within allowlist)')
