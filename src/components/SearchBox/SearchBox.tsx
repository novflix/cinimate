import { useEffect, useRef, type FormEvent } from 'react'
import { CloseCircleIcon } from '@solar-icons/react/bold/close-circle'
import { MagnifierIcon } from '@solar-icons/react/linear/magnifier'
import type { LiquidGlassController, LiquidGlassOptions } from '@/vendor/liquid-glass'
import './SearchBox.css'

// The pill is 60px tall, so the lens radius is half of that. A softer bend than the small mobile
// circle keeps the wide surface from looking warped.
const glass: LiquidGlassOptions = {
  mode: 'backdrop',
  fit: true,
  radius: 30,
  refraction: 10,
  bezel: 0.55,
  curvature: 3,
  ior: 1.45,
  chroma: 0.04,
  blur: 12,
  specular: 0.45,
  specularWidth: 1.5,
  lightAngle: -90,
  fallback: 'blur(18px) saturate(160%)',
}

type SearchBoxProps = {
  value: string
  onChange: (value: string) => void
}

function SearchBox({ value, onChange }: SearchBoxProps) {
  const boxRef = useRef<HTMLFormElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // The refraction engine is client-only and heavy, so it is loaded after the first paint.
  useEffect(() => {
    const box = boxRef.current
    if (!box) return

    let disposed = false
    let controller: LiquidGlassController | null = null

    void import('@/vendor/liquid-glass').then(({ createGlass }) => {
      if (disposed) return
      controller = createGlass(box, glass)
    })

    return () => {
      disposed = true
      controller?.destroy()
      controller = null
    }
  }, [])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    // Results are live, so Enter only needs to keep the browser from reloading the page.
    event.preventDefault()
  }

  const handleClear = () => {
    onChange('')
    inputRef.current?.focus()
  }

  return (
    <form ref={boxRef} className="search-box" role="search" onSubmit={handleSubmit}>
      <MagnifierIcon className="search-box__icon" size={22} aria-hidden="true" />

      <input
        ref={inputRef}
        className="search-box__input"
        type="search"
        name="q"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search movies, series..."
        aria-label="Search movies and series"
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="search"
      />

      {value.length > 0 && (
        <button
          type="button"
          className="search-box__clear"
          aria-label="Clear search"
          onClick={handleClear}
        >
          <CloseCircleIcon size={20} aria-hidden="true" />
        </button>
      )}
    </form>
  )
}

export default SearchBox
