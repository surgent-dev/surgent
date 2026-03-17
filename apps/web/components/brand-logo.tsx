import Image from 'next/image'

export function BrandLogo() {
  return (
    <>
      <Image
        src="/surgent-logo-dark.svg"
        alt="Surgent"
        width={119}
        height={32}
        className="h-7 w-auto hidden dark:block"
        priority
      />
      <Image
        src="/surgent-logo.svg"
        alt="Surgent"
        width={119}
        height={32}
        className="h-7 w-auto block dark:hidden"
        priority
      />
    </>
  )
}
