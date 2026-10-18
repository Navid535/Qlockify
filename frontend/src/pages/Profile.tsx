import { useEffect, useState, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "../hooks/useTranslation"
import { 
  getUserProfile, 
  updateUserProfile, 
  updateProfilePicture, 
  removeProfilePicture,
  changePassword,
} from "../api/users"
import { Button } from "../components/ui/button"
import { Camera, Edit2, Trash2, User as UserIcon, UploadCloud, X, Check } from "lucide-react"
import JalaliDatePicker from "../components/ui/JalaliDatePicker"
import { toast } from "sonner"
import { Modal } from "../components/Modal"
import { Input } from "../components/ui/input"
import { TextAreaInput } from "../components/ui/TextAreaInput"
import { AuthPasswordField } from "./auth/AuthPasswordField"
import { getPasswordValidationMessage } from "./auth/utils"

export interface UserProfile {
  id?: string;
  email?: string;
  mobile?: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  description?: string;
  birth_date?: string;
  age?: number;
  profile_picture?: string;
  date_joined?: string;
  created_at?: string;
}

export default function Profile() {
  const navigate = useNavigate()
  const [user, setUser] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const { t, lang } = useTranslation()
  const isFa = lang === 'fa'
  const passwordCopy = t.profile.password
  
  const toPersianNum = (num: string | number | undefined | null) => {
    if (num === null || num === undefined) return num
    if (!isFa) return num
    return num.toString().replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d as any])
  }

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return "-"
    try {
      const date = new Date(dateStr)
      return new Intl.DateTimeFormat(isFa ? 'fa-IR' : 'en-US', {
        dateStyle: 'long',
        timeZone: 'Asia/Tehran'
      }).format(date)
    } catch (e) {
      return dateStr
    }
  }

  // Modals & Editing state
  const [isEditing, setIsEditing] = useState(false)
  const [isPicModalOpen, setIsPicModalOpen] = useState(false)
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Form states
  const [formData, setFormData] = useState<Partial<UserProfile>>({})
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })

  const fetchProfile = async () => {
    try {
      const data = await getUserProfile()
      setUser(data)
    } catch (error) {
      navigate("/auth")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchProfile()
  }, [])

  const handleEditClick = () => {
    if (user) {
      setFormData({
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        email: user.email || "",
        description: user.description || "",
        birth_date: user.birth_date || "",
      })
      setIsEditing(true)
    }
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setFormData({})
  }

  const handleSaveProfile = async () => {
    setIsSaving(true)
    try {
      const payload: Record<string, any> = {}
      
      Object.entries(formData).forEach(([key, value]) => {
        if (key === "birth_date" && value === "") {
          payload[key] = null 
        } else if (value !== undefined && value !== null) {
          payload[key] = value
        }
      })
      
      const updatedUser = await updateUserProfile(payload)
      setUser(prev => prev ? { ...prev, ...updatedUser } : updatedUser)
      setIsEditing(false)

      window.dispatchEvent(new CustomEvent('profile_updated', { detail: updatedUser }));
      toast.success(t.profile.toasts.successEdit)
    } catch (error) {
      toast.error(t.profile.toasts.error)
      console.error("Failed to update profile", error)
    } finally {
      setIsSaving(false)
    }
  }

  const handlePictureUpload = async () => {
    if (!selectedFile) return
    setIsSaving(true)
    try {
      const response = await updateProfilePicture(selectedFile)
      setUser(prev => prev ? { ...prev, profile_picture: response.profile_picture } : response)
      setIsPicModalOpen(false)
      setSelectedFile(null)

      window.dispatchEvent(new CustomEvent('profile_updated', { detail: { profile_picture: response.profile_picture || null } }));
      toast.success(t.profile.toasts.successImage)
    } catch (error) {
      toast.error(t.profile.toasts.error)
      console.error("Failed to upload picture", error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeletePicture = async () => {
    setIsSaving(true)
    try {
      const response = await removeProfilePicture()
      setUser(prev => prev ? { ...prev, profile_picture: response.profile_picture || null } : response)
      setIsPicModalOpen(false)
      window.dispatchEvent(new CustomEvent('profile_updated', { detail: { profile_picture: response.profile_picture || null } }));
      toast.success(t.profile.toasts.successRemoveImage)
    } catch (error) {
      toast.error(t.profile.toasts.error)
      console.error("Failed to delete picture", error)
    } finally {
      setIsSaving(false)
    }
  }

  const resetPasswordForm = () => {
    setPasswordForm({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    })
  }

  const handleChangePassword = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      toast.error(t.login.toasts.fillAll)
      return
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error(t.login.passwordMismatch)
      return
    }

    const passwordValidationMessage = getPasswordValidationMessage(passwordForm.newPassword, t.login)
    if (passwordValidationMessage) {
      toast.error(passwordValidationMessage)
      return
    }

    if (passwordForm.currentPassword === passwordForm.newPassword) {
      toast.error(t.login.passwordReuse)
      return
    }

    setIsSaving(true)
    try {
      await changePassword(
        passwordForm.currentPassword,
        passwordForm.newPassword,
        passwordForm.confirmPassword,
      )
      resetPasswordForm()
      setIsPasswordModalOpen(false)
      toast.success(passwordCopy.toasts.success)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : passwordCopy.toasts.error)
    } finally {
      setIsSaving(false)
    }
  }

  // Drag & Drop Handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0])
    }
  }

  if (isLoading) {
    return (
      <>
        <div className="flex min-h-[calc(100vh-73px)] items-center justify-center bg-slate-50 dark:bg-slate-950 transition-colors">
          <div className="text-slate-500 dark:text-slate-400">Loading...</div>
        </div>
      </>
    )
  }

  if (!user) return null

  return (
    <>
      <div className="min-h-[calc(100vh-73px)] bg-slate-50 dark:bg-slate-950 p-6 transition-colors">
        <div className="mx-auto max-w-3xl space-y-6">
          
          {/* Header Card */}
          <div className="flex flex-col md:flex-row items-center gap-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
            
            <div className="relative group cursor-pointer" onClick={() => setIsPicModalOpen(true)}>
              <div className="h-24 w-24 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center border-4 border-white dark:border-slate-900 shadow-sm">
                {user.profile_picture ? (
                  <img src={user.profile_picture} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  <UserIcon className="h-10 w-10 text-slate-400" />
                )}
              </div>
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="h-6 w-6 text-white" />
              </div>
            </div>

            <div className="flex-1 text-center md:text-start">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                                {user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : user.first_name || user.last_name || "-"}
              </h1>
              <p className="text-slate-500 dark:text-slate-400 mt-1">{user.email || "-"}</p>
            </div>
          </div>

          {/* Details Card */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
            
            {/* Header with Title and Edit Button */}
            <div className="flex items-center justify-between mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {t.profile?.title || 'Personal Information'}
              </h2>
              
              {!isEditing && (
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => setIsPasswordModalOpen(true)}>
                    {passwordCopy.trigger}
                  </Button>
                  <Button onClick={handleEditClick}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Row 1: First Name | Last Name */}
              <div className="space-y-1">
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{t.profile?.firstName || 'First Name'}</span>
                {isEditing ? (
                  <Input
                    type="text"
                    value={formData.first_name || ""}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    disabled={isSaving}
                    className="mt-1 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="font-medium text-slate-900 dark:text-slate-100 min-h-[38px] flex items-center">{user.first_name || "-"}</p>
                )}
              </div>

              <div className="space-y-1">
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{t.profile?.lastName || 'Last Name'}</span>
                {isEditing ? (
                  <Input
                    type="text"
                    value={formData.last_name || ""}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    disabled={isSaving}
                    className="mt-1 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="font-medium text-slate-900 dark:text-slate-100 min-h-[38px] flex items-center">{user.last_name || "-"}</p>
                )}
              </div>

              {/* Row 2: Mobile | Email */}
              <div className="space-y-1">
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{t.profile?.mobileNumber || 'Mobile'}</span>
                <p className="font-medium text-slate-900 dark:text-slate-100 min-h-[38px] flex items-center">
                  {toPersianNum(user.mobile)}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{t.profile?.email || 'Email'}</span>
                {isEditing ? (
                  <Input
                    type="email"
                    value={formData.email || ""}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    disabled={isSaving}
                    dir="ltr"
                    className="mt-1 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="font-medium text-slate-900 dark:text-slate-100 min-h-[38px] flex items-center">{user.email || "-"}</p>
                )}
              </div>

              {/* Row 3: Birth Date | Date Joined */}
              <div className="space-y-1">
                {isEditing ? (
                  <div className="pt-1">
                    <JalaliDatePicker
                      label={t.profile?.birthDate || 'Birth Date'}
                      value={formData.birth_date}
                      onChange={(date) => setFormData({ ...formData, birth_date: date })}
                      disabled={isSaving}
                    />
                  </div>
                ) : (
                  <>
                    <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{t.profile?.birthDate || 'Birth Date'}</span>
                    <p className="font-medium text-slate-900 dark:text-slate-100 min-h-[38px] flex items-center">
                      {formatDate(user.birth_date)} {user.age ? `(${toPersianNum(user.age)} ${t.profile?.yearsOld || 'years'})` : ""}
                    </p>
                  </>
                )}
              </div>

              <div className="space-y-1">
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{t.profile?.dateJoined || 'Date Joined'}</span>
                <p className="font-medium text-slate-900 dark:text-slate-100 min-h-[38px] flex items-center">
                  {formatDate(user.date_joined || user.created_at)}
                </p>
              </div>

              {/* Row 4: Description (Full Width) */}
              <div className="space-y-1 md:col-span-2">
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{t.profile?.description || 'Description'}</span>
                {isEditing ? (
                  <TextAreaInput
                    rows={4}
                    value={formData.description || ""}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    disabled={isSaving}
                    className="mt-1 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                  />
                ) : (
                  <p className="font-medium text-slate-900 dark:text-slate-100 whitespace-pre-wrap mt-1">{user.description || "-"}</p>
                )}
              </div>
            </div>

            {/* Save/Cancel Buttons at Bottom (Visible only when editing) */}
            {isEditing && (
              <div className="mt-8 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end items-center gap-3">
                <Button variant="outline" onClick={handleCancelEdit} disabled={isSaving} className="flex items-center gap-2">
                  <X className="h-4 w-4" />
                  {t.actions?.cancel || 'Cancel'}
                </Button>
                <Button onClick={handleSaveProfile} disabled={isSaving} className="flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700">
                  <Check className="h-4 w-4" />
                  {isSaving ? "Saving..." : (t.profile?.save || 'Save')}
                </Button>
              </div>
            )}

          </div>

        </div>

        {/* Profile Picture Modal */}
        {isPicModalOpen && (
        <Modal
          isOpen={isPicModalOpen}
          isFa={isFa}
          onClose={() => !isSaving && setIsPicModalOpen(false)}
          title={t.profile?.changePicture || 'Profile Picture'}
          maxWidth="max-w-sm"
          footer={
            <Button 
              variant="outline" 
              onClick={() => setIsPicModalOpen(false)} 
              disabled={isSaving}
            >
              {t.actions?.cancel || 'Cancel'}
            </Button>
          }
        >
          <div className="space-y-4">
            {/* Drag and Drop Zone */}
            <div 
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
                dragActive 
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" 
                  : "border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/80"
              }`}
            >
              <Input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              />
              
              {selectedFile ? (
                <div className="absolute inset-0 p-2">
                  <img 
                    src={URL.createObjectURL(selectedFile)} 
                    alt="Preview" 
                    className="w-full h-full object-contain rounded-lg" 
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center text-center p-4">
                  <UploadCloud className="h-10 w-10 text-slate-400 mb-2" />
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    { t.profile?.imageInput }
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    SVG, PNG, JPG (MAX. 800x400px)
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 mt-4">
              <Button 
                onClick={handlePictureUpload} 
                disabled={!selectedFile || isSaving} 
                className="w-full"
              >
                {t.profile?.upload || 'Upload'}
              </Button>
              
              {user?.profile_picture && (
                <Button 
                  variant="destructive" 
                  onClick={handleDeletePicture} 
                  disabled={isSaving} 
                  className="w-full flex items-center justify-center gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  {t.profile?.remove || "Remove"}
                </Button>
              )}
            </div>
          </div>
        </Modal>
        )}

        {isPasswordModalOpen && (
          <Modal
            isOpen={isPasswordModalOpen}
            isFa={isFa}
            onClose={() => {
              if (isSaving) return
              setIsPasswordModalOpen(false)
              resetPasswordForm()
            }}
            title={passwordCopy.title}
            description={passwordCopy.description}
            maxWidth="max-w-md"
          >
            <form onSubmit={handleChangePassword} className="grid gap-4">
              <AuthPasswordField
                id="current-password"
                value={passwordForm.currentPassword}
                onChange={(value) => setPasswordForm((current) => ({ ...current, currentPassword: value }))}
                placeholder={passwordCopy.currentPassword}
                disabled={isSaving}
              />
              <AuthPasswordField
                id="new-password"
                value={passwordForm.newPassword}
                onChange={(value) => setPasswordForm((current) => ({ ...current, newPassword: value }))}
                placeholder={passwordCopy.newPassword}
                disabled={isSaving}
              />
              <AuthPasswordField
                id="confirm-password"
                value={passwordForm.confirmPassword}
                onChange={(value) => setPasswordForm((current) => ({ ...current, confirmPassword: value }))}
                placeholder={passwordCopy.confirmPassword}
                disabled={isSaving}
              />

              <div className="flex flex-col-reverse gap-3 mt-3 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsPasswordModalOpen(false)
                    resetPasswordForm()
                  }}
                  disabled={isSaving}
                >
                  {t.actions?.cancel || "Cancel"}
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? passwordCopy.saving : passwordCopy.submit}
                </Button>
              </div>
            </form>
          </Modal>
        )}

      </div>
    </>
  )
}
