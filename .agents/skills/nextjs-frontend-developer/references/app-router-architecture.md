# Next.js App Router Architecture & Data Flow

This reference covers deep architectural patterns for Next.js App Router applications, focusing on React Server Components (RSC), Server Actions, Layouts, Streaming, and Route Handlers.

---

## 1. React Server Components (RSC) vs Client Components

### Component Boundary Rules
| Requirement / Use Case | Server Component | Client Component |
| :--- | :---: | :---: |
| Fetch data from DB or external APIs | ✅ | ❌ (Unless via fetch/SWR) |
| Keep API keys / tokens secret | ✅ | ❌ |
| Reduce JavaScript sent to browser | ✅ | ❌ |
| Interactive event handlers (`onClick`, `onChange`) | ❌ | ✅ |
| React state (`useState`, `useReducer`, `useEffect`) | ❌ | ✅ |
| Browser-only APIs (`window`, `localStorage`, `document`) | ❌ | ✅ |
| Custom hooks dependent on state/effects | ❌ | ✅ |

### Passing Server Components into Client Components (Children Pattern)
You cannot import a Server Component directly inside a Client Component file. Instead, pass the Server Component as `children` or a prop to maintain the server boundary:

```tsx
// components/ClientWrapper.tsx
'use client'

export function ClientWrapper({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = React.useState(false)
  return (
    <div>
      <button onClick={() => setIsOpen(!isOpen)}>Toggle</button>
      {isOpen && children}
    </div>
  )
}

// app/page.tsx (Server Component)
import { ClientWrapper } from '@/components/ClientWrapper'
import { HeavyServerData } from '@/components/HeavyServerData'

export default async function Page() {
  return (
    <ClientWrapper>
      <HeavyServerData /> {/* Rendered on server, passed as RSC payload */}
    </ClientWrapper>
  )
}
```

---

## 2. Layouts, Templates & Route Groups

### Layouts vs Templates
- **Layouts (`layout.tsx`)**: Preserve state across route transitions, do not re-render shared UI (e.g. Header, Sidebar).
- **Templates (`template.tsx`)**: Create a fresh instance for every route change. Use when you need `useEffect` triggered on page navigation, reset state, or run entry/exit animations.

### Route Groups `(folder)`
Route groups allow organizing files without impacting the URL structure:
- `app/(marketing)/about/page.tsx` -> `/about`
- `app/(dashboard)/settings/page.tsx` -> `/settings`
- Each route group can have its own root layout (`(marketing)/layout.tsx` vs `(dashboard)/layout.tsx`).

---

## 3. Server Actions & Mutations

### Form Handling with Server Actions
Combine Server Actions with React 19's `useActionState` hook for robust status and error handling.

```tsx
// app/actions/user.ts
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const UserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address')
})

export type FormState = {
  success?: boolean
  errors?: Record<string, string[]>
  message?: string
}

export async function createUserAction(prevState: FormState, formData: FormData): Promise<FormState> {
  const rawData = {
    name: formData.get('name'),
    email: formData.get('email')
  }

  const validated = UserSchema.safeParse(rawData)
  if (!validated.success) {
    return {
      success: false,
      errors: validated.error.flatten().fieldErrors,
      message: 'Validation failed'
    }
  }

  try {
    // Database operation (prisma, drizzle, fetch, etc.)
    // await db.user.create({ data: validated.data })

    revalidatePath('/users')
    return { success: true, message: 'User created successfully!' }
  } catch (error) {
    return { success: false, message: 'Database error failed to create user.' }
  }
}
```

```tsx
// components/UserForm.tsx
'use client'

import { useActionState } from 'react'
import { createUserAction, FormState } from '@/app/actions/user'

const initialState: FormState = {}

export function UserForm() {
  const [state, formAction, isPending] = useActionState(createUserAction, initialState)

  return (
    <form action={formAction} className="space-y-4 max-w-md">
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Name</label>
        <input
          type="text"
          name="name"
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        {state.errors?.name && (
          <p className="mt-1 text-xs text-red-500">{state.errors.name[0]}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Email</label>
        <input
          type="email"
          name="email"
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        {state.errors?.email && (
          <p className="mt-1 text-xs text-red-500">{state.errors.email[0]}</p>
        )}
      </div>

      {state.message && (
        <p className={`text-sm ${state.success ? 'text-green-600' : 'text-red-500'}`}>
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        {isPending ? 'Saving...' : 'Create User'}
      </button>
    </form>
  )
}
```

---

## 4. Streaming & Suspense Boundaries

Streaming allows progressive rendering of slow data-fetching components while displaying instant fallbacks.

```tsx
// app/dashboard/page.tsx
import { Suspense } from 'react'
import { AnalyticsCard } from '@/components/AnalyticsCard'
import { CardSkeleton } from '@/components/skeletons'

export default function DashboardPage() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Suspense fallback={<CardSkeleton />}>
          <AnalyticsCard type="revenue" />
        </Suspense>

        <Suspense fallback={<CardSkeleton />}>
          <AnalyticsCard type="users" />
        </Suspense>

        <Suspense fallback={<CardSkeleton />}>
          <AnalyticsCard type="conversions" />
        </Suspense>
      </div>
    </div>
  )
}
```
