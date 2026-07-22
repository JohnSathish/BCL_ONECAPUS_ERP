'use client';

import { GripVertical, MoveDown, MoveUp } from 'lucide-react';
import { useState, type DragEvent, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils/cn';

type ReorderableItem = { id: string };

export function ReorderableList<T extends ReorderableItem>({
  items,
  onReorder,
  renderItem,
  label,
}: {
  items: T[];
  onReorder: (items: T[]) => void;
  renderItem: (item: T, index: number) => ReactNode;
  label: string;
}) {
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    const [item] = next.splice(from, 1);
    if (!item) return;
    next.splice(to, 0, item);
    onReorder(next);
  };

  const drop = (event: DragEvent<HTMLLIElement>, targetIndex: number) => {
    event.preventDefault();
    const sourceIndex = items.findIndex((item) => item.id === draggedId);
    if (sourceIndex >= 0) move(sourceIndex, targetIndex);
    setDraggedId(null);
  };

  return (
    <ol className="space-y-2" aria-label={label}>
      {items.map((item, index) => (
        <li
          key={item.id}
          draggable
          onDragStart={() => setDraggedId(item.id)}
          onDragEnd={() => setDraggedId(null)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => drop(event, index)}
          className={cn(
            'flex items-center gap-2 rounded-lg border border-border bg-card p-2',
            draggedId === item.id && 'opacity-50',
          )}
        >
          <GripVertical
            className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground"
            aria-hidden
          />
          <div className="min-w-0 flex-1">{renderItem(item, index)}</div>
          <div className="flex shrink-0 gap-1">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              disabled={index === 0}
              aria-label={`Move item ${index + 1} up`}
              onClick={() => move(index, index - 1)}
            >
              <MoveUp className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              disabled={index === items.length - 1}
              aria-label={`Move item ${index + 1} down`}
              onClick={() => move(index, index + 1)}
            >
              <MoveDown className="h-4 w-4" />
            </Button>
          </div>
        </li>
      ))}
    </ol>
  );
}
