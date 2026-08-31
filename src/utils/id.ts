export function genId(prefix: string): string {
  try {
    const uuid = crypto.randomUUID().replace(/-/g, '').slice(0, 12)
    return `${prefix}_${uuid}`
  } catch {
    return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
  }
}
