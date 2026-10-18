export const SESSION_CHANGED_EVENT = "auth_session_changed"

export const getAccessToken = () => localStorage.getItem("accessToken")

export const getRefreshToken = () => localStorage.getItem("refreshToken")

export const emitSessionChanged = () => {
  window.dispatchEvent(new Event(SESSION_CHANGED_EVENT))
}

export const setSessionTokens = (accessToken: string, refreshToken: string) => {
  localStorage.setItem("accessToken", accessToken)
  localStorage.setItem("refreshToken", refreshToken)
  emitSessionChanged()
}

export const clearSessionTokens = () => {
  localStorage.removeItem("accessToken")
  localStorage.removeItem("refreshToken")
  emitSessionChanged()
}
