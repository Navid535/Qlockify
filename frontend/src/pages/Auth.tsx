import { Command, Loader2 } from "lucide-react"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"

import { loginWithPassword, registerWithPassword } from "../api/users"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { SettingsMenu } from "../components/SettingsMenu"
import { Footer } from "../components/Footer"
import { setSessionTokens } from "../lib/session"

export default function Auth() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<"login" | "signup">("login")
  const [mobile, setMobile] = useState("")
  const [password, setPassword] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [loading, setLoading] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!mobile || !password) {
      toast.error("Mobile and password are required.")
      return
    }
    setLoading(true)
    try {
      const data =
        mode === "login"
          ? await loginWithPassword(mobile, password)
          : await registerWithPassword({ mobile, password, first_name: firstName, last_name: lastName })
      if (data.access && data.refresh) {
        setSessionTokens(data.access, data.refresh)
      }
      toast.success(mode === "login" ? "Signed in successfully." : "Account created successfully.")
      navigate("/timesheet")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Authentication failed.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white transition-colors dark:bg-slate-950">
      <div className="container relative grid min-h-[calc(100vh-64px)] flex-col items-center justify-center lg:max-w-none lg:grid-cols-2 lg:px-0">
        <div className="absolute inset-e-4 top-4 z-50 md:inset-e-8 md:top-8">
          <SettingsMenu />
        </div>

        <div className="relative hidden h-full flex-col border-e border-slate-200 bg-slate-900 p-10 text-white dark:border-slate-800 dark:bg-slate-900/50 lg:flex">
          <div className="relative z-20 flex items-center gap-2 text-lg font-medium">
            <Command className="h-6 w-6" />
            Quera Clock
          </div>
          <div className="relative z-20 mt-auto">
            <blockquote className="space-y-2">
              <p className="text-lg">Track work time inside clear, simple workspaces.</p>
            </blockquote>
          </div>
        </div>

        <div className="flex h-full items-center justify-center p-8 lg:p-8">
          <div className="mx-auto flex w-full max-w-[26rem] flex-col justify-center">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                {mode === "login" ? "Sign in" : "Create account"}
              </h1>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Use your mobile number and password to continue.
              </p>
              <form onSubmit={submit} className="mt-6 grid gap-4">
                {mode === "signup" && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input value={firstName} onChange={(event) => setFirstName(event.target.value)} placeholder="First name" />
                    <Input value={lastName} onChange={(event) => setLastName(event.target.value)} placeholder="Last name" />
                  </div>
                )}
                <Input value={mobile} onChange={(event) => setMobile(event.target.value)} placeholder="Mobile number" />
                <Input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" type="password" />
                <Button type="submit" className="h-11 w-full" disabled={loading}>
                  {loading && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                  {mode === "login" ? "Sign in" : "Create account"}
                </Button>
                <button type="button" className="text-sm font-medium text-blue-600 hover:text-blue-500" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
                  {mode === "login" ? "Create a new account" : "Already have an account? Sign in"}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
