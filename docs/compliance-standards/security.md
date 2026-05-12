# Security

This document records OWASP Top 10 and ASVS-aligned implementation evidence for Social Event Mapper.

## Access Control

Backend access control is enforced on API routes, not only in clients. `backend/internal/adapter/out/httpapi/middleware.go` validates Bearer access tokens and stores claims in request context:

```go
func RequireAuth(verifier domain.TokenVerifier) fiber.Handler {
	return func(c *fiber.Ctx) error {
		header := c.Get(fiber.HeaderAuthorization)
		token, ok := extractBearer(header)
		if !ok {
			return WriteError(c, missingTokenError())
		}

		claims, err := verifier.VerifyAccessToken(token)
		if err != nil {
			return WriteError(c, invalidTokenError())
		}

		c.Locals(contextKeyUserClaims, claims)
		applyLocalePreference(c, claims.UserID)
		return c.Next()
	}
}
```

Admin-only endpoints require the `ADMIN` role server-side:

```go
func RequireAdmin(verifier domain.TokenVerifier) fiber.Handler {
	return func(c *fiber.Ctx) error {
		...
		if claims.Role != domain.UserRoleAdmin {
			return WriteError(c, adminAccessRequiredError())
		}
		...
	}
}
```

Frontend and mobile route guards are UX conveniences. They do not replace backend authorization.

## Authentication and Session Handling

The backend uses short-lived access tokens and refresh-token rotation. In `backend/internal/application/auth/service.go`, refresh detects replay of revoked tokens and revokes the token family:

```go
// Refresh performs refresh-token rotation: it validates the current token,
// issues a new access + refresh pair, revokes the old token, and links the
// old token to its replacement. If a revoked token is replayed, the entire
// token family is revoked to mitigate token theft.
func (s *Service) Refresh(ctx context.Context, input RefreshInput) (*AuthSession, error) {
	...
	if current.RevokedAt != nil {
		if err := s.repo.RevokeRefreshTokenFamily(ctx, current.FamilyID, now); err != nil {
			return nil, fmt.Errorf("revoke refresh token family: %w", err)
		}
		return nil, domain.AuthError(domain.ErrorCodeRefreshReused, "The refresh token has already been used.")
	}
	...
}
```

Mobile stores the session in Expo SecureStore in `mobile/src/services/sessionStorage.ts`:

```ts
const AUTH_SESSION_KEY = 'auth_session';

export async function readStoredSession(): Promise<StoredAuthSession | null> {
  const raw = await SecureStore.getItemAsync(AUTH_SESSION_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as StoredAuthSession;
    if (
      parsed &&
      typeof parsed.access_token === 'string' &&
      typeof parsed.refresh_token === 'string' &&
      parsed.user &&
      typeof parsed.user.id === 'string'
    ) {
      return parsed;
    }
  } catch {
    // Corrupted session blobs should not block app startup.
  }

  await SecureStore.deleteItemAsync(AUTH_SESSION_KEY);
  return null;
}
```

## Input Validation

Backend validation is the source of truth. The auth service rejects malformed login, registration, OTP, refresh, and password-reset inputs before mutation. Example from `backend/internal/application/auth/service.go`:

```go
func (s *Service) Login(ctx context.Context, input LoginInput) (*AuthSession, error) {
	now := time.Now().UTC()
	username, password, appErr := validateLoginInput(input)
	if appErr != nil {
		return nil, appErr
	}

	if allowed, _ := s.loginRateLimiter.Allow(strings.ToLower(username), now); !allowed {
		return nil, domain.RateLimitedError("Too many requests. Try again later.")
	}
	...
}
```

Other validator locations include:

- `backend/internal/application/event/validator.go`
- `backend/internal/application/profile/validator.go`
- `backend/internal/application/favorite_location/validator.go`
- `backend/internal/application/notification/validator.go`

## Injection Resistance

Postgres access is handled through repository adapters under `backend/internal/adapter/in/postgres/`. Queries use pgx parameters rather than concatenating untrusted input into SQL.

Representative pattern from repository code:

```go
row := r.db.QueryRow(ctx, `
	SELECT id, username, email, password_hash, status, role, created_at, updated_at
	FROM app_user
	WHERE username = $1
`, username)
```

The important contract is that untrusted values are passed as query parameters (`$1`, `$2`, ...), not interpolated into SQL strings.

## API Security Middleware

`backend/internal/server/http.go` installs recovery, CORS, request-body limits, and API security headers before route registration:

```go
func NewHTTP(container *bootstrap.Container) *fiber.App {
	cfg := container.Config
	app := fiber.New(fiber.Config{
		BodyLimit:               maxRequestBodyBytes(cfg),
		ProxyHeader:             "X-Real-IP",
		EnableTrustedProxyCheck: true,
		TrustedProxies: []string{
			"127.0.0.1",
			"::1",
			"10.0.0.0/8",
			"172.16.0.0/12",
			"192.168.0.0/16",
		},
	})

	installGlobalSecurityMiddleware(app, cfg)
	...
}
```

The middleware sets conservative headers and allows only configured browser origins:

```go
func installGlobalSecurityMiddleware(app *fiber.App, cfg *config.Config) {
	app.Use(recover.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins: strings.Join(corsAllowedOrigins(cfg), ","),
		AllowMethods: strings.Join([]string{
			fiber.MethodGet,
			fiber.MethodPost,
			fiber.MethodPut,
			fiber.MethodPatch,
			fiber.MethodDelete,
			fiber.MethodOptions,
		}, ","),
		AllowHeaders: strings.Join([]string{
			fiber.HeaderAuthorization,
			fiber.HeaderContentType,
			fiber.HeaderAccept,
			fiber.HeaderAcceptLanguage,
			"X-Requested-With",
		}, ","),
	}))
	app.Use(func(c *fiber.Ctx) error {
		c.Set(fiber.HeaderXContentTypeOptions, "nosniff")
		c.Set(fiber.HeaderXFrameOptions, "DENY")
		c.Set(fiber.HeaderReferrerPolicy, "no-referrer")
		c.Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
		c.Set(fiber.HeaderContentSecurityPolicy, apiContentSecurityPolicy)
		return c.Next()
	})
}
```

This addresses OWASP security misconfiguration, exceptional-condition handling, and baseline browser hardening.

## Static Web Security Headers

The deployed web app is served by Nginx. `frontend/nginx.conf` and the outer ingress configs under `nginx/` add security headers and a Content Security Policy that permits required dependencies: Google Maps, Photon, OSRM, Open-Meteo, HTTPS image/CDN assets, DigitalOcean Spaces direct uploads, and local API calls during development.

```nginx
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=(self)" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' https://maps.googleapis.com https://maps.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' http://localhost:8080 http://127.0.0.1:8080 https://socialeventmapper.com https://www.socialeventmapper.com https://*.socialeventmapper.com https://maps.googleapis.com https://maps.gstatic.com https://photon.komoot.io https://router.project-osrm.org https://api.open-meteo.com https://*.digitaloceanspaces.com https://sem-bucket.fra1.digitaloceanspaces.com; frame-src 'self' https://www.google.com https://maps.google.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'" always;
```

Built assets are cached immutably while the SPA entrypoint remains no-store:

```nginx
location /assets/ {
    try_files $uri =404;
    add_header Cache-Control "public, max-age=31536000, immutable" always;
}

location / {
    add_header Cache-Control "no-store" always;
    try_files $uri $uri/ /index.html;
}
```

## Error Handling

Backend handlers return a consistent JSON envelope through `backend/internal/adapter/out/httpapi/handler.go`:

```go
type ErrorEnvelope struct {
	Error ErrorBody `json:"error"`
}

type ErrorBody struct {
	Code    string            `json:"code"`
	Message string            `json:"message"`
	Details map[string]string `json:"details,omitempty"`
}
```

Unexpected errors are logged server-side and returned as generic internal errors, preventing stack traces or implementation details from leaking to clients:

```go
slog.ErrorContext(c.UserContext(), "handler error",
	"error", err,
	"method", c.Method(),
	"path", c.Path(),
)

return c.Status(fiber.StatusInternalServerError).JSON(ErrorEnvelope{
	Error: ErrorBody{
		Code:    "internal_server_error",
		Message: message,
	},
})
```

## Upload Handling

Image upload flows avoid routing raw file streams through normal JSON API handlers. The backend issues scoped upload URLs and confirmation tokens through `backend/internal/application/imageupload` and the Spaces adapter under `backend/internal/adapter/in/spaces`. Clients upload directly to object storage and then confirm completion through backend services.

This reduces backend request-body exposure and keeps uploaded assets behind explicit confirmation logic.

## Observability and Logging

Request traces and HTTP metrics use OpenTelemetry in `backend/internal/server/http.go`:

```go
app.Use(otelfiber.Middleware())
```

Business logs remain structured and low-noise per `backend/AGENTS.md`, avoiding secrets such as passwords, OTPs, reset tokens, refresh tokens, raw authorization headers, and sensitive user-edited content.

## Supply Chain and Build Verification

The project uses pinned lock/module files:

- `backend/go.sum`
- `frontend/package-lock.json`
- `mobile/package-lock.json`

The backend release gate in `backend/shipcheck.sh` includes module verification, format checks, `go vet`, static analysis, vulnerability scanning, build, unit tests, and integration tests.
