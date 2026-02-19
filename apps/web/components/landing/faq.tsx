'use client'

import { motion } from 'motion/react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

const faqs = [
  {
    question: 'What is Surgent?',
    answer:
      'Surgent is an AI-powered platform that turns natural language descriptions into fully functional, deployed web applications. You describe your idea, and our AI handles the code, design, and deployment.',
  },
  {
    question: 'What kind of apps can I build?',
    answer:
      'Anything from portfolios and landing pages to SaaS dashboards, e-commerce stores, booking systems, client portals, and internal tools. If it runs on the web, Surgent can build it.',
  },
  {
    question: 'Do I need to know how to code?',
    answer:
      'Not at all. Surgent is designed for everyone — from complete beginners to experienced developers who want to move faster. Just describe what you want in plain English.',
  },
  {
    question: 'How does deployment work?',
    answer:
      'One click. Your app is deployed to our global infrastructure with SSL, custom domains, and automatic scaling. No server configuration or DevOps knowledge required.',
  },
  {
    question: 'Is there a free tier?',
    answer:
      'Yes! You can start building and deploying apps for free. We offer generous free credits to get you going, with paid plans for teams and high-volume usage.',
  },
  {
    question: 'Can I use my own domain?',
    answer:
      'Absolutely. You can connect any custom domain to your deployed apps. SSL certificates are provisioned automatically.',
  },
]

export function LandingFaq() {
  return (
    <section id="faq" className="relative py-24 sm:py-32 px-5 sm:px-6 landing-divider">
      <div className="mx-auto max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-14 sm:mb-16"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-semibold text-white tracking-[-0.025em] leading-tight">
            Common{' '}
            <span className="font-[var(--font-display)] italic font-normal text-brand">
              questions
            </span>
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, i) => (
              <AccordionItem key={i} value={`item-${i}`} className="border-white/[0.06]">
                <AccordionTrigger className="text-white text-[15px] hover:no-underline hover:text-slate-300">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-slate-400 text-sm leading-relaxed">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  )
}
