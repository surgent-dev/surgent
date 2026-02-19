'use client'

import { motion } from 'motion/react'

const stats = [
  { value: '10,000+', label: 'Projects built' },
  { value: '50,000+', label: 'Deployments' },
  { value: '5,000+', label: 'Creators' },
  { value: '99.9%', label: 'Uptime' },
]

export function LandingSocialProof() {
  return (
    <section className="relative py-16 sm:py-20 px-5 sm:px-6 landing-divider">
      <div className="mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-12"
        >
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                {stat.value}
              </div>
              <div className="text-sm text-slate-500 mt-1">{stat.label}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
