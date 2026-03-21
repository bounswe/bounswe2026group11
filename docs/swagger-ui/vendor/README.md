# Vendored Swagger UI

Static assets from **swagger-ui-dist@5.18.2** (Apache 2.0). See `swagger-ui-dist/LICENSE`.

## Upgrade (offline-friendly)

From repo root, with Node/npm available:

```bash
mkdir -p /tmp/swagger-vendor && cd /tmp/swagger-vendor
npm pack swagger-ui-dist@<version>
tar -xzf swagger-ui-dist-*.tgz
cp package/swagger-ui.css package/swagger-ui-bundle.js package/swagger-ui-standalone-preset.js \
  /path/to/repo/docs/swagger-ui/vendor/swagger-ui-dist/
# Optional: favicons, oauth2-redirect.html
```

Then update this README with the new version number.
