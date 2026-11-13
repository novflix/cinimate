export type LiquidGlassEngine = 'blink' | 'webkit' | 'gecko' | 'unknown'

export type LiquidGlassMode = 'content' | 'backdrop'

export type LiquidGlassOptions = {
  x?: number
  y?: number
  width?: number
  height?: number
  radius?: number

  refraction?: number
  bezel?: number
  curvature?: number
  ior?: number
  invert?: boolean
  chroma?: number
  blur?: number
  specular?: number
  specularWidth?: number
  lightAngle?: number
  mapScale?: number

  fit?: boolean
  clip?: boolean
  sync?: boolean
  hidden?: boolean
  fallback?: string
  mode?: LiquidGlassMode
}

export type LiquidGlassController = {
  update(options?: LiquidGlassOptions): void
  flush(): void
  readonly params: Required<LiquidGlassOptions>
  readonly filterId: string
  destroy(): void
}

export const engine: LiquidGlassEngine

export function createGlass(
  target: HTMLElement,
  options?: LiquidGlassOptions,
): LiquidGlassController
