package observability

import (
	"context"
	"io"
	"log/slog"
	"os"
	"strings"
	"testing"
)

func TestSetupDisabledWithoutEndpoint(t *testing.T) {
	t.Setenv("OTEL_EXPORTER_OTLP_ENDPOINT", "")

	runtime, err := Setup(context.Background(), "local")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if runtime != nil {
		t.Fatal("expected nil runtime without OTLP endpoint")
	}
}

func TestConfigureLoggerWritesToStdoutWithoutProvider(t *testing.T) {
	reader, writer, err := os.Pipe()
	if err != nil {
		t.Fatalf("pipe: %v", err)
	}
	defer func() { _ = reader.Close() }()

	originalStdout := os.Stdout
	os.Stdout = writer
	defer func() { os.Stdout = originalStdout }()

	ConfigureLogger(nil)
	slog.Info("hello", "component", "test")
	_ = writer.Close()

	output, err := io.ReadAll(reader)
	if err != nil {
		t.Fatalf("read output: %v", err)
	}
	if !strings.Contains(string(output), "\"msg\":\"hello\"") {
		t.Fatalf("expected stdout log output, got %s", string(output))
	}
}
