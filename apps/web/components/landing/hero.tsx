'use client'

import { ArrowRight } from 'lucide-react'
import Image from 'next/image'

/* ─── Hero ─── */
export function LandingHero({ onGetStarted }: { onGetStarted: () => void }) {
  return (
    <section className="relative flex-1 flex flex-col justify-end min-h-[calc(100dvh-3.5rem)] overflow-hidden">
      <div className="relative z-10 w-full max-w-6xl mx-auto px-6 sm:px-8 pb-16 sm:pb-20">
        {/* Main grid — headline left, meta right */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr,280px] gap-16 lg:gap-24 items-end">
          {/* Left */}
          <div>
            <h1 className="font-display text-[3.25rem] sm:text-[4.5rem] lg:text-[5.5rem] leading-[1.02] text-foreground/80 mb-8 landing-stagger-2">
              Launch your
              <br />
              business.
              <br />
              <span className="italic text-foreground/25">Let AI grow it.</span>
            </h1>

            <div className="flex flex-col sm:flex-row sm:items-end gap-8 sm:gap-12">
              {/* Subtitle */}
              <p className="text-muted-foreground text-sm sm:text-[15px] max-w-[320px] leading-relaxed landing-stagger-2">
                Describe what you do. Surgent builds your site, deploys an AI sales agent, and
                brings you customers — on autopilot.
              </p>

              {/* CTA */}
              <div className="landing-stagger-3">
                <button
                  onClick={onGetStarted}
                  className="btn-brand inline-flex items-center gap-2 h-11 px-7 rounded-[0.625rem] text-sm cursor-pointer whitespace-nowrap"
                  style={{ fontWeight: 500 }}
                >
                  Create your business
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Right — meta column */}
          <div className="hidden lg:flex flex-col gap-10 landing-stagger-4">
            {/* Social proof */}
            <div className="flex flex-col gap-2.5">
              <span className="text-[10px] tracking-widest uppercase text-muted-foreground/40 font-medium">
                Trusted by
              </span>
              <div className="flex -space-x-1.5">
                {[
                  { src: '/lovedby/alidar.png', alt: 'Alidar' },
                  { src: '/lovedby/asadbek.jpeg', alt: 'Asadbek' },
                  { src: '/lovedby/diyor.jpeg', alt: 'Diyor' },
                  { src: '/lovedby/sardor.jpeg', alt: 'Sardor' },
                  { src: '/lovedby/yunus.jpeg', alt: 'Yunus' },
                ].map((a) => (
                  <Image
                    key={a.alt}
                    src={a.src}
                    alt={a.alt}
                    width={24}
                    height={24}
                    className="w-6 h-6 rounded-full border-[1.5px] border-background object-cover"
                  />
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground/50 leading-snug">
                1,500+ business owners
              </p>
            </div>

            {/* What you get */}
            <div className="flex flex-col gap-2.5">
              <span className="text-[10px] tracking-widest uppercase text-muted-foreground/40 font-medium">
                What you get
              </span>
              <div className="flex flex-col gap-1.5">
                {['Website', 'AI Sales Agent', 'Lead Capture', 'Auto Marketing'].map((item) => (
                  <span key={item} className="text-[11px] text-muted-foreground/60">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
