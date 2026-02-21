export function planLimits(plan) {
  if (plan === "team") return { chatPerMin: Number(process.env.CHAT_PER_MIN_TEAM || 180) };
  if (plan === "pro") return { chatPerMin: Number(process.env.CHAT_PER_MIN_PRO || 60) };
  return { chatPerMin: Number(process.env.CHAT_PER_MIN_FREE || 20) };
}