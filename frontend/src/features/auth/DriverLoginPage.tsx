import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useDriverAuth } from '@/auth/DriverAuthContext'
import { ApiClientError } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const schema = z.object({
  mobile: z.string().min(1, 'Mobile is required'),
  password: z.string().min(1, 'Password is required'),
})
type FormValues = z.infer<typeof schema>

export default function DriverLoginPage() {
  const { login } = useDriverAuth()
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function onSubmit(values: FormValues) {
    setServerError(null)
    try {
      await login(values.mobile, values.password)
      navigate('/driver', { replace: true })
    } catch (err) {
      setServerError(err instanceof ApiClientError ? err.message : 'Login failed.')
    }
  }

  return (
    <div className="flex flex-col min-h-svh items-center justify-center font-sans relative overflow-hidden p-4">
      {/* Minimal Professional Background with Subtle Indigo Glow */}
      <div className="fixed inset-0 z-0 bg-[#0a0a0a]" />
      <div className="fixed inset-0 z-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.15),rgba(0,0,0,0))]" />

      <div className="relative z-10 w-full max-w-sm animate-fadeInUp">
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-xl text-white drop-shadow-sm">NewsTrack Driver</CardTitle>
            <CardDescription className="text-white/70">Sign in with your mobile number.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="mobile" className="text-white/80 font-medium">Mobile</Label>
                <Input id="mobile" inputMode="tel" autoComplete="username" {...register('mobile')} />
                {errors.mobile && (
                  <p className="text-sm text-error">{errors.mobile.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-white/80 font-medium">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  {...register('password')}
                />
                {errors.password && (
                  <p className="text-sm text-error">{errors.password.message}</p>
                )}
              </div>
              {serverError && <p className="text-sm text-error">{serverError}</p>}
              <Button type="submit" className="w-full shadow-[0_4px_14px_0_rgba(0,112,235,0.2)]" disabled={isSubmitting}>
                {isSubmitting ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>
            <p className="mt-6 text-center text-sm text-white/70">
              <Link to="/login" className="underline underline-offset-4 text-white hover:text-primary transition-colors">
                Operations console sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
