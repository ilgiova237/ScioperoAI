export function checkDateAlert(text: string): { days: number; date: string } {
  const dateRegex = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/g;
  const matches = text.matchAll(dateRegex);
  const now = new Date();
  for (const match of matches) {
    const day = parseInt(match[1]), month = parseInt(match[2]), year = parseInt(match[3]);
    const eventDate = new Date(year, month - 1, day);
    const diffTime = eventDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays >= 0 && diffDays <= 30) {
      return { days: diffDays, date: eventDate.toISOString().split("T")[0] };
    }
  }
  return { days: -1, date: "" };
}