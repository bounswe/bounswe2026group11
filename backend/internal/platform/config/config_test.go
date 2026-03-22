package config

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestLoad_RequiredMissing(t *testing.T) {
	dir := t.TempDir()
	t.Chdir(dir)
	clearConfigEnv(t)

	_, err := Load()
	if err == nil {
		t.Fatal("expected error")
	}
	if !strings.Contains(err.Error(), "base configuration missing") {
		t.Fatalf("expected missing base config error, got: %v", err)
	}
}

func TestLoad_OK(t *testing.T) {
	dir := t.TempDir()
	t.Chdir(dir)
	writeConfigFile(t, dir, "local", "app_port: 8080\ndb_host: localhost\ndb_port: 5432\ndb_name: sem\ndb_user: postgres\naccess_token_ttl: 15m\nrefresh_token_ttl: 336h\nmax_session_ttl: 1440h\notp_ttl: 10m\notp_max_attempts: 5\notp_resend_cooldown: 1m\notp_request_limit: 5\notp_request_window: 10m\nlogin_rate_limit: 10\nlogin_rate_window: 15m\notp_mailer_mode: mock\n")
	clearConfigEnv(t)
	t.Setenv("APP_PORT", "9090")
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
	writeConfigFile(t, dir, "local", "app_port: 8080\ndb_host: db.example\ndb_port: 5432\ndb_name: sem\ndb_user: postgres\naccess_token_ttl: 15m\nrefresh_token_ttl: 336h\nmax_session_ttl: 1440h\notp_ttl: 10m\notp_max_attempts: 5\notp_resend_cooldown: 1m\notp_request_limit: 5\notp_request_window: 10m\nlogin_rate_limit: 10\nlogin_rate_window: 15m\notp_mailer_mode: mock\n")

	envContent := strings.TrimSpace(`
DB_PASSWORD=
JWT_SECRET=from-file
`) + "\n"
	if err := os.WriteFile(filepath.Join(dir, ".env"), []byte(envContent), 0o600); err != nil {
		t.Fatal(err)
	}

	clearConfigEnv(t)

	cfg, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.AppPort != 8080 || cfg.JWTSecret != "from-file" || cfg.DBHost != "db.example" {
		t.Fatalf("unexpected cfg: %+v", cfg)
	}
}

func TestLoad_EnvOverridesYamlAndDotEnv(t *testing.T) {
	dir := t.TempDir()
	t.Chdir(dir)
	writeConfigFile(t, dir, "local", "app_port: 7070\ndb_host: file\ndb_port: 5432\ndb_name: sem\ndb_user: postgres\naccess_token_ttl: 15m\nrefresh_token_ttl: 336h\nmax_session_ttl: 1440h\notp_ttl: 10m\notp_max_attempts: 5\notp_resend_cooldown: 1m\notp_request_limit: 5\notp_request_window: 10m\nlogin_rate_limit: 10\nlogin_rate_window: 15m\notp_mailer_mode: mock\n")

	if err := os.WriteFile(filepath.Join(dir, ".env"), []byte("DB_PASSWORD=\nJWT_SECRET=file-secret\n"), 0o600); err != nil {
		t.Fatal(err)
	}

	clearConfigEnv(t)
	t.Setenv("DB_HOST", "override-host")
	t.Setenv("JWT_SECRET", "override-secret")
	// Ensure other keys come from YAML / .env.
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
		t.Fatalf("expected env to override YAML/.env, got %+v", cfg)
	}
	if cfg.AppPort != 7070 {
		t.Fatalf("expected APP_PORT from YAML, got %d", cfg.AppPort)
	}
}

func TestLoad_EmptyJWTSecret(t *testing.T) {
	dir := t.TempDir()
	t.Chdir(dir)
	writeConfigFile(t, dir, "local", "app_port: 8080\ndb_host: localhost\ndb_port: 5432\ndb_name: sem\ndb_user: postgres\naccess_token_ttl: 15m\nrefresh_token_ttl: 336h\nmax_session_ttl: 1440h\notp_ttl: 10m\notp_max_attempts: 5\notp_resend_cooldown: 1m\notp_request_limit: 5\notp_request_window: 10m\nlogin_rate_limit: 10\nlogin_rate_window: 15m\notp_mailer_mode: mock\n")
	clearConfigEnv(t)
	t.Setenv("JWT_SECRET", "")

	_, err := Load()
	if err == nil {
		t.Fatal("expected error")
	}
	if !strings.Contains(err.Error(), "JWT_SECRET") {
		t.Fatalf("expected JWT_SECRET in error, got: %v", err)
	}
}

func TestLoad_UsesAppEnvSpecificYaml(t *testing.T) {
	dir := t.TempDir()
	t.Chdir(dir)
	writeConfigFile(t, dir, "local", "app_port: 8080\ndb_host: localhost\ndb_port: 5432\ndb_name: sem\ndb_user: postgres\naccess_token_ttl: 15m\nrefresh_token_ttl: 336h\nmax_session_ttl: 1440h\notp_ttl: 10m\notp_max_attempts: 5\notp_resend_cooldown: 1m\notp_request_limit: 5\notp_request_window: 10m\nlogin_rate_limit: 10\nlogin_rate_window: 15m\notp_mailer_mode: mock\n")
	writeConfigFile(t, dir, "dev", "app_port: 8080\ndb_host: postgres\ndb_port: 5432\ndb_name: sem\ndb_user: postgres\naccess_token_ttl: 15m\nrefresh_token_ttl: 336h\nmax_session_ttl: 1440h\notp_ttl: 10m\notp_max_attempts: 5\notp_resend_cooldown: 1m\notp_request_limit: 5\notp_request_window: 10m\nlogin_rate_limit: 10\nlogin_rate_window: 15m\notp_mailer_mode: mock\n")
	clearConfigEnv(t)
	t.Setenv("APP_ENV", "dev")
	t.Setenv("JWT_SECRET", "dev-secret")

	cfg, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.DBHost != "postgres" {
		t.Fatalf("expected dev YAML to be loaded, got %+v", cfg)
	}
}

func clearConfigEnv(t *testing.T) {
	t.Helper()
	for _, k := range []string{
		"APP_ENV",
		"APP_CONFIG_FILE",
		"APP_PORT",
		"DB_HOST",
		"DB_PORT",
		"DB_NAME",
		"DB_USER",
		"DB_PASSWORD",
		"JWT_SECRET",
		"ACCESS_TOKEN_TTL",
		"REFRESH_TOKEN_TTL",
		"MAX_SESSION_TTL",
		"OTP_TTL",
		"OTP_MAX_ATTEMPTS",
		"OTP_RESEND_COOLDOWN",
		"OTP_REQUEST_LIMIT",
		"OTP_REQUEST_WINDOW",
		"LOGIN_RATE_LIMIT",
		"LOGIN_RATE_WINDOW",
		"OTP_MAILER_MODE",
	} {
		t.Setenv(k, "")
	}
}

func writeConfigFile(t *testing.T, dir, envName, contents string) {
	t.Helper()
	configDir := filepath.Join(dir, "config")
	if err := os.MkdirAll(configDir, 0o755); err != nil {
		t.Fatal(err)
	}
	filename := filepath.Join(configDir, "application."+envName+".yaml")
	if err := os.WriteFile(filename, []byte(contents), 0o600); err != nil {
		t.Fatal(err)
	}
}
