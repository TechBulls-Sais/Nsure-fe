export const money = (value) => "BWP " + Number(value || 0).toLocaleString("en-GB");
export const initials = (name) =>
  String(name || "")
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("");
