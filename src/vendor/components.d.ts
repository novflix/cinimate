import type { ReactNode, Ref } from 'react'

/** The subset of the `<lg-navbar>` API that the app drives. */
export type LgNavbarElement = HTMLElement & {
  setCurrent(index: number): void
  moveTo(index: number, immediate?: boolean): void
  refresh(): void
}

export { createGlass } from './liquid-glass'
export { createSpring } from './liquid-glass'
export type {
  LiquidGlassController,
  LiquidGlassOptions,
  LiquidGlassEngine,
  LiquidGlassMode,
} from './liquid-glass'

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'lg-navbar': {
        children?: ReactNode
        className?: string
        ref?: Ref<LgNavbarElement>
        'aria-label'?: string
        'aria-hidden'?: boolean | 'true' | 'false'
        'data-active'?: number
        /** Lens optics, read by the component on attach. */
        radius?: number | 'capsule'
        refraction?: number | string
        bezel?: number | string
        curvature?: number | string
        ior?: number | string
        chroma?: number | string
        blur?: number | string
        specular?: number | string
        'specular-width'?: number | string
        'light-angle'?: number | string
        backdrop?: string
      }
    }
  }
}
