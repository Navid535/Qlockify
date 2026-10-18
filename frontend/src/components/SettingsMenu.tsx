import { Moon, Sun } from "lucide-react"
import { Button } from "./ui/button"
import { useTheme } from "./ThemeProvider"

export function SettingsMenu() {
  const { theme, setTheme } = useTheme()

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="text-slate-900 dark:text-slate-50"
      title={theme === "dark" ? "Light Mode" : "Dark Mode"}
    >
      {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </Button>
  )
}
