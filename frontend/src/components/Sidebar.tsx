import { useEffect, useState } from "react"
import { NavLink, useNavigate } from "react-router-dom"
import {
  Briefcase,
  Clock3,
  LayoutDashboard,
  LogIn,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Tags,
  User,
  Users,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { getUserProfile, logoutUser } from "../api/users"
import { useOptionalWorkspace } from "../context/WorkspaceContext"
import { clearSessionTokens, getAccessToken, getRefreshToken } from "../lib/session"
import { WorkspaceSelector } from "./WorkspaceSelector"
import { Button } from "./ui/button"
import { stageEnabled, type StageName } from "../config/stages"

type SidebarProps = {
  mobileOpen?: boolean
  onMobileClose?: () => void
}

export const Sidebar = ({ mobileOpen = false, onMobileClose }: SidebarProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [user, setUser] = useState<any>(null)
  const navigate = useNavigate()
  const workspaceContext = useOptionalWorkspace()
  const activeWorkspace = workspaceContext?.activeWorkspace ?? null
  const ToggleIcon = isCollapsed ? PanelLeftOpen : PanelLeftClose

  useEffect(() => {
    const fetchUser = async () => {
      if (!getAccessToken()) return
      try {
        setUser(await getUserProfile())
      } catch (error) {
        console.error("Failed to fetch user profile:", error)
      }
    }
    void fetchUser()
  }, [])

  const handleLogout = async () => {
    try {
      const refreshToken = getRefreshToken()
      if (refreshToken) await logoutUser(refreshToken)
    } catch (error) {
      console.error("Logout API failed:", error)
    } finally {
      clearSessionTokens()
      setUser(null)
      setShowLogoutModal(false)
      onMobileClose?.()
      toast.success("Successfully logged out.")
      navigate("/auth")
    }
  }

  const navItems: Array<{ path: string; icon: typeof Clock3; label: string; stage: StageName }> = [
    { path: "/timesheet", icon: Clock3, label: "Timesheet", stage: "13-time-tracking" },
    { path: "/tags", icon: Tags, label: "Tags", stage: "11-tags" },
    { path: "/clients", icon: Users, label: "Clients", stage: "10-clients" },
    { path: "/projects", icon: Briefcase, label: "Projects", stage: "12-projects" },
    { path: "/workspaces", icon: LayoutDashboard, label: "Workspaces", stage: "9-workspaces" },
  ]

  const renderNavItems = (mobile = false) =>
    navItems.filter((item) => stageEnabled(item.stage)).map((item) => {
      const Icon = item.icon
      return (
        <NavLink
          key={`${mobile ? "mobile" : "desktop"}-${item.path}`}
          to={item.path}
          title={!mobile && isCollapsed ? item.label : undefined}
          onClick={() => mobile && onMobileClose?.()}
          className={({ isActive }) =>
            `flex items-center rounded-lg text-sm font-medium transition-colors ${
              mobile ? "gap-3 px-4 py-3" : isCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5"
            } ${
              isActive
                ? "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-900/50"
            }`
          }
        >
          <Icon size={mobile ? 20 : isCollapsed ? 22 : 18} className="shrink-0" />
          {(mobile || !isCollapsed) && <span className="truncate whitespace-nowrap">{item.label}</span>}
        </NavLink>
      )
    })

  const footer = user ? (
    <div className="space-y-1 p-4">
      <button onClick={() => navigate("/profile")} className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-900/50">
        <User size={20} />
        <span>Profile</span>
      </button>
      <button onClick={() => setShowLogoutModal(true)} className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-500 dark:hover:bg-red-950/50">
        <LogOut size={20} />
        <span>Logout</span>
      </button>
    </div>
  ) : (
    <div className="border-t border-slate-200 p-4 dark:border-slate-800">
      <Button onClick={() => navigate("/auth")} className="w-full bg-blue-600 text-white hover:bg-blue-700">
        <LogIn className="mr-2 h-4 w-4" />
        Login
      </Button>
    </div>
  )

  return (
    <>
      <aside className={`hidden h-screen shrink-0 flex-col border-e border-slate-200 bg-white transition-all duration-300 md:sticky md:top-0 md:flex dark:border-slate-800 dark:bg-slate-950 ${isCollapsed ? "w-20" : "w-64"}`}>
        <div className={`flex h-[73px] shrink-0 items-center border-b border-slate-200 dark:border-slate-800 ${isCollapsed ? "justify-center px-0" : "justify-between px-6"}`}>
          {!isCollapsed && <h2 className="truncate text-xl font-bold text-slate-800 dark:text-white">Quera Clock</h2>}
          <button onClick={() => setIsCollapsed(!isCollapsed)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800" title={isCollapsed ? "Expand" : "Collapse"}>
            <ToggleIcon size={20} />
          </button>
        </div>
        
        <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden p-4">{renderNavItems(false)}</nav>
      </aside>

      <div className={`fixed inset-0 z-[70] transition-all duration-200 md:hidden ${mobileOpen ? "pointer-events-auto" : "pointer-events-none"}`}>
        <button type="button" className={`absolute inset-0 bg-slate-950/50 backdrop-blur-[1px] transition-opacity ${mobileOpen ? "opacity-100" : "opacity-0"}`} onClick={onMobileClose} />
        <aside className={`absolute inset-y-0 left-0 flex w-[19.5rem] max-w-[88vw] flex-col overflow-hidden border-e border-slate-200 bg-white shadow-2xl transition-transform dark:border-slate-800 dark:bg-slate-950 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-5 dark:border-slate-800">
              <h2 className="truncate text-lg font-bold text-slate-800 dark:text-white">Quera Clock</h2>
              <button type="button" onClick={onMobileClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800" title="Close">
                <X size={20} />
              </button>
            </div>
            {activeWorkspace && stageEnabled("9-workspaces") && <div className="border-b border-slate-200 p-4 dark:border-slate-800"><WorkspaceSelector className="w-full" /></div>}
            <nav className="shrink-0 space-y-1 p-4">{renderNavItems(true)}</nav>
            <div className="mt-auto shrink-0">{footer}</div>
          </div>
        </aside>
      </div>

      {showLogoutModal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 px-4" onClick={() => setShowLogoutModal(false)}>
          <div className="w-full max-w-sm rounded-lg border bg-white p-6 shadow-lg dark:border-slate-800 dark:bg-slate-900" onClick={(event) => event.stopPropagation()}>
            <h2 className="mb-2 text-lg font-bold text-slate-900 dark:text-white">Confirm Logout</h2>
            <p className="mb-6 text-slate-600 dark:text-slate-400">Are you sure you want to log out of your account?</p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowLogoutModal(false)} className="dark:text-white">Cancel</Button>
              <Button variant="destructive" onClick={handleLogout} className="bg-red-500 text-white hover:bg-red-600">Logout</Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
