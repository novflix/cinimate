import { useEffect, useRef } from 'react'
import { AltArrowLeftIcon } from '@solar-icons/react/bold/alt-arrow-left'
import { AltArrowRightIcon } from '@solar-icons/react/bold/alt-arrow-right'
import type { LiquidGlassController, LiquidGlassOptions } from '@/vendor/liquid-glass'
import './CarouselArrow.css'

// The arrows float over the page, so backdrop mode refracts the live content behind them
// in Chromium and falls back to frosted blur elsewhere — the same pattern as MobileNav.
const arrowGlass: LiquidGlassOptions = {
  mode: 'backdrop',
  fit: true,
  radius: 20,
  refraction: 10,
  bezel: 0.6,
  curvature: 3,
  ior: 1.45,
  chroma: 0.04,
  blur: 8,
  specular: 0.45,
  specularWidth: 1.5,
  lightAngle: -90,
  fallback: 'blur(16px) saturate(150%)',
}

type CarouselArrowProps = {
  direction: 'back' | 'forward'
  label: string
  onClick: () => void
  disabled?: boolean
  className?: string
}

function CarouselArrow({
  direction,
  label,
  onClick,
  disabled = false,
  className,
}: CarouselArrowProps) {
  const ref = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    let disposed = false
    let controller: LiquidGlassController | null = null

    void import('@/vendor/components.js').then(({ createGlass }) => {
      if (disposed) return
      controller = createGlass(element, arrowGlass)
    })

    return () => {
      disposed = true
      controller?.destroy()
      controller = null
    }
  }, [])

  return (
    <button
      ref={ref}
      type="button"
      className={`carousel-arrow${className ? ` ${className}` : ''}`}
      disabled={disabled}
      aria-label={label}
      onClick={onClick}
    >
      {direction === 'back' ? (
        <AltArrowLeftIcon size={20} aria-hidden="true" />
      ) : (
        <AltArrowRightIcon size={20} aria-hidden="true" />
      )}
    </button>
  )
}

export default CarouselArrow
