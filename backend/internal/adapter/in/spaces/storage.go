package spaces

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
	"github.com/aws/smithy-go"
	smithyhttp "github.com/aws/smithy-go/transport/http"
	"github.com/bounswe/bounswe2026group11/backend/internal/application/imageupload"
)

// Config contains the secrets and endpoint settings required to talk to Spaces.
type Config struct {
	AccessKey string
	SecretKey string
	Endpoint  string
	Bucket    string
	Region    string
}

// Storage is the Spaces-backed implementation of imageupload.Storage.
type Storage struct {
	client  *s3.Client
	presign *s3.PresignClient
	bucket  string
}

// NewStorage constructs a Spaces client using the AWS SDK v2 S3 client.
func NewStorage(cfg Config) *Storage {
	awsCfg := aws.Config{
		Region:      strings.TrimSpace(cfg.Region),
		Credentials: aws.NewCredentialsCache(credentials.NewStaticCredentialsProvider(cfg.AccessKey, cfg.SecretKey, "")),
	}

	client := s3.NewFromConfig(awsCfg, func(opts *s3.Options) {
		opts.UsePathStyle = false
		opts.BaseEndpoint = aws.String(strings.TrimRight(strings.TrimSpace(cfg.Endpoint), "/"))
	})

	return &Storage{
		client:  client,
		presign: s3.NewPresignClient(client),
		bucket:  strings.TrimSpace(cfg.Bucket),
	}
}

// PresignPutObject returns a signed PUT request for a single object key.
func (s *Storage) PresignPutObject(
	ctx context.Context,
	key, contentType, cacheControl string,
	expires time.Duration,
) (*imageupload.PresignedRequest, error) {
	req, err := s.presign.PresignPutObject(ctx, &s3.PutObjectInput{
		Bucket:       aws.String(s.bucket),
		Key:          aws.String(key),
		ContentType:  aws.String(contentType),
		CacheControl: aws.String(cacheControl),
		ACL:          types.ObjectCannedACLPublicRead,
	}, func(opts *s3.PresignOptions) {
		opts.Expires = expires
	})
	if err != nil {
		return nil, fmt.Errorf("presign put object %q: %w", key, err)
	}

	headers := map[string]string{
		"Content-Type":  contentType,
		"Cache-Control": cacheControl,
		"x-amz-acl":     string(types.ObjectCannedACLPublicRead),
	}
	for name, values := range req.SignedHeader {
		if strings.EqualFold(name, "Host") || len(values) == 0 {
			continue
		}
		headers[normalizeHeaderName(name)] = values[0]
	}

	return &imageupload.PresignedRequest{
		Method:  req.Method,
		URL:     req.URL,
		Headers: headers,
	}, nil
}

func normalizeHeaderName(name string) string {
	switch {
	case strings.EqualFold(name, "Content-Type"):
		return "Content-Type"
	case strings.EqualFold(name, "Cache-Control"):
		return "Cache-Control"
	case strings.EqualFold(name, "x-amz-acl"):
		return "x-amz-acl"
	default:
		return name
	}
}

// ObjectExists checks whether the requested object key is present in Spaces.
func (s *Storage) ObjectExists(ctx context.Context, key string) (bool, error) {
	_, err := s.client.HeadObject(ctx, &s3.HeadObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	})
	if err == nil {
		return true, nil
	}
	if isNotFound(err) {
		return false, nil
	}

	return false, fmt.Errorf("head object %q: %w", key, err)
}

func isNotFound(err error) bool {
	var responseErr *smithyhttp.ResponseError
	if errors.As(err, &responseErr) && responseErr.HTTPStatusCode() == http.StatusNotFound {
		return true
	}

	var apiErr smithy.APIError
	if errors.As(err, &apiErr) {
		code := apiErr.ErrorCode()
		return code == "NotFound" || code == "NoSuchKey"
	}

	return false
}
