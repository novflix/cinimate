import './Avatar.css'

interface AvatarProps {
  /** Nickname; its first letter becomes the avatar. */
  name?: string | null
  /** Pixel size. When omitted the avatar fills its parent. */
  size?: number
}

function Avatar({ name, size }: AvatarProps) {
  const letter = (Array.from(name?.trim() ?? '')[0] ?? '?').toUpperCase()

  return (
    <span
      className="avatar"
      aria-hidden="true"
      style={size ? { width: size, height: size, fontSize: size * 0.45 } : undefined}
    >
      {letter}
    </span>
  )
}

export default Avatar
