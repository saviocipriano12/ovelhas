export function createCheckInCode(cellId: string, type: "cell" | "service" = "cell") {
  return `${type}-${cellId}`;
}

export function parseCheckInCode(code: string) {
  const [type, ...cellParts] = code.split("-");
  const checkinType: "cell" | "service" = type === "service" ? "service" : "cell";
  return {
    checkinType,
    cellId: cellParts.join("-"),
  };
}

export function qrCodeUrl(value: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=16&data=${encodeURIComponent(value)}`;
}
