import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { fetchWorkspaces, createWorkspace, type Workspace } from "../api/workspaces"
import { useTranslation } from "../hooks/useTranslation"
import { isRateLimitActive } from "../lib/rateLimit"
import { toast } from "sonner"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"

interface WorkspaceContextType {
  workspaces: Workspace[]
  activeWorkspace: Workspace | null
  setActiveWorkspace: (workspace: Workspace | null) => void
  addWorkspace: (name: string) => Promise<void>
  refreshWorkspaces: () => Promise<void>
  isLoading: boolean
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined)

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext)
  if (!context) throw new Error("useWorkspace must be used within a WorkspaceProvider")
  return context
}

export const useOptionalWorkspace = () => useContext(WorkspaceContext)

export const WorkspaceProvider = ({ children }: { children: ReactNode }) => {
  const { t } = useTranslation()
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [activeWorkspace, setActiveWorkspaceState] = useState<Workspace | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [newWorkspaceName, setNewWorkspaceName] = useState("")
  const [isCreatingFirst, setIsCreatingFirst] = useState(false)

  const isAuthenticated = !!localStorage.getItem("accessToken")
  const rateLimited = isRateLimitActive()

  const refreshWorkspaces = async () => {
    if (!isAuthenticated || isRateLimitActive()) {
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      const response = await fetchWorkspaces()

      const data = Array.isArray(response) ? response : (response?.results || [])
      setWorkspaces(data)

      if (data.length > 0) {
        const storedId = localStorage.getItem("activeWorkspaceId")
        const stored = data.find((w: Workspace) => w.id === storedId)
        if (stored) {
          setActiveWorkspaceState(stored)
        } else {
          setActiveWorkspaceState(data[0])
          localStorage.setItem("activeWorkspaceId", data[0].id)
        }
      } else {
        setActiveWorkspaceState(null)
        localStorage.removeItem("activeWorkspaceId")
      }
    } catch (error) {
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!isAuthenticated || rateLimited) {
      setIsLoading(false)
      return
    }

    void refreshWorkspaces()
  }, [isAuthenticated, rateLimited])

  const setActiveWorkspace = (workspace: Workspace | null) => {
    setActiveWorkspaceState(workspace)
    if (workspace) {
      localStorage.setItem("activeWorkspaceId", workspace.id)
    } else {
      localStorage.removeItem("activeWorkspaceId")
    }
  }

  const addWorkspace = async (name: string) => {
    try {
      setIsCreatingFirst(true)
      const newWs = await createWorkspace({ name, description: "" }) 
      setWorkspaces((prev) => [...prev, newWs])
      setActiveWorkspace(newWs)
      toast.success(t.workspace?.successCreate || t.workspace?.toast?.successCreate || "Workspace created!")
    } catch (error) {
      toast.error(t.workspace?.toast?.errorCreate || "Failed to create workspace")
      throw error
    } finally {
      setIsCreatingFirst(false)
      setNewWorkspaceName("")
    }
  }

  return (
    <WorkspaceContext.Provider
      value={{ workspaces, activeWorkspace, setActiveWorkspace, addWorkspace, refreshWorkspaces, isLoading }}
    >
      {children}
    </WorkspaceContext.Provider>
  )
}
