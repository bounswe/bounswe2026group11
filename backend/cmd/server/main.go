package main

import (
	"context"
	"fmt"
	"log"

	"github.com/bounswe/bounswe2026group11/backend/internal/deps"
	"github.com/bounswe/bounswe2026group11/backend/internal/server"
)

func main() {
	container, err := deps.New(context.Background())
	if err != nil {
		log.Fatalf("bootstrap: %v", err)
	}
	defer container.Close()

	app := server.NewHTTP(container.AuthService)
	addr := fmt.Sprintf(":%d", container.Config.AppPort)
	log.Fatal(app.Listen(addr))
}
