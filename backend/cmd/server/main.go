// Package main is the entrypoint for the Social Event Mapper backend server.
// It initializes the dependency container and starts the HTTP server.
package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/bootstrap"
	"github.com/bounswe/bounswe2026group11/backend/internal/infrastructure/observability"
	"github.com/bounswe/bounswe2026group11/backend/internal/server"
)

func main() {
	ctx := context.Background()

	observability.ConfigureLogger(nil)

	observabilityRuntime, err := observability.Setup(ctx, os.Getenv("APP_ENV"))
	if err != nil {
		slog.Error("observability bootstrap failed", "error", err)
		os.Exit(1)
	}
	if observabilityRuntime != nil {
		observability.ConfigureLogger(observabilityRuntime.LoggerProvider())
		defer func() {
			if err := observabilityRuntime.Shutdown(ctx); err != nil {
				slog.Error("observability shutdown failed", "error", err)
			}
		}()
	}

	container, err := bootstrap.New(ctx)
	if err != nil {
		slog.Error("bootstrap failed", "error", err)
		os.Exit(1)
	}
	defer container.Close()

	container.StartEventExpiryJob(ctx, 1*time.Minute)
	container.StartNotificationRetentionJob(ctx, 24*time.Hour)

	app := server.NewHTTP(container)
	addr := fmt.Sprintf(":%d", container.Config.AppPort)
	if err := app.Listen(addr); err != nil {
		slog.Error("server stopped", "error", err, "addr", addr)
		os.Exit(1)
	}
}
