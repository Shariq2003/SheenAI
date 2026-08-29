import { toast } from 'sonner'

import { ApiError } from './api'

export function notifyError(err: unknown, fallback = 'Something went wrong') {
  const msg =
    err instanceof ApiError || err instanceof Error ? err.message : fallback
  toast.error(msg)
}

export { toast }
