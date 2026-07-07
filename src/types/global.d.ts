import type { NexOpsApi } from '../../electron/preload'

declare global {
  interface Window {
    nexops: NexOpsApi
  }
}
