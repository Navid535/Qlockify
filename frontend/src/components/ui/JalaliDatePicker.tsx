import { useEffect, useState } from "react"
import DatePicker, { DateObject } from "react-multi-date-picker"
import gregorian from "react-date-object/calendars/gregorian"
import gregorian_en from "react-date-object/locales/gregorian_en"
import "react-multi-date-picker/styles/backgrounds/bg-dark.css"

interface AppDatePickerProps {
  value: string | null | undefined
  onChange: (date: string) => void
  label?: string
  disabled?: boolean
  inputClassName?: string
  placeholder?: string
  calendarPosition?: string
}

export default function JalaliDatePicker({
  value,
  onChange,
  label,
  disabled,
  inputClassName = "",
  placeholder,
  calendarPosition = "bottom-right",
}: AppDatePickerProps) {
  const [isDark, setIsDark] = useState(document.documentElement.classList.contains("dark"))

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"))
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
    return () => observer.disconnect()
  }, [])

  const handleChange = (date: DateObject | null) => {
    onChange(date ? date.convert(gregorian, gregorian_en).format("YYYY-MM-DD") : "")
  }

  return (
    <div className="w-full">
      {label && <label className="mb-1 block text-sm font-medium dark:text-slate-300">{label}</label>}
      <DatePicker
        value={value ? new Date(value) : null}
        onChange={handleChange}
        calendar={gregorian}
        locale={gregorian_en}
        format="YYYY/MM/DD"
        placeholder={placeholder || "YYYY/MM/DD"}
        onOpenPickNewDate={false}
        inputClass={`w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed ${inputClassName}`}
        containerClassName="w-full"
        className={isDark ? "bg-dark" : ""}
        calendarPosition={calendarPosition}
        fixMainPosition
        disabled={disabled}
      />
    </div>
  )
}
