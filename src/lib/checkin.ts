const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function createCheckInCode(cellId: string, type: "cell" | "service" = "cell", date = new Date()) {
  return `${type}-${date.toISOString().slice(0, 10)}-${cellId}`;
}

export function parseCheckInCode(code: string) {
  const parts = code.split("-");
  const type = parts[0];
  const checkinType: "cell" | "service" = type === "service" ? "service" : "cell";
  const maybeDate = parts.slice(1, 4).join("-");

  if (DATE_PATTERN.test(maybeDate)) {
    return { checkinType, cellId: parts.slice(4).join("-"), date: maybeDate };
  }

  return { checkinType, cellId: parts.slice(1).join("-"), date: undefined as string | undefined };
}

export function qrCodeUrl(value: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=16&data=${encodeURIComponent(value)}`;
}
