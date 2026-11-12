export const WEEKLY_GOAL = 5 // completed interviews per mode per week

/** Monday 00:00 of this week, in the user's own time zone. */
export function startOfWeek(now = new Date()): Date {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
  return start
}
