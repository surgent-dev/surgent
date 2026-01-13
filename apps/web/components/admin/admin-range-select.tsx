"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ranges = [
  { value: "today", label: "Today" },
  { value: "week", label: "Week" },
  { value: "this_month", label: "This month" },
  { value: "month", label: "Last month" },
  { value: "year", label: "This year" },
  { value: "12mo", label: "Last 12 months" },
];

export function AdminRangeSelect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("range") || "today";
  const [pending, startTransition] = useTransition();

  function onChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", value);
    params.set("page", "1");
    startTransition(() => {
      router.push(`/admin?${params.toString()}`);
    });
  }

  return (
    <Select value={current} onValueChange={onChange} disabled={pending}>
      <SelectTrigger className="w-[160px]">
        <div className="flex items-center gap-2">
          <SelectValue placeholder="Select range" />
          {pending ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
        </div>
      </SelectTrigger>
      <SelectContent>
        {ranges.map((r) => (
          <SelectItem key={r.value} value={r.value}>
            {r.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
