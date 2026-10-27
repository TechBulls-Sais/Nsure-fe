// Whole pula print as "BWP 1,250"; a rate-table premium summed from per-life rates keeps its thebe ("BWP 34.13").
export const money = (value) => {
  const amount = Number(value || 0);
  return "BWP " + amount.toLocaleString("en-GB", Number.isInteger(amount)
    ? {}
    : { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
export const initials = (name) =>
  String(name || "")
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("");
