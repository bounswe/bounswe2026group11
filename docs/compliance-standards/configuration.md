# Configuration

This document records hardening-related configuration used by Social Event Mapper.

## Backend Configuration Shape

The backend supports optional hardening configuration in `backend/internal/infrastructure/config/config.go`:

```go
type Config struct {
	AppPort             int
	CORSAllowedOrigins  []string
	MaxRequestBodyBytes int
	...
}
```

Environment variables are bound in the same loader:

```go
bind("cors_allowed_origins", "CORS_ALLOWED_ORIGINS")
bind("max_request_body_bytes", "MAX_REQUEST_BODY_BYTES")
```

Comma-separated or YAML-list CORS values are normalized:

```go
func normalizeStringList(values []string) []string {
	seen := make(map[string]struct{}, len(values))
	normalized := make([]string, 0, len(values))
	for _, value := range values {
		for _, part := range strings.Split(value, ",") {
			item := strings.TrimSpace(part)
			if item == "" {
				continue
			}
			if _, ok := seen[item]; ok {
				continue
			}
			seen[item] = struct{}{}
			normalized = append(normalized, item)
		}
	}
	return normalized
}
```

## Local and Development Defaults

Local and dev defaults are declared in both `backend/config/application.local.yaml` and `backend/config/application.dev.yaml`:

```yaml
cors_allowed_origins:
  - http://localhost:5173
  - http://127.0.0.1:5173
  - http://localhost:8081
  - http://127.0.0.1:8081
  - https://socialeventmapper.com
  - https://www.socialeventmapper.com
  - https://*.socialeventmapper.com
: 4194304
```

If omitted, `backend/internal/server/http.go` falls back to the same conservative local origins and a 4 MiB request body limit.

