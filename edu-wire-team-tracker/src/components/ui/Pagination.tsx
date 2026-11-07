import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from './Button'
import { cn } from '@/lib/utils/cn'

export interface PaginationProps {
  currentPage: number
  totalPages: number
  totalItems?: number
  itemName?: string
  onPageChange: (page: number) => void
  className?: string
}

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  itemName = 'items',
  onPageChange,
  className,
}: PaginationProps) {
  if (totalPages <= 1) return null

  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border-subtle pt-4 px-2',
        className,
      )}
    >
      <span className="text-xs text-text-muted">
        Page <span className="font-semibold text-text-primary">{currentPage}</span> of{' '}
        <span className="font-semibold text-text-primary">{totalPages}</span>
        {typeof totalItems === 'number' && (
          <> ({totalItems} total {itemName})</>
        )}
      </span>

      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          leftIcon={<ChevronLeft className="w-4 h-4" />}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          rightIcon={<ChevronRight className="w-4 h-4" />}
        >
          Next
        </Button>
      </div>
    </div>
  )
}

