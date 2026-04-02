package config

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/spf13/viper"
)

const defaultAppEnv = "local"

var appEnvPattern = regexp.MustCompile(`^[a-zA-Z0-9_-]+$`)

// Config holds application settings loaded from an environment-specific YAML
// file first, then from the repository-root .env for secrets, then from OS environment variables.
type Config struct {
	AppPort                int
	DBHost                 string
	DBPort                 int
	DBName                 string
	DBUser                 string
	DBPassword             string
	JWTSecret              string
	AccessTokenTTL         time.Duration
	RefreshTokenTTL        time.Duration
	MaxSessionTTL          time.Duration
	OTPTTL                 time.Duration
	OTPMaxAttempts         int
	OTPResendCooldown      time.Duration
	OTPRequestLimit        int
	OTPRequestWindow       time.Duration
	LoginRateLimit         int
	LoginRateWindow        time.Duration
	AvailabilityRateLimit  int
	AvailabilityRateWindow time.Duration
	MailProvider           string
	MailDomain             string
	ResendClientAPIKey     string
	RatingGlobalPrior      float64
	RatingBayesianM        int
	SpacesAccessKey        string
	SpacesSecretKey        string
	SpacesEndpoint         string
	SpacesBucket           string
	SpacesCDNBaseURL       string
	SpacesS3Region         string
	SpacesPresignTTL       time.Duration
	SpacesUploadCacheCtrl  string
}

// Load reads configuration using the following precedence:
// 1. config/application.<APP_ENV>.yaml (or APP_CONFIG_FILE if set)
// 2. repository-root .env
// 3. OS environment variables
func Load() (*Config, error) {
	v := viper.New()

	appEnv := strings.TrimSpace(os.Getenv("APP_ENV"))
	if appEnv == "" {
		appEnv = defaultAppEnv
	}

	if err := loadBaseConfig(v, appEnv); err != nil {
		return nil, err
	}
	if err := mergeDotEnv(v); err != nil {
		return nil, err
	}

	v.AutomaticEnv()

	bind := func(key, envVar string) {
		_ = v.BindEnv(key, envVar)
	}
	bind("app_port", "APP_PORT")
	bind("db_host", "DB_HOST")
	bind("db_port", "DB_PORT")
	bind("db_name", "DB_NAME")
	bind("db_user", "DB_USER")
	bind("db_password", "DB_PASSWORD")
	bind("jwt_secret", "JWT_SECRET")
	bind("access_token_ttl", "ACCESS_TOKEN_TTL")
	bind("refresh_token_ttl", "REFRESH_TOKEN_TTL")
	bind("max_session_ttl", "MAX_SESSION_TTL")
	bind("otp_ttl", "OTP_TTL")
	bind("otp_max_attempts", "OTP_MAX_ATTEMPTS")
	bind("otp_resend_cooldown", "OTP_RESEND_COOLDOWN")
	bind("otp_request_limit", "OTP_REQUEST_LIMIT")
	bind("otp_request_window", "OTP_REQUEST_WINDOW")
	bind("login_rate_limit", "LOGIN_RATE_LIMIT")
	bind("login_rate_window", "LOGIN_RATE_WINDOW")
	bind("availability_rate_limit", "AVAILABILITY_RATE_LIMIT")
	bind("availability_rate_window", "AVAILABILITY_RATE_WINDOW")
	bind("mail_provider", "MAIL_PROVIDER")
	bind("mail_domain", "MAIL_DOMAIN")
	bind("resend_client_api_key", "RESEND_CLIENT_API_KEY")
	bind("rating_global_prior", "RATING_GLOBAL_PRIOR")
	bind("rating_bayesian_m", "RATING_BAYESIAN_M")
	bind("spaces_access_key", "SPACES_ACCESS_KEY")
	bind("spaces_secret_key", "SPACES_SECRET_KEY")
	bind("spaces_endpoint", "SPACES_ENDPOINT")
	bind("spaces_bucket", "SPACES_BUCKET")
	bind("spaces_cdn_base_url", "SPACES_CDN_BASE_URL")
	bind("spaces_s3_region", "SPACES_S3_REGION")
	bind("spaces_presign_ttl", "SPACES_PRESIGN_TTL")
	bind("spaces_upload_cache_control", "SPACES_UPLOAD_CACHE_CONTROL")

	cfg := &Config{
		AppPort:                v.GetInt("app_port"),
		DBHost:                 strings.TrimSpace(v.GetString("db_host")),
		DBPort:                 v.GetInt("db_port"),
		DBName:                 strings.TrimSpace(v.GetString("db_name")),
		DBUser:                 strings.TrimSpace(v.GetString("db_user")),
		DBPassword:             v.GetString("db_password"),
		JWTSecret:              strings.TrimSpace(v.GetString("jwt_secret")),
		AccessTokenTTL:         v.GetDuration("access_token_ttl"),
		RefreshTokenTTL:        v.GetDuration("refresh_token_ttl"),
		MaxSessionTTL:          v.GetDuration("max_session_ttl"),
		OTPTTL:                 v.GetDuration("otp_ttl"),
		OTPMaxAttempts:         v.GetInt("otp_max_attempts"),
		OTPResendCooldown:      v.GetDuration("otp_resend_cooldown"),
		OTPRequestLimit:        v.GetInt("otp_request_limit"),
		OTPRequestWindow:       v.GetDuration("otp_request_window"),
		LoginRateLimit:         v.GetInt("login_rate_limit"),
		LoginRateWindow:        v.GetDuration("login_rate_window"),
		AvailabilityRateLimit:  v.GetInt("availability_rate_limit"),
		AvailabilityRateWindow: v.GetDuration("availability_rate_window"),
		MailProvider:           strings.TrimSpace(v.GetString("mail_provider")),
		MailDomain:             strings.TrimSpace(v.GetString("mail_domain")),
		ResendClientAPIKey:     strings.TrimSpace(v.GetString("resend_client_api_key")),
		RatingGlobalPrior:      v.GetFloat64("rating_global_prior"),
		RatingBayesianM:        v.GetInt("rating_bayesian_m"),
		SpacesAccessKey:        strings.TrimSpace(v.GetString("spaces_access_key")),
		SpacesSecretKey:        strings.TrimSpace(v.GetString("spaces_secret_key")),
		SpacesEndpoint:         strings.TrimSpace(v.GetString("spaces_endpoint")),
		SpacesBucket:           strings.TrimSpace(v.GetString("spaces_bucket")),
		SpacesCDNBaseURL:       strings.TrimSpace(v.GetString("spaces_cdn_base_url")),
		SpacesS3Region:         strings.TrimSpace(v.GetString("spaces_s3_region")),
		SpacesPresignTTL:       v.GetDuration("spaces_presign_ttl"),
		SpacesUploadCacheCtrl:  strings.TrimSpace(v.GetString("spaces_upload_cache_control")),
	}

	if err := validate(v, cfg); err != nil {
		return nil, err
	}

	return cfg, nil
}

// loadBaseConfig reads the environment-specific YAML file. It checks APP_CONFIG_FILE
// first, then probes a small set of supported backend working-directory layouts.
func loadBaseConfig(v *viper.Viper, appEnv string) error {
	configFile := strings.TrimSpace(os.Getenv("APP_CONFIG_FILE"))
	if configFile != "" {
		v.SetConfigFile(configFile)
		if err := v.ReadInConfig(); err != nil {
			return fmt.Errorf("load APP_CONFIG_FILE %q: %w", configFile, err)
		}
		return nil
	}

	if !appEnvPattern.MatchString(appEnv) {
		return fmt.Errorf("APP_ENV must contain only letters, numbers, underscore, or hyphen")
	}

	configName := fmt.Sprintf("application.%s.yaml", appEnv)
	for _, candidate := range []string{
		filepath.Join("config", configName),
		filepath.Join("..", "config", configName),
		filepath.Join("..", "..", "config", configName),
		filepath.Join("backend", "config", configName),
	} {
		// #nosec G703 -- appEnv is validated above and candidate directories are fixed backend config locations.
		if st, err := os.Stat(candidate); err == nil && !st.IsDir() {
			v.SetConfigFile(candidate)
			if err := v.ReadInConfig(); err != nil {
				return fmt.Errorf("load %s: %w", candidate, err)
			}
			return nil
		} else if err != nil && !os.IsNotExist(err) {
			return fmt.Errorf("stat %s: %w", candidate, err)
		}
	}

	return fmt.Errorf(
		"base configuration missing: expected %s under config/, ../config/, ../../config/, or backend/config/ relative to the working directory",
		configName,
	)
}

// mergeDotEnv merges key=value pairs from the repository root .env file.
// Missing .env is silently ignored so containerized runs can rely on process env.
func mergeDotEnv(v *viper.Viper) error {
	workingDir, err := os.Getwd()
	if err != nil {
		return fmt.Errorf("get working directory: %w", err)
	}

	repoRoot, err := findRepositoryRoot(workingDir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return fmt.Errorf("resolve repository root: %w", err)
	}

	envPath := filepath.Join(repoRoot, ".env")
	if st, err := os.Stat(envPath); err == nil && !st.IsDir() {
		v.SetConfigFile(envPath)
		v.SetConfigType("env")
		if err := v.MergeInConfig(); err != nil {
			return fmt.Errorf("load %s: %w", envPath, err)
		}
		return nil
	} else if err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("stat %s: %w", envPath, err)
	}

	return nil
}

func findRepositoryRoot(start string) (string, error) {
	dir := filepath.Clean(start)
	for {
		agentsPath := filepath.Join(dir, "AGENTS.md")
		backendPath := filepath.Join(dir, "backend")

		if fileInfo, err := os.Stat(agentsPath); err == nil && !fileInfo.IsDir() {
			if backendInfo, err := os.Stat(backendPath); err == nil && backendInfo.IsDir() {
				return dir, nil
			} else if err != nil && !os.IsNotExist(err) {
				return "", fmt.Errorf("stat %s: %w", backendPath, err)
			}
		} else if err != nil && !os.IsNotExist(err) {
			return "", fmt.Errorf("stat %s: %w", agentsPath, err)
		}

		parent := filepath.Dir(dir)
		if parent == dir {
			return "", os.ErrNotExist
		}
		dir = parent
	}
}

// validate ensures all required config values are present and within valid ranges.
func validate(v *viper.Viper, c *Config) error {
	missing := func(envVar string) error {
		return fmt.Errorf("required configuration missing: set %s in the environment or in the repository-root .env file", envVar)
	}

	if !v.IsSet("db_host") && c.DBHost == "" {
		return missing("DB_HOST")
	}
	if c.DBHost == "" {
		return fmt.Errorf("DB_HOST is required and cannot be empty")
	}

	if !v.IsSet("db_name") && c.DBName == "" {
		return missing("DB_NAME")
	}
	if c.DBName == "" {
		return fmt.Errorf("DB_NAME is required and cannot be empty")
	}

	if !v.IsSet("db_user") && c.DBUser == "" {
		return missing("DB_USER")
	}
	if c.DBUser == "" {
		return fmt.Errorf("DB_USER is required and cannot be empty")
	}

	if !v.IsSet("jwt_secret") && c.JWTSecret == "" {
		return missing("JWT_SECRET")
	}
	if c.JWTSecret == "" {
		return fmt.Errorf("JWT_SECRET is required and cannot be empty")
	}

	if c.AppPort < 1 || c.AppPort > 65535 {
		return fmt.Errorf("APP_PORT must be between 1 and 65535, got %d", c.AppPort)
	}
	if c.DBPort < 1 || c.DBPort > 65535 {
		return fmt.Errorf("DB_PORT must be between 1 and 65535, got %d", c.DBPort)
	}
	if c.AccessTokenTTL <= 0 {
		return fmt.Errorf("ACCESS_TOKEN_TTL must be greater than zero")
	}
	if c.RefreshTokenTTL <= 0 {
		return fmt.Errorf("REFRESH_TOKEN_TTL must be greater than zero")
	}
	if c.MaxSessionTTL <= 0 {
		return fmt.Errorf("MAX_SESSION_TTL must be greater than zero")
	}
	if c.MaxSessionTTL < c.RefreshTokenTTL {
		return fmt.Errorf("MAX_SESSION_TTL must be greater than or equal to REFRESH_TOKEN_TTL")
	}
	if c.OTPTTL <= 0 {
		return fmt.Errorf("OTP_TTL must be greater than zero")
	}
	if c.OTPMaxAttempts < 1 {
		return fmt.Errorf("OTP_MAX_ATTEMPTS must be at least 1")
	}
	if c.OTPResendCooldown < 0 {
		return fmt.Errorf("OTP_RESEND_COOLDOWN cannot be negative")
	}
	if c.OTPRequestLimit < 1 {
		return fmt.Errorf("OTP_REQUEST_LIMIT must be at least 1")
	}
	if c.OTPRequestWindow <= 0 {
		return fmt.Errorf("OTP_REQUEST_WINDOW must be greater than zero")
	}
	if c.LoginRateLimit < 1 {
		return fmt.Errorf("LOGIN_RATE_LIMIT must be at least 1")
	}
	if c.LoginRateWindow <= 0 {
		return fmt.Errorf("LOGIN_RATE_WINDOW must be greater than zero")
	}
	if c.AvailabilityRateLimit < 1 {
		return fmt.Errorf("AVAILABILITY_RATE_LIMIT must be at least 1")
	}
	if c.AvailabilityRateWindow <= 0 {
		return fmt.Errorf("AVAILABILITY_RATE_WINDOW must be greater than zero")
	}
	if c.MailProvider == "" {
		return fmt.Errorf("MAIL_PROVIDER cannot be empty")
	}
	if c.MailProvider != "mock" && c.MailProvider != "resend" {
		return fmt.Errorf("MAIL_PROVIDER must be \"mock\" or \"resend\", got %q", c.MailProvider)
	}
	if c.MailDomain == "" {
		return fmt.Errorf("MAIL_DOMAIN is required and cannot be empty")
	}
	if c.MailProvider == "resend" {
		if !v.IsSet("resend_client_api_key") && c.ResendClientAPIKey == "" {
			return missing("RESEND_CLIENT_API_KEY")
		}
		if c.ResendClientAPIKey == "" {
			return fmt.Errorf("RESEND_CLIENT_API_KEY is required and cannot be empty")
		}
	}
	if c.RatingGlobalPrior < 1 || c.RatingGlobalPrior > 5 {
		return fmt.Errorf("RATING_GLOBAL_PRIOR must be between 1 and 5")
	}
	if c.RatingBayesianM < 1 {
		return fmt.Errorf("RATING_BAYESIAN_M must be at least 1")
	}
	if !v.IsSet("spaces_access_key") && c.SpacesAccessKey == "" {
		return missing("SPACES_ACCESS_KEY")
	}
	if c.SpacesAccessKey == "" {
		return fmt.Errorf("SPACES_ACCESS_KEY is required and cannot be empty")
	}
	if !v.IsSet("spaces_secret_key") && c.SpacesSecretKey == "" {
		return missing("SPACES_SECRET_KEY")
	}
	if c.SpacesSecretKey == "" {
		return fmt.Errorf("SPACES_SECRET_KEY is required and cannot be empty")
	}
	if !v.IsSet("spaces_endpoint") && c.SpacesEndpoint == "" {
		return missing("SPACES_ENDPOINT")
	}
	if c.SpacesEndpoint == "" {
		return fmt.Errorf("SPACES_ENDPOINT is required and cannot be empty")
	}
	if !v.IsSet("spaces_bucket") && c.SpacesBucket == "" {
		return missing("SPACES_BUCKET")
	}
	if c.SpacesBucket == "" {
		return fmt.Errorf("SPACES_BUCKET is required and cannot be empty")
	}
	if !v.IsSet("spaces_cdn_base_url") && c.SpacesCDNBaseURL == "" {
		return missing("SPACES_CDN_BASE_URL")
	}
	if c.SpacesCDNBaseURL == "" {
		return fmt.Errorf("SPACES_CDN_BASE_URL is required and cannot be empty")
	}
	if !v.IsSet("spaces_s3_region") && c.SpacesS3Region == "" {
		return missing("SPACES_S3_REGION")
	}
	if c.SpacesS3Region == "" {
		return fmt.Errorf("SPACES_S3_REGION is required and cannot be empty")
	}
	if c.SpacesPresignTTL <= 0 {
		return fmt.Errorf("SPACES_PRESIGN_TTL must be greater than zero")
	}
	if c.SpacesUploadCacheCtrl == "" {
		return fmt.Errorf("SPACES_UPLOAD_CACHE_CONTROL is required and cannot be empty")
	}

	return nil
}
