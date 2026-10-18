import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "../hooks/useTranslation"
import { Button } from "./ui/button"
import { SettingsMenu } from "./SettingsMenu"
import { LogOut, User, Moon, Sun, Command, Menu } from "lucide-react"
import { useTheme } from "./ThemeProvider"
import { logoutUser, getUserProfile } from "../api/users"
import { WorkspaceSelector } from "./WorkspaceSelector"
import { toast } from "sonner"
import { NotificationBell } from "./notifications/NotificationBell"
import { clearSessionTokens, getAccessToken, getRefreshToken } from "../lib/session"
import { stageEnabled } from "../config/stages"

type NavbarProps = {
  onOpenSidebar?: () => void
}

export function Navbar({ onOpenSidebar }: NavbarProps) {
  const { t } = useTranslation()
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()

  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [user, setUser] = useState<any>(null)

  const dropdownRef = useRef<HTMLDivElement>(null)

  const isDarkMode =
    theme === "dark" ||
    (theme === "system" && document.documentElement.classList.contains("dark"))

  useEffect(() => {
    const handleProfileUpdated = ((e: CustomEvent) => {
      if (e.detail) {
        setUser((prev: any) => (prev ? { ...prev, ...e.detail } : e.detail))
      }
    }) as EventListener

    window.addEventListener("profile_updated", handleProfileUpdated)
    return () => window.removeEventListener("profile_updated", handleProfileUpdated)
  }, [])

  useEffect(() => {
    const fetchUser = async () => {
      const token = getAccessToken()
      if (!token) return

      try {
        const userData = await getUserProfile()
        setUser(userData)
      } catch (error) {
        console.error("Failed to fetch user profile:", error)
      }
    }

    void fetchUser()
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleLogout = async () => {
    try {
      const refreshToken = getRefreshToken()
      if (refreshToken) {
        await logoutUser(refreshToken)
      }
    } catch (error) {
      console.error("Logout API failed:", error)
    } finally {
      clearSessionTokens()
      setUser(null)
      setShowLogoutModal(false)
      toast.success(t.logoutToast || "Successfully logged out!")
      navigate("/auth")
    }
  }

  const toggleTheme = () => {
    setTheme(isDarkMode ? "light" : "dark")
  }

  return (
    <>
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-slate-200/80 bg-white/70 px-4 py-4 backdrop-blur-md transition-colors md:px-8 md:py-6 dark:border-slate-800/80 dark:bg-slate-900/70">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenSidebar}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100 md:hidden dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
            title="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div
            className="flex cursor-pointer items-center gap-2"
            onClick={() => navigate("/")}
          >
            <span className="relative z-20 flex items-center gap-2 text-lg font-bold tracking-tight text-slate-900 md:text-xl dark:text-slate-50">
              <Command className="h-6 w-6 md:h-7 md:w-7" />
              Quera Clock
            </span>
          </div>
        </div>

        {/* Mobile navbar: theme toggle + notification bell */}
        <div className="flex items-center gap-2 md:hidden">
          <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            title={isDarkMode ? t.lightMode || "Light Mode" : t.darkMode || "Dark Mode"}
          >
            {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>

          {user && stageEnabled("5-notifications") && <NotificationBell />}
        </div>

        {/* Desktop navbar: keep the old controls here */}
        <div className="hidden items-center gap-4 md:flex">
          {user && stageEnabled("9-workspaces") && <WorkspaceSelector />}

          {user ? (
            <>
              {stageEnabled("5-notifications") && <NotificationBell />}

              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setIsDropdownOpen((current) => !current)}
                  className="h-12 w-12 overflow-hidden rounded-full border-2 border-slate-200 transition-all hover:border-blue-500 focus:outline-none dark:border-slate-700 dark:hover:border-blue-500"
                >
                  {user.profile_picture ? (
                    <img
                      src={user.profile_picture}
                      alt="Profile"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-slate-100 text-sm font-bold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {user.first_name?.[0] || user.email?.[0] || "U"}
                    </div>
                  )}
                </button>

                {isDropdownOpen && (
                  <div
                    className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white py-2 shadow-lg ring-[0.1px] ring-black ring-opacity-5 dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div className="mb-2 border-b border-slate-100 px-4 py-2 dark:border-slate-800">
                      <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-400">
                        {user.first_name || user.last_name
                          ? `${user.first_name || ""} ${user.last_name || ""}`.trim()
                          : user.email}
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        navigate("/profile")
                        setIsDropdownOpen(false)
                      }}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <User className="h-4 w-4" />
                      <span>{t.profile?.title || "Profile"}</span>
                    </button>

                    <button
                      onClick={toggleTheme}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      {isDarkMode ? (
                        <Sun className="h-4 w-4" />
                      ) : (
                        <Moon className="h-4 w-4" />
                      )}
                      <span>
                        {isDarkMode
                          ? t.lightMode || "Light Mode"
                          : t.darkMode || "Dark Mode"}
                      </span>
                    </button>

                    <div className="my-1 h-px bg-slate-200 dark:bg-slate-800" />

                    <button
                      onClick={() => {
                        setShowLogoutModal(true)
                        setIsDropdownOpen(false)
                      }}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-500 dark:hover:bg-red-950/50"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>{t.logout || "Logout"}</span>
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <SettingsMenu />

              <Button
                onClick={() => navigate("/auth")}
                className="bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700"
              >
                {t.login?.signIn || "Login"}
              </Button>
            </>
          )}
        </div>
      </header>

      {showLogoutModal && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 px-4"
          onClick={() => setShowLogoutModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-lg border bg-white p-6 shadow-lg dark:border-slate-800 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-2 text-lg font-bold text-slate-900 dark:text-white">
              {t.confirmLogoutTitle || "Confirm Logout"}
            </h2>

            <p className="mb-6 text-slate-600 dark:text-slate-400">
              {t.confirmLogoutMessage ||
                "Are you sure you want to log out of your account?"}
            </p>

            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setShowLogoutModal(false)}
                className="dark:text-white"
              >
                {t.actions?.cancel || "Cancel"}
              </Button>

              <Button
                variant="destructive"
                onClick={handleLogout}
                className="bg-red-500 text-white hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700"
              >
                {t.logout || "Logout"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
