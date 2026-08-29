import { useEffect, useState } from 'react'

import { api } from './api'
import type { Category } from './types'

let cache: Category[] | null = null

/** Categories are a small fixed set — fetch once, reuse across the app. */
export function useCategories(): Category[] {
  const [categories, setCategories] = useState<Category[]>(cache ?? [])

  useEffect(() => {
    if (cache) return
    let alive = true
    api
      .getCategories()
      .then((list) => {
        cache = list
        if (alive) setCategories(list)
      })
      .catch(() => {
        /* non-fatal — caller can still show tasks */
      })
    return () => {
      alive = false
    }
  }, [])

  return categories
}
