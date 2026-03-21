package config

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/spf13/viper"
)

const defaultAppEnv = "local"

// Config holds application settings loaded from an environment-specific YAML
// file first, then from .env for secrets, then from OS environment variables.
type Config struct {
	AppPort           int
	DBHost            string
	DBPort            int
	DBName            string
	DBUser            string
	DBPassword        string
	JWTSecret         string
	AccessTokenTTL    time.Duration
	RefreshTokenTTL   time.Duration
	MaxSessionTTL     time.Duration
	OTPTTL            time.Duration
	OTPMaxAttempts    int
	OTPResendCooldown time.Duration
	OTPRequestLimit   int
	OTPRequestWindow  time.Duration
	LoginRateLimit    int
	LoginRateWindow   time.Duration
	OTPMailerMode     string
}

// Load reads configuration using the following precedence:
// 1. config/application.<APP_ENV>.yaml (or APP_CONFIG_FILE if set)
// 2. .env in the process working directory
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
	bind("otp_mailer_mode", "OTP_MAILER_MODE")

	cfg := &Config{
		AppPort:           v.GetInt("app_port"),
		DBHost:            strings.TrimSpace(v.GetString("db_host")),
		DBPort:            v.GetInt("db_port"),
		DBName:            strings.TrimSpace(v.GetString("db_name")),
		DBUser:            strings.TrimSpace(v.GetString("db_user")),
		DBPassword:        v.GetString("db_password"),
		JWTSecret:         strings.TrimSpace(v.GetString("jwt_secret")),
		AccessTokenTTL:    v.GetDuration("access_token_ttl"),
		RefreshTokenTTL:   v.GetDuration("refresh_token_ttl"),
		MaxSessionTTL:     v.GetDuration("max_session_ttl"),
		OTPTTL:            v.GetDuration("otp_ttl"),
		OTPMaxAttempts:    v.GetInt("otp_max_attempts"),
		OTPResendCooldown: v.GetDuration("otp_resend_cooldown"),
		OTPRequestLimit:   v.GetInt("otp_request_limit"),
		OTPRequestWindow:  v.GetDuration("otp_request_window"),
		LoginRateLimit:    v.GetInt("login_rate_limit"),
		LoginRateWindow:   v.GetDuration("login_rate_window"),
		OTPMailerMode:     strings.TrimSpace(v.GetString("otp_mailer_mode")),
	}

	if err := validate(v, cfg); err != nil {
		return nil, err
	}

	return cfg, nil
}

// loadBaseConfig reads the environment-specific YAML file. It checks APP_CONFIG_FILE
// first, then probes config/ and ../config/ relative to the working directory.
func loadBaseConfig(v *viper.Viper, appEnv string) error {
	configFile := strings.TrimSpace(os.Getenv("APP_CONFIG_FILE"))
	if configFile != "" {
		v.SetConfigFile(configFile)
		if err := v.ReadInConfig(); err != nil {
			return fmt.Errorf("load APP_CONFIG_FILE %q: %w", configFile, err)
		}
		return nil
	}

	configName := fmt.Sprintf("application.%s", appEnv)
	// Try config/ first (normal run from repo root), then ../config/ (run from cmd/server).
	for _, configPath := range []string{"config", filepath.Join("..", "config")} {
		v.SetConfigName(configName)
		v.SetConfigType("yaml")
		v.AddConfigPath(configPath)
		if err := v.ReadInConfig(); err == nil {
			return nil
		} else if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			return fmt.Errorf("load %s.yaml from %s: %w", configName, configPath, err)
		}
	}

	return fmt.Errorf(
		"base configuration missing: expected config/%s.yaml (or APP_CONFIG_FILE) relative to the working directory",
		configName,
	)
}

// mergeDotEnv merges key=value pairs from a .env file if one exists in the
// current working directory. Missing .env is silently ignored.
func mergeDotEnv(v *viper.Viper) error {
	if st, err := os.Stat(".env"); err == nil && !st.IsDir() {
		v.SetConfigFile(".env")
		v.SetConfigType("env")
		if err := v.MergeInConfig(); err != nil {
			return fmt.Errorf("load .env: %w", err)
		}
		return nil
	} else if err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("stat .env: %w", err)
	}

	return nil
}

// validate ensures all required config values are present and within valid ranges.
func validate(v *viper.Viper, c *Config) error {
	missing := func(envVar string) error {
		return fmt.Errorf("required configuration missing: set %s in the environment or in a .env file next to the process working directory", envVar)
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
	if c.OTPMailerMode == "" {
		return fmt.Errorf("OTP_MAILER_MODE cannot be empty")
	}
	if c.OTPMailerMode != "mock" {
		return fmt.Errorf("OTP_MAILER_MODE must be \"mock\", got %q", c.OTPMailerMode)
	}

	return nil
}
