import { useState, type ComponentProps } from 'react'
import './SmartImage.css'

type ImageState = 'loading' | 'loaded' | 'error'

type SmartImageProps = ComponentProps<'img'>

/**
 * An `<img>` that fades in when the bitmap is ready. The ref callback also catches images that
 * are already in the browser cache, so going back never shows a blank frame or a stuck shimmer.
 */
function SmartImage({ className, onLoad, onError, src, ...props }: SmartImageProps) {
  const [state, setState] = useState<ImageState>('loading')

  const syncCachedImage = (image: HTMLImageElement | null) => {
    if (!image?.complete) return
    setState(image.naturalWidth > 0 ? 'loaded' : 'error')
  }

  return (
    <img
      {...props}
      ref={syncCachedImage}
      src={src}
      className={`smart-image${className ? ` ${className}` : ''}`}
      data-state={state}
      onLoad={(event) => {
        setState('loaded')
        onLoad?.(event)
      }}
      onError={(event) => {
        setState('error')
        onError?.(event)
      }}
    />
  )
}

export default SmartImage
