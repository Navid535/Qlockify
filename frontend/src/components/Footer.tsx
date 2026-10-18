import { API_BASE_URL } from "../config/constants"

const backendOrigin = (() => {
  try {
    return new URL(API_BASE_URL).origin
  } catch {
    return "http://localhost:8000"
  }
})()

const phaseOneLinks = [
  { label: "Home", href: `${backendOrigin}/` },
  { label: "About", href: `${backendOrigin}/about/` },
  { label: "Status", href: `${backendOrigin}/status/` },
  { label: "Dashboard", href: `${backendOrigin}/dashboard/` },
  { label: "Sign in", href: "/auth" },
  { label: "Terms", href: "/terms" },
]

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t border-slate-200 bg-slate-50 px-6 py-16 text-slate-700 transition-colors dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-14">
        <div className="space-y-7 text-center">
          <p className="text-sm font-semibold tracking-[0.22em] text-slate-500 dark:text-slate-400">NAVIGATE</p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-[1.03rem]">
            {phaseOneLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="text-slate-700 transition-colors hover:text-blue-700 dark:text-slate-200 dark:hover:text-blue-300"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>

        <div className="grid gap-5 text-sm text-slate-600 md:grid-cols-3 md:items-end dark:text-slate-300">
          <div className="text-center md:text-left">
            <p className="opacity-80">Built for focused teams</p>
            <p className="mt-1 font-semibold tracking-[0.18em] text-slate-900 dark:text-white">QUERA CLOCK</p>
          </div>
          <div className="flex justify-center">
            <img
              src="https://avatars.githubusercontent.com/u/19687772?s=200&v=4"
              alt="Quera"
              className="h-14 w-14 rounded-full border border-slate-300/80 object-cover shadow-sm dark:border-slate-700"
              loading="lazy"
            />
          </div>
          <div className="text-center md:text-right">
            <p>© {currentYear} Quera Clock — All rights reserved</p>
            <p className="mt-1 opacity-80">Time tracking for modern workspaces</p>
          </div>
        </div>
      </div>
    </footer>
  )
}
