package ticket

import (
	"context"
	"errors"
	"log/slog"
	"strings"
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/application/uow"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
)

const (
	defaultQRTokenTTL      = 10 * time.Second
	defaultProximityMeters = 200.0
)

var tracer = otel.Tracer("github.com/bounswe/bounswe2026group11/backend/internal/application/ticket")

// Service owns ticket-specific application behavior.
type Service struct {
	repo       Repository
	unitOfWork uow.UnitOfWork
	tokens     QRTokenManager
	settings   Settings
	now        func() time.Time
}

var _ UseCase = (*Service)(nil)

// NewService constructs a ticket service backed by its repository and token manager.
func NewService(repo Repository, unitOfWork uow.UnitOfWork, tokens QRTokenManager, settings Settings) *Service {
	if settings.QRTokenTTL <= 0 {
		settings.QRTokenTTL = defaultQRTokenTTL
	}
	if settings.ProximityMeters <= 0 {
		settings.ProximityMeters = defaultProximityMeters
	}
	return &Service{
		repo:       repo,
		unitOfWork: unitOfWork,
		tokens:     tokens,
		settings:   settings,
		now:        time.Now,
	}
}

// CreateTicketForParticipation creates the protected-event ticket linked to an approved participation.
func (s *Service) CreateTicketForParticipation(ctx context.Context, participation *domain.Participation, status domain.TicketStatus) (*domain.Ticket, error) {
	ctx, span := tracer.Start(ctx, "ticket.create_for_participation")
	defer span.End()
	span.SetAttributes(
		attribute.String("operation", "ticket.create_for_participation"),
		attribute.String("ticket_status", status.String()),
	)

	if participation == nil {
		err := errors.New("create ticket: participation is nil")
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		slog.ErrorContext(ctx, "ticket creation failed",
			"operation", "ticket.create_for_participation",
			"ticket_status", status.String(),
			"error", err,
		)
		return nil, err
	}
	span.SetAttributes(
		attribute.String("participation_id", participation.ID.String()),
		attribute.String("event_id", participation.EventID.String()),
		attribute.String("participant_user_id", participation.UserID.String()),
	)

	var result *domain.Ticket
	err := s.unitOfWork.RunInTx(ctx, func(ctx context.Context) error {
		var err error
		result, err = s.repo.CreateTicketForParticipation(ctx, participation.ID, status)
		return err
	})
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		slog.ErrorContext(ctx, "ticket creation failed",
			"operation", "ticket.create_for_participation",
			"participation_id", participation.ID.String(),
			"event_id", participation.EventID.String(),
			"participant_user_id", participation.UserID.String(),
			"ticket_status", status.String(),
			"error", err,
		)
		return nil, err
	}
	span.SetAttributes(attribute.String("ticket_id", result.ID.String()))
	slog.InfoContext(ctx, "ticket created",
		"operation", "ticket.create_for_participation",
		"ticket_id", result.ID.String(),
		"participation_id", participation.ID.String(),
		"event_id", participation.EventID.String(),
		"participant_user_id", participation.UserID.String(),
		"ticket_status", result.Status.String(),
	)
	return result, nil
}

// CancelTicketForParticipation cancels a non-terminal ticket linked to the participation, if present.
func (s *Service) CancelTicketForParticipation(ctx context.Context, participationID uuid.UUID) error {
	ctx, span := tracer.Start(ctx, "ticket.cancel_for_participation")
	defer span.End()
	span.SetAttributes(
		attribute.String("operation", "ticket.cancel_for_participation"),
		attribute.String("participation_id", participationID.String()),
	)

	err := s.unitOfWork.RunInTx(ctx, func(ctx context.Context) error {
		return s.repo.CancelTicketForParticipation(ctx, participationID)
	})
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		slog.ErrorContext(ctx, "ticket cancellation failed",
			"operation", "ticket.cancel_for_participation",
			"participation_id", participationID.String(),
			"error", err,
		)
		return err
	}
	slog.InfoContext(ctx, "ticket canceled for participation",
		"operation", "ticket.cancel_for_participation",
		"participation_id", participationID.String(),
	)
	return nil
}

// CancelTicketsForEvent cancels all non-terminal tickets linked to an event.
func (s *Service) CancelTicketsForEvent(ctx context.Context, eventID uuid.UUID) error {
	ctx, span := tracer.Start(ctx, "ticket.cancel_for_event")
	defer span.End()
	span.SetAttributes(
		attribute.String("operation", "ticket.cancel_for_event"),
		attribute.String("event_id", eventID.String()),
	)

	err := s.unitOfWork.RunInTx(ctx, func(ctx context.Context) error {
		return s.repo.CancelTicketsForEvent(ctx, eventID)
	})
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		slog.ErrorContext(ctx, "event ticket cancellation failed",
			"operation", "ticket.cancel_for_event",
			"event_id", eventID.String(),
			"error", err,
		)
		return err
	}
	slog.InfoContext(ctx, "event tickets canceled",
		"operation", "ticket.cancel_for_event",
		"event_id", eventID.String(),
	)
	return nil
}

// ExpireTicketsForEvent expires all unused non-terminal tickets linked to an event.
func (s *Service) ExpireTicketsForEvent(ctx context.Context, eventID uuid.UUID) error {
	ctx, span := tracer.Start(ctx, "ticket.expire_for_event")
	defer span.End()
	span.SetAttributes(
		attribute.String("operation", "ticket.expire_for_event"),
		attribute.String("event_id", eventID.String()),
	)

	err := s.unitOfWork.RunInTx(ctx, func(ctx context.Context) error {
		return s.repo.ExpireTicketsForEvent(ctx, eventID)
	})
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		slog.ErrorContext(ctx, "event ticket expiration failed",
			"operation", "ticket.expire_for_event",
			"event_id", eventID.String(),
			"error", err,
		)
		return err
	}
	slog.InfoContext(ctx, "event tickets expired",
		"operation", "ticket.expire_for_event",
		"event_id", eventID.String(),
	)
	return nil
}

// ListMyTickets returns tickets owned by the authenticated user.
func (s *Service) ListMyTickets(ctx context.Context, userID uuid.UUID) (*ListTicketsResult, error) {
	records, err := s.repo.ListTicketsByUser(ctx, userID)
	if err != nil {
		return nil, err
	}
	items := make([]TicketListItem, len(records))
	for i, record := range records {
		items[i] = toTicketListItem(record)
	}
	return &ListTicketsResult{Items: items}, nil
}

// GetMyTicket returns a single ticket detail owned by the authenticated user.
func (s *Service) GetMyTicket(ctx context.Context, userID, ticketID uuid.UUID) (*TicketDetailResult, error) {
	record, err := s.repo.GetTicketDetail(ctx, userID, ticketID)
	if err != nil {
		return nil, err
	}
	if record == nil {
		return nil, domain.NotFoundError(domain.ErrorCodeTicketNotFound, "The requested ticket does not exist.")
	}
	return toTicketDetailResult(*record, s.settings.ProximityMeters, s.now().UTC()), nil
}

// IssueQRToken validates current access and issues a short-lived signed token.
func (s *Service) IssueQRToken(ctx context.Context, userID, ticketID uuid.UUID, input QRTokenInput) (*QRTokenResult, error) {
	ctx, span := tracer.Start(ctx, "ticket.issue_qr_token")
	defer span.End()
	span.SetAttributes(
		attribute.String("operation", "ticket.issue_qr_token"),
		attribute.String("user_id", userID.String()),
		attribute.String("ticket_id", ticketID.String()),
	)

	var result *QRTokenResult
	err := s.unitOfWork.RunInTx(ctx, func(ctx context.Context) error {
		record, err := s.repo.GetTicketAccessForUser(ctx, userID, ticketID, input.Lat, input.Lon, true)
		if err != nil {
			slog.ErrorContext(ctx, "ticket qr token access lookup failed",
				"operation", "ticket.issue_qr_token",
				"user_id", userID.String(),
				"ticket_id", ticketID.String(),
				"error", err,
			)
			return err
		}
		if record == nil {
			err := domain.NotFoundError(domain.ErrorCodeTicketNotFound, "The requested ticket does not exist.")
			slog.InfoContext(ctx, "ticket qr token rejected",
				"operation", "ticket.issue_qr_token",
				"user_id", userID.String(),
				"ticket_id", ticketID.String(),
				"reason", domain.ErrorCodeTicketNotFound,
			)
			return err
		}
		span.SetAttributes(
			attribute.String("event_id", record.EventID.String()),
			attribute.String("participation_id", record.Participation.ID.String()),
		)
		if err := validateQRAccess(*record, s.settings.ProximityMeters, s.now().UTC()); err != nil {
			slog.InfoContext(ctx, "ticket qr token rejected",
				"operation", "ticket.issue_qr_token",
				"user_id", userID.String(),
				"ticket_id", ticketID.String(),
				"event_id", record.EventID.String(),
				"participation_id", record.Participation.ID.String(),
				"ticket_status", record.Ticket.Status.String(),
				"participation_status", record.Participation.Status.String(),
				"event_status", string(record.EventStatus),
				"error", err,
			)
			return err
		}

		issuedAt := s.now().UTC()
		expiresAt := issuedAt.Add(s.settings.QRTokenTTL)
		version := record.Ticket.QRTokenVersion + 1
		token, err := s.tokens.Issue(QRTokenClaims{
			TicketID:        record.Ticket.ID,
			ParticipationID: record.Participation.ID,
			EventID:         record.EventID,
			UserID:          userID,
			Version:         version,
			IssuedAt:        issuedAt,
			ExpiresAt:       expiresAt,
		})
		if err != nil {
			slog.ErrorContext(ctx, "ticket qr token signing failed",
				"operation", "ticket.issue_qr_token",
				"user_id", userID.String(),
				"ticket_id", ticketID.String(),
				"event_id", record.EventID.String(),
				"participation_id", record.Participation.ID.String(),
				"version", version,
				"error", err,
			)
			return err
		}
		if err := s.repo.StoreIssuedToken(ctx, record.Ticket.ID, version, s.tokens.Hash(token)); err != nil {
			slog.ErrorContext(ctx, "ticket qr token persistence failed",
				"operation", "ticket.issue_qr_token",
				"user_id", userID.String(),
				"ticket_id", ticketID.String(),
				"event_id", record.EventID.String(),
				"participation_id", record.Participation.ID.String(),
				"version", version,
				"error", err,
			)
			return err
		}
		result = &QRTokenResult{
			Token:     token,
			ExpiresAt: expiresAt,
			Version:   version,
		}
		return nil
	})
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return nil, err
	}
	span.SetAttributes(attribute.Int("ticket_qr_version", result.Version))
	slog.InfoContext(ctx, "ticket qr token issued",
		"operation", "ticket.issue_qr_token",
		"user_id", userID.String(),
		"ticket_id", ticketID.String(),
		"version", result.Version,
	)
	return result, nil
}

// ScanTicket verifies a scanned QR token and marks its ticket USED when all checks pass.
func (s *Service) ScanTicket(ctx context.Context, hostUserID, eventID uuid.UUID, input ScanTicketInput) (*ScanTicketResult, error) {
	ctx, span := tracer.Start(ctx, "ticket.scan")
	defer span.End()
	span.SetAttributes(
		attribute.String("operation", "ticket.scan"),
		attribute.String("host_user_id", hostUserID.String()),
		attribute.String("event_id", eventID.String()),
	)

	token := strings.TrimSpace(input.QRToken)
	if token == "" {
		logTicketScanRejected(ctx, hostUserID, eventID, uuid.Nil, RejectReasonInvalidToken)
		return rejected(RejectReasonInvalidToken), nil
	}

	claims, err := s.tokens.Verify(token)
	if err != nil {
		logTicketScanRejected(ctx, hostUserID, eventID, uuid.Nil, RejectReasonInvalidToken)
		return rejected(RejectReasonInvalidToken), nil
	}
	span.SetAttributes(
		attribute.String("ticket_id", claims.TicketID.String()),
		attribute.String("participation_id", claims.ParticipationID.String()),
		attribute.String("participant_user_id", claims.UserID.String()),
		attribute.Int("ticket_qr_version", claims.Version),
	)
	if claims.EventID != eventID {
		logTicketScanRejected(ctx, hostUserID, eventID, claims.TicketID, RejectReasonEventMismatch)
		return rejected(RejectReasonEventMismatch), nil
	}

	var result *ScanTicketResult
	err = s.unitOfWork.RunInTx(ctx, func(ctx context.Context) error {
		record, err := s.repo.GetTicketForScan(ctx, eventID, claims.TicketID, true)
		if err != nil {
			slog.ErrorContext(ctx, "ticket scan lookup failed",
				"operation", "ticket.scan",
				"host_user_id", hostUserID.String(),
				"event_id", eventID.String(),
				"ticket_id", claims.TicketID.String(),
				"error", err,
			)
			return err
		}
		if record == nil {
			result = rejected(RejectReasonTicketNotFound)
			logTicketScanRejected(ctx, hostUserID, eventID, claims.TicketID, RejectReasonTicketNotFound)
			return nil
		}
		if record.HostID != hostUserID {
			err := domain.ForbiddenError(domain.ErrorCodeEventHostManagementNotAllowed, "Only the event host can scan tickets for this event.")
			slog.InfoContext(ctx, "ticket scan rejected",
				"operation", "ticket.scan",
				"host_user_id", hostUserID.String(),
				"event_id", eventID.String(),
				"ticket_id", record.Ticket.ID.String(),
				"participation_id", record.Participation.ID.String(),
				"reason", domain.ErrorCodeEventHostManagementNotAllowed,
			)
			return err
		}
		if reason := scanRejectReason(*record, *claims, s.tokens.Hash(token)); reason != "" {
			result = rejected(reason)
			logTicketScanRejected(ctx, hostUserID, eventID, record.Ticket.ID, reason,
				"participation_id", record.Participation.ID.String(),
				"participant_user_id", record.UserID.String(),
				"ticket_status", record.Ticket.Status.String(),
				"participation_status", record.Participation.Status.String(),
				"event_status", string(record.EventStatus),
			)
			return nil
		}

		used, err := s.repo.MarkTicketUsed(ctx, record.Ticket.ID)
		if err != nil {
			slog.ErrorContext(ctx, "ticket usage persistence failed",
				"operation", "ticket.scan",
				"host_user_id", hostUserID.String(),
				"event_id", eventID.String(),
				"ticket_id", record.Ticket.ID.String(),
				"participation_id", record.Participation.ID.String(),
				"error", err,
			)
			return err
		}
		result = accepted(*record, used.Status)
		return nil
	})
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return nil, err
	}
	if result != nil {
		span.SetAttributes(attribute.String("ticket_scan_result", result.Result))
		if result.Reason != nil {
			span.SetAttributes(attribute.String("ticket_scan_reject_reason", *result.Reason))
		}
	}
	if result != nil && result.Result == ScanResultAccepted {
		slog.InfoContext(ctx, "ticket scan accepted",
			"operation", "ticket.scan",
			"host_user_id", hostUserID.String(),
			"event_id", eventID.String(),
			"ticket_id", claims.TicketID.String(),
			"participation_id", claims.ParticipationID.String(),
			"participant_user_id", claims.UserID.String(),
		)
	}
	return result, nil
}

func logTicketScanRejected(ctx context.Context, hostUserID, eventID, ticketID uuid.UUID, reason string, attrs ...any) {
	fields := []any{
		"operation", "ticket.scan",
		"host_user_id", hostUserID.String(),
		"event_id", eventID.String(),
		"reason", reason,
	}
	if ticketID != uuid.Nil {
		fields = append(fields, "ticket_id", ticketID.String())
	}
	fields = append(fields, attrs...)
	slog.InfoContext(ctx, "ticket scan rejected", fields...)
}

func validateQRAccess(record TicketAccessRecord, proximityMeters float64, now time.Time) error {
	if record.Ticket.Status != domain.TicketStatusActive {
		return domain.ConflictError(domain.ErrorCodeTicketNotActive, "Only ACTIVE tickets can issue QR tokens.")
	}
	if record.Participation.Status != domain.ParticipationStatusApproved {
		return domain.ConflictError(domain.ErrorCodeTicketNotActive, "The linked participation is not approved.")
	}
	if record.EventStatus != domain.EventStatusActive && record.EventStatus != domain.EventStatusInProgress {
		return domain.ConflictError(domain.ErrorCodeTicketNotActive, "The event is not accepting ticket access.")
	}
	if record.PrivacyLevel != domain.PrivacyProtected {
		return domain.ConflictError(domain.ErrorCodeTicketNotActive, "Only PROTECTED events support tickets.")
	}
	if !record.Ticket.ExpiresAt.After(now) {
		return domain.ConflictError(domain.ErrorCodeTicketNotActive, "The ticket has expired.")
	}
	if record.DistanceMeters > proximityMeters {
		return domain.ForbiddenError(domain.ErrorCodeTicketProximityRequired, "You must be near the event location to show this ticket QR.")
	}
	return nil
}

func scanRejectReason(record TicketScanRecord, claims QRTokenClaims, tokenHash string) string {
	if record.Participation.ID != claims.ParticipationID {
		return RejectReasonParticipationMismatch
	}
	if record.UserID != claims.UserID {
		return RejectReasonInvalidToken
	}
	if record.Ticket.Status == domain.TicketStatusUsed {
		return RejectReasonTicketAlreadyUsed
	}
	if record.Ticket.Status != domain.TicketStatusActive {
		return RejectReasonTicketNotActive
	}
	if record.Participation.Status != domain.ParticipationStatusApproved {
		return RejectReasonParticipationInvalid
	}
	if record.EventStatus != domain.EventStatusActive && record.EventStatus != domain.EventStatusInProgress {
		return RejectReasonEventInvalid
	}
	if record.PrivacyLevel != domain.PrivacyProtected {
		return RejectReasonEventInvalid
	}
	if claims.Version != record.Ticket.QRTokenVersion {
		return RejectReasonTokenOldVersion
	}
	if record.Ticket.LastIssuedQRTokenHash == nil || *record.Ticket.LastIssuedQRTokenHash != tokenHash {
		return RejectReasonTokenNotLatest
	}
	return ""
}

func rejected(reason string) *ScanTicketResult {
	return &ScanTicketResult{
		Result: ScanResultRejected,
		Reason: &reason,
	}
}

func accepted(record TicketScanRecord, status domain.TicketStatus) *ScanTicketResult {
	ticketID := record.Ticket.ID.String()
	participationID := record.Participation.ID.String()
	userID := record.UserID.String()
	return &ScanTicketResult{
		Result:          ScanResultAccepted,
		TicketID:        &ticketID,
		ParticipationID: &participationID,
		UserID:          &userID,
		TicketStatus:    &status,
	}
}

func toTicketListItem(record TicketRecord) TicketListItem {
	return TicketListItem{
		TicketID:      record.Ticket.ID.String(),
		Status:        record.Ticket.Status,
		ExpiresAt:     record.Ticket.ExpiresAt,
		Event:         toTicketEventSummary(record),
		Participation: toTicketParticipationInfo(record.Participation),
	}
}

func toTicketDetailResult(record TicketRecord, proximityMeters float64, now time.Time) *TicketDetailResult {
	return &TicketDetailResult{
		Ticket: TicketInfo{
			ID:        record.Ticket.ID.String(),
			Status:    record.Ticket.Status,
			ExpiresAt: record.Ticket.ExpiresAt,
			UsedAt:    record.Ticket.UsedAt,
			CreatedAt: record.Ticket.CreatedAt,
			UpdatedAt: record.Ticket.UpdatedAt,
		},
		Participation: toTicketParticipationInfo(record.Participation),
		Event:         toTicketEventSummary(record),
		Location: TicketLocationSummary{
			Type:      record.LocationType,
			Address:   record.Address,
			AnchorLat: record.Anchor.Lat,
			AnchorLon: record.Anchor.Lon,
		},
		QRAccess: buildQRAccessInfo(record, proximityMeters, now),
	}
}

func toTicketParticipationInfo(participation domain.Participation) TicketParticipationInfo {
	return TicketParticipationInfo{
		ID:     participation.ID.String(),
		Status: participation.Status,
	}
}

func toTicketEventSummary(record TicketRecord) TicketEventSummary {
	return TicketEventSummary{
		ID:           record.EventID.String(),
		Title:        record.EventTitle,
		Status:       record.EventStatus,
		PrivacyLevel: record.PrivacyLevel,
		StartTime:    record.StartTime,
		EndTime:      record.EndTime,
		LocationType: record.LocationType,
		Address:      record.Address,
	}
}

func buildQRAccessInfo(record TicketRecord, proximityMeters float64, now time.Time) QRAccessInfo {
	reason := qrAccessReason(record, now)
	return QRAccessInfo{
		RequiresLocationPermission: true,
		RequiresProximity:          true,
		ProximityMeters:            proximityMeters,
		EligibleNow:                reason == nil,
		Reason:                     reason,
	}
}

func qrAccessReason(record TicketRecord, now time.Time) *string {
	var reason string
	switch {
	case record.Ticket.Status == domain.TicketStatusPending:
		reason = "PARTICIPATION_PENDING_REAPPROVAL"
	case record.Ticket.Status != domain.TicketStatusActive:
		reason = "TICKET_" + record.Ticket.Status.String()
	case record.Participation.Status != domain.ParticipationStatusApproved:
		reason = "PARTICIPATION_" + record.Participation.Status.String()
	case record.EventStatus != domain.EventStatusActive && record.EventStatus != domain.EventStatusInProgress:
		reason = "EVENT_" + string(record.EventStatus)
	case !record.Ticket.ExpiresAt.After(now):
		reason = "TICKET_EXPIRED"
	default:
		return nil
	}
	return &reason
}
