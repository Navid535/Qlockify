import type { InputHTMLAttributes } from "react"

import { Input } from "../../components/ui/input"

type AuthPasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> & {
  onChange?: (value: string) => void
}

export function AuthPasswordField({ onChange, ...props }: AuthPasswordFieldProps) {
  return <Input type="password" {...props} onChange={(event) => onChange?.(event.target.value)} />
}
