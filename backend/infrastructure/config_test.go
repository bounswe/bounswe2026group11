package infrastructure

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestLoad_RequiredMissing(t *testing.T) {
	// No .env in package test dir; clear relevant env.
	for _, k := range []string{
		"APP_PORT", "DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD", "JWT_SECRET",
	} {
		t.Setenv(k, "")
	}

	_, err := Load()
	if err == nil {
		t.Fatal("expected error")
	}
	if !strings.Contains(err.Error(), "DB_HOST") {
		t.Fatalf("expected DB_HOST in error, got: %v", err)
	}
}

func TestLoad_OK(t *testing.T) {
	t.Setenv("APP_PORT", "9090")
	t.Setenv("DB_HOST", "localhost")
	t.Setenv("DB_PORT", "5432")
	t.Setenv("DB_NAME", "sem")
	t.Setenv("DB_USER", "postgres")
	t.Setenv("DB_PASSWORD", "")
	t.Setenv("JWT_SECRET", "test-secret-minimum")

	cfg, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.AppPort != 9090 || cfg.DBHost != "localhost" || cfg.JWTSecret != "test-secret-minimum" {
		t.Fatalf("unexpected cfg: %+v", cfg)
	}
}

func TestLoad_FromDotEnv(t *testing.T) {
	dir := t.TempDir()
	t.Chdir(dir)

	envContent := strings.TrimSpace(`
APP_PORT=7070
DB_HOST=db.example
DB_PORT=5432
DB_NAME=sem
DB_USER=postgres
DB_PASSWORD=
JWT_SECRET=from-file
`) + "\n"
	if err := os.WriteFile(filepath.Join(dir, ".env"), []byte(envContent), 0o600); err != nil {
		t.Fatal(err)
	}

	for _, k := range []string{
		"APP_PORT", "DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD", "JWT_SECRET",
	} {
		t.Setenv(k, "")
	}

	cfg, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.AppPort != 7070 || cfg.JWTSecret != "from-file" || cfg.DBHost != "db.example" {
		t.Fatalf("unexpected cfg: %+v", cfg)
	}
}

func TestLoad_EnvOverridesDotEnv(t *testing.T) {
	dir := t.TempDir()
	t.Chdir(dir)

	if err := os.WriteFile(filepath.Join(dir, ".env"), []byte("APP_PORT=7070\nDB_HOST=file\nDB_PORT=5432\nDB_NAME=sem\nDB_USER=postgres\nDB_PASSWORD=\nJWT_SECRET=file-secret\n"), 0o600); err != nil {
		t.Fatal(err)
	}

	t.Setenv("DB_HOST", "override-host")
	t.Setenv("JWT_SECRET", "override-secret")
	// Ensure other keys come from file / defaults
	t.Setenv("APP_PORT", "")
	t.Setenv("DB_PORT", "")
	t.Setenv("DB_NAME", "")
	t.Setenv("DB_USER", "")
	t.Setenv("DB_PASSWORD", "")

	cfg, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.DBHost != "override-host" || cfg.JWTSecret != "override-secret" {
		t.Fatalf("expected env to override .env, got %+v", cfg)
	}
	if cfg.AppPort != 7070 {
		t.Fatalf("expected APP_PORT from file, got %d", cfg.AppPort)
	}
}

func TestLoad_EmptyJWTSecret(t *testing.T) {
	t.Setenv("DB_HOST", "localhost")
	t.Setenv("DB_NAME", "sem")
	t.Setenv("DB_USER", "postgres")
	t.Setenv("JWT_SECRET", "")

	_, err := Load()
	if err == nil {
		t.Fatal("expected error")
	}
	if !strings.Contains(err.Error(), "JWT_SECRET") {
		t.Fatalf("expected JWT_SECRET in error, got: %v", err)
	}
}
