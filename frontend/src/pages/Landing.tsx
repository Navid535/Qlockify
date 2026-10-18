import { ArrowRight, Clock3, Layers3, Moon, ShieldCheck, Sun } from "lucide-react"
import { Link } from "react-router-dom"

import { useTheme } from "../components/ThemeProvider"
import { Button } from "../components/ui/button"
import { Footer } from "../components/Footer"

export default function Landing() {
  const { theme, setTheme } = useTheme()
  const isDarkMode =
    theme === "dark" ||
    (theme === "system" && document.documentElement.classList.contains("dark"))

  const toggleTheme = () => {
    setTheme(isDarkMode ? "light" : "dark")
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-slate-950 dark:text-white flex flex-col justify-between">
      <div className="mx-auto flex max-w-6xl flex-col gap-16 px-6 py-10">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-lg font-bold">
            <Clock3 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            Quera Clock
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-300 text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
            >
              {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <Button asChild className="bg-blue-500 hover:bg-blue-600">
              <Link to="/auth">Open app</Link>
            </Button>
          </div>
        </header>
        <main className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <section>
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.3em] text-blue-700 dark:text-blue-300">Time tracking for focused teams</p>
            <h1 className="text-5xl font-black tracking-tight md:text-7xl">Track time, organize work, and keep teams aligned.</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">
              Quera Clock is a simplified Clockify-style workspace where teams can create workspaces, manage clients and projects, track time, and follow activity from one clean interface.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-blue-500 hover:bg-blue-600">
                <Link to="/auth">
                  Start tracking
                  <ArrowRight className="ms-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-slate-300 bg-white text-slate-800 hover:bg-slate-100 dark:border-white/20 dark:bg-white/5 dark:text-white dark:hover:bg-white/10">
                <Link to="/terms">Read terms</Link>
              </Button>
            </div>
          </section>
          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl backdrop-blur dark:border-white/10 dark:bg-white/10">
            <div className="rounded-2xl bg-slate-100 p-5 dark:bg-slate-900">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm text-slate-500 dark:text-slate-400">Today</span>
                <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-semibold text-emerald-300">Live</span>
              </div>
              <div className="text-4xl font-bold">03:42:18</div>
              <div className="mt-6 grid gap-3">
                {["Website redesign", "Mobile planning", "Client meeting"].map((item, index) => (
                  <div key={item} className="flex items-center justify-between rounded-xl bg-white px-4 py-3 shadow-sm dark:bg-white/5 dark:shadow-none">
                    <span>{item}</span>
                    <span className="text-sm text-slate-500 dark:text-slate-400">{index + 1}h 20m</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </main>
        <section className="grid gap-4 md:grid-cols-3">
          {[
            { icon: Layers3, title: "Workspace structure", text: "Keep clients, projects, tags, and entries in the right workspace." },
            { icon: Clock3, title: "Fast timesheet", text: "Start a running timer or add manual entries for completed work." },
            { icon: ShieldCheck, title: "Simple roles", text: "Use owner, admin, and member roles without complex access screens." },
          ].map((item) => {
            const Icon = item.icon
            return (
              <article key={item.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none">
                <Icon className="mb-4 h-6 w-6 text-blue-600 dark:text-blue-300" />
                <h2 className="text-lg font-semibold">{item.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.text}</p>
              </article>
            )
          })}
        </section>
      </div>
      <Footer />
    </div>
  )
}
