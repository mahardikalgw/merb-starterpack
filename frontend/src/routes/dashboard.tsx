import { useEffect, useState } from 'react'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { clearAuth, fetchMe, getAuth, logout, type AuthUser } from '#/lib/auth'
import { Button } from '#/components/ui/button'

export const Route = createFileRoute('/dashboard')({
  beforeLoad: () => {
    // Route guard: redirect to login when there is no session.
    if (!getAuth().accessToken) {
      throw redirect({ to: '/login' })
    }
  },
  component: DashboardPage,
})

function DashboardPage() {
  const navigate = useNavigate()
  const [user, setUser] = useState<AuthUser | null>(getAuth().user)

  // Re-validate the session against the API (also refreshes stale user data).
  useEffect(() => {
    fetchMe()
      .then(setUser)
      .catch(() => {
        clearAuth()
        void navigate({ to: '/login' })
      })
  }, [navigate])

  async function handleLogout() {
    await logout()
    await navigate({ to: '/login' })
  }

  const isAdmin = user?.role.permissions.includes('*') ?? false

  return (
    <div className="min-h-svh bg-muted/40 p-8">
      <div className="mx-auto max-w-2xl rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            {user && (
              <p className="mt-1 text-sm text-muted-foreground">
                Logged in as <strong>{user.name}</strong> ({user.email}) — role:{' '}
                <span className="rounded bg-primary/10 px-2 py-0.5 font-medium text-primary">
                  {user.role.name}
                </span>
              </p>
            )}
          </div>
          <Button variant="outline" onClick={handleLogout}>
            Log out
          </Button>
        </div>

        <div className="mt-6 space-y-2 text-sm">
          <p className="font-medium text-foreground">Your permissions:</p>
          {isAdmin ? (
            <p className="text-muted-foreground">* (full access — admin)</p>
          ) : user && user.role.permissions.length > 0 ? (
            <ul className="list-inside list-disc text-muted-foreground">
              {user.role.permissions.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">No permissions assigned.</p>
          )}
        </div>
      </div>
    </div>
  )
}
