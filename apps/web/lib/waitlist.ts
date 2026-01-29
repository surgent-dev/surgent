export function isWaitlistMode() {
  const v = process.env.NEXT_PUBLIC_WAITLIST_MODE
  return v === '1' || v === 'true'
}
