import folderIconImg from '@/assets/folder-icon.png'
import { cn } from '@/lib/utils/cn'
import type { SubtaskItem } from '../types/task.types'

export interface TaskFolderItemProps {
  subtask: SubtaskItem
  isSelected: boolean
  onSelect: (subtaskId: string) => void
  onOpen: (subtaskId: string) => void
}

/**
 * Compact Finder-style subfolder tile representing a single authorized subtask.
 */
export function TaskFolderItem({
  subtask,
  isSelected,
  onSelect,
  onOpen,
}: TaskFolderItemProps) {
  const ariaLabel = [
    `Open details for ${subtask.title}`,
    subtask.responsibilityLabel ? subtask.responsibilityLabel : null,
    subtask.owner ? `assigned to ${subtask.owner}` : null,
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <button
      type="button"
      title={subtask.title}
      aria-label={ariaLabel}
      aria-current={isSelected ? 'true' : undefined}
      onClick={() => onOpen(subtask.id)}
      onMouseEnter={() => onSelect(subtask.id)}
      onFocus={() => onSelect(subtask.id)}
      className={cn(
        'group w-full max-w-[145px] h-[148px] rounded-[12px] border px-2.5 pt-3 pb-2.5 flex flex-col items-center justify-center text-center transition-colors cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-1 [content-visibility:auto] [contain-intrinsic-size:auto_148px]',
        isSelected
          ? 'bg-tint-blue-bg/90 border-brand-blue shadow-[0_0_0_1px_rgba(37,99,235,0.18)]'
          : 'bg-surface border-border-subtle hover:bg-tint-blue-bg/60 hover:border-brand-blue/60',
      )}
    >
      <img
        src={folderIconImg}
        alt=""
        draggable={false}
        className="w-16 h-16 object-contain shrink-0 select-none pointer-events-none"
      />
      <span className="mt-2 w-full min-w-0 truncate text-[12.5px] font-medium text-text-primary leading-tight">
        {subtask.title}
      </span>
      <div className="mt-1.5 h-[20px] flex items-center justify-center">
        <span
          aria-hidden="true"
          className={cn(
            'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-medium text-brand-blue bg-surface/95 border border-tint-blue-border transition-opacity whitespace-nowrap',
            isSelected
              ? 'opacity-100'
              : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100',
          )}
        >
          <span>Open details</span>
          <span>&rarr;</span>
        </span>
      </div>
    </button>
  )
}

