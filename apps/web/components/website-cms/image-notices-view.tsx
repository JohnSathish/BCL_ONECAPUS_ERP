'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ReorderableList } from '@/components/website-cms/reorderable-list';
import {
  createWebsiteImageNotice,
  deleteWebsiteImageNotice,
  fetchWebsiteImageNotices,
  reorderWebsiteImageNotices,
  updateWebsiteImageNotice,
} from '@/services/website-cms';
import type { WebsiteImageNotice } from '@/types/website-cms';
import { apiErrorMessage } from '@/utils/api-error';

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

type Props = {
  onMessage: (message: string) => void;
};

export function ImageNoticesView({ onMessage }: Props) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['website', 'image-notices'],
    queryFn: fetchWebsiteImageNotices,
  });
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ['website', 'image-notices'] });

  const create = useMutation({
    mutationFn: () => createWebsiteImageNotice(file!, title.trim() || file!.name, caption.trim()),
    onSuccess: () => {
      setFile(null);
      setTitle('');
      setCaption('');
      onMessage('Image notice added. It will appear on the campus notice board.');
      invalidate();
    },
    onError: (error) => onMessage(apiErrorMessage(error, 'Image upload failed')),
  });

  const update = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Partial<Pick<WebsiteImageNotice, 'title' | 'caption' | 'isVisible'>>;
    }) => updateWebsiteImageNotice(id, payload),
    onSuccess: () => invalidate(),
    onError: (error) => onMessage(apiErrorMessage(error, 'Could not update the image notice')),
  });

  const reorder = useMutation({
    mutationFn: (items: WebsiteImageNotice[]) =>
      reorderWebsiteImageNotices(items.map((item) => item.id)),
    onSuccess: () => {
      onMessage('Image notice order saved.');
      invalidate();
    },
    onError: (error) => onMessage(apiErrorMessage(error, 'Could not reorder image notices')),
  });

  const remove = useMutation({
    mutationFn: deleteWebsiteImageNotice,
    onSuccess: () => {
      onMessage('Image notice removed.');
      invalidate();
    },
    onError: (error) => onMessage(apiErrorMessage(error, 'Could not delete the image notice')),
  });

  if (!query.data) {
    if (query.isLoading)
      return <p className="text-sm text-muted-foreground">Loading image notices…</p>;
    return (
      <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
        {apiErrorMessage(query.error, 'Image notices could not be loaded')}
      </p>
    );
  }

  const wrongType = file && file.type && !IMAGE_TYPES.has(file.type);

  return (
    <div className="space-y-4">
      <CompactCard>
        <CompactCardHeader
          title="Image Notices"
          description="Upload JPG, PNG, or WebP pictures for the campus television. These images rotate on the left side of the digital notice board. PDF circulars stay on Notice Board."
        />
        <CompactCardBody className="space-y-3">
          <div className="grid max-w-4xl gap-2 lg:grid-cols-[1.1fr_1fr_1fr_auto]">
            <Input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Title shown on the board"
            />
            <Input
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              placeholder="Short caption (optional)"
            />
            <Button
              disabled={!file || wrongType || create.isPending}
              onClick={() => create.mutate()}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add image
            </Button>
          </div>
          <p className={`text-xs ${wrongType ? 'text-destructive' : 'text-muted-foreground'}`}>
            {wrongType
              ? 'Only JPG, PNG, and WebP images can be uploaded here.'
              : 'Best size is 1920×1080 pixels, JPG, PNG, or WebP, under 5 MB. Drag the list to change the order on the television.'}
          </p>
        </CompactCardBody>
      </CompactCard>

      {query.data.length ? (
        <ReorderableList
          label="Image notices"
          items={query.data}
          onReorder={(items) => reorder.mutate(items)}
          renderItem={(item) => (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Image
                unoptimized
                width={240}
                height={135}
                src={item.imageUrl}
                alt={item.title}
                className="aspect-video w-full max-w-[240px] rounded-md bg-muted object-cover"
              />
              <div className="min-w-0 flex-1 space-y-2">
                <Badge variant={item.isVisible ? 'default' : 'secondary'}>
                  {item.isVisible ? 'On the board' : 'Hidden'}
                </Badge>
                <Input
                  defaultValue={item.title}
                  aria-label={`Title for ${item.title}`}
                  onBlur={(event) => {
                    const next = event.target.value.trim();
                    if (next && next !== item.title) {
                      update.mutate({ id: item.id, payload: { title: next } });
                    }
                  }}
                />
                <Input
                  defaultValue={item.caption}
                  aria-label={`Caption for ${item.title}`}
                  placeholder="Caption"
                  onBlur={(event) => {
                    const next = event.target.value.trim();
                    if (next !== item.caption) {
                      update.mutate({ id: item.id, payload: { caption: next } });
                    }
                  }}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      update.mutate({ id: item.id, payload: { isVisible: !item.isVisible } })
                    }
                  >
                    {item.isVisible ? 'Hide' : 'Show'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => remove.mutate(item.id)}
                    disabled={remove.isPending}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          )}
        />
      ) : (
        <CompactCard>
          <CompactCardBody>
            <p className="text-sm text-muted-foreground">
              No image notices yet. Upload the first picture above. It appears on the left side of
              the campus notice board.
            </p>
          </CompactCardBody>
        </CompactCard>
      )}
    </div>
  );
}
