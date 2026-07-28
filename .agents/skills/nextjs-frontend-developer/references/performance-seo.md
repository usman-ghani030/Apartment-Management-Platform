# Next.js Performance, Caching & SEO Optimization

This reference outlines strategies for maximizing performance, Core Web Vitals, dynamic metadata generation, image/font optimizations, and caching mechanisms in Next.js App Router applications.

---

## 1. Metadata & OpenGraph Optimization

### Static Metadata Export (`app/layout.tsx` or `app/page.tsx`)
```tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: {
    default: 'Acme SaaS — Modern Workflow Solutions',
    template: '%s | Acme SaaS'
  },
  description: 'Boost team productivity with Acme SaaS automated workflow management software.',
  keywords: ['SaaS', 'Workflow', 'Productivity', 'Automation', 'Next.js'],
  authors: [{ name: 'Acme Team', url: 'https://acme.com' }],
  openGraph: {
    title: 'Acme SaaS — Modern Workflow Solutions',
    description: 'Boost team productivity with automated workflows.',
    url: 'https://acme.com',
    siteName: 'Acme SaaS',
    images: [
      {
        url: 'https://acme.com/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Acme SaaS Dashboard Preview'
      }
    ],
    locale: 'en_US',
    type: 'website'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Acme SaaS',
    description: 'Boost team productivity with automated workflows.',
    creator: '@acme'
  },
  robots: {
    index: true,
    follow: true
  }
}
```

### Dynamic Metadata Generation (`app/products/[id]/page.tsx`)
```tsx
import type { Metadata, ResolvingMetadata } from 'next'

type Props = {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props, parent: ResolvingMetadata): Promise<Metadata> {
  const resolvedParams = await params
  const product = await fetchProduct(resolvedParams.id)

  return {
    title: product.name,
    description: product.description,
    openGraph: {
      title: product.name,
      description: product.description,
      images: [product.imageUrl]
    }
  }
}
```

---

## 2. Image Optimization with `next/image`

### Rules for `next/image`
1. **Always specify `width` and `height`** (or `fill`) to prevent Layout Shifts (CLS).
2. **Use `priority` for Above-The-Fold / LCP images** (hero background, primary header banner).
3. **Configure Remote Patterns** in `next.config.js` for external image domains.

```tsx
import Image from 'next/image'

export function HeroBanner() {
  return (
    <div className="relative h-[400px] w-full overflow-hidden rounded-3xl">
      <Image
        src="/hero-banner.jpg"
        alt="Hero product showcase"
        fill
        priority
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px"
        className="object-cover object-center transition-transform duration-500 hover:scale-105"
      />
    </div>
  )
}
```

```js
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com'
      }
    ]
  }
}

module.exports = nextConfig
```

---

## 3. Font Optimization with `next/font`

Using `next/font/google` automatically eliminates network requests to Google Fonts and prevents FOUT (Flash of Unstyled Text).

```tsx
// app/layout.tsx
import { Inter, Outfit } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap'
})

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap'
})

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable}`}>
      <body className="bg-slate-950 text-slate-100 font-sans antialiased">{children}</body>
    </html>
  )
}
```

---

## 4. Caching & Data Revalidation Strategies

Next.js App Router includes multiple caching layers:

### Revalidation Options
1. **Time-Based Revalidation (`revalidate`)**:
   ```tsx
   // Revalidate data every hour (3600s)
   const data = await fetch('https://api.example.com/data', {
     next: { revalidate: 3600 }
   })
   ```
2. **On-Demand Revalidation with Tags**:
   ```tsx
   // Fetch with tag
   const data = await fetch('https://api.example.com/products', {
     next: { tags: ['products'] }
   })

   // In a Server Action or Route Handler:
   import { revalidateTag } from 'next/cache'
   export async function updateProduct() {
     'use server'
     // mutate database
     revalidateTag('products')
   }
   ```
3. **Opting Out of Caching (Force Dynamic)**:
   ```tsx
   export const dynamic = 'force-dynamic'
   ```
