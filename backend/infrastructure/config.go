package infrastructure

import (
	"fmt"
	"os"
	"strings"

	"github.com/spf13/viper"
)

// Config holds application settings loaded via viper from .env (local) and
// environment variables (CI/CD). Env vars override values from the file.
type Config struct {
	AppPort    int
	DBHost     string
	DBPort     int
	DBName     string
	DBUser     string
	DBPassword string
	JWTSecret  string
}

// Load reads configuration using viper. If a .env file exists in the current
// working directory, it is loaded first; OS environment variables always take
// precedence. Required values must be set (non-empty where noted); optional
// keys use defaults from .env.example when unset.
func Load() (*Config, error) {
	v := viper.New()

	v.SetDefault("app_port", 8080)
	v.SetDefault("db_port", 5432)

	if st, err := os.Stat(".env"); err == nil && !st.IsDir() {
		v.SetConfigFile(".env")
		v.SetConfigType("env")
		if err := v.ReadInConfig(); err != nil {
			return nil, fmt.Errorf("load .env: %w", err)
		}
	} else if err != nil && !os.IsNotExist(err) {
		return nil, fmt.Errorf("stat .env: %w", err)
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

	cfg := &Config{
		AppPort:    v.GetInt("app_port"),
		DBHost:     strings.TrimSpace(v.GetString("db_host")),
		DBPort:     v.GetInt("db_port"),
		DBName:     strings.TrimSpace(v.GetString("db_name")),
		DBUser:     strings.TrimSpace(v.GetString("db_user")),
		DBPassword: v.GetString("db_password"),
		JWTSecret:  strings.TrimSpace(v.GetString("jwt_secret")),
	}

	if err := validate(v, cfg); err != nil {
		return nil, err
	}

	return cfg, nil
}

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

	return nil
}
