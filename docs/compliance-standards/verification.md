# Verification

This document records automated checks and verification commands for the compliance controls.

## Backend Middleware Tests

Backend middleware behavior is covered in `backend/internal/server/http_test.go`:

```go
func TestGlobalSecurityMiddlewareSetsHeaders(t *testing.T) {
	app := securityTestApp(nil)
	req := httptest.NewRequest(fiber.MethodGet, "/ok", nil)

	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	assertHeader(t, resp.Header.Get(fiber.HeaderXContentTypeOptions), "nosniff", fiber.HeaderXContentTypeOptions)
	assertHeader(t, resp.Header.Get(fiber.HeaderXFrameOptions), "DENY", fiber.HeaderXFrameOptions)
	assertHeader(t, resp.Header.Get(fiber.HeaderReferrerPolicy), "no-referrer", fiber.HeaderReferrerPolicy)
	assertHeader(t, resp.Header.Get("Permissions-Policy"), "camera=(), microphone=(), geolocation=()", "Permissions-Policy")
	assertHeader(t, resp.Header.Get(fiber.HeaderContentSecurityPolicy), apiContentSecurityPolicy, fiber.HeaderContentSecurityPolicy)
}
```

The same file also verifies configured CORS origin behavior, body-size rejection, and panic recovery.

## Frontend Accessibility Tests

Frontend accessibility behavior is covered in `frontend/src/components/AppShell.test.tsx`:

```tsx
it('exposes skip link, main landmark, and navigation state', () => {
  renderShell();

  expect(screen.getByRole('link', { name: 'Skip to main content' }).getAttribute('href')).toBe('#main-content');
  expect(container.querySelector('main#main-content')?.getAttribute('tabindex')).toBe('-1');
  expect(screen.getByRole('navigation', { name: 'Primary navigation' })).toBeDefined();

  const toggle = screen.getByRole('button', { name: 'Toggle navigation' });
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  fireEvent.click(toggle);
  expect(toggle.getAttribute('aria-expanded')).toBe('true');
});
```

## Verification Commands

The compliance-related checks are verified with:

```bash
cd backend && ./shipcheck.sh
cd frontend && npm run test
cd frontend && npm run build
cd mobile && npm test -- --runInBand
cd mobile && npx tsc --noEmit
git diff --check
```

