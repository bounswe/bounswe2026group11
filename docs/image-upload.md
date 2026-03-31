# Image Upload Flow

This document describes the backend-supported image upload flow for profile avatars and event cover images.

## Overview

The upload flow is always:

1. Client requests presigned upload instructions from the backend.
2. Backend reserves the next image version and returns:
   - a versioned CDN `base_url`
   - an opaque `confirm_token`
   - two direct-upload instructions: `ORIGINAL` and `SMALL`
3. Client uploads both JPEG files directly to DigitalOcean Spaces with the returned method, URL, and headers.
4. Client calls the confirm endpoint with only the `confirm_token`.
5. Backend verifies both objects exist and atomically updates the database.

This keeps image bytes out of the backend, preserves old versions for CDN cache safety, and lets web/mobile upload directly to Spaces.

## Why `public-read` ACL Is Part of the Flow

Some DigitalOcean Spaces setups use limited-access keys. Those keys can upload objects but may not be allowed to manage bucket policy through the API. Because of that, the backend now presigns uploads with:

```text
x-amz-acl: public-read
```

Clients must send that header exactly as returned. This makes each uploaded object readable through the Spaces origin and the CDN without requiring signed read URLs.

## Supported Resources

### Profile avatar

- Upload init: `POST /me/avatar/upload-url`
- Confirm: `POST /me/avatar/confirm`

### Event cover image

- Upload init: `POST /events/{id}/image/upload-url`
- Confirm: `POST /events/{id}/image/confirm`

Event images are uploaded only after the event already exists.

## Naming Convention

The backend generates versioned object keys. Clients never choose or persist their own keys.

### Profile avatar

- original: `profiles/{user_id}/avatar/v{n}-{upload_id}`
- small: `profiles/{user_id}/avatar/v{n}-{upload_id}-small`

### Event cover image

- original: `events/{event_id}/cover/v{n}-{upload_id}`
- small: `events/{event_id}/cover/v{n}-{upload_id}-small`

## Stored URL and Small Variant Rule

The database stores the returned `base_url` only.

Examples:

- original: `https://sem-bucket.fra1.cdn.digitaloceanspaces.com/events/{event_id}/cover/v2-abc123`
- small: `https://sem-bucket.fra1.cdn.digitaloceanspaces.com/events/{event_id}/cover/v2-abc123-small`

Client rule:

- use `base_url` for the original image
- use `base_url + "-small"` for the small image

## Versioning and Cache Behavior

Old files are never deleted during an update.

- each new upload reserves `version + 1`
- confirm persists the new `base_url`
- the old versioned URL stays intact
- CDN can cache each URL safely for a long time

This is why image updates do not overwrite the previous object path.

## Required Upload Headers

Clients must send every returned upload header exactly as returned by the backend. Do not rebuild this header set manually.

Current required headers are:

- `Content-Type: image/jpeg`
- `Cache-Control: public, max-age=604800, immutable`
- `x-amz-acl: public-read`

For browser clients, CORS on the Space must allow at least:

- methods: `GET`, `HEAD`, `PUT`
- headers: `Content-Type`, `Cache-Control`, `x-amz-acl`

## Mock Upload-Init Response

Example event image upload-init response:

```json
{
  "base_url": "https://sem-bucket.fra1.cdn.digitaloceanspaces.com/events/ad9a0262-fd1f-48a6-8685-dd026511e63e/cover/v1-adc6d2b4-a575-4363-8c9e-e34c920fc07c",
  "version": 1,
  "confirm_token": "opaque-signed-token",
  "uploads": [
    {
      "variant": "ORIGINAL",
      "method": "PUT",
      "url": "https://sem-bucket.fra1.digitaloceanspaces.com/events/ad9a0262-fd1f-48a6-8685-dd026511e63e/cover/v1-adc6d2b4-a575-4363-8c9e-e34c920fc07c?...",
      "headers": {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=604800, immutable",
        "x-amz-acl": "public-read"
      }
    },
    {
      "variant": "SMALL",
      "method": "PUT",
      "url": "https://sem-bucket.fra1.digitaloceanspaces.com/events/ad9a0262-fd1f-48a6-8685-dd026511e63e/cover/v1-adc6d2b4-a575-4363-8c9e-e34c920fc07c-small?...",
      "headers": {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=604800, immutable",
        "x-amz-acl": "public-read"
      }
    }
  ]
}
```

## Example Client Sequence

### 1. Request upload instructions

```bash
curl -X POST \
  http://localhost/api/events/ad9a0262-fd1f-48a6-8685-dd026511e63e/image/upload-url \
  -H 'Authorization: Bearer <ACCESS_TOKEN>'
```

### 2. Upload the original JPEG

```bash
curl -X PUT \
  -H 'Content-Type: image/jpeg' \
  -H 'Cache-Control: public, max-age=604800, immutable' \
  -H 'x-amz-acl: public-read' \
  --upload-file ./original.jpg \
  'https://sem-bucket.fra1.digitaloceanspaces.com/events/...'
```

### 3. Upload the small JPEG

```bash
curl -X PUT \
  -H 'Content-Type: image/jpeg' \
  -H 'Cache-Control: public, max-age=604800, immutable' \
  -H 'x-amz-acl: public-read' \
  --upload-file ./small.jpg \
  'https://sem-bucket.fra1.digitaloceanspaces.com/events/...-small'
```

### 4. Confirm

```bash
curl -X POST \
  http://localhost/api/events/ad9a0262-fd1f-48a6-8685-dd026511e63e/image/confirm \
  -H 'Authorization: Bearer <ACCESS_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{
    "confirm_token": "opaque-signed-token"
  }'
```

Expected result:

- upload `PUT` requests return `200` or `204`
- confirm returns `204`

## CDN Read Behavior

After confirm succeeds:

- read original from `base_url`
- read small from `base_url + "-small"`

No separate signed read URL is required.

## Local Verification Checklist

1. Call upload-init.
2. Upload both `ORIGINAL` and `SMALL` JPEG files using the returned headers exactly.
3. Call confirm with the returned `confirm_token`.
4. Verify the database row now stores the returned `base_url`.
5. Open the origin or CDN URL for the original image.
6. Open the `-small` URL for the small image.

## Common Errors

### `invalid_token`

The access token in the `Authorization` header is invalid or expired. Re-authenticate and retry the same request if the confirm token is still valid.

### `AccessDenied` when reading the image URL

Most common causes:

- the client uploaded without `x-amz-acl: public-read`
- the object was uploaded before the ACL fix was deployed
- the upload used a different header set than the one returned by the backend

Fix:

- request a fresh upload URL
- re-upload both variants using all returned headers exactly
- confirm again

### `AccessDenied` while changing bucket policy or CORS

This usually means the Spaces key is a limited-access key and cannot manage bucket policy or CORS over the API. That does not block the main upload flow anymore because object reads are enabled by `x-amz-acl: public-read`.

If browser uploads still fail because of CORS, configure CORS manually in the DigitalOcean Spaces panel.

### Upload confirm returns a conflict

The reserved version is stale. Another upload was confirmed first. Start a new upload-init flow and retry with the newer version.

### Upload confirm returns incomplete upload

At least one of the two objects is missing. Re-upload both variants, then confirm again.
