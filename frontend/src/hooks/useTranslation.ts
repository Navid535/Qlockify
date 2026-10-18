import { en } from "../locales/en"

export function useTranslation() {
  return {
    t: en,
    lang: "en" as "en" | "fa",
    setLanguage: (_language: "en" | "fa") => undefined,
  }
}
