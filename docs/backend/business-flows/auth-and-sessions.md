# Auth and Sessions

Auth is implemented by `auth.Service` with the auth repository, OTP generator, email mailer, refresh-token manager, password hasher, token issuer, and rate limiters wired in `bootstrap.Container`.

## Registration

```mermaid
sequenceDiagram
    participant C as Client
    participant H as auth_handler
    participant S as auth.Service
    participant R as AuthRepository
    participant M as MailProvider
    participant T as TokenIssuer

    C->>H: POST /auth/register/email/request-otp
    H->>S: RequestRegistrationOTP(email)
    S->>S: Normalize email and apply OTP rate limits
    S->>R: Upsert EMAIL/REGISTRATION OTP challenge with hashed code
    S->>M: Send OTP email
    H-->>C: 204
    C->>H: POST /auth/register/email/verify
    H->>S: VerifyRegistrationOTP(email, username, password, otp)
    S->>R: Verify challenge, create app_user and profile in transaction
    S->>R: Create hashed refresh_token row
    S->>T: Issue access JWT with user id, username, email, role
    H-->>C: Session payload
```

Business rules:

- Registration starts with a challenge, not immediate user creation.
- OTP codes are stored as hashes, and challenges track attempts, expiry, and consumption.
- New users get default role `USER`, status `active`, and locale `en` unless changed later.
- The auth response includes a user summary and a bearer access token; the refresh token is opaque and stored only as a hash.

## Login and Refresh

```mermaid
flowchart TD
    Login["POST /auth/login"] --> Validate["Validate username/password input"]
    Validate --> Lookup["Load user by username"]
    Lookup --> Status["Reject deactivated users"]
    Status --> Compare["bcrypt compare password"]
    Compare --> Session["Issue access JWT and refresh token"]
    Session --> Persist["Persist refresh_token hash with family_id"]

    Refresh["POST /auth/refresh"] --> Hash["Hash presented refresh token"]
    Hash --> Load["Load refresh_token row"]
    Load --> Reuse{"Revoked or replaced?"}
    Reuse -- yes --> RevokeFamily["Revoke refresh token family"]
    Reuse -- no --> Rotate["Create replacement refresh token"]
    Rotate --> Link["Mark old row replaced_by_id"]
    Link --> NewSession["Return new access and refresh tokens"]
```

Refresh rotation is the main session-safety mechanism. If a rotated token is reused, the whole family is revoked.

## Logout

`POST /auth/logout` revokes the supplied refresh token. Access tokens are stateless JWTs and remain valid until their short TTL expires.

## Password Reset

```mermaid
sequenceDiagram
    participant C as Client
    participant S as auth.Service
    participant R as AuthRepository
    participant M as MailProvider

    C->>S: RequestPasswordResetOTP(email)
    S->>R: If user exists, upsert reset OTP challenge
    S->>M: Send reset OTP for existing users
    S-->>C: 204 even when email is unknown
    C->>S: VerifyPasswordResetOTP(email, otp)
    S->>R: Consume OTP challenge
    S-->>C: password reset grant
    C->>S: ResetPassword(email, grant, new_password)
    S->>R: Update password hash and consume grant
```

Unknown reset emails are handled silently so the API does not disclose registered accounts.

## Authorization Claims

Access-token claims are attached by middleware:

- `RequireAuth` rejects missing/invalid tokens.
- `OptionalAuth` enriches a request when a token is present and valid.
- `RequireAdmin` requires the `ADMIN` role claim.

The role is persisted on `app_user.role` and serialized as uppercase `USER` or `ADMIN`.
