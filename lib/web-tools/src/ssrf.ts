import dns from 'node:dns/promises'

interface LookupAddress {
  address: string
  family: number
}

// ---------------------------------------------------------------------------
// SSRF Protection
// ---------------------------------------------------------------------------

/** True when an IPv4 address is in a private / loopback / link-local range. */
function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return false
  }
  const [a, b] = parts as [number, number, number, number]
  if (a === 10) return true
  if (a === 127) return true
  if (a === 0) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 100 && b >= 64 && b <= 127) return true
  if (a >= 224) return true
  return false
}

function isPrivateIpv6(ip: string): boolean {
  const lower = ip.toLowerCase()
  if (lower === '::1' || lower === '::') return true
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true
  if (lower.startsWith('fe80:')) return true
  if (lower.startsWith('ff')) return true
  return false
}

/** Check if a string looks like an IPv4 address. */
function isIpv4(ip: string): boolean {
  return /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)
}

/** Check if a string looks like an IPv6 address. */
function isIpv6(ip: string): boolean {
  return /^(::|[0-9a-f]*:[0-9a-f:]{1,39})$/.test(ip)
}

async function resolveAndCheck(hostname: string): Promise<{ ok: true; pinnedIp: string } | { ok: false; error: string }>
{
  const family = isIpv4(hostname) ? 4 : isIpv6(hostname) ? 6 : -1
  if (family === 4) {
    return isPrivateIpv4(hostname)
      ? { ok: false, error: 'Refusing to fetch private IP address' }
      : { ok: true, pinnedIp: hostname }
  }
  if (family === 6) {
    return isPrivateIpv6(hostname)
      ? { ok: false, error: 'Refusing to fetch private IP address' }
      : { ok: true, pinnedIp: hostname }
  }

  let addrs: LookupAddress[]
  try {
    addrs = await dns.lookup(hostname, { all: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: `DNS resolution failed for ${hostname}: ${message}` }
  }
  if (addrs.length === 0) {
    return { ok: false, error: `No addresses for ${hostname}` }
  }
  for (const a of addrs) {
    if (a.family === 4 && isPrivateIpv4(a.address)) {
      return { ok: false, error: 'Refusing to fetch private IP address' }
    }
    if (a.family === 6 && isPrivateIpv6(a.address)) {
      return { ok: false, error: 'Refusing to fetch private IP address' }
    }
  }
  return { ok: true, pinnedIp: addrs[0]!.address }
}

export { resolveAndCheck }
