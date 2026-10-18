import { Toaster as Sonner } from "sonner"
import { useTheme } from "../ThemeProvider"
import { useTranslation } from "../../hooks/useTranslation" 

export function Toaster() {
  const { theme } = useTheme()
  const { lang } = useTranslation()

  const isFa = lang === "fa"

  return (
    <Sonner
      theme={theme as "light" | "dark" | "system"}
      className="toaster group"
      richColors
      position={isFa ? "top-left" : "top-right"}
      dir={isFa ? "rtl" : "ltr"}
      closeButton
    />
  )
}
