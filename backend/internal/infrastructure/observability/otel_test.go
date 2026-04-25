package observability

import (
	"context"
	"io"
	"log/slog"
	"os"
	"strings"
	"testing"
	"time"

	sdklog "go.opentelemetry.io/otel/sdk/log"
)

type captureHandler struct {
	records []slog.Record
}

func (h *captureHandler) Enabled(_ context.Context, _ slog.Level) bool { return true }

func (h *captureHandler) Handle(_ context.Context, record slog.Record) error {
	h.records = append(h.records, record.Clone())
	return nil
}

func (h *captureHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	return h
}

func (h *captureHandler) WithGroup(name string) slog.Handler {
	return h
}

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

func TestConfigureLoggerSkipsStdoutWhenProviderIsConfigured(t *testing.T) {
	reader, writer, err := os.Pipe()
	if err != nil {
		t.Fatalf("pipe: %v", err)
	}
	defer func() { _ = reader.Close() }()

	originalStdout := os.Stdout
	os.Stdout = writer
	defer func() { os.Stdout = originalStdout }()

	provider := sdklog.NewLoggerProvider()
	defer func() {
		if err := provider.Shutdown(context.Background()); err != nil {
			t.Fatalf("shutdown provider: %v", err)
		}
	}()

	ConfigureLogger(provider)
	slog.Info("hello", "component", "test")
	_ = writer.Close()

	output, err := io.ReadAll(reader)
	if err != nil {
		t.Fatalf("read output: %v", err)
	}
	if len(strings.TrimSpace(string(output))) != 0 {
		t.Fatalf("expected no stdout log output, got %s", string(output))
	}
}

func TestLevelAttrHandlerAddsLevelAttribute(t *testing.T) {
	sink := &captureHandler{}
	handler := newLevelAttrHandler(sink)

	record := slog.NewRecord(timeNowForTest(), slog.LevelWarn, "warn message", 0)
	if err := handler.Handle(context.Background(), record); err != nil {
		t.Fatalf("handle: %v", err)
	}

	if len(sink.records) != 1 {
		t.Fatalf("expected one record, got %d", len(sink.records))
	}

	level := ""
	sink.records[0].Attrs(func(attr slog.Attr) bool {
		if attr.Key == slog.LevelKey {
			level = attr.Value.String()
			return false
		}
		return true
	})
	if level != "WARN" {
		t.Fatalf("expected WARN level attr, got %q", level)
	}
}

func TestLevelAttrHandlerDoesNotDuplicateExistingLevelAttribute(t *testing.T) {
	sink := &captureHandler{}
	handler := newLevelAttrHandler(sink)

	record := slog.NewRecord(timeNowForTest(), slog.LevelInfo, "info message", 0)
	record.AddAttrs(slog.String(slog.LevelKey, "custom"))
	if err := handler.Handle(context.Background(), record); err != nil {
		t.Fatalf("handle: %v", err)
	}

	levelAttrs := 0
	lastValue := ""
	sink.records[0].Attrs(func(attr slog.Attr) bool {
		if attr.Key == slog.LevelKey {
			levelAttrs++
			lastValue = attr.Value.String()
		}
		return true
	})
	if levelAttrs != 1 {
		t.Fatalf("expected one level attr, got %d", levelAttrs)
	}
	if lastValue != "custom" {
		t.Fatalf("expected custom level attr, got %q", lastValue)
	}
}

func timeNowForTest() (now time.Time) {
	return time.Unix(1710000000, 0)
}
