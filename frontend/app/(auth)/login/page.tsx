'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { auth } from '@/app/lib/api'
import { Eye, EyeOff } from 'lucide-react'
import { loginSchema, type LoginFormValues } from '@/app/lib/schemas'
import { FieldError } from '@/app/components/ui/field-error'

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const router = useRouter()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', password: '' },
  })

  const onSubmit = async (values: LoginFormValues) => {
    try {
      // Call the backend API
      const response = await auth.login(values.username, values.password)

      toast.success(`Welcome back, ${response.role}!`)

      // Redirect based on user role
      if (response.role === 'admin') {
        router.push('/admin')
      } else if (response.role === 'employee' || response.role === 'head_installation' || response.role === 'head_maintenance') {
        router.push('/employee')
      } else if (response.role === 'nursery') {
        router.push('/nursery')
      } else {
        router.push('/') // Fallback
      }
    } catch (error: unknown) {
      console.error('Login error:', error)
      toast.error(error instanceof Error && error.message ? error.message : 'Login failed. Please check your credentials.')
    }
  }

  return (
    <div 
      className="min-h-screen relative flex items-center justify-center px-4"
      style={{
        backgroundImage: 'url(/assets/login/scene.svg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-6">
        <img src="/assets/logo.svg" alt="Nursery ERP" className="h-12 w-auto cursor-pointer" />
      </div>

      {/* Login Card */}
      <div className="w-full max-w-md bg-[#9DB57E] rounded-3xl shadow-2xl p-10 mt-16">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#13452D] mb-2">
            Welcome Back
          </h1>
          <p className="text-white text-sm">Sign in to continue to Nursery ERP</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="username" className="block text-[#13452D] font-semibold text-sm">
              User name
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              aria-invalid={!!errors.username}
              {...register('username')}
              className="w-full h-12 px-4 rounded-lg border-2 border-[#13452D] focus:outline-none focus:ring-2 focus:ring-[#1F764D] transition-all text-black bg-amber-50"
              placeholder=""
            />
            <FieldError error={errors.username} />
          </div>
          
          <div className="space-y-2">
            <label htmlFor="password" className="block text-[#13452D] font-semibold text-sm">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                aria-invalid={!!errors.password}
                {...register('password')}
                className="w-full h-12 px-4 pr-12 rounded-lg border-2 border-[#13452D] focus:outline-none focus:ring-2 focus:ring-[#1F764D] transition-all text-black bg-amber-50"
                placeholder=""
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#13452D] hover:text-[#1F764D] transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            <FieldError error={errors.password} />
          </div>

          <button 
            type="submit" 
            className="w-full h-12 text-base font-bold bg-[#13452D] hover:bg-[#1F764D] text-white rounded-lg transition-all duration-300 uppercase tracking-wider cursor-pointer" 
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Signing in...
              </span>
            ) : (
              'LOGIN'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}