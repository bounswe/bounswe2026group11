package spaces

import (
	"context"
	"strings"
	"testing"
	"time"
)

func TestPresignPutObjectIncludesPublicReadACLHeader(t *testing.T) {
	// given
	storage := NewStorage(Config{
		AccessKey: "test-access",
		SecretKey: "test-secret",
		Endpoint:  "https://fra1.digitaloceanspaces.com",
		Bucket:    "sem-bucket",
		Region:    "us-east-1",
	})

	// when
	request, err := storage.PresignPutObject(
		context.Background(),
		"events/123/cover/v1-upload",
		"image/jpeg",
		"public, max-age=604800, immutable",
		15*time.Minute,
	)

	// then
	if err != nil {
		t.Fatalf("PresignPutObject() error = %v", err)
	}
	if request.Method != "PUT" {
		t.Fatalf("expected method PUT, got %q", request.Method)
	}
	if got := request.Headers["Content-Type"]; got != "image/jpeg" {
		t.Fatalf("expected Content-Type image/jpeg, got %q", got)
	}
	if got := request.Headers["Cache-Control"]; got != "public, max-age=604800, immutable" {
		t.Fatalf("expected Cache-Control header, got %q", got)
	}
	if got := request.Headers["x-amz-acl"]; got != "public-read" {
		t.Fatalf("expected x-amz-acl public-read, got %q", got)
	}
	if !strings.Contains(request.URL, "X-Amz-Algorithm=AWS4-HMAC-SHA256") {
		t.Fatalf("expected presigned URL, got %q", request.URL)
	}
}
