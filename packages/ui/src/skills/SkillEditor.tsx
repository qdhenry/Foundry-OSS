"use client";

import { useCallback, useRef } from "react";

interface SkillEditorProps {
  content: string;
  onChange: (content: string) => void;
  readOnly?: boolean;
}

export function SkillEditor({ content, onChange, readOnly }: SkillEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  const lines = content.split("\n");
  const lineCount = lines.length;

  const handleScroll = useCallback(() => {
    if (textareaRef.current && gutterRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);

  return (
    <div className="flex flex-col rounded-lg border border-border-default bg-surface-default">
      <div className="relative flex flex-1 overflow-hidden">
        {/* Line numbers gutter */}
        <div
          ref={gutterRef}
          className="pointer-events-none w-12 shrink-0 overflow-hidden border-r border-border-default bg-surface-raised py-3 text-right"
          aria-hidden="true"
        >
          {lines.map((_, i) => (
            <div key={i} className="px-2 font-mono text-xs leading-6 text-text-muted">
              {i + 1}
            </div>
          ))}
        </div>

        {/* Editor textarea */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => onChange(e.target.value)}
          onScroll={handleScroll}
          readOnly={readOnly}
          spellCheck={false}
          className="flex-1 resize-none bg-transparent px-4 py-3 font-mono text-sm leading-6 text-text-heading outline-none"
          style={{ minHeight: `${Math.max(lineCount, 10) * 24 + 24}px` }}
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-border-default px-3 py-1.5">
        <span className="text-xs text-text-muted">
          {lineCount} line{lineCount !== 1 ? "s" : ""}
        </span>
        {readOnly && <span className="text-xs font-medium text-text-muted">Read Only</span>}
      </div>
    </div>
  );
}
