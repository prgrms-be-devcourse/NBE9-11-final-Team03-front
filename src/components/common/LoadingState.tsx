interface LoadingStateProps {
  label?: string;
}

export function LoadingState({ label = "불러오는 중입니다" }: LoadingStateProps) {
  return (
    <div className="flex min-h-40 items-center justify-center rounded-lg border border-zinc-200 bg-white">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" />
      <span className="ml-3 text-sm text-zinc-600">{label}</span>
    </div>
  );
}
