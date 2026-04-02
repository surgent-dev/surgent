declare module '*.svg' {
  const content: string
  export const ReactComponent: React.ComponentType<React.SVGProps<SVGSVGElement>>
  export default content
}

declare module '*.css'
