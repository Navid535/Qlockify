import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { AlertTriangle, Clock3 } from "lucide-react"
import { Button } from "../components/ui/button"
import { useTranslation } from "../hooks/useTranslation"
import {
  clearRateLimitLock,
  getRateLimitRemainingSeconds,
  getStoredRateLimitLock,
} from "../lib/rateLimit"

const PERSIAN_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"]

const toPersianDigits = (value: string) =>
  value.replace(/\d/g, (digit) => PERSIAN_DIGITS[Number.parseInt(digit, 10)] ?? digit)

export default function RateLimitPage() {
  const navigate = useNavigate()
  const { t, lang } = useTranslation()
  const isRtl = lang === "fa"

  const initialLock = getStoredRateLimitLock()
  const [returnTo] = useState(initialLock?.returnTo || "/")
  const [status] = useState(initialLock?.status ?? 429)
  const [message] = useState(initialLock?.message || t.rateLimit.message)
  const [remainingSeconds, setRemainingSeconds] = useState(getRateLimitRemainingSeconds(initialLock))

  useEffect(() => {
    if (!initialLock) {
      navigate(returnTo, { replace: true })
      return
    }

    const timer = window.setInterval(() => {
      const currentLock = getStoredRateLimitLock()
      setRemainingSeconds(getRateLimitRemainingSeconds(currentLock))
    }, 1000)

    return () => window.clearInterval(timer)
  }, [initialLock, navigate, returnTo])

  const localizedDigits = (value: string) => (isRtl ? toPersianDigits(value) : value)

  const countdown = useMemo(() => {
    const minutes = Math.floor(remainingSeconds / 60)
    const seconds = remainingSeconds % 60
    const base =
      minutes > 0
        ? `${minutes}:${seconds.toString().padStart(2, "0")}`
        : `${seconds}s`

    return localizedDigits(base)
  }, [isRtl, remainingSeconds])

  const handleContinue = () => {
    clearRateLimitLock()
    navigate(returnTo, { replace: true })
  }

  const isCoolingDown = remainingSeconds > 0

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-2xl items-center justify-center">
        <div className="w-full rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-10">
          <div className="mb-6 flex items-center justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
              <AlertTriangle className="h-8 w-8" />
            </div>
          </div>

          <div className="space-y-4 text-center">
            <p className="text-sm font-medium uppercase tracking-[0.3em] text-amber-600 dark:text-amber-300">
              {t.rateLimit.eyebrow}
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              {t.rateLimit.title}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 sm:text-base">
              {t.rateLimit.message}
            </p>
          </div>

          <div className="mt-8 grid gap-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-start dark:border-slate-800 dark:bg-slate-950/60">
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                <Clock3 className="h-4 w-4" />
                <p className="text-xs font-medium uppercase tracking-[0.2em]">
                  {t.rateLimit.cooldownLabel}
                </p>
              </div>
              <p className="mt-2 text-2xl font-semibold">
                {isCoolingDown ? countdown : t.rateLimit.ready}
              </p>
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-300">
            {isCoolingDown ? t.rateLimit.waitingMessage(countdown) : t.rateLimit.finishedMessage}
          </div>

          <div className="mt-8 flex justify-center">
            <Button
              onClick={handleContinue}
              disabled={isCoolingDown}
              className="h-11 min-w-52"
            >
              {isCoolingDown ? t.rateLimit.continueCooldown(countdown) : t.rateLimit.continue}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
