import { createBrowserRouter, Navigate, Outlet, RouterProvider } from "react-router-dom"
import { useState } from "react"
import { ThemeProvider } from "./components/ThemeProvider"
import { Toaster } from "./components/ui/toaster"
import { Navbar } from "./components/Navbar"
import { Sidebar } from "./components/Sidebar"
import { NotificationsProvider } from "./context/NotificationsContext"
import { WorkspaceProvider } from "./context/WorkspaceContext"
import Auth from "./pages/Auth"
import Profile from "./pages/Profile"
import Terms from "./pages/Terms"
import Workspaces from "./pages/Workspaces"
import CreateWorkspace from "./pages/WorkspaceCreate"
import WorkspaceDetail from "./pages/WorkspaceDetail"
import EditWorkspace from "./pages/WorkspaceEdit"
import Clients from "./pages/Clients"
import { Projects } from "./pages/Projects"
import ProjectCreate from "./pages/ProjectCreate"
import ProjectEdit from "./pages/ProjectEdit"
import Tags from "./pages/Tags"
import Timesheet from "./pages/Timesheet"
import NotificationsPage from "./pages/Notifications"
import Landing from "./pages/Landing"
import { fallbackPathForStage, stageEnabled, type StageName } from "./config/stages"
import RateLimitPage from "./pages/RateLimit"

const MainLayout = () => {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden text-slate-900 dark:text-slate-100">
      <Sidebar mobileOpen={mobileSidebarOpen} onMobileClose={() => setMobileSidebarOpen(false)} />
      <div className="flex-1 flex flex-col h-screen overflow-y-auto relative">
        <Navbar onOpenSidebar={() => setMobileSidebarOpen(true)} />
        <main className="flex-1 relative">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

const AppRedirect = () => {
  const isAuthenticated = !!localStorage.getItem("accessToken")
  return isAuthenticated ? <Navigate to={fallbackPathForStage()} replace /> : <Navigate to="/auth" replace />
}

const enabledRoute = (stage: StageName, element: React.ReactElement) =>
  stageEnabled(stage) ? element : <Navigate to={fallbackPathForStage()} replace />

const router = createBrowserRouter([
  {
    element: (
      <WorkspaceProvider>
        <Outlet />
      </WorkspaceProvider>
    ),
    children: [
      { path: "/", element: <Landing /> },
      { path: "/app", element: <AppRedirect /> },
      { path: "/auth", element: <Auth /> },
      { path: "/terms", element: <Terms /> },
      { path: "/rate-limit", element: <RateLimitPage /> },
      {
        element: <MainLayout />,
        children: [
          { path: "/profile", element: <Profile /> },
          { path: "/timesheet", element: enabledRoute("13-time-tracking", <Timesheet />) },
          { path: "/notifications", element: enabledRoute("5-notifications", <NotificationsPage />) },
          { path: "/tags", element: enabledRoute("11-tags", <Tags />) },
          { path: "/workspaces", element: enabledRoute("9-workspaces", <Workspaces />) },
          { path: "/workspaces/create", element: enabledRoute("9-workspaces", <CreateWorkspace />) },
          { path: "/workspaces/:id", element: enabledRoute("9-workspaces", <WorkspaceDetail />) },
          { path: "/workspaces/:id/edit", element: enabledRoute("9-workspaces", <EditWorkspace />) },
          { path: "/clients", element: enabledRoute("10-clients", <Clients />) },
          { path: "/projects", element: enabledRoute("12-projects", <Projects />) },
          { path: "/projects/create", element: enabledRoute("12-projects", <ProjectCreate />) },
          { path: "/projects/:id/edit", element: enabledRoute("12-projects", <ProjectEdit />) },
        ],
      },
    ],
  },
])

function App() {
  return (
    <ThemeProvider>
      <NotificationsProvider>
        <RouterProvider router={router} />
      </NotificationsProvider>
      <Toaster />
    </ThemeProvider>
  )
}

export default App
