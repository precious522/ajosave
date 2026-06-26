import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

export const locales = ["en", "yo", "ig", "ha"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

export default getRequestConfig(async () => {
  const cookieStore = cookies();
  const locale = (cookieStore.get("locale")?.value ?? defaultLocale) as Locale;
  const safeLocale = locales.includes(locale) ? locale : defaultLocale;

  return {
    locale: safeLocale,
    messages: (await import(`../messages/${safeLocale}.json`)).default,
  };
});
