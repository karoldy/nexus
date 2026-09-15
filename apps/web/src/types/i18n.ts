export const APP_LANGUAGES = ['sc', 'tc', 'en'] as const;

export type AppLanguage = (typeof APP_LANGUAGES)[number];
