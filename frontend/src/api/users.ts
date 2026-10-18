import { authFetch, buildApiError } from "./client"

const normalizeDigits = (value: string) => value.trim()

export const loginWithPassword = async (mobile: string, password: string) => {
  const response = await authFetch("/api/users/login/", {
    method: "POST",
    body: JSON.stringify({ mobile: normalizeDigits(mobile), password }),
  })
  if (!response.ok) throw await buildApiError(response)
  return response.json()
}

export const registerWithPassword = async (data: {
  mobile: string
  password: string
  first_name?: string
  last_name?: string
}) => {
  const response = await authFetch("/api/users/register/", {
    method: "POST",
    body: JSON.stringify({
      mobile: normalizeDigits(data.mobile),
      password: data.password,
      first_name: data.first_name || "",
      last_name: data.last_name || "",
    }),
  })
  if (!response.ok) throw await buildApiError(response)
  return response.json()
}

export const logoutUser = async (_refreshToken?: string | null) => {
  const response = await authFetch("/api/users/logout/", { method: "POST" })
  if (!response.ok && response.status !== 401) throw await buildApiError(response)
  return {}
}

export const getUserProfile = async () => {
  const response = await authFetch("/api/users/me/")
  if (!response.ok) throw await buildApiError(response)
  return response.json()
}

export const updateUserProfile = async (data: Record<string, unknown>) => {
  const response = await authFetch("/api/users/me/", {
    method: "PATCH",
    body: JSON.stringify(data),
  })
  if (!response.ok) throw await buildApiError(response)
  return response.json()
}

export const changePassword = async (
  oldPasswordOrData: string | { old_password: string; new_password: string; re_new_password?: string },
  newPassword?: string,
  reNewPassword?: string,
) => {
  const data =
    typeof oldPasswordOrData === "string"
      ? { old_password: oldPasswordOrData, new_password: newPassword || "", re_new_password: reNewPassword || "" }
      : oldPasswordOrData
  const response = await authFetch("/api/users/password/change/", {
    method: "POST",
    body: JSON.stringify(data),
  })
  if (!response.ok) throw await buildApiError(response)
  return response.json()
}

export const updateProfilePicture = async (file: File) => {
  const formData = new FormData()
  formData.append("profile_picture", file)
  const response = await authFetch("/api/users/profile/picture/", {
    method: "POST",
    body: formData,
  })
  if (!response.ok) throw await buildApiError(response)
  return response.json()
}

export const removeProfilePicture = async () => {
  const response = await authFetch("/api/users/profile/picture/", { method: "DELETE" })
  if (!response.ok) throw await buildApiError(response)
  return response.json()
}

export interface SearchedUser {
  id: string
  mobile: string
  first_name?: string
  last_name?: string
  email?: string
  profile_picture?: string | null
}

export const searchUserByExactMobile = async (mobile: string): Promise<SearchedUser | null> => {
  const response = await authFetch(`/api/users/search/?mobile=${encodeURIComponent(normalizeDigits(mobile))}`)
  if (response.status === 404) return null
  if (!response.ok) throw await buildApiError(response)
  return response.json()
}
