export function formatRelativeDate(timestamp: number, now: number = Date.now()): string {
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);

  if (seconds < 60) return "الآن";
  if (minutes < 60) {
    if (minutes === 1) return "منذ دقيقة";
    if (minutes === 2) return "منذ دقيقتين";
    if (minutes <= 10) return `منذ ${minutes} دقائق`;
    return `منذ ${minutes} دقيقة`;
  }
  if (hours < 24) {
    if (hours === 1) return "منذ ساعة";
    if (hours === 2) return "منذ ساعتين";
    if (hours <= 10) return `منذ ${hours} ساعات`;
    return `منذ ${hours} ساعة`;
  }
  if (days < 7) return `منذ ${days} ي`;
  if (weeks === 1) return "منذ أسبوع";
  if (weeks < 4) return `منذ ${weeks} أسابيع`;

  const months = Math.floor(days / 30);
  if (months === 1) return "منذ شهر";
  if (months < 12) return `منذ ${months} أشهر`;

  const years = Math.floor(days / 365);
  if (years === 1) return "منذ سنة";
  return `منذ ${years} سنوات`;
}

export function formatAbsoluteDate(timestamp: number): string {
  return new Intl.DateTimeFormat("ar-SA-u-ca-gregory", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "numeric",
    timeZone: "Asia/Riyadh",
  }).format(new Date(timestamp));
}
