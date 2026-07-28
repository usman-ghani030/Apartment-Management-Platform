# Next.js UI Styling & Component Guidelines

This guide covers styling patterns, design tokens, Shadcn UI setup, Radix primitives, glassmorphic styling, dark mode support, and Framer Motion micro-animations.

---

## 1. Design System & Tailwind CSS Architecture

### CSS Variables & HSL Color Tokens (`globals.css`)
Define colors using CSS variables in `globals.css` to allow seamless light/dark mode switches:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 224 71% 4%;
    --foreground: 213 31% 91%;
    --card: 224 71% 7%;
    --card-foreground: 213 31% 91%;
    --primary: 263 70% 50%;
    --primary-foreground: 210 40% 98%;
    --secondary: 215 27.9% 16.9%;
    --secondary-foreground: 210 40% 98%;
    --muted: 215 27.9% 16.9%;
    --muted-foreground: 215.4 16.3% 56.9%;
    --border: 215 27.9% 16.9%;
    --radius: 0.75rem;
  }
}
```

---

## 2. Glassmorphism & Modern Card Design Pattern

Creating visually captivating, premium UI cards with Tailwind CSS:

```tsx
import { cn } from '@/lib/utils'

interface StatCardProps {
  title: string
  value: string
  change: string
  isPositive?: boolean
  icon: React.ReactNode
}

export function StatCard({ title, value, change, isPositive = true, icon }: StatCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl p-6 transition-all duration-300",
        "bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 hover:border-indigo-500/50",
        "shadow-lg hover:shadow-indigo-500/10 group"
      )}
    >
      {/* Decorative gradient glow on hover */}
      <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-indigo-500/10 blur-2xl transition-all duration-500 group-hover:bg-indigo-500/20" />

      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-400">{title}</span>
        <div className="rounded-xl bg-indigo-500/10 p-2.5 text-indigo-400 border border-indigo-500/20">
          {icon}
        </div>
      </div>

      <div className="mt-4 flex items-baseline justify-between">
        <h3 className="text-3xl font-bold text-white tracking-tight">{value}</h3>
        <span
          className={cn(
            "text-xs font-semibold px-2 py-0.5 rounded-full border",
            isPositive
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
              : "bg-rose-500/10 text-rose-400 border-rose-500/20"
          )}
        >
          {change}
        </span>
      </div>
    </div>
  )
}
```

---

## 3. Micro-Animations with Framer Motion

When implementing client-side animations:
1. Always add `'use client'` to animated components.
2. Use lightweight variant patterns for page entry, list stagger, and modal triggers.

```tsx
'use client'

import { motion } from 'framer-motion'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.05
    }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }
  }
}

export function AnimatedGrid({ items }: { items: { id: string; title: string }[] }) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-1 md:grid-cols-3 gap-6"
    >
      {items.map((item) => (
        <motion.div
          key={item.id}
          variants={itemVariants}
          whileHover={{ y: -4, scale: 1.01 }}
          className="rounded-xl bg-slate-900 border border-slate-800 p-5 shadow-md"
        >
          <h4 className="font-semibold text-white">{item.title}</h4>
        </motion.div>
      ))}
    </motion.div>
  )
}
```

---

## 4. Shadcn UI / Radix Dialog Pattern

Example of an accessible modal component using Radix primitives or Shadcn UI:

```tsx
'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { useState } from 'react'

export function ModalTrigger({ triggerText, children }: { triggerText: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors">
          {triggerText}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl focus:outline-none">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <Dialog.Title className="text-lg font-semibold text-white">Modal Window</Dialog.Title>
            <Dialog.Close asChild>
              <button className="rounded-full p-1 text-slate-400 hover:text-white transition-colors">
                <X className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>
          <div className="py-4 text-slate-300">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
```
