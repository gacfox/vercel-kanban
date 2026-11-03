"use client";

import * as React from "react";
import { Loader2, Plus, X } from "lucide-react";
import { useBoard } from "@/components/board/board-provider";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function CardComposer({ columnId }: { columnId: string }) {
  const { createCard } = useBoard();
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [pending, setPending] = React.useState(false);

  async function submit() {
    const trimmed = title.trim();
    if (!trimmed || pending) return;
    setPending(true);
    const ok = await createCard(columnId, trimmed);
    setPending(false);
    if (ok) {
      setTitle("");
      setOpen(false);
    }
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="w-full justify-start text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <Plus className="size-4" />
        新建卡片
      </Button>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border bg-card p-2">
      <Textarea
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="输入卡片标题，Enter 保存"
        rows={2}
        autoFocus
        className="min-h-16 resize-none border-0 p-1 shadow-none focus-visible:ring-0"
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            void submit();
          }
          if (event.key === "Escape") {
            setOpen(false);
            setTitle("");
          }
        }}
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground">
          Enter 保存 · Esc 取消
        </span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => {
              setOpen(false);
              setTitle("");
            }}
            aria-label="取消"
          >
            <X className="size-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={pending || !title.trim()}
            onClick={() => void submit()}
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            保存
          </Button>
        </div>
      </div>
    </div>
  );
}
