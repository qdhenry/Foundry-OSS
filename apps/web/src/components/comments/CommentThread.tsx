"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";

type EntityType = "requirement" | "risk" | "task" | "skill" | "gate" | "integration";

interface CommentThreadProps {
  entityType: EntityType;
  entityId: string;
  programId: string;
  orgId: string;
}

interface CommentData {
  _id: string;
  _creationTime: number;
  authorId: string;
  authorName: string;
  authorAvatarUrl?: string;
  content: string;
  parentId?: string;
}

function formatTimestamp(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function CommentItem({
  comment,
  currentUserId,
  onDelete,
  onReply,
  replies,
  depth,
}: {
  comment: CommentData;
  currentUserId: string | null;
  onDelete: (id: string) => void;
  onReply: (parentId: string) => void;
  replies: CommentData[];
  depth: number;
}) {
  const isOwn = currentUserId === comment.authorId;

  return (
    <div className={depth > 0 ? "ml-6 border-l-2 border-border-default pl-4" : ""}>
      <div className="group py-2">
        <div className="flex items-start gap-2">
          {/* Avatar */}
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-elevated text-xs font-medium text-text-primary">
            {comment.authorAvatarUrl ? (
              <img src={comment.authorAvatarUrl} alt="" className="h-7 w-7 rounded-full" />
            ) : (
              comment.authorName.charAt(0).toUpperCase()
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-text-heading">{comment.authorName}</span>
              <span className="text-xs text-text-muted">
                {formatTimestamp(comment._creationTime)}
              </span>
              {isOwn && (
                <button
                  onClick={() => onDelete(comment._id)}
                  className="ml-auto hidden rounded p-0.5 text-text-muted transition-colors hover:text-status-error-fg group-hover:block"
                  title="Delete comment"
                >
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            <p className="mt-0.5 text-sm text-text-primary">{comment.content}</p>
            <button
              onClick={() => onReply(comment._id)}
              className="mt-1 text-xs text-text-muted transition-colors hover:text-accent-default"
            >
              Reply
            </button>
          </div>
        </div>
      </div>

      {/* Nested replies */}
      {replies.map((reply) => (
        <CommentItem
          key={reply._id}
          comment={reply}
          currentUserId={currentUserId}
          onDelete={onDelete}
          onReply={onReply}
          replies={[]}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

export function CommentThread({ entityType, entityId, programId, orgId }: CommentThreadProps) {
  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const comments = useQuery(api.comments.listByEntity, {
    entityType: entityType as any,
    entityId,
  });

  const createComment = useMutation(api.comments.create);
  const deleteComment = useMutation(api.comments.remove);

  // Derive current user ID from comments (if the user has authored any)
  // We use the Clerk identity indirectly -- the backend handles auth
  const currentUserId: string | null = null;

  const handleSubmit = async () => {
    if (!newComment.trim() || submitting) return;
    setSubmitting(true);
    try {
      await createComment({
        orgId,
        programId,
        entityType: entityType as any,
        entityId,
        content: newComment.trim(),
        ...(replyingTo ? { parentId: replyingTo as any } : {}),
      });
      setNewComment("");
      setReplyingTo(null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    await deleteComment({ commentId });
  };

  const handleReply = (parentId: string) => {
    setReplyingTo(parentId);
  };

  // Separate top-level comments from replies
  const allComments = comments ?? [];
  const topLevel = allComments.filter((c: any) => !c.parentId);
  const repliesByParent = new Map<string, CommentData[]>();
  for (const c of allComments) {
    if ((c as any).parentId) {
      const parentId = (c as any).parentId as string;
      const existing = repliesByParent.get(parentId) ?? [];
      existing.push(c as any);
      repliesByParent.set(parentId, existing);
    }
  }

  const replyingToComment = replyingTo ? allComments.find((c: any) => c._id === replyingTo) : null;

  return (
    <div>
      <h3 className="mb-3 text-sm font-medium text-text-heading">
        Comments
        {allComments.length > 0 && (
          <span className="ml-1.5 text-xs font-normal text-text-muted">({allComments.length})</span>
        )}
      </h3>

      {/* Comment list */}
      {allComments.length === 0 && (
        <p className="mb-3 text-xs text-text-muted">No comments yet. Start the conversation.</p>
      )}

      <div className="mb-4 space-y-1">
        {topLevel.map((comment: any) => (
          <CommentItem
            key={comment._id}
            comment={comment}
            currentUserId={currentUserId}
            onDelete={handleDelete}
            onReply={handleReply}
            replies={repliesByParent.get(comment._id) ?? []}
            depth={0}
          />
        ))}
      </div>

      {/* Reply indicator */}
      {replyingToComment && (
        <div className="mb-2 flex items-center gap-2 text-xs text-text-secondary">
          <span>
            Replying to{" "}
            <span className="font-medium text-text-primary">
              {(replyingToComment as any).authorName}
            </span>
          </span>
          <button
            onClick={() => setReplyingTo(null)}
            className="text-text-muted hover:text-text-primary"
          >
            <svg
              className="h-3 w-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Add comment form */}
      <div className="flex gap-2">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              handleSubmit();
            }
          }}
          placeholder="Add a comment..."
          rows={2}
          className="textarea flex-1 resize-none"
        />
        <button
          onClick={handleSubmit}
          disabled={!newComment.trim() || submitting}
          className="self-end rounded-lg bg-accent-default px-4 py-2 text-sm font-medium text-text-on-brand transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "..." : "Post"}
        </button>
      </div>
    </div>
  );
}
