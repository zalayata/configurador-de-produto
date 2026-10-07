import { useConfigurator, type SharedConfig } from '../state/store'

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

/** Monta o estado compartilhável a partir do estado atual (demo ou catálogo). */
export function currentSharedConfig(): SharedConfig | null {
  const { source, finishes, options, line, productId, groupFinishes } = useConfigurator.getState()
  if (source === 'catalogo' && productId) {
    return { p: productId, g: groupFinishes }
  }
  if (source === 'demo') {
    return {
      f: finishes,
      o: Object.entries(options)
        .filter(([, enabled]) => enabled)
        .map(([id]) => id),
      l: line,
    }
  }
  return null
}

export function encodeConfig(config: SharedConfig): string {
  return toBase64Url(JSON.stringify(config))
}

const isStringRecord = (value: unknown): value is Record<string, string> =>
  typeof value === 'object' &&
  value !== null &&
  Object.values(value).every((v) => typeof v === 'string')

export function decodeConfig(encoded: string): SharedConfig | null {
  try {
    const parsed = JSON.parse(fromBase64Url(encoded)) as Record<string, unknown>
    if (typeof parsed !== 'object' || parsed === null) return null
    const config: SharedConfig = {}
    if (isStringRecord(parsed.f)) config.f = parsed.f
    if (Array.isArray(parsed.o)) config.o = parsed.o.filter((id) => typeof id === 'string')
    if (typeof parsed.l === 'string') config.l = parsed.l
    if (typeof parsed.p === 'string') config.p = parsed.p
    if (isStringRecord(parsed.g)) config.g = parsed.g
    return config
  } catch {
    return null
  }
}

export function shareUrl(config: SharedConfig): string {
  const { origin, pathname } = window.location
  return `${origin}${pathname}#c=${encodeConfig(config)}`
}

/** Link da configuração atual, ou null quando a fonte não é compartilhável (modelo importado). */
export function currentShareUrl(): string | null {
  const config = currentSharedConfig()
  return config ? shareUrl(config) : null
}

export function readSharedFromUrl(): SharedConfig | null {
  const match = window.location.hash.match(/#c=([A-Za-z0-9_-]+)/)
  if (!match) return null
  return decodeConfig(match[1])
}
