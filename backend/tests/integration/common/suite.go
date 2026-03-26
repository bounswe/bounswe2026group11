//go:build integration

package common

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	tc "github.com/testcontainers/testcontainers-go"
	tcpostgres "github.com/testcontainers/testcontainers-go/modules/postgres"
	"github.com/testcontainers/testcontainers-go/wait"
)

var (
	integrationPool       *pgxpool.Pool
	integrationContainer  *tcpostgres.PostgresContainer
	integrationSkipReason string
	initScriptPath        string
)

// Run bootstraps the shared integration database once per test package.
func Run(m *testing.M) int {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	if err := ensureDockerAvailable(); err != nil {
		integrationSkipReason = err.Error()
		return m.Run()
	}

	if err := startSharedPostgres(ctx); err != nil {
		fmt.Fprintf(os.Stderr, "failed to start shared integration database: %v\n", err)
		return 1
	}
	defer cleanup()

	return m.Run()
}

// RequirePool returns the shared integration pool or skips when prerequisites
// are not available.
func RequirePool(t *testing.T) *pgxpool.Pool {
	t.Helper()

	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	if integrationSkipReason != "" {
		t.Skipf("skipping integration test: %s", integrationSkipReason)
	}
	if integrationPool == nil {
		t.Fatal("integration database pool is not initialized")
	}

	return integrationPool
}

// BeginTx opens a per-test transaction and rolls it back during cleanup.
func BeginTx(t *testing.T) (*pgxpool.Pool, pgx.Tx) {
	t.Helper()

	pool := RequirePool(t)
	tx, err := pool.BeginTx(context.Background(), pgx.TxOptions{})
	if err != nil {
		t.Fatalf("BeginTx() error = %v", err)
	}

	t.Cleanup(func() {
		_ = tx.Rollback(context.Background())
	})

	return pool, tx
}

// RequireAppErrorCode asserts that err is a domain.AppError with the expected code.
func RequireAppErrorCode(t *testing.T, err error, code string) {
	t.Helper()

	var appErr *domain.AppError
	if !errors.As(err, &appErr) {
		t.Fatalf("expected *domain.AppError, got %T: %v", err, err)
	}
	if appErr.Code != code {
		t.Fatalf("expected error code %q, got %q", code, appErr.Code)
	}
}

func cleanup() {
	if integrationPool != nil {
		integrationPool.Close()
	}
	if integrationContainer != nil {
		_ = tc.TerminateContainer(integrationContainer)
	}
	if initScriptPath != "" {
		_ = os.RemoveAll(filepath.Dir(initScriptPath))
	}
}

func startSharedPostgres(ctx context.Context) error {
	initScriptPath = writeInitScript()

	scripts := []string{initScriptPath}
	scripts = append(scripts, migrationPaths()...)

	var err error
	integrationContainer, err = tcpostgres.Run(
		ctx,
		"postgis/postgis:16-3.4",
		tcpostgres.WithDatabase("sem_integration"),
		tcpostgres.WithUsername("postgres"),
		tcpostgres.WithPassword("postgres"),
		tcpostgres.WithOrderedInitScripts(scripts...),
		tc.WithAdditionalWaitStrategyAndDeadline(
			2*time.Minute,
			wait.ForAll(
				wait.ForListeningPort("5432/tcp"),
				wait.ForLog("database system is ready to accept connections").WithOccurrence(2),
			),
		),
	)
	if err != nil {
		return fmt.Errorf("postgres.Run(): %w", err)
	}

	dsn, err := integrationContainer.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		return fmt.Errorf("ConnectionString(): %w", err)
	}

	integrationPool, err = pgxpool.New(ctx, dsn)
	if err != nil {
		return fmt.Errorf("pgxpool.New(): %w", err)
	}

	if err := integrationPool.Ping(ctx); err != nil {
		return fmt.Errorf("pool.Ping(): %w", err)
	}
	if err := waitForSchema(ctx, integrationPool); err != nil {
		return err
	}

	return nil
}

func waitForSchema(ctx context.Context, pool *pgxpool.Pool) error {
	deadline := time.Now().Add(15 * time.Second)
	for time.Now().Before(deadline) {
		var ready bool
		err := pool.QueryRow(ctx, `SELECT to_regclass('public.app_user') IS NOT NULL`).Scan(&ready)
		if err == nil && ready {
			return nil
		}

		time.Sleep(100 * time.Millisecond)
	}

	return fmt.Errorf("shared integration schema was not ready before deadline")
}

func ensureDockerAvailable() error {
	if _, err := exec.LookPath("docker"); err != nil {
		return err
	}

	cmd := exec.Command("docker", "info", "--format", "{{.ServerVersion}}")
	output, err := cmd.CombinedOutput()
	if err != nil {
		message := strings.TrimSpace(string(output))
		if message == "" {
			return err
		}
		return fmt.Errorf("%w: %s", err, message)
	}

	return nil
}

func writeInitScript() string {
	dir, err := os.MkdirTemp("", "sem-integration-init-*")
	if err != nil {
		panic(fmt.Errorf("MkdirTemp(): %w", err))
	}

	path := filepath.Join(dir, "000000_enable_pgcrypto.sql")
	if err := os.WriteFile(path, []byte("CREATE EXTENSION IF NOT EXISTS pgcrypto;\n"), 0o600); err != nil {
		panic(fmt.Errorf("WriteFile(): %w", err))
	}

	return path
}

func migrationPaths() []string {
	_, filename, _, ok := runtime.Caller(0)
	if !ok {
		panic("runtime.Caller() failed")
	}

	pattern := filepath.Join(filepath.Dir(filename), "..", "..", "..", "migrations", "*.up.sql")
	paths, err := filepath.Glob(pattern)
	if err != nil {
		panic(fmt.Errorf("filepath.Glob(): %w", err))
	}
	if len(paths) == 0 {
		panic("no integration migration scripts found")
	}

	sort.Strings(paths)
	return paths
}
