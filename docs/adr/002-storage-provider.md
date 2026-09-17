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
- **Abstration Constraint**: We must implement this behind a backend-adjacent `StorageProvider` interface (`upload`, `getUrl`, `delete`) in Phase 0/1 - no feature calls the Cloudinary SDK directly - so migrating to S3/R2 later is a contained swap, not a rewrite.

---

## Implementation notes (2026-09-17)

Built as decided, with the following specifics pinned down while implementing. Every
Cloudinary call lives in `backend/src/lib/storage/cloudinary.ts`; nothing else
imports the SDK.

### Interface shape
`StorageProvider` is `getSignedUploadParams` / `confirmUpload` / `getUrl` /
`openAssetStream` / `delete` (`backend/src/lib/storage/index.ts`). Two additions to
the original sketch were forced by reality:

- **`confirmUpload` takes the folder and limits**, and re-checks them. It rejects
  anything outside the folder the session was signed for, of the wrong format, or
  over the size limit. The check runs on the public id the *provider* reports, not
  just the string the client sent.
- **`openAssetStream`** exists because payment-proof screenshots must stay
  access-controlled (ADR 008). See "Delivery is not access control" below.

### Upload flow
`POST /api/v1/uploads/signature` → browser POSTs the file straight to
`https://api.cloudinary.com/v1_1/{cloud}/{resource_type}/upload` →
`POST /api/v1/uploads/confirm`. The signature is produced by
`cloudinary.utils.api_sign_request` over **exactly** the params the client sends
(`folder`, `timestamp`, `allowed_formats`). The API secret is never returned.

Folder layout is `omnihome/{societyId}/{resourceType}/{resourceId}`
(`storageFolder()` in `shared/`), and `societyId` always comes from the session -
a client-supplied `societyId` is ignored, and a forged `x-society-id` with no
membership is refused 403. A purpose registry (`lib/upload-purposes.ts`) maps each
purpose to the permission check *and* to the record-ownership check, so a
signature is never issued for a ticket or invoice the caller cannot reach.

### What Cloudinary does and does not enforce (verified against the live account)
- `allowed_formats` **is** signable and **is** enforced: a PDF uploaded with
  `allowed_formats=jpg,png` comes back `400 Image file format pdf not allowed`.
- `max_file_size` is **not** a signable upload param - including it in the
  signature makes Cloudinary reject the upload with "Invalid Signature". The byte
  limit therefore cannot be enforced by Cloudinary and is enforced in
  `confirmUpload` instead (oversized assets are rejected *and* destroyed). The
  browser-side check is only for fast feedback.
- `type: authenticated` does **not** gate reads on this account: the plain
  `secure_url` answered `200` anonymously, and an *expired* signed URL still
  answered `200`. So delivery type cannot be used as an access control.

### Delivery is not access control
Ticket photos are stored as public Cloudinary delivery URLs in `Ticket.photosUrl`
(the existing UI renders them directly, and ADR 002 wants Cloudinary's format
optimisation). Payment-proof screenshots are **not**: they are stored as a public
id and read only through `GET /api/v1/payment-proofs/:id/screenshot`, which
authorises the caller and then streams the bytes through the API. Handing the
browser a provider URL would silently break the ADR 008 rule.

### Deletion
`delete(publicId)` is reached only from the explicit admin endpoint
`DELETE /api/v1/uploads/asset` (own-society folder, admin only, audited as
`UPLOAD_DELETED`). Soft-deleting a domain record does **not** delete the asset; a
hard cleanup of orphaned assets is still a future task.

### Still on local disk (deliberately)
Documents (`routes/documents.ts`) and parcel photos (`routes/parcels.ts`) still
use multer into `backend/uploads/`. They were not migrated in this pass; the
interface is ready for them. `GET /api/v1/tickets/photo/:filename` is kept only to
serve ticket photos uploaded before this change.

### Configuration
Credentials resolve from `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` /
`CLOUDINARY_API_SECRET`, falling back to a well-formed `CLOUDINARY_URL`.
`lib/storage/cloudinary-env.ts` sanitises `CLOUDINARY_URL` before the SDK module is
ever evaluated, because the SDK **throws at import time** on a malformed value -
and the value in `backend/.env` had been pasted as the whole `CLOUDINARY_URL=...`
line, which would have crashed the backend on boot. That line has been corrected;
the sanitizer stays as a guard, and loading the provider is lazy so an environment
with no storage configured never loads the SDK at all (routes answer 503).
