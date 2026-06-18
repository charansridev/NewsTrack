import { Button } from '@/components/ui/button'
import type { Pagination as PaginationMeta } from '@/types/models'

export function Pagination({
  pagination,
  page,
  onPageChange,
}: {
  pagination?: PaginationMeta
  page: number
  onPageChange: (page: number) => void
}) {
  const totalPages = pagination?.total_pages ?? 1
  const total = pagination?.total
  return (
    <div className="flex items-center justify-between pt-4 text-sm text-muted-foreground">
      <span>
        {total != null ? `${total} total` : ''} · Page {page} of {totalPages}
      </span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  )
}
