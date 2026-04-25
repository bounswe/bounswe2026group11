package observability

import (
	"context"
	"errors"
	"log/slog"
	"os"
	"strings"
	"time"

	"go.opentelemetry.io/contrib/bridges/otelslog"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploghttp"
	"go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetrichttp"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	otellogglobal "go.opentelemetry.io/otel/log/global"
	"go.opentelemetry.io/otel/propagation"
	sdklog "go.opentelemetry.io/otel/sdk/log"
	"go.opentelemetry.io/otel/sdk/metric"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.39.0"
)

const (
	defaultServiceName      = "sem-backend"
	defaultServiceNamespace = "social-event-mapper"
	logScopeName            = "github.com/bounswe/bounswe2026group11/backend"
	shutdownTimeout         = 10 * time.Second
)

// Runtime owns the configured OpenTelemetry providers so they can be flushed
// and shut down during process exit.
type Runtime struct {
	traceProvider  *sdktrace.TracerProvider
	meterProvider  *metric.MeterProvider
	loggerProvider *sdklog.LoggerProvider
}

// LoggerProvider exposes the configured OpenTelemetry logger provider so the
// process logger can bridge slog records into the OTLP logs pipeline.
func (r *Runtime) LoggerProvider() *sdklog.LoggerProvider {
	if r == nil {
		return nil
	}
	return r.loggerProvider
}

// ConfigureLogger installs the process-wide logger. It always writes JSON logs
// to stdout and, when a LoggerProvider is available, mirrors them into the
// OpenTelemetry logs pipeline.
func ConfigureLogger(provider *sdklog.LoggerProvider) {
	stdoutHandler := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo})
	if provider == nil {
		slog.SetDefault(slog.New(stdoutHandler))
		return
	}

	otelHandler := otelslog.NewHandler(
		logScopeName,
		otelslog.WithLoggerProvider(provider),
		otelslog.WithSource(true),
	)
	slog.SetDefault(slog.New(newFanoutHandler(stdoutHandler, otelHandler)))
}

// Setup initializes OpenTelemetry traces, metrics, and logs when an OTLP
// endpoint is configured. Without an endpoint, the backend keeps only stdout
// logging enabled.
func Setup(ctx context.Context, appEnv string) (*Runtime, error) {
	if strings.TrimSpace(os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT")) == "" {
		return nil, nil
	}

	res, err := newResource(ctx, appEnv)
	if err != nil {
		return nil, err
	}

	traceExporter, err := otlptracehttp.New(ctx)
	if err != nil {
		return nil, err
	}
	traceProvider := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(traceExporter),
		sdktrace.WithResource(res),
	)

	metricExporter, err := otlpmetrichttp.New(ctx)
	if err != nil {
		return nil, err
	}
	meterProvider := metric.NewMeterProvider(
		metric.WithReader(metric.NewPeriodicReader(metricExporter)),
		metric.WithResource(res),
	)

	logExporter, err := otlploghttp.New(ctx)
	if err != nil {
		return nil, err
	}
	loggerProvider := sdklog.NewLoggerProvider(
		sdklog.WithProcessor(sdklog.NewBatchProcessor(logExporter)),
		sdklog.WithResource(res),
	)

	otel.SetTracerProvider(traceProvider)
	otel.SetMeterProvider(meterProvider)
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
		propagation.TraceContext{},
		propagation.Baggage{},
	))
	otellogglobal.SetLoggerProvider(loggerProvider)

	return &Runtime{
		traceProvider:  traceProvider,
		meterProvider:  meterProvider,
		loggerProvider: loggerProvider,
	}, nil
}

// Shutdown flushes telemetry providers in reverse startup order.
func (r *Runtime) Shutdown(ctx context.Context) error {
	if r == nil {
		return nil
	}

	shutdownCtx, cancel := context.WithTimeout(ctx, shutdownTimeout)
	defer cancel()

	var err error
	if r.loggerProvider != nil {
		err = errors.Join(err, r.loggerProvider.Shutdown(shutdownCtx))
	}
	if r.meterProvider != nil {
		err = errors.Join(err, r.meterProvider.Shutdown(shutdownCtx))
	}
	if r.traceProvider != nil {
		err = errors.Join(err, r.traceProvider.Shutdown(shutdownCtx))
	}
	return err
}

func newResource(ctx context.Context, appEnv string) (*resource.Resource, error) {
	serviceName := strings.TrimSpace(os.Getenv("OTEL_SERVICE_NAME"))
	if serviceName == "" {
		serviceName = defaultServiceName
	}

	opts := []resource.Option{
		resource.WithFromEnv(),
		resource.WithTelemetrySDK(),
		resource.WithProcess(),
		resource.WithHost(),
		resource.WithAttributes(
			semconv.ServiceName(serviceName),
			semconv.ServiceNamespace(defaultServiceNamespace),
		),
	}
	if strings.TrimSpace(appEnv) != "" {
		opts = append(opts, resource.WithAttributes(semconv.DeploymentEnvironmentName(strings.TrimSpace(appEnv))))
	}

	res, err := resource.New(ctx, opts...)
	if err != nil {
		return nil, err
	}
	return res, nil
}

type fanoutHandler struct {
	handlers []slog.Handler
}

func newFanoutHandler(handlers ...slog.Handler) slog.Handler {
	filtered := make([]slog.Handler, 0, len(handlers))
	for _, handler := range handlers {
		if handler != nil {
			filtered = append(filtered, handler)
		}
	}
	return &fanoutHandler{handlers: filtered}
}

func (h *fanoutHandler) Enabled(ctx context.Context, level slog.Level) bool {
	for _, handler := range h.handlers {
		if handler.Enabled(ctx, level) {
			return true
		}
	}
	return false
}

func (h *fanoutHandler) Handle(ctx context.Context, record slog.Record) error {
	var err error
	for _, handler := range h.handlers {
		err = errors.Join(err, handler.Handle(ctx, record.Clone()))
	}
	return err
}

func (h *fanoutHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	next := make([]slog.Handler, 0, len(h.handlers))
	for _, handler := range h.handlers {
		next = append(next, handler.WithAttrs(attrs))
	}
	return &fanoutHandler{handlers: next}
}

func (h *fanoutHandler) WithGroup(name string) slog.Handler {
	next := make([]slog.Handler, 0, len(h.handlers))
	for _, handler := range h.handlers {
		next = append(next, handler.WithGroup(name))
	}
	return &fanoutHandler{handlers: next}
}
