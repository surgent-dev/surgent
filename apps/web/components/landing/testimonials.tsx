'use client'

import { motion } from 'motion/react'

const testimonials = [
  {
    quote:
      'I went from idea to a deployed SaaS dashboard in under 20 minutes. This is genuinely the future of building software.',
    name: 'Alex Rivera',
    role: 'Indie Hacker',
  },
  {
    quote:
      'Surgent replaced my entire prototyping workflow. I can show clients working demos the same day they brief me.',
    name: 'Priya Sharma',
    role: 'Freelance Designer',
  },
  {
    quote:
      'The AI understands context so well. I described a booking system and it built exactly what I pictured — calendar, payments, confirmations, all of it.',
    name: 'Marcus Chen',
    role: 'Product Manager',
  },
  {
    quote:
      'I have zero coding experience and I built and deployed my own portfolio site. It actually looks professional.',
    name: 'Sofia Andersson',
    role: 'Content Creator',
  },
  {
    quote:
      'We use Surgent to spin up internal tools for our team. What used to take a sprint now takes an afternoon.',
    name: 'James Okonkwo',
    role: 'Engineering Lead',
  },
  {
    quote:
      "The marketplace is a goldmine. I've made real money selling templates I built in a few hours each.",
    name: 'Luna Park',
    role: 'App Creator',
  },
]

export function LandingTestimonials() {
  return (
    <section className="relative py-24 sm:py-32 px-5 sm:px-6 landing-divider">
      <div className="mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-14 sm:mb-16"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-semibold text-white tracking-[-0.025em] leading-tight">
            Loved by{' '}
            <span className="font-[var(--font-display)] italic font-normal text-brand">
              builders
            </span>
          </h2>
          <p className="text-slate-400 text-base sm:text-lg mt-4 max-w-lg mx-auto">
            Thousands of creators, developers, and founders ship with Surgent every day.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{
                duration: 0.5,
                delay: i * 0.08,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="landing-glass rounded-2xl p-6"
            >
              <p className="text-slate-300 text-sm leading-relaxed mb-5">&ldquo;{t.quote}&rdquo;</p>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-brand/20 flex items-center justify-center text-xs font-semibold text-brand">
                  {t.name.charAt(0)}
                </div>
                <div>
                  <div className="text-white text-sm font-medium">{t.name}</div>
                  <div className="text-slate-500 text-xs">{t.role}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
