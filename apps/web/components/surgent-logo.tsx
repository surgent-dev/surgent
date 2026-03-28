export function SurgentLogo({ className }: { className?: string }) {
  return (
    <span
      className={`font-semibold tracking-[-0.03em] leading-none ${className ?? ''}`}
      style={{ fontFamily: 'var(--font-space-grotesk), system-ui, sans-serif' }}
    >
      surgent
    </span>
  )
}
