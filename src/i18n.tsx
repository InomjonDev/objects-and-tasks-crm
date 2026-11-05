import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { translate, type Language } from "./messages"

const LanguageContext = createContext<{
  language: Language
  setLanguage: (language: Language) => void
}>({ language: "ru", setLanguage: () => {} })
export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    try {
      return localStorage.getItem("crm-language") === "en" ? "en" : "ru"
    } catch {
      return "ru"
    }
  })
  useEffect(() => {
    document.documentElement.lang = language
    document.title = `${translate("Объекты и задачи", language)} — CRM`
    try {
      localStorage.setItem("crm-language", language)
    } catch {
      /* Browser storage can be unavailable in private sessions. */
    }
  }, [language])
  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  )
}
export function useI18n() {
  const { language, setLanguage } = useContext(LanguageContext)
  return {
    language,
    setLanguage,
    locale: language === "en" ? "en-US" : "ru-RU",
    t: (text: string) => translate(text, language),
  }
}
export function LanguageSelect({ id = "language" }: { id?: string }) {
  const { language, setLanguage, t } = useI18n()
  return (
    <NativeSelect
      id={id}
      aria-label={t("Язык")}
      value={language}
      onChange={(event) =>
        setLanguage(event.target.value === "en" ? "en" : "ru")
      }
    >
      <NativeSelectOption value="ru">Русский</NativeSelectOption>
      <NativeSelectOption value="en">English</NativeSelectOption>
    </NativeSelect>
  )
}
