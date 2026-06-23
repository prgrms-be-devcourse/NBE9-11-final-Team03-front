interface ErrorStateProps {
  title?: string;
  message: string;
}

export function ErrorState({
  title = "문제가 발생했어요",
  message,
}: ErrorStateProps) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-6">
      <p className="font-semibold text-red-900">{title}</p>
      <p className="mt-2 text-sm leading-6 text-red-700">{message}</p>
    </div>
  );
}
