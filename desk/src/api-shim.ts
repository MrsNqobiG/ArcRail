import { handleArcApi } from '@/lib/arcrail/api'

/**
 * The views call fetch('/api/...') exactly as they did against the operator
 * server. In the public demo there is no server: this routes those calls to the
 * same handler running in the page, so a static host (GitHub Pages) can serve it.
 * Any other URL goes to the real network untouched.
 */
export function installApiShim() {
  const realFetch = window.fetch.bind(window)
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (!raw.startsWith('/api/')) return realFetch(input, init)
    const url = `https://arcrail-demo.local${raw}`
    const request = input instanceof Request ? new Request(url, input) : new Request(url, init)
    return handleArcApi(request)
  }
}
