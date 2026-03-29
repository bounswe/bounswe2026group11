package email

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"

	emailapp "github.com/bounswe/bounswe2026group11/backend/internal/application/email"
)

func TestResendProviderSendBuildsSingleRecipientPayload(t *testing.T) {
	// given
	transport := &recordingTransport{}
	httpClient := &http.Client{Transport: transport}
	provider := newResendProviderWithHTTPClient("re_test_key", "socialeventmapper.com", httpClient)

	// when
	err := provider.Send(context.Background(), emailapp.Message{
		FromLocalPart: "auth",
		To:            "user@example.com",
		Subject:       "Your code",
		HTML:          "<strong>123456</strong>",
		Text:          "123456",
	})

	// then
	if err != nil {
		t.Fatalf("Send() error = %v", err)
	}
	if transport.request == nil {
		t.Fatal("expected a resend request to be sent")
	}
	if transport.request.Method != http.MethodPost {
		t.Fatalf("expected POST request, got %s", transport.request.Method)
	}
	if transport.request.URL.Path != "/emails" {
		t.Fatalf("expected /emails path, got %s", transport.request.URL.Path)
	}
	if authHeader := transport.request.Header.Get("Authorization"); authHeader != "Bearer re_test_key" {
		t.Fatalf("expected resend authorization header, got %q", authHeader)
	}

	var payload struct {
		From    string   `json:"from"`
		To      []string `json:"to"`
		Subject string   `json:"subject"`
		HTML    string   `json:"html"`
		Text    string   `json:"text"`
	}
	if err := json.Unmarshal(transport.body, &payload); err != nil {
		t.Fatalf("Unmarshal(payload) error = %v", err)
	}
	if payload.From != "Social Event Mapper <auth@socialeventmapper.com>" {
		t.Fatalf("expected sender to use auth@socialeventmapper.com, got %q", payload.From)
	}
	if len(payload.To) != 1 || payload.To[0] != "user@example.com" {
		t.Fatalf("expected one recipient, got %#v", payload.To)
	}
	if payload.Subject != "Your code" {
		t.Fatalf("expected subject to be propagated, got %q", payload.Subject)
	}
	if payload.HTML != "<strong>123456</strong>" || payload.Text != "123456" {
		t.Fatalf("expected html/text payload to be preserved, got html=%q text=%q", payload.HTML, payload.Text)
	}
}

type recordingTransport struct {
	request *http.Request
	body    []byte
}

func (t *recordingTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	t.request = req.Clone(req.Context())
	if req.Body != nil {
		body, err := io.ReadAll(req.Body)
		if err != nil {
			return nil, err
		}
		t.body = body
	}

	return &http.Response{
		StatusCode: http.StatusOK,
		Header:     make(http.Header),
		Body:       io.NopCloser(strings.NewReader(`{"id":"email_123"}`)),
		Request:    req,
	}, nil
}
