'use client'

import { useEffect, useState } from 'react'
import {
  Sparkle,
  MagicWand,
  Rocket,
  Lightning,
  Atom,
  Alien,
  Ghost,
  Flame,
  Planet,
  Compass,
  Brain,
  Lightbulb,
  Cube,
  Rainbow,
  Coffee,
  Heart,
  Star,
  Moon,
  Sun,
  Cloud,
  Fire,
  Butterfly,
  Cat,
  Dog,
  Bird,
  Fish,
  Tree,
  Flower,
  Diamond,
  Crown,
  Gift,
  Balloon,
  Confetti,
  MusicNote,
  Headphones,
  GameController,
  Pizza,
  IceCream,
  Cookie,
} from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { ShimmeringText } from './shimmer-text'

// Fun loading messages with icons and animations
type LoadingVibe = {
  message: string
  icon: typeof Sparkle
  animation: string
}

export const FUN_VIBES: LoadingVibe[] = [
  {
    message: 'Manifesting...',
    icon: Sparkle,
    animation: 'animate-[pulse_1s_ease-in-out_infinite]',
  },
  {
    message: 'Conjuring pixels...',
    icon: MagicWand,
    animation: 'animate-[wiggle_0.5s_ease-in-out_infinite]',
  },
  {
    message: 'Summoning bits...',
    icon: Ghost,
    animation: 'animate-[float_2s_ease-in-out_infinite]',
  },
  {
    message: 'Brewing magic...',
    icon: Flame,
    animation: 'animate-[flicker_0.3s_ease-in-out_infinite]',
  },
  {
    message: 'Channeling energy...',
    icon: Lightning,
    animation: 'animate-[zap_0.15s_ease-in-out_infinite]',
  },
  { message: 'Splitting atoms...', icon: Atom, animation: 'animate-[spin_1s_linear_infinite]' },
  { message: 'Launching...', icon: Rocket, animation: 'animate-[rocket_1s_ease-in-out_infinite]' },
  {
    message: 'Phoning home...',
    icon: Alien,
    animation: 'animate-[wobble_1s_ease-in-out_infinite]',
  },
  { message: 'Aligning planets...', icon: Planet, animation: 'animate-[orbit_3s_linear_infinite]' },
  {
    message: 'Finding the way...',
    icon: Compass,
    animation: 'animate-[spin_2s_ease-in-out_infinite]',
  },
  { message: 'Thinking...', icon: Brain, animation: 'animate-[throb_0.8s_ease-in-out_infinite]' },
  {
    message: 'Having ideas...',
    icon: Lightbulb,
    animation: 'animate-[glow_1.5s_ease-in-out_infinite]',
  },
  {
    message: 'Building blocks...',
    icon: Cube,
    animation: 'animate-[spin3d_2s_ease-in-out_infinite]',
  },
  {
    message: 'Chasing rainbows...',
    icon: Rainbow,
    animation: 'animate-[rainbow_2s_ease-in-out_infinite]',
  },
  {
    message: 'Vibing...',
    icon: MusicNote,
    animation: 'animate-[bounce_0.6s_ease-in-out_infinite]',
  },
  {
    message: 'Brewing coffee...',
    icon: Coffee,
    animation: 'animate-[wiggle_0.5s_ease-in-out_infinite]',
  },
  {
    message: 'Sending love...',
    icon: Heart,
    animation: 'animate-[throb_0.8s_ease-in-out_infinite]',
  },
  {
    message: 'Wishing on stars...',
    icon: Star,
    animation: 'animate-[glow_1.5s_ease-in-out_infinite]',
  },
  {
    message: 'Howling at moon...',
    icon: Moon,
    animation: 'animate-[float_2s_ease-in-out_infinite]',
  },
  { message: 'Chasing the sun...', icon: Sun, animation: 'animate-[spin_3s_linear_infinite]' },
  {
    message: 'Cloud surfing...',
    icon: Cloud,
    animation: 'animate-[float_2s_ease-in-out_infinite]',
  },
  {
    message: 'Playing with fire...',
    icon: Fire,
    animation: 'animate-[flicker_0.3s_ease-in-out_infinite]',
  },
  {
    message: 'Catching butterflies...',
    icon: Butterfly,
    animation: 'animate-[float_1.5s_ease-in-out_infinite]',
  },
  { message: 'Herding cats...', icon: Cat, animation: 'animate-[wobble_1s_ease-in-out_infinite]' },
  {
    message: 'Walking the dog...',
    icon: Dog,
    animation: 'animate-[bounce_0.6s_ease-in-out_infinite]',
  },
  {
    message: 'Watching birds...',
    icon: Bird,
    animation: 'animate-[float_1.5s_ease-in-out_infinite]',
  },
  {
    message: 'Gone fishing...',
    icon: Fish,
    animation: 'animate-[wiggle_0.5s_ease-in-out_infinite]',
  },
  {
    message: 'Planting trees...',
    icon: Tree,
    animation: 'animate-[pulse_1s_ease-in-out_infinite]',
  },
  {
    message: 'Smelling flowers...',
    icon: Flower,
    animation: 'animate-[wiggle_0.5s_ease-in-out_infinite]',
  },
  {
    message: 'Mining diamonds...',
    icon: Diamond,
    animation: 'animate-[glow_1.5s_ease-in-out_infinite]',
  },
  {
    message: 'Claiming throne...',
    icon: Crown,
    animation: 'animate-[float_2s_ease-in-out_infinite]',
  },
  {
    message: 'Unwrapping gifts...',
    icon: Gift,
    animation: 'animate-[wobble_1s_ease-in-out_infinite]',
  },
  {
    message: 'Floating away...',
    icon: Balloon,
    animation: 'animate-[float_2s_ease-in-out_infinite]',
  },
  {
    message: 'Celebrating...',
    icon: Confetti,
    animation: 'animate-[bounce_0.6s_ease-in-out_infinite]',
  },
  {
    message: 'Jamming out...',
    icon: Headphones,
    animation: 'animate-[pulse_1s_ease-in-out_infinite]',
  },
  {
    message: 'Gaming...',
    icon: GameController,
    animation: 'animate-[wiggle_0.5s_ease-in-out_infinite]',
  },
  {
    message: 'Ordering pizza...',
    icon: Pizza,
    animation: 'animate-[spin_2s_ease-in-out_infinite]',
  },
  {
    message: 'Getting ice cream...',
    icon: IceCream,
    animation: 'animate-[wobble_1s_ease-in-out_infinite]',
  },
  {
    message: 'Baking cookies...',
    icon: Cookie,
    animation: 'animate-[pulse_1s_ease-in-out_infinite]',
  },
]

// Just the messages for simple text placeholders
export const FUN_MESSAGES = FUN_VIBES.map((v) => v.message)

// Custom keyframe styles (inject once)
const keyframeStyles = `
  @keyframes wiggle {
    0%, 100% { transform: rotate(-12deg); }
    50% { transform: rotate(12deg); }
  }
  @keyframes float {
    0%, 100% { transform: translateY(0) scale(1); opacity: 0.7; }
    50% { transform: translateY(-10px) scale(1.1); opacity: 1; }
  }
  @keyframes flicker {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.6; transform: scale(0.95); }
  }
  @keyframes zap {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-3px); }
    75% { transform: translateX(3px); }
  }
  @keyframes rocket {
    0%, 100% { transform: translateY(0) rotate(-45deg); }
    50% { transform: translateY(-8px) rotate(-45deg); }
  }
  @keyframes wobble {
    0%, 100% { transform: rotate(0) scale(1); }
    25% { transform: rotate(-5deg) scale(1.05); }
    75% { transform: rotate(5deg) scale(1.05); }
  }
  @keyframes orbit {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  @keyframes throb {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.15); }
  }
  @keyframes glow {
    0%, 100% { opacity: 0.5; transform: scale(0.9); filter: brightness(1); }
    50% { opacity: 1; transform: scale(1.1); filter: brightness(1.3); }
  }
  @keyframes spin3d {
    0% { transform: perspective(100px) rotateY(0deg); }
    100% { transform: perspective(100px) rotateY(360deg); }
  }
  @keyframes rainbow {
    0%, 100% { filter: hue-rotate(0deg); transform: scale(1); }
    50% { filter: hue-rotate(180deg); transform: scale(1.1); }
  }
`

function getRandomVibe() {
  return FUN_VIBES[Math.floor(Math.random() * FUN_VIBES.length)]!
}

export function getRandomMessage() {
  return FUN_MESSAGES[Math.floor(Math.random() * FUN_MESSAGES.length)]!
}

// Hook for rotating fun messages
export function useFunMessage(interval = 2000) {
  const [message, setMessage] = useState(getRandomMessage)

  useEffect(() => {
    setMessage(getRandomMessage())
    const id = setInterval(() => setMessage(getRandomMessage()), interval)
    return () => clearInterval(id)
  }, [interval])

  return message
}

// Hook for rotating fun vibes (message + icon + animation)
export function useFunVibe(interval = 2500) {
  const [vibe, setVibe] = useState(getRandomVibe)

  useEffect(() => {
    setVibe(getRandomVibe())
    const id = setInterval(() => setVibe(getRandomVibe()), interval)
    return () => clearInterval(id)
  }, [interval])

  return vibe
}

// Inline text with icon - for use in agent thread
export function FunWorkingText({ className }: { className?: string }) {
  const vibe = useFunVibe(2000)
  const Icon = vibe.icon

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <Icon className="size-3.5 animate-pulse" weight="duotone" />
      <ShimmeringText text={vibe.message} duration={0.4} />
    </span>
  )
}

// Full centered loading state - for use in preview panel
export function FunLoadingState({ className }: { className?: string }) {
  const vibe = useFunVibe(2500)
  const Icon = vibe.icon

  return (
    <div className={cn('w-full h-full flex items-center justify-center', className)}>
      <style jsx>{keyframeStyles}</style>
      <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
        <div className={cn('transition-all duration-500', vibe.animation)}>
          <Icon className="h-8 w-8" weight="duotone" />
        </div>
        <span className="transition-opacity duration-300">{vibe.message}</span>
      </div>
    </div>
  )
}
