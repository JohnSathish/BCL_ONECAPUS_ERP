'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { withApiStartupRetry } from '@/lib/http/wait-for-api';
import {
  createLmsDiscussion,
  fetchLmsDiscussionReplies,
  fetchLmsDiscussions,
  replyLmsDiscussion,
} from '@/services/lms';

type Props = {
  workspaceId: string;
  viewerRole?: 'admin' | 'faculty' | 'student';
};

export function LmsDiscussionsPanel({ workspaceId, viewerRole = 'admin' }: Props) {
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [reply, setReply] = useState('');

  const discussions = useQuery({
    queryKey: ['lms', 'discussions', workspaceId],
    queryFn: () => withApiStartupRetry(() => fetchLmsDiscussions(workspaceId)),
    enabled: Boolean(workspaceId),
  });

  const replies = useQuery({
    queryKey: ['lms', 'discussion-replies', selectedId],
    queryFn: () => withApiStartupRetry(() => fetchLmsDiscussionReplies(selectedId)),
    enabled: Boolean(selectedId),
  });

  const create = useMutation({
    mutationFn: () => createLmsDiscussion(workspaceId, { title: title.trim(), body: body.trim() }),
    onSuccess: () => {
      setTitle('');
      setBody('');
      void qc.invalidateQueries({ queryKey: ['lms', 'discussions', workspaceId] });
    },
  });

  const postReply = useMutation({
    mutationFn: () => replyLmsDiscussion(selectedId, reply.trim()),
    onSuccess: () => {
      setReply('');
      void qc.invalidateQueries({ queryKey: ['lms', 'discussion-replies', selectedId] });
      void qc.invalidateQueries({ queryKey: ['lms', 'discussions', workspaceId] });
    },
  });

  const list = discussions.data ?? [];

  return (
    <div className="space-y-4">
      <CompactCard>
        <CompactCardHeader
          title="Start a thread"
          description="Subject workspace Q&A and announcements."
        />
        <CompactCardBody className="space-y-2">
          <Input
            placeholder="Topic title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            className="min-h-24 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            placeholder="Write your post…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <Button
            type="button"
            disabled={!title.trim() || !body.trim() || create.isPending}
            onClick={() => create.mutate()}
          >
            Post discussion
          </Button>
        </CompactCardBody>
      </CompactCard>

      <CompactCard>
        <CompactCardHeader title="Threads" description={`${list.length} active`} />
        <CompactCardBody className="space-y-3">
          {list.map((thread) => (
            <div key={thread.id} className="rounded-lg border border-border p-3">
              <button
                type="button"
                className="w-full text-left"
                onClick={() => setSelectedId(thread.id)}
              >
                <p className="font-medium">{thread.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {thread.createdBy?.displayName ?? thread.createdBy?.email ?? viewerRole} ·{' '}
                  {thread._count?.replies ?? 0} replies
                </p>
              </button>
              {selectedId === thread.id ? (
                <div className="mt-3 space-y-2 border-t border-border pt-3">
                  <p className="text-sm">{thread.body}</p>
                  <ul className="space-y-2 text-sm">
                    {(replies.data ?? []).map((item) => (
                      <li key={item.id} className="rounded-md bg-muted/40 px-3 py-2">
                        <p>{item.body}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {item.createdBy?.displayName ?? 'User'}
                        </p>
                      </li>
                    ))}
                  </ul>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Reply…"
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                    />
                    <Button
                      type="button"
                      size="sm"
                      disabled={!reply.trim() || postReply.isPending}
                      onClick={() => postReply.mutate()}
                    >
                      Reply
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          ))}
          {!discussions.isLoading && !list.length ? (
            <p className="text-sm text-muted-foreground">No discussions yet.</p>
          ) : null}
        </CompactCardBody>
      </CompactCard>
    </div>
  );
}
