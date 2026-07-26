import type { GroupId } from '../config/product'

interface SharedConfig {
  f: Partial<Record<GroupId, string>>
  o: string[]
  l?: string
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  bytes.forEach((b) => {
    binary += String.fromCharCode(b)
  })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(encoded: string): string {
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export function encodeConfig(
  finishes: Record<GroupId, string>,
  options: Record<string, boolean>,
  line: string,
): string {
  const payload: SharedConfig = {
    f: finishes,
    o: Object.entries(options)
      .filter(([, enabled]) => enabled)
      .map(([id]) => id),
    l: line,
  }
  return toBase64Url(JSON.stringify(payload))
}

export function decodeConfig(encoded: string): SharedConfig | null {
  try {
    const parsed = JSON.parse(fromBase64Url(encoded)) as SharedConfig
    if (typeof parsed !== 'object' || parsed === null) return null
    return {
      f: typeof parsed.f === 'object' && parsed.f !== null ? parsed.f : {},
      o: Array.isArray(parsed.o) ? parsed.o.filter((id) => typeof id === 'string') : [],
      l: typeof parsed.l === 'string' ? parsed.l : undefined,
    }
  } catch {
    return null
  }
}

export function shareUrl(
  finishes: Record<GroupId, string>,
  options: Record<string, boolean>,
  line: string,
): string {
  const { origin, pathname } = window.location
  return `${origin}${pathname}#c=${encodeConfig(finishes, options, line)}`
}

export function readSharedFromUrl(): SharedConfig | null {
  const match = window.location.hash.match(/#c=([A-Za-z0-9_-]+)/)
  if (!match) return null
  return decodeConfig(match[1])
}
