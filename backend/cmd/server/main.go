// Package main is the entrypoint for the Social Event Mapper backend server.
// It initialises the dependency container and starts the HTTP server.
package main

import (
	"context"
	"fmt"
	"log"

	"github.com/bounswe/bounswe2026group11/backend/internal/bootstrap"
	"github.com/bounswe/bounswe2026group11/backend/internal/server"
)

func main() {
	container, err := bootstrap.New(context.Background())
	if err != nil {
		log.Fatalf("bootstrap: %v", err)
	}
	defer container.Close()

	app := server.NewHTTP(container)
	addr := fmt.Sprintf(":%d", container.Config.AppPort)
	log.Fatal(app.Listen(addr))
}
