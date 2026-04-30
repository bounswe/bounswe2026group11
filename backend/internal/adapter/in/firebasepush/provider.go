package firebasepush

import (
	"bytes"
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"

	notificationapp "github.com/bounswe/bounswe2026group11/backend/internal/application/notification"
)

const (
	fcmScope            = "https://www.googleapis.com/auth/firebase.messaging"
	defaultTokenURI     = "https://oauth2.googleapis.com/token" // #nosec G101 -- public Google OAuth endpoint, not a credential.
	tokenRefreshSkew    = time.Minute
	fcmEndpointTemplate = "https://fcm.googleapis.com/v1/projects/%s/messages:send"
)

// MockSender accepts messages without contacting Firebase. It is used for local
// development and tests where push delivery should not leave the process.
type MockSender struct{}

func (MockSender) Send(context.Context, notificationapp.PushSendMessage) (*notificationapp.PushSendResult, error) {
	return &notificationapp.PushSendResult{}, nil
}

// Sender sends push notifications through Firebase Cloud Messaging HTTP v1.
type Sender struct {
	client       *http.Client
	tokenURI     string
	projectID    string
	clientEmail  string
	privateKey   *rsa.PrivateKey
	now          func() time.Time
	tokenMu      sync.Mutex
	accessToken  string
	tokenExpires time.Time
}

type serviceAccount struct {
	ProjectID   string `json:"project_id"`
	ClientEmail string `json:"client_email"`
	PrivateKey  string `json:"private_key"`
	TokenURI    string `json:"token_uri"`
}

func NewSender(_ context.Context, credentialsFile, credentialsJSONBase64 string) (*Sender, error) {
	credentials, err := loadServiceAccount(credentialsFile, credentialsJSONBase64)
	if err != nil {
		return nil, err
	}
	privateKey, err := parsePrivateKey(credentials.PrivateKey)
	if err != nil {
		return nil, err
	}
	tokenURI := strings.TrimSpace(credentials.TokenURI)
	if tokenURI == "" {
		tokenURI = defaultTokenURI
	}

	return &Sender{
		client:      http.DefaultClient,
		tokenURI:    tokenURI,
		projectID:   strings.TrimSpace(credentials.ProjectID),
		clientEmail: strings.TrimSpace(credentials.ClientEmail),
		privateKey:  privateKey,
		now:         time.Now,
	}, nil
}

func (s *Sender) Send(ctx context.Context, message notificationapp.PushSendMessage) (*notificationapp.PushSendResult, error) {
	accessToken, err := s.validAccessToken(ctx)
	if err != nil {
		return nil, err
	}

	data := map[string]string{}
	for key, value := range message.Data {
		data[key] = value
	}
	if message.DeepLink != nil && strings.TrimSpace(*message.DeepLink) != "" {
		data["deep_link"] = strings.TrimSpace(*message.DeepLink)
	}

	payload := map[string]any{
		"message": map[string]any{
			"token": message.Token,
			"notification": map[string]string{
				"title": message.Title,
				"body":  message.Body,
			},
			"data": data,
		},
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("marshal fcm payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, fmt.Sprintf(fcmEndpointTemplate, s.projectID), bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("build fcm request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("send fcm request: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		return &notificationapp.PushSendResult{}, nil
	}

	responseBody, _ := io.ReadAll(io.LimitReader(resp.Body, 8192))
	return &notificationapp.PushSendResult{InvalidToken: isInvalidTokenResponse(resp.StatusCode, responseBody)}, fmt.Errorf("fcm send failed: status=%d", resp.StatusCode)
}

func (s *Sender) validAccessToken(ctx context.Context) (string, error) {
	s.tokenMu.Lock()
	defer s.tokenMu.Unlock()

	now := s.now().UTC()
	if s.accessToken != "" && now.Before(s.tokenExpires.Add(-tokenRefreshSkew)) {
		return s.accessToken, nil
	}

	token, expiresAt, err := s.fetchAccessToken(ctx, now)
	if err != nil {
		slog.ErrorContext(ctx, "firebase access token refresh failed",
			"operation", "notification.push.firebase_token",
			"project_id", s.projectID,
			"error", err,
		)
		return "", err
	}
	s.accessToken = token
	s.tokenExpires = expiresAt
	return token, nil
}

func (s *Sender) fetchAccessToken(ctx context.Context, now time.Time) (string, time.Time, error) {
	assertion, err := s.signedJWT(now)
	if err != nil {
		return "", time.Time{}, err
	}

	form := url.Values{}
	form.Set("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer")
	form.Set("assertion", assertion)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.tokenURI, strings.NewReader(form.Encode()))
	if err != nil {
		return "", time.Time{}, fmt.Errorf("build firebase token request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := s.client.Do(req)
	if err != nil {
		return "", time.Time{}, fmt.Errorf("request firebase access token: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	var response struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int64  `json:"expires_in"`
		Error       string `json:"error"`
		Description string `json:"error_description"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 8192)).Decode(&response); err != nil {
		return "", time.Time{}, fmt.Errorf("decode firebase token response: %w", err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", time.Time{}, fmt.Errorf("firebase token request failed: status=%d error=%s", resp.StatusCode, response.Error)
	}
	if response.AccessToken == "" || response.ExpiresIn <= 0 {
		return "", time.Time{}, errors.New("firebase token response missing access token or expiry")
	}

	return response.AccessToken, now.Add(time.Duration(response.ExpiresIn) * time.Second), nil
}

func (s *Sender) signedJWT(now time.Time) (string, error) {
	header, err := json.Marshal(map[string]string{"alg": "RS256", "typ": "JWT"})
	if err != nil {
		return "", fmt.Errorf("marshal jwt header: %w", err)
	}
	claims, err := json.Marshal(map[string]any{
		"iss":   s.clientEmail,
		"scope": fcmScope,
		"aud":   s.tokenURI,
		"iat":   now.Unix(),
		"exp":   now.Add(time.Hour).Unix(),
	})
	if err != nil {
		return "", fmt.Errorf("marshal jwt claims: %w", err)
	}

	unsigned := base64.RawURLEncoding.EncodeToString(header) + "." + base64.RawURLEncoding.EncodeToString(claims)
	digest := sha256.Sum256([]byte(unsigned))
	signature, err := rsa.SignPKCS1v15(rand.Reader, s.privateKey, crypto.SHA256, digest[:])
	if err != nil {
		return "", fmt.Errorf("sign firebase jwt: %w", err)
	}
	return unsigned + "." + base64.RawURLEncoding.EncodeToString(signature), nil
}

func loadServiceAccount(credentialsFile, credentialsJSONBase64 string) (*serviceAccount, error) {
	credentialsFile = strings.TrimSpace(credentialsFile)
	credentialsJSONBase64 = strings.TrimSpace(credentialsJSONBase64)
	if credentialsFile == "" && credentialsJSONBase64 == "" {
		return nil, errors.New("firebase credentials are required")
	}
	if credentialsFile != "" && credentialsJSONBase64 != "" {
		return nil, errors.New("set either FIREBASE_CREDENTIALS_FILE or FIREBASE_SERVICE_ACCOUNT_JSON_BASE64, not both")
	}

	var raw []byte
	var err error
	if credentialsFile != "" {
		raw, err = os.ReadFile(credentialsFile) // #nosec G304 -- path is explicit deployment configuration.
		if err != nil {
			return nil, fmt.Errorf("read firebase credentials file: %w", err)
		}
	} else {
		raw, err = base64.StdEncoding.DecodeString(credentialsJSONBase64)
		if err != nil {
			return nil, fmt.Errorf("decode FIREBASE_SERVICE_ACCOUNT_JSON_BASE64: %w", err)
		}
	}

	var credentials serviceAccount
	if err := json.Unmarshal(raw, &credentials); err != nil {
		return nil, fmt.Errorf("parse firebase service account json: %w", err)
	}
	if strings.TrimSpace(credentials.ProjectID) == "" {
		return nil, errors.New("firebase service account missing project_id")
	}
	if strings.TrimSpace(credentials.ClientEmail) == "" {
		return nil, errors.New("firebase service account missing client_email")
	}
	if strings.TrimSpace(credentials.PrivateKey) == "" {
		return nil, errors.New("firebase service account missing private_key")
	}
	return &credentials, nil
}

func parsePrivateKey(value string) (*rsa.PrivateKey, error) {
	block, _ := pem.Decode([]byte(value))
	if block == nil {
		return nil, errors.New("firebase private key must be PEM encoded")
	}
	key, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		return nil, fmt.Errorf("parse firebase private key: %w", err)
	}
	rsaKey, ok := key.(*rsa.PrivateKey)
	if !ok {
		return nil, errors.New("firebase private key must be RSA")
	}
	return rsaKey, nil
}

func isInvalidTokenResponse(statusCode int, body []byte) bool {
	if statusCode == http.StatusNotFound {
		return true
	}
	var parsed struct {
		Error struct {
			Status  string `json:"status"`
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.Unmarshal(body, &parsed); err != nil {
		return false
	}
	status := strings.ToUpper(parsed.Error.Status)
	message := strings.ToLower(parsed.Error.Message)
	return status == "NOT_FOUND" ||
		(status == "INVALID_ARGUMENT" && strings.Contains(message, "token"))
}
