'use client'

import Link from 'next/link'
import { motion } from 'motion/react'
import { ArrowRight } from 'lucide-react'

export function LandingCta() {
  return (
    <section className="relative py-24 sm:py-32 px-5 sm:px-6 overflow-hidden">
      {/* Violet glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[800px] h-[500px] rounded-full bg-brand/[0.06] blur-[150px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-100px' }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 mx-auto max-w-2xl text-center"
      >
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-white tracking-[-0.025em] leading-tight mb-4">
          Start building{' '}
          <span className="font-[var(--font-display)] italic font-normal text-brand">today</span>
        </h2>
        <p className="text-slate-400 text-base sm:text-lg mb-8 max-w-md mx-auto">
          Go from idea to deployed app in minutes. No setup, no boilerplate, no waiting.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 bg-brand text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-brand/90 transition-all"
          >
            Get started free
            <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href="mailto:hello@surgent.dev"
            className="text-slate-400 text-sm hover:text-white transition-colors px-4 py-3"
          >
            Book a demo
          </a>
        </div>
      </motion.div>
    </section>
  )
}
