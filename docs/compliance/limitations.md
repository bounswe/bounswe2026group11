# Limitations

This document records known limitations and the conditions required before broader compliance claims.

## Web Session Storage

Web access and refresh tokens are stored in `localStorage` in `frontend/src/contexts/AuthContext.tsx`. This preserves the established web session behavior. An HttpOnly secure-cookie session design would further reduce XSS token theft impact.

## Static-Site Content Security Policy

The static-site CSP includes `'unsafe-inline'` because the existing Vite/Google Maps integration and styling approach are not nonce/hash-based.

## WCAG Conformance

WCAG conformance cannot be claimed solely from code changes. Before a formal claim, run keyboard-only testing, browser zoom testing at 200%, screen-reader checks, and color-contrast scans on the deployed UI.

## OWASP and ASVS Scope

OWASP/ASVS alignment in these documents is a practical Level 1-style hardening posture. Full ASVS verification requires a dedicated security assessment, dependency audit evidence, deployment configuration review, and penetration testing.
