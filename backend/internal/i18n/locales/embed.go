// Package locales embeds the JSON translation catalogs at build time so
// the backend ships as a single binary.
package locales

import "embed"

//go:embed *.json
var FS embed.FS

// Dir is the embedded subdirectory passed to i18n.LoadFromFS. The catalogs
// live at the package root, so the directory is "." within FS.
const Dir = "."
