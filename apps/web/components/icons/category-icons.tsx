import type * as React from 'react'

export function AllIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <circle cx="7" cy="7" r="4" fill="currentColor" />
      <circle cx="17" cy="7" r="4" fill="currentColor" fillOpacity="0.5" />
      <circle cx="7" cy="17" r="4" fill="currentColor" fillOpacity="0.5" />
      <circle cx="17" cy="17" r="4" fill="currentColor" fillOpacity="0.2" />
    </svg>
  )
}

export function AiIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M11 1C11 6.52285 15.4772 11 21 11C15.4772 11 11 15.4772 11 21C11 15.4772 6.52285 11 1 11C6.52285 11 11 6.52285 11 1Z"
        fill="currentColor"
      />
      <path
        d="M18.5 13C18.5 15.4853 20.5147 17.5 23 17.5C20.5147 17.5 18.5 19.5147 18.5 22C18.5 19.5147 16.4853 17.5 14 17.5C16.4853 17.5 18.5 15.4853 18.5 13Z"
        fill="currentColor"
        fillOpacity="0.5"
      />
    </svg>
  )
}

export function SaasIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <rect x="2" y="10" width="14" height="12" rx="4" fill="currentColor" />
      <rect x="6" y="6" width="14" height="12" rx="4" fill="currentColor" fillOpacity="0.5" />
      <rect x="10" y="2" width="12" height="12" rx="4" fill="currentColor" fillOpacity="0.2" />
    </svg>
  )
}

export function DevIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <rect x="2" y="3" width="20" height="18" rx="5" fill="currentColor" fillOpacity="0.2" />
      <path
        d="M7 9L11 12L7 15"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="13" y="14" width="5" height="3" rx="1" fill="currentColor" />
    </svg>
  )
}

export function ProductivityIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" fill="currentColor" />
    </svg>
  )
}

export function MarketingIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M11.5 5.5L4 9V15L11.5 18.5V5.5Z" fill="currentColor" />
      <path
        d="M11.5 5.5C11.5 5.5 16 2.5 22 4V20C16 21.5 11.5 18.5 11.5 18.5V5.5Z"
        fill="currentColor"
        fillOpacity="0.4"
      />
      <rect x="1" y="10" width="4" height="4" rx="2" fill="currentColor" fillOpacity="0.8" />
    </svg>
  )
}

export function ContentIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M15.5 2.5C16.8807 1.11929 19.1193 1.11929 20.5 2.5C21.8807 3.88071 21.8807 6.11929 20.5 7.5L8.5 19.5L2 21L3.5 14.5L15.5 2.5Z"
        fill="currentColor"
        fillOpacity="0.3"
      />
      <path
        d="M15.5 2.5C16.8807 1.11929 19.1193 1.11929 20.5 2.5C21.8807 3.88071 21.8807 6.11929 20.5 7.5L14 14L7.5 7.5L15.5 2.5Z"
        fill="currentColor"
      />
    </svg>
  )
}

export function EducationIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M12 3L1 9L12 15L23 9L12 3Z" fill="currentColor" />
      <path
        d="M5 11.2V16C5 18.2 8.1 20 12 20C15.9 20 19 18.2 19 16V11.2"
        fill="currentColor"
        fillOpacity="0.4"
      />
    </svg>
  )
}

export function MobileIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <rect x="4" y="2" width="16" height="20" rx="5" fill="currentColor" fillOpacity="0.3" />
      <rect x="7" y="6" width="10" height="12" rx="2" fill="currentColor" />
    </svg>
  )
}

export function HealthIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M12 21.35L10.55 20.03C5.4 15.36 2 12.28 2 8.5C2 5.42 4.42 3 7.5 3C9.24 3 10.91 3.81 12 5.09C13.09 3.81 14.76 3 16.5 3C19.58 3 22 5.42 22 8.5C22 12.28 18.6 15.36 13.45 20.04L12 21.35Z"
        fill="currentColor"
      />
    </svg>
  )
}

export function FintechIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <rect x="3" y="5" width="18" height="14" rx="3" fill="currentColor" fillOpacity="0.4" />
      <rect x="3" y="9" width="18" height="4" fill="var(--background, #1c1c1c)" />
      <rect x="6" y="15" width="4" height="2" rx="1" fill="currentColor" />
      <rect x="11" y="15" width="7" height="2" rx="1" fill="currentColor" />
    </svg>
  )
}

export function AnalyticsIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <rect x="3" y="13" width="5" height="9" rx="2.5" fill="currentColor" fillOpacity="0.3" />
      <rect x="9.5" y="7" width="5" height="15" rx="2.5" fill="currentColor" fillOpacity="0.6" />
      <rect x="16" y="2" width="5" height="20" rx="2.5" fill="currentColor" />
    </svg>
  )
}

export function DesignIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <circle cx="9" cy="9" r="7" fill="currentColor" fillOpacity="0.4" />
      <rect x="9" y="9" width="13" height="13" rx="4" fill="currentColor" />
    </svg>
  )
}

export function EcommerceIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M7 8V6C7 3.23858 9.23858 1 12 1C14.7614 1 17 3.23858 17 6V8"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <rect x="3" y="8" width="18" height="14" rx="4" fill="currentColor" />
    </svg>
  )
}
