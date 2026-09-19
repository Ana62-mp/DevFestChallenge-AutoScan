export const normalizePlate = value => value.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^([A-Z]{3})(\d{4})$/, '$1-$2');
export const validPlate = value => /^[A-Z]{3}-\d{4}$/.test(normalizePlate(value));
export const recentTimes = (times, now = Date.now()) => times.filter(time => time >= now - 7 * 86400000);
export function nextSighting(previous, now = Date.now()) {
  const times = [...recentTimes(previous?.times || [], now), now];
  return { times, count: times.length, shouldAlert: times.length >= 3 && (!previous?.lastAlert || previous.lastAlert < now - 7 * 86400000) };
}
