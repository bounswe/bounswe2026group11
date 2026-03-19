package main

import (
	"fmt"
	"log"

	"github.com/bounswe/bounswe2026group11/backend/infrastructure"
	"github.com/gofiber/fiber/v2"
)

func main() {
	cfg, err := infrastructure.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	app := fiber.New()

	app.Get("/health", func(c *fiber.Ctx) error {
		return c.SendStatus(fiber.StatusOK)
	})

	addr := fmt.Sprintf(":%d", cfg.AppPort)
	log.Fatal(app.Listen(addr))
}
