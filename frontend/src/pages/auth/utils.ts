export const getPasswordValidationMessage = (password: string, _copy?: unknown) => {
  if (!password) return "Password is required."
  if (password.length < 8) return "Password must contain at least 8 characters."
  return ""
}
