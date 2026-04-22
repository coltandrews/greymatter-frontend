/** Demo slots until Ola schedule data is wired; 15-minute increments. */
export function mockSlotsForDate(isoDate: string): { start: string; label: string }[] {
  const base = new Date(`${isoDate}T13:00:00`);
  const slots: { start: string; label: string }[] = [];
  for (let i = 0; i < 8; i++) {
    const d = new Date(base.getTime() + i * 15 * 60 * 1000);
    slots.push({
      start: d.toISOString(),
      label: d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
    });
  }
  return slots;
}
