---
name: nextjs-frontend-developer
description: Comprehensive guide and best practices for modern Next.js frontend development (Next.js 14/15 App Router). Triggers when creating, building, refactoring, or designing Next.js web applications, pages, components, layouts, React Server Components (RSC), Server Actions, UI/UX with Tailwind CSS, Shadcn UI, Radix UI, Framer Motion, frontend performance, or SEO optimizations. Use this skill whenever the user mentions Next.js, React App Router, building web apps in Next, React components, Tailwind styling in Next.js, or frontend architecture.
---

# Next.js Frontend Developer Skill

A comprehensive skill for building modern, high-performance, aesthetically stunning Next.js applications using the App Router, React Server Components (RSC), Tailwind CSS, Shadcn UI, and Framer Motion.

## Progressive Disclosure & Reference Guides

For deep dives into specific topics, consult the following bundled reference guides:
- [App Router Architecture & Server Actions](file:///C:/Users/HP/Desktop/claude/.agents/skills/nextjs-frontend-developer/references/app-router-architecture.md) — RSC vs Client components, layout nesting, route handlers, Server Actions, streaming & Suspense.
- [UI Styling & Component System](file:///C:/Users/HP/Desktop/claude/.agents/skills/nextjs-frontend-developer/references/ui-styling-components.md) — Tailwind CSS setup, Shadcn UI patterns, animations with Framer Motion, glassmorphism, responsive design.
- [Performance, Caching & SEO](file:///C:/Users/HP/Desktop/claude/.agents/skills/nextjs-frontend-developer/references/performance-seo.md) — `next/image`, `next/font`, dynamic metadata, OpenGraph, dynamic & static caching strategies (`revalidate`), Core Web Vitals.

---

## Core Architecture Principles

### 1. Server Components by Default ('use server' & 'use client' Boundary)
- In the App Router, **every component in the `app` directory is a React Server Component (RSC) by default**.
- **Keep components on the server** to reduce client bundle size, access backend resources directly, and improve initial page load performance.
- Only add `'use client'` at the top of a file when the component requires:
  - Event listeners (`onClick`, `onChange`, `onSubmit`)
  - React state or lifecycle hooks (`useState`, `useEffect`, `useReducer`, `useContext`)
  - Browser-only APIs (`window`, `localStorage`, `navigator`)
  - Custom client-side hooks or animation libraries requiring DOM refs (`framer-motion`)
- **Leaf Node Pattern**: Push `'use client'` down to the smallest possible leaf components. Do not mark an entire page or layout as `'use client'` unless strictly necessary.

### 2. File & Directory Structure Convention
Adopt a feature-based or clean modular directory layout:

```
app/
├── (auth)/                  # Route groups (don't affect URL path)
│   ├── login/
│   │   └── page.tsx
│   └── register/
│       └── page.tsx
├── (dashboard)/
│   ├── dashboard/
│   │   └── page.tsx
│   └── layout.tsx           # Shared dashboard layout
├── api/                     # Route Handlers
│   └── health/route.ts
├── favicon.ico
├── globals.css              # Tailwind imports & CSS variables
├── layout.tsx               # Root layout (HTML, Body, Providers, Metadata)
├── loading.tsx              # Root loading UI (Suspense boundary)
├── error.tsx                # Error boundary ('use client')
├── not-found.tsx            # 404 page
└── page.tsx                 # Home page
components/                  # UI & Feature components
├── ui/                      # Primitive Shadcn/Radix components (button, card, dialog)
├── forms/                   # Client & server form components
└── navigation/              # Header, sidebar, footer
lib/                         # Utilities, helper functions, DB clients, validators
├── utils.ts                 # cn() classnames helper
└── validations/             # Zod schemas
types/                       # TypeScript interfaces & types
```

### 3. Server Actions & Form Handling
- Use **Server Actions** (`'use server'`) for mutations, form submissions, and database/API updates directly from components.
- Pair Server Actions with **Zod** for schema validation and **React 19 hooks** (`useActionState`, `useFormStatus`, `useOptimistic`) for smooth user feedback.
- Use `revalidatePath()` or `revalidateTag()` to purge cache and instantly refresh UI state upon successful mutations.

```tsx
// lib/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const Schema = z.object({ title: z.string().min(3) })

export async function createItem(prevState: any, formData: FormData) {
  const validated = Schema.safeParse({ title: formData.get('title') })
  if (!validated.success) {
    return { error: validated.error.flatten().fieldErrors }
  }
  // Perform DB insertion/API call
  revalidatePath('/dashboard')
  return { success: true }
}
```

---

## Design System & Styling Rules

### 1. Visual Excellence & Aesthetics
- **Never settle for bare-bones default styling.** Apply rich visual depth using modern design trends:
  - Curated color palettes (HSL variables with dark mode support).
  - Subtle borders (`border-white/10` or `border-slate-200/80`).
  - Glassmorphism effects (`backdrop-blur-md bg-white/70 dark:bg-slate-900/70`).
  - Smooth micro-interactions & hover transitions (`transition-all duration-200 hover:scale-[1.02]`).
  - Sleek gradients (`bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500`).

### 2. Standard `cn()` Helper for Tailwind
Always use `clsx` + `tailwind-merge` (`cn` helper) for dynamic class merging:

```ts
// lib/utils.ts
import { ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

### 3. Responsive & Accessible Controls
- Design mobile-first using Tailwind responsive breakpoints (`sm:`, `md:`, `lg:`, `xl:`).
- Use semantic HTML tags (`<header>`, `<nav>`, `<main>`, `<section>`, `<footer>`, `<article>`).
- Ensure full keyboard navigation, aria labels, and focus rings (`focus-visible:ring-2 focus-visible:ring-offset-2`).

---

## Workflow Checklist for Next.js Tasks

1. **Understand & Define Requirements**:
   - Determine if pages require static generation (SSG), dynamic server rendering (SSR), or streaming with Suspense.
2. **Setup Component Architecture**:
   - Identify which components remain Server Components and which require `'use client'`.
3. **Implement Styling & UI**:
   - Use Tailwind CSS, Lucide Icons, Shadcn primitives, and Framer Motion for animations.
4. **Implement Data Fetching & Actions**:
   - Fetch data in Server Components or Server Actions; implement progressive loading with `loading.tsx` / Suspense.
5. **Enforce SEO & Metadata**:
   - Export dynamic/static `metadata` from `page.tsx` or `layout.tsx`.
6. **Verify & Build**:
   - Test build (`npm run build`) to catch TypeScript/RSC boundary issues early.
