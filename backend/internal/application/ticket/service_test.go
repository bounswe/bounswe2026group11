package ticket

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

type fakeUnitOfWork struct {
	callCount int
}

func (u *fakeUnitOfWork) RunInTx(ctx context.Context, fn func(context.Context) error) error {
	u.callCount++
	return fn(ctx)
}

type fakeTokenManager struct {
	verifyClaims *QRTokenClaims
	verifyErr    error
	issuedClaims QRTokenClaims
}

func (m *fakeTokenManager) Issue(claims QRTokenClaims) (string, error) {
	m.issuedClaims = claims
	return "signed-token", nil
}

func (m *fakeTokenManager) Verify(_ string) (*QRTokenClaims, error) {
	if m.verifyErr != nil {
		return nil, m.verifyErr
	}
	return m.verifyClaims, nil
}

func (m *fakeTokenManager) Hash(token string) string {
	return "hash:" + token
}

type fakeTicketRepo struct {
	err                   error
	createdParticipation  uuid.UUID
	createdStatus         domain.TicketStatus
	canceledParticipation uuid.UUID
	canceledEvent         uuid.UUID
	expiredEvent          uuid.UUID
	listRecords           []TicketRecord
	detailRecord          *TicketRecord
	accessRecord          *TicketAccessRecord
	scanRecord            *TicketScanRecord
	storedVersion         int
	storedHash            string
	usedTicketID          uuid.UUID
}

func (r *fakeTicketRepo) CreateTicketForParticipation(_ context.Context, participationID uuid.UUID, status domain.TicketStatus) (*domain.Ticket, error) {
	r.createdParticipation = participationID
	r.createdStatus = status
	if r.err != nil {
		return nil, r.err
	}
	return &domain.Ticket{ID: uuid.New(), ParticipationID: participationID, Status: status}, nil
}

func (r *fakeTicketRepo) CancelTicketForParticipation(_ context.Context, participationID uuid.UUID) error {
	r.canceledParticipation = participationID
	return r.err
}

func (r *fakeTicketRepo) CancelTicketsForEvent(_ context.Context, eventID uuid.UUID) error {
	r.canceledEvent = eventID
	return r.err
}

func (r *fakeTicketRepo) ExpireTicketsForEvent(_ context.Context, eventID uuid.UUID) error {
	r.expiredEvent = eventID
	return r.err
}

func (r *fakeTicketRepo) ListTicketsByUser(_ context.Context, _ uuid.UUID) ([]TicketRecord, error) {
	return r.listRecords, r.err
}

func (r *fakeTicketRepo) GetTicketDetail(_ context.Context, _, _ uuid.UUID) (*TicketRecord, error) {
	return r.detailRecord, r.err
}

func (r *fakeTicketRepo) GetTicketAccessForUser(_ context.Context, _, _ uuid.UUID, _, _ float64, _ bool) (*TicketAccessRecord, error) {
	return r.accessRecord, r.err
}

func (r *fakeTicketRepo) StoreIssuedToken(_ context.Context, _ uuid.UUID, version int, tokenHash string) error {
	r.storedVersion = version
	r.storedHash = tokenHash
	return r.err
}

func (r *fakeTicketRepo) GetTicketForScan(_ context.Context, _, _ uuid.UUID, _ bool) (*TicketScanRecord, error) {
	return r.scanRecord, r.err
}

func (r *fakeTicketRepo) MarkTicketUsed(_ context.Context, ticketID uuid.UUID) (*domain.Ticket, error) {
	r.usedTicketID = ticketID
	if r.err != nil {
		return nil, r.err
	}
	return &domain.Ticket{ID: ticketID, Status: domain.TicketStatusUsed}, nil
}

func TestIssueQRTokenStoresNextVersionAndHash(t *testing.T) {
	// given
	now := time.Date(2026, 4, 26, 12, 0, 0, 0, time.UTC)
	record := activeTicketAccessRecord(now)
	repo := &fakeTicketRepo{accessRecord: record}
	tokens := &fakeTokenManager{}
	service := NewService(repo, &fakeUnitOfWork{}, tokens, Settings{QRTokenTTL: 10 * time.Second, ProximityMeters: 200})
	service.now = func() time.Time { return now }

	// when
	result, err := service.IssueQRToken(context.Background(), record.UserID, record.Ticket.ID, QRTokenInput{Lat: 41, Lon: 29})

	// then
	if err != nil {
		t.Fatalf("IssueQRToken() error = %v", err)
	}
	if result.Token != "signed-token" || result.Version != record.Ticket.QRTokenVersion+1 {
		t.Fatalf("unexpected token result: %+v", result)
	}
	if repo.storedVersion != result.Version || repo.storedHash != "hash:signed-token" {
		t.Fatalf("expected stored version/hash, got version=%d hash=%q", repo.storedVersion, repo.storedHash)
	}
	if tokens.issuedClaims.TicketID != record.Ticket.ID || tokens.issuedClaims.ParticipationID != record.Participation.ID {
		t.Fatalf("issued claims do not match record: %+v", tokens.issuedClaims)
	}
}

func TestIssueQRTokenRejectsFarLocation(t *testing.T) {
	// given
	now := time.Now().UTC()
	record := activeTicketAccessRecord(now)
	record.DistanceMeters = 201
	service := NewService(&fakeTicketRepo{accessRecord: record}, &fakeUnitOfWork{}, &fakeTokenManager{}, Settings{ProximityMeters: 200})
	service.now = func() time.Time { return now }

	// when
	_, err := service.IssueQRToken(context.Background(), record.UserID, record.Ticket.ID, QRTokenInput{})

	// then
	var appErr *domain.AppError
	if !errors.As(err, &appErr) || appErr.Code != domain.ErrorCodeTicketProximityRequired {
		t.Fatalf("expected proximity error, got %T %v", err, err)
	}
}

func TestScanTicketMarksActiveLatestTokenUsed(t *testing.T) {
	// given
	now := time.Now().UTC()
	record := activeTicketScanRecord(now)
	claims := &QRTokenClaims{
		TicketID:        record.Ticket.ID,
		ParticipationID: record.Participation.ID,
		EventID:         record.EventID,
		UserID:          record.UserID,
		Version:         record.Ticket.QRTokenVersion,
		IssuedAt:        now,
		ExpiresAt:       now.Add(10 * time.Second),
	}
	repo := &fakeTicketRepo{scanRecord: record}
	service := NewService(repo, &fakeUnitOfWork{}, &fakeTokenManager{verifyClaims: claims}, Settings{})

	// when
	result, err := service.ScanTicket(context.Background(), record.HostID, record.EventID, ScanTicketInput{QRToken: "signed-token"})

	// then
	if err != nil {
		t.Fatalf("ScanTicket() error = %v", err)
	}
	if result.Result != ScanResultAccepted || result.TicketStatus == nil || *result.TicketStatus != domain.TicketStatusUsed {
		t.Fatalf("expected accepted USED result, got %+v", result)
	}
	if repo.usedTicketID != record.Ticket.ID {
		t.Fatalf("expected used ticket %s, got %s", record.Ticket.ID, repo.usedTicketID)
	}
}

func TestScanTicketRejectsOldVersion(t *testing.T) {
	// given
	now := time.Now().UTC()
	record := activeTicketScanRecord(now)
	claims := &QRTokenClaims{
		TicketID:        record.Ticket.ID,
		ParticipationID: record.Participation.ID,
		EventID:         record.EventID,
		UserID:          record.UserID,
		Version:         record.Ticket.QRTokenVersion - 1,
		IssuedAt:        now,
		ExpiresAt:       now.Add(10 * time.Second),
	}
	service := NewService(&fakeTicketRepo{scanRecord: record}, &fakeUnitOfWork{}, &fakeTokenManager{verifyClaims: claims}, Settings{})

	// when
	result, err := service.ScanTicket(context.Background(), record.HostID, record.EventID, ScanTicketInput{QRToken: "signed-token"})

	// then
	if err != nil {
		t.Fatalf("ScanTicket() error = %v", err)
	}
	if result.Result != ScanResultRejected || result.Reason == nil || *result.Reason != RejectReasonTokenOldVersion {
		t.Fatalf("expected old-version rejection, got %+v", result)
	}
}

func activeTicketAccessRecord(now time.Time) *TicketAccessRecord {
	ticketID := uuid.New()
	participationID := uuid.New()
	userID := uuid.New()
	eventID := uuid.New()
	return &TicketAccessRecord{
		TicketRecord: TicketRecord{
			Ticket: domain.Ticket{
				ID:              ticketID,
				ParticipationID: participationID,
				Status:          domain.TicketStatusActive,
				QRTokenVersion:  4,
				ExpiresAt:       now.Add(time.Hour),
				CreatedAt:       now.Add(-time.Hour),
				UpdatedAt:       now,
			},
			Participation: domain.Participation{
				ID:        participationID,
				EventID:   eventID,
				UserID:    userID,
				Status:    domain.ParticipationStatusApproved,
				CreatedAt: now.Add(-time.Hour),
				UpdatedAt: now,
			},
			EventID:      eventID,
			EventTitle:   "Protected Event",
			EventStatus:  domain.EventStatusActive,
			PrivacyLevel: domain.PrivacyProtected,
			StartTime:    now.Add(time.Hour),
			LocationType: domain.LocationPoint,
			Anchor:       domain.GeoPoint{Lat: 41, Lon: 29},
		},
		UserID:         userID,
		DistanceMeters: 5,
	}
}

func activeTicketScanRecord(now time.Time) *TicketScanRecord {
	access := activeTicketAccessRecord(now)
	hash := "hash:signed-token"
	access.Ticket.LastIssuedQRTokenHash = &hash
	return &TicketScanRecord{
		Ticket:        access.Ticket,
		Participation: access.Participation,
		EventID:       access.EventID,
		EventStatus:   access.EventStatus,
		PrivacyLevel:  access.PrivacyLevel,
		HostID:        uuid.New(),
		UserID:        access.UserID,
	}
}
