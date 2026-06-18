/**
 * Live board / alerts WebSocket.
 *
 * Connects to `${wsUrl}/realtime?token=<jwt>`, subscribes to the requested
 * channels, and routes server events to TanStack Query cache invalidations +
 * toasts. Auto-reconnects with capped backoff and resubscribes on reconnect.
 */
import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { env } from '@/lib/env'

type Channel = 'transit_board' | 'alerts'

interface ServerEvent {
  event: string
  data: Record<string, unknown>
}

export function useRealtime(token: string | null, channels: Channel[] = ['transit_board', 'alerts']) {
  const qc = useQueryClient()
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const attemptsRef = useRef(0)

  useEffect(() => {
    if (!token) return
    let closed = false

    function connect() {
      const ws = new WebSocket(`${env.wsUrl}/realtime?token=${encodeURIComponent(token!)}`)
      wsRef.current = ws

      ws.onopen = () => {
        attemptsRef.current = 0
        ws.send(JSON.stringify({ action: 'subscribe', channels }))
      }

      ws.onmessage = (msg) => {
        let payload: ServerEvent
        try {
          payload = JSON.parse(msg.data as string)
        } catch {
          return
        }
        handleEvent(payload, qc)
      }

      ws.onclose = () => {
        if (closed) return
        // Exponential backoff capped at 30s.
        const delay = Math.min(30_000, 1000 * 2 ** attemptsRef.current)
        attemptsRef.current += 1
        reconnectRef.current = setTimeout(connect, delay)
      }

      ws.onerror = () => ws.close()
    }

    connect()

    return () => {
      closed = true
      if (reconnectRef.current) clearTimeout(reconnectRef.current)
      wsRef.current?.close()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])
}

function handleEvent(payload: ServerEvent, qc: ReturnType<typeof useQueryClient>) {
  const { event, data } = payload

  if (event.startsWith('delivery.')) {
    void qc.invalidateQueries({ queryKey: ['deliveries'] })
  }
  if (event.startsWith('issue.')) {
    void qc.invalidateQueries({ queryKey: ['issues'] })
  }

  switch (event) {
    case 'delivery.delay_flagged':
      toast.warning('A delivery is running late.', {
        description: `Delivery ${String(data.delivery_id ?? '').slice(0, 8)} exceeded its threshold.`,
      })
      break
    case 'issue.raised':
      toast.warning('New issue raised', { description: String(data.title ?? '') })
      break
    case 'notification.new':
      void qc.invalidateQueries({ queryKey: ['notifications'] })
      if (data.message) toast.info(String(data.message))
      break
    default:
      break
  }
}
