import { Bell, Check, X } from 'lucide-react'
import { useNotifications, useMarkRead, useClearNotification } from '@/api/notifications'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

export function NotificationBell() {
  const { data } = useNotifications()
  const markRead = useMarkRead()
  const clear = useClearNotification()
  const unread = data?.unread_count ?? 0
  const items = data?.data ?? []

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="size-5" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold text-white">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="border-b px-4 py-2 text-sm font-medium">
          Notifications {unread > 0 && <span className="text-muted-foreground">({unread} unread)</span>}
        </div>
        <div className="max-h-96 overflow-auto">
          {items.length === 0 && (
            <p className="p-4 text-center text-sm text-muted-foreground">No notifications.</p>
          )}
          {items.map((n) => (
            <div
              key={n.id}
              className={cn(
                'flex items-start gap-2 border-b px-4 py-3 text-sm last:border-b-0',
                !n.is_read && 'bg-accent/40',
              )}
            >
              <div className="flex-1">
                <p>{n.message}</p>
                <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(n.created_at)}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                {!n.is_read && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    title="Mark read"
                    onClick={() => markRead.mutate(n.id!)}
                  >
                    <Check className="size-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  title="Clear"
                  onClick={() => clear.mutate(n.id!)}
                >
                  <X className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
