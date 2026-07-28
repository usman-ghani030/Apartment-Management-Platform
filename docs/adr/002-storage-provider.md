# ADR 002: File Storage Provider

## Context and Problem Statement
Our platform will need to store media uploaded by users. This includes photos attached to maintenance tickets (Phase 1) and official community documents like bylaws, meeting minutes, and vendor contracts (Phase 6). We need a reliable storage system that is accessible from both the backend API and frontend Next.js application.

## Decision
We will use **Cloudinary** as the primary storage provider for uploading and serving media assets.

### Why this approach?
1. **Media Handling**: Cloudinary handles image compression, format optimization (WebP/AVIF delivery), and thumbnail transformations automatically out-of-the-box, which is ideal for resident-uploaded maintenance tickets.
2. **Simplified SDKs**: Cloudinary provides rich SDKs for React/Next.js (CldImage, widgets) and Node.js that streamline client-side uploading and server-side signing.
3. **Generous Free Tier**: Includes a generous free tier for storage and transformations, allowing local and dev environments to run without incurring costs.

## Alternatives Considered
- **AWS S3 / Cloudflare R2**: High flexibility, but requires setting up image processing pipelines (e.g. sharp/lambda) manually to optimize uploaded photos. Since we are building an MVP, Cloudinary is significantly faster to implement and optimize.

## Consequences
- We will require a `CLOUDINARY_URL` in our `.env` configuration.
- We must build secure signed upload endpoints in the API to prevent unauthorized upload attempts (satisfying security guidelines).
- **Abstration Constraint**: We must implement this behind a backend-adjacent `StorageProvider` interface (`upload`, `getUrl`, `delete`) in Phase 0/1 — no feature calls the Cloudinary SDK directly — so migrating to S3/R2 later is a contained swap, not a rewrite.
