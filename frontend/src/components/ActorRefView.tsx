import type { ActorRef } from '@/types/models'

/** Renders an expanded actor reference (sender / recipient / created_by). */
export function ActorRefView({ actor }: { actor?: ActorRef | null }) {
  if (!actor) return <span className="text-muted-foreground">—</span>
  return (
    <span className="inline-flex items-center gap-1.5">
      <span>{actor.name ?? actor.entity_id ?? actor.universal_id}</span>
      {actor.entity_type && (
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
          {actor.entity_type}
        </span>
      )}
    </span>
  )
}
