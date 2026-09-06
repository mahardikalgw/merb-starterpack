import { createFileRoute, Link } from '@tanstack/react-router'
import { getAuth } from '#/lib/auth'
import { Button } from '#/components/ui/button'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  const auth = getAuth()
  const loggedIn = Boolean(auth.accessToken)

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40 p-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold">Welcome to the platform</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          {loggedIn ? 'You are logged in.' : 'Log in to get started.'}
        </p>
        <div className="mt-6 flex justify-center gap-3">
          {loggedIn ? (
            <Button asChild>
              <Link to="/dashboard">Go to dashboard</Link>
            </Button>
          ) : (
            <>
              <Button asChild>
                <Link to="/login">Log in</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/register">Register</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
