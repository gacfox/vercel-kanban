"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { CustomField, UserSummary } from "@/lib/types";

export function FieldInput({
  field,
  value,
  members,
  onChange,
  disabled,
}: {
  field: CustomField;
  value: unknown;
  members: UserSummary[];
  onChange: (value: unknown) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = React.useState(
    value == null ? "" : typeof value === "string" ? value : String(value)
  );

  React.useEffect(() => {
    setDraft(value == null ? "" : typeof value === "string" ? value : String(value));
  }, [value]);

  if (field.type === "long_text") {
    return (
      <Textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          if (draft !== (value ?? "")) onChange(draft);
        }}
        rows={3}
        disabled={disabled}
        placeholder="输入内容"
      />
    );
  }

  if (field.type === "text" || field.type === "url" || field.type === "number") {
    return (
      <Input
        type={field.type === "number" ? "number" : field.type === "url" ? "url" : "text"}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          if (draft === (value ?? "")) return;
          if (field.type === "number") {
            const number = Number(draft);
            onChange(draft === "" ? null : Number.isFinite(number) ? number : null);
          } else {
            onChange(draft || null);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
        }}
        disabled={disabled}
        placeholder={field.type === "url" ? "https://" : "输入内容"}
      />
    );
  }

  if (field.type === "date") {
    return (
      <Input
        type="date"
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(event.target.value || null)}
        disabled={disabled}
      />
    );
  }

  if (field.type === "checkbox") {
    return (
      <div className="flex h-9 items-center rounded-md border px-3">
        <Checkbox
          checked={value === true}
          onCheckedChange={(checked) => onChange(checked === true)}
          disabled={disabled}
        />
        <span className="ml-2 text-sm text-muted-foreground">
          {value === true ? "是" : "否"}
        </span>
      </div>
    );
  }

  if (field.type === "select") {
    return (
      <Select
        value={typeof value === "string" ? value : ""}
        onValueChange={(next) => onChange(next || null)}
        disabled={disabled}
      >
        <SelectTrigger>
          <SelectValue placeholder="未选择" />
        </SelectTrigger>
        <SelectContent>
          {field.options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (field.type === "multi_select") {
    const selected = Array.isArray(value) ? (value as string[]) : [];
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between font-normal"
            disabled={disabled}
          >
            <span className="truncate">
              {selected.length > 0 ? selected.join("、") : "未选择"}
            </span>
            <ChevronsUpDown className="size-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-60 p-1">
          {field.options.length === 0 ? (
            <p className="px-2 py-1 text-xs text-muted-foreground">暂无可选项</p>
          ) : (
            field.options.map((option) => {
              const checked = selected.includes(option);
              return (
                <button
                  key={option}
                  type="button"
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                  onClick={() => {
                    const next = checked
                      ? selected.filter((item) => item !== option)
                      : [...selected, option];
                    onChange(next);
                  }}
                >
                  <span
                    className={cn(
                      "flex size-4 items-center justify-center rounded border",
                      checked && "bg-primary text-primary-foreground"
                    )}
                  >
                    {checked ? <Check className="size-3" /> : null}
                  </span>
                  {option}
                </button>
              );
            })
          )}
        </PopoverContent>
      </Popover>
    );
  }

  if (field.type === "user") {
    return (
      <Select
        value={typeof value === "string" ? value : ""}
        onValueChange={(next) => onChange(next || null)}
        disabled={disabled}
      >
        <SelectTrigger>
          <SelectValue placeholder="未指定" />
        </SelectTrigger>
        <SelectContent>
          {members.map((member) => (
            <SelectItem key={member.id} value={member.id}>
              {member.displayName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return null;
}
