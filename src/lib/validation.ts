export const MIN_PASSWORD_LENGTH = 8
export const MIN_NICKNAME_LENGTH = 2
export const MAX_NICKNAME_LENGTH = 24

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}
