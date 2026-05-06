package eventreport

import (
	"context"
	"testing"

	"github.com/bounswe/bounswe2026group11/backend/internal/application/imageupload"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

type fakeEventReportRepo struct {
	reportContext *EventReportContext
	reportRecord  *EventReportRecord
	lastCreate    CreateEventReportParams
}

func (r *fakeEventReportRepo) GetEventReportContext(_ context.Context, eventID uuid.UUID) (*EventReportContext, error) {
	if r.reportContext == nil {
		return nil, domain.ErrNotFound
	}
	ctx := *r.reportContext
	ctx.EventID = eventID
	return &ctx, nil
}

func (r *fakeEventReportRepo) CreateEventReport(_ context.Context, params CreateEventReportParams) (*EventReportRecord, error) {
	r.lastCreate = params
	if r.reportRecord != nil {
		return r.reportRecord, nil
	}
	return &EventReportRecord{
		ID:             uuid.New(),
		EventID:        params.EventID,
		ReporterUserID: params.ReporterUserID,
		Category:       params.Category,
		Message:        params.Message,
		ImageURL:       params.ImageURL,
		Status:         domain.EventReportStatusPending,
	}, nil
}

type fakeReportImageConfirmer struct {
	baseURL string
}

func (f fakeReportImageConfirmer) ConfirmEventReportImageUpload(context.Context, uuid.UUID, uuid.UUID, imageupload.ConfirmUploadInput) (*imageupload.ConfirmReportImageResult, error) {
	return &imageupload.ConfirmReportImageResult{BaseURL: f.baseURL}, nil
}

func TestCreateEventReportStoresNormalizedReport(t *testing.T) {
	eventID := uuid.New()
	userID := uuid.New()
	repo := &fakeEventReportRepo{reportContext: baseReportContext(domain.EventStatusActive)}
	service := NewService(repo)

	result, err := service.CreateEventReport(context.Background(), userID, eventID, CreateEventReportInput{
		Category: domain.EventReportCategorySpamOrScam,
		Message:  "  suspicious invite link  ",
	})

	if err != nil {
		t.Fatalf("CreateEventReport() error = %v", err)
	}
	if result.Message != "suspicious invite link" {
		t.Fatalf("expected trimmed message, got %q", result.Message)
	}
	if repo.lastCreate.Category != domain.EventReportCategorySpamOrScam {
		t.Fatalf("expected category %q, got %q", domain.EventReportCategorySpamOrScam, repo.lastCreate.Category)
	}
}

func TestCreateEventReportRequiresMessage(t *testing.T) {
	service := NewService(&fakeEventReportRepo{reportContext: baseReportContext(domain.EventStatusActive)})

	_, err := service.CreateEventReport(context.Background(), uuid.New(), uuid.New(), CreateEventReportInput{
		Category: domain.EventReportCategorySafety,
		Message:  "  ",
	})

	requireReportAppError(t, err, domain.ErrorCodeValidation)
}

func TestCreateEventReportRejectsImageBeforeEventStarts(t *testing.T) {
	token := "token"
	service := NewService(&fakeEventReportRepo{reportContext: baseReportContext(domain.EventStatusActive)})
	service.SetReportImageConfirmer(fakeReportImageConfirmer{baseURL: "https://cdn.example/report.jpg"})

	_, err := service.CreateEventReport(context.Background(), uuid.New(), uuid.New(), CreateEventReportInput{
		Category:          domain.EventReportCategorySafety,
		Message:           "needs an image",
		ImageConfirmToken: &token,
	})

	requireReportAppError(t, err, domain.ErrorCodeEventReportImageNotAllowed)
}

func TestCreateEventReportStoresConfirmedImageForInProgressEvent(t *testing.T) {
	token := "token"
	repo := &fakeEventReportRepo{reportContext: baseReportContext(domain.EventStatusInProgress)}
	service := NewService(repo)
	service.SetReportImageConfirmer(fakeReportImageConfirmer{baseURL: "https://cdn.example/report.jpg"})

	_, err := service.CreateEventReport(context.Background(), uuid.New(), uuid.New(), CreateEventReportInput{
		Category:          domain.EventReportCategoryInappropriateContent,
		Message:           "inappropriate incident happened",
		ImageConfirmToken: &token,
	})

	if err != nil {
		t.Fatalf("CreateEventReport() error = %v", err)
	}
	if repo.lastCreate.ImageURL == nil || *repo.lastCreate.ImageURL != "https://cdn.example/report.jpg" {
		t.Fatalf("expected confirmed image URL to be stored, got %#v", repo.lastCreate.ImageURL)
	}
}

func baseReportContext(status domain.EventStatus) *EventReportContext {
	return &EventReportContext{
		EventID: uuid.New(),
		HostID:  uuid.New(),
		Status:  status,
	}
}

func requireReportAppError(t *testing.T, err error, code string) {
	t.Helper()
	appErr, ok := err.(*domain.AppError)
	if !ok {
		t.Fatalf("expected AppError %q, got %T: %v", code, err, err)
	}
	if appErr.Code != code {
		t.Fatalf("expected error code %q, got %q", code, appErr.Code)
	}
}
