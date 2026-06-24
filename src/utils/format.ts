export function formatCredit(value: number): string {
  return `${value.toLocaleString("ko-KR")} 크레딧`;
}

export function formatDate(date: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

export function formatRating(value: number): string {
  return value.toFixed(1);
}

export function formatEstimatedDuration(hours: number): string {
  if (hours >= 720 && hours % 720 === 0) {
    return `${hours / 720}개월`;
  }

  if (hours >= 168 && hours % 168 === 0) {
    return `${hours / 168}주`;
  }

  if (hours >= 24 && hours % 24 === 0) {
    return `${hours / 24}일`;
  }

  if (hours === 8) {
    return "당일";
  }

  return `${hours}시간`;
}
