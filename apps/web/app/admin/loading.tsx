import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4 space-y-8">
        <div className="flex items-center justify-between">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-10 w-40" />
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-[250px]" />
          <Skeleton className="h-[250px]" />
        </div>

        <Skeleton className="h-[320px]" />
        <Skeleton className="h-[420px]" />
      </div>
    </div>
  );
}
