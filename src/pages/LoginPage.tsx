import { useState } from 'react'
import type { FormEvent } from 'react'
import { Shield } from 'lucide-react'
import { useAuth } from '../store/AuthContext'
import { Button, Field, Input, Select } from '../components/ui'
import type { Role } from '../store/AuthContext'

export function LoginPage() {
  const { signIn } = useAuth()
  const [role, setRole] = useState<Role>('user')
  const [name, setName] = useState('')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    signIn(role, name)
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-slate-900 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-2xl font-extrabold text-white">
            IS
          </div>
          <h1 className="text-2xl font-bold text-white">IST Services</h1>
          <p className="mt-1 text-sm text-slate-400">Təlimatçıların tədris yükünün idarə edilməsi</p>
        </div>

        <form onSubmit={submit} className="rounded-2xl bg-white p-6 shadow-xl">
          <h2 className="mb-4 text-base font-bold text-slate-800">Sistemə giriş</h2>
          <div className="space-y-4">
            <Field label="İstifadəçi növü">
              <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
                <option value="user">İstifadəçi</option>
                <option value="admin">Administrator</option>
              </Select>
            </Field>
            <Field label="Ad Soyad">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Adınızı daxil edin" autoFocus />
            </Field>
            <Button type="submit" className="w-full">
              <Shield size={16} />
              Daxil ol
            </Button>
          </div>
          <p className="mt-4 text-center text-xs text-slate-400">
            Bu demo girişdir. Real təhlükəsizlik üçün Firebase Authentication və Security Rules tələb olunur
            (README-ə baxın).
          </p>
        </form>
      </div>
    </div>
  )
}
