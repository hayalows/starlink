export const ghs = (n: number | null) =>
  n === null
    ? "—"
    : "GH₵" + n.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
