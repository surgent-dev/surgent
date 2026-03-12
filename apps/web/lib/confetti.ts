'use client'

export async function fireConfetti() {
  const { default: confetti } = await import('canvas-confetti')

  confetti({
    particleCount: 120,
    spread: 70,
    startVelocity: 32,
    origin: { y: 0.65 },
    colors: ['#111827', '#2563eb', '#10b981', '#f59e0b', '#ef4444'],
  })
}
