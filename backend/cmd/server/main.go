// Package main is the entrypoint for the Social Event Mapper backend server.
// It initialises the dependency container and starts the HTTP server.
package main

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/bootstrap"
	"github.com/bounswe/bounswe2026group11/backend/internal/server"
)

func main() {
	ctx := context.Background()

	container, err := bootstrap.New(ctx)
	if err != nil {
		log.Fatalf("bootstrap: %v", err)
	}
	defer container.Close()

	container.StartEventExpiryJob(ctx, 1*time.Minute)

	app := server.NewHTTP(container)
	addr := fmt.Sprintf(":%d", container.Config.AppPort)
	log.Fatal(app.Listen(addr))
}
