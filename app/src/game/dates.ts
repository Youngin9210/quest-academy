// Dates as 'YYYY-MM-DD' in the player's own time zone (same format the old app saved).
export const today = (): string => new Date().toLocaleDateString('en-CA');
export const dayDiff = (a: string, b: string): number => Math.round((+new Date(b) - +new Date(a)) / 86400000);
