package config

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestLoad_RequiredMissing(t *testing.T) {
	// given
	dir := t.TempDir()
	t.Chdir(dir)
	clearConfigEnv(t)

	// when
	_, err := Load()

	// then
	if err == nil {
		t.Fatal("expected error")
	}
	if !strings.Contains(err.Error(), "base configuration missing") {
		t.Fatalf("expected missing base config error, got: %v", err)
	}
}

func TestLoad_OK(t *testing.T) {
	// given
	dir := t.TempDir()
	t.Chdir(dir)
	writeConfigFile(t, dir, "local", mockMailerConfigYAML("localhost"))
	clearConfigEnv(t)
	t.Setenv("APP_PORT", "9090")
	t.Setenv("JWT_SECRET", "test-secret-minimum")

	// when
	cfg, err := Load()

	// then
	if err != nil {
		t.Fatal(err)
	}
	if cfg.AppPort != 9090 || cfg.DBHost != "localhost" || cfg.JWTSecret != "test-secret-minimum" {
		t.Fatalf("unexpected cfg: %+v", cfg)
	}
	if cfg.MailProvider != "mock" || cfg.MailDomain != "socialeventmapper.com" {
		t.Fatalf("unexpected mail config: %+v", cfg)
	}
	if cfg.RatingGlobalPrior != 4.0 || cfg.RatingBayesianM != 5 {
		t.Fatalf("unexpected rating config: %+v", cfg)
	}
}

func TestLoad_UsesRepoRootDotEnvWhenRunningFromBackend(t *testing.T) {
	// given
	repoRoot := createRepoRoot(t)
	writeBackendConfigFile(t, repoRoot, "local", resendMailerConfigYAML("db.example"))
	writeFile(t, filepath.Join(repoRoot, ".env"), "JWT_SECRET=from-root\nRESEND_CLIENT_API_KEY=re_test\n")
	t.Chdir(filepath.Join(repoRoot, "backend"))
	clearConfigEnv(t)

	// when
	cfg, err := Load()

	// then
	if err != nil {
		t.Fatal(err)
	}
	if cfg.JWTSecret != "from-root" || cfg.ResendClientAPIKey != "re_test" {
		t.Fatalf("expected repo root .env values, got %+v", cfg)
	}
	if cfg.RatingGlobalPrior != 4.0 || cfg.RatingBayesianM != 5 {
		t.Fatalf("expected rating config from YAML, got %+v", cfg)
	}
}

func TestLoad_UsesRepoRootDotEnvWhenRunningFromCmdServer(t *testing.T) {
	// given
	repoRoot := createRepoRoot(t)
	writeBackendConfigFile(t, repoRoot, "local", resendMailerConfigYAML("db.example"))
	writeFile(t, filepath.Join(repoRoot, ".env"), "JWT_SECRET=from-root\nRESEND_CLIENT_API_KEY=re_test\n")
	t.Chdir(filepath.Join(repoRoot, "backend", "cmd", "server"))
	clearConfigEnv(t)

	// when
	cfg, err := Load()

	// then
	if err != nil {
		t.Fatal(err)
	}
	if cfg.DBHost != "db.example" || cfg.JWTSecret != "from-root" || cfg.ResendClientAPIKey != "re_test" {
		t.Fatalf("expected repo root config/env values, got %+v", cfg)
	}
}

func TestLoad_EnvOverridesYamlAndRepoRootDotEnv(t *testing.T) {
	// given
	repoRoot := createRepoRoot(t)
	writeBackendConfigFile(t, repoRoot, "local", mockMailerConfigYAML("file"))
	writeFile(t, filepath.Join(repoRoot, ".env"), "DB_PASSWORD=\nJWT_SECRET=file-secret\n")
	t.Chdir(filepath.Join(repoRoot, "backend"))
	clearConfigEnv(t)
	t.Setenv("DB_HOST", "override-host")
	t.Setenv("JWT_SECRET", "override-secret")
	t.Setenv("APP_PORT", "")
	t.Setenv("DB_PORT", "")
	t.Setenv("DB_NAME", "")
	t.Setenv("DB_USER", "")
	t.Setenv("DB_PASSWORD", "")

	// when
	cfg, err := Load()

	// then
	if err != nil {
		t.Fatal(err)
	}
	if cfg.DBHost != "override-host" || cfg.JWTSecret != "override-secret" {
		t.Fatalf("expected env to override YAML/.env, got %+v", cfg)
	}
	if cfg.AppPort != 8080 {
		t.Fatalf("expected APP_PORT from YAML, got %d", cfg.AppPort)
	}
}

func TestLoad_EmptyJWTSecret(t *testing.T) {
	// given
	dir := t.TempDir()
	t.Chdir(dir)
	writeConfigFile(t, dir, "local", mockMailerConfigYAML("localhost"))
	clearConfigEnv(t)
	t.Setenv("JWT_SECRET", "")

	// when
	_, err := Load()

	// then
	if err == nil {
		t.Fatal("expected error")
	}
	if !strings.Contains(err.Error(), "JWT_SECRET") {
		t.Fatalf("expected JWT_SECRET in error, got: %v", err)
	}
}

func TestLoad_UsesAppEnvSpecificYaml(t *testing.T) {
	// given
	dir := t.TempDir()
	t.Chdir(dir)
	writeConfigFile(t, dir, "local", mockMailerConfigYAML("localhost"))
	writeConfigFile(t, dir, "dev", mockMailerConfigYAML("postgres"))
	clearConfigEnv(t)
	t.Setenv("APP_ENV", "dev")
	t.Setenv("JWT_SECRET", "dev-secret")

	// when
	cfg, err := Load()

	// then
	if err != nil {
		t.Fatal(err)
	}
	if cfg.DBHost != "postgres" {
		t.Fatalf("expected dev YAML to be loaded, got %+v", cfg)
	}
}

func TestLoad_RequiresResendAPIKeyWhenProviderIsResend(t *testing.T) {
	// given
	dir := t.TempDir()
	t.Chdir(dir)
	writeConfigFile(t, dir, "local", resendMailerConfigYAML("localhost"))
	clearConfigEnv(t)
	t.Setenv("JWT_SECRET", "secret")

	// when
	_, err := Load()

	// then
	if err == nil {
		t.Fatal("expected error")
	}
	if !strings.Contains(err.Error(), "RESEND_CLIENT_API_KEY") {
		t.Fatalf("expected RESEND_CLIENT_API_KEY in error, got: %v", err)
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
		"AVAILABILITY_RATE_LIMIT",
		"AVAILABILITY_RATE_WINDOW",
		"MAIL_PROVIDER",
		"MAIL_DOMAIN",
		"RESEND_CLIENT_API_KEY",
		"RATING_GLOBAL_PRIOR",
		"RATING_BAYESIAN_M",
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
	writeFile(t, filename, contents)
}

func writeBackendConfigFile(t *testing.T, repoRoot, envName, contents string) {
	t.Helper()
	configDir := filepath.Join(repoRoot, "backend", "config")
	if err := os.MkdirAll(configDir, 0o755); err != nil {
		t.Fatal(err)
	}
	filename := filepath.Join(configDir, "application."+envName+".yaml")
	writeFile(t, filename, contents)
}

func createRepoRoot(t *testing.T) string {
	t.Helper()

	repoRoot := t.TempDir()
	writeFile(t, filepath.Join(repoRoot, "AGENTS.md"), "# test repo\n")
	for _, path := range []string{
		filepath.Join(repoRoot, "backend"),
		filepath.Join(repoRoot, "backend", "cmd", "server"),
		filepath.Join(repoRoot, "backend", "config"),
	} {
		if err := os.MkdirAll(path, 0o755); err != nil {
			t.Fatal(err)
		}
	}
	return repoRoot
}

func writeFile(t *testing.T, path, contents string) {
	t.Helper()
	if err := os.WriteFile(path, []byte(contents), 0o600); err != nil {
		t.Fatal(err)
	}
}

func mockMailerConfigYAML(dbHost string) string {
	return strings.TrimSpace(`
app_port: 8080
db_host: `+dbHost+`
db_port: 5432
db_name: sem
db_user: postgres
access_token_ttl: 15m
refresh_token_ttl: 336h
max_session_ttl: 1440h
otp_ttl: 10m
otp_max_attempts: 5
otp_resend_cooldown: 1m
otp_request_limit: 5
otp_request_window: 10m
login_rate_limit: 10
login_rate_window: 15m
availability_rate_limit: 20
availability_rate_window: 15m
mail_provider: mock
mail_domain: socialeventmapper.com
rating_global_prior: 4.0
rating_bayesian_m: 5
`) + "\n"
}

func resendMailerConfigYAML(dbHost string) string {
	return strings.TrimSpace(`
app_port: 8080
db_host: `+dbHost+`
db_port: 5432
db_name: sem
db_user: postgres
access_token_ttl: 15m
refresh_token_ttl: 336h
max_session_ttl: 1440h
otp_ttl: 10m
otp_max_attempts: 5
otp_resend_cooldown: 1m
otp_request_limit: 5
otp_request_window: 10m
login_rate_limit: 10
login_rate_window: 15m
availability_rate_limit: 20
availability_rate_window: 15m
mail_provider: resend
mail_domain: socialeventmapper.com
rating_global_prior: 4.0
rating_bayesian_m: 5
`) + "\n"
}
