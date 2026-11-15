import { useContext } from 'react'
import { LibraryContext, type LibraryContextValue } from '@/context/libraryContext'

export function useLibrary(): LibraryContextValue {
  const context = useContext(LibraryContext)
  if (!context) throw new Error('useLibrary must be used inside <LibraryProvider>')
  return context
}
