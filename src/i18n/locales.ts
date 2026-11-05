export const locales = ['ko', 'en', 'ja'] as const;
export type Locale = (typeof locales)[number];
