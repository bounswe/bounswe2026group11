package postgres

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"time"

	invitationapp "github.com/bounswe/bounswe2026group11/backend/internal/application/invitation"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

type InvitationRepository struct {
	pool *pgxpool.Pool
	db   execer
}

var _ invitationapp.Repository = (*InvitationRepository)(nil)

var invitationUsernamePattern = regexp.MustCompile(`^[A-Za-z0-9_]+$`)

func NewInvitationRepository(pool *pgxpool.Pool) *InvitationRepository {
	return &InvitationRepository{
		pool: pool,
		db:   contextualRunner{fallback: pool},
	}
}

func (r *InvitationRepository) CreateInvitations(
	ctx context.Context,
	params invitationapp.CreateInvitationsParams,
) (*invitationapp.CreateInvitationsRecord, error) {
	event, err := r.loadInvitationEventState(ctx, params.EventID, true)
	if err != nil {
		return nil, err
	}
	if event == nil {
		return nil, domain.NotFoundError(domain.ErrorCodeEventNotFound, "The requested event does not exist.")
	}
	if event.HostID != params.HostID {
		return nil, domain.ForbiddenError(domain.ErrorCodeEventHostManagementNotAllowed, "Only the event host can manage invitations.")
	}
	if event.PrivacyLevel != domain.PrivacyPrivate {
		return nil, domain.ConflictError(domain.ErrorCodeInvitationNotAllowed, "Only PRIVATE events support host invitations.")
	}
	if event.Status == domain.EventStatusCanceled || event.Status == domain.EventStatusCompleted {
		return nil, domain.ConflictError(domain.ErrorCodeEventNotJoinable, "This event is no longer accepting participants.")
	}

	result := &invitationapp.CreateInvitationsRecord{
		SuccessfulInvitations: []invitationapp.CreatedInvitationRecord{},
		InvalidUsernames:      []string{},
		Failed:                []invitationapp.InvitationFailureRecord{},
	}

	validForLookup, invalidByShape := partitionValidUsernames(params.Usernames)
	result.InvalidUsernames = append(result.InvalidUsernames, invalidByShape...)

	orderedUsernames, duplicates := uniqueUsernames(validForLookup)
	for _, username := range duplicates {
		result.Failed = append(result.Failed, invitationapp.InvitationFailureRecord{
			Username: username,
			Code:     invitationapp.FailureDuplicateUsername,
		})
	}

	users, err := r.loadUsersByUsername(ctx, orderedUsernames)
	if err != nil {
		return nil, err
	}

	userIDs := make([]uuid.UUID, 0, len(users))
	for _, username := range orderedUsernames {
		user, ok := users[username]
		if !ok {
			result.InvalidUsernames = append(result.InvalidUsernames, username)
			continue
		}
		userIDs = append(userIDs, user.ID)
	}

	existingInvitations, err := r.loadInvitationsByEventAndUsers(ctx, params.EventID, userIDs)
	if err != nil {
		return nil, err
	}
	participations, err := r.loadParticipationsByEventAndUsers(ctx, params.EventID, userIDs)
	if err != nil {
		return nil, err
	}

	for _, username := range orderedUsernames {
		user, ok := users[username]
		if !ok {
			continue
		}
		failureCode := invitationFailureForUser(event, user.ID, existingInvitations[user.ID], participations[user.ID], params.Now)
		if failureCode != "" {
			result.Failed = append(result.Failed, invitationapp.InvitationFailureRecord{Username: username, Code: failureCode})
			continue
		}

		var invitation *domain.Invitation
		if existing := existingInvitations[user.ID]; existing != nil {
			invitation, err = r.reactivateInvitation(ctx, existing.ID, params.Message)
		} else {
			invitation, err = r.insertInvitation(ctx, params.EventID, params.HostID, user.ID, params.Message)
		}
		if err != nil {
			return nil, err
		}
		result.SuccessfulInvitations = append(result.SuccessfulInvitations, invitationapp.CreatedInvitationRecord{
			Invitation: invitation,
			Username:   username,
		})
	}

	return result, nil
}

func (r *InvitationRepository) ListReceivedPendingInvitations(
	ctx context.Context,
	userID uuid.UUID,
) ([]invitationapp.ReceivedInvitationRecord, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT
			inv.id,
			inv.status,
			inv.message,
			inv.expires_at,
			inv.created_at,
			inv.updated_at,
			e.id,
			e.title,
			e.image_url,
			e.start_time,
			e.end_time,
			e.status,
			e.privacy_level,
			e.approved_participant_count,
			host.id,
			host.username,
			hp.display_name,
			hp.avatar_url
		FROM invitation inv
		JOIN event e ON e.id = inv.event_id
		JOIN app_user host ON host.id = inv.host_id
		LEFT JOIN profile hp ON hp.user_id = host.id
		WHERE inv.invited_user_id = $1
		  AND inv.status = $2
		  AND e.privacy_level = $3
		  AND e.status IN ($4, $5)
		ORDER BY inv.created_at ASC, inv.id ASC
	`, userID, domain.InvitationStatusPending, domain.PrivacyPrivate, domain.EventStatusActive, domain.EventStatusInProgress)
	if err != nil {
		return nil, fmt.Errorf("list received invitations: %w", err)
	}
	defer rows.Close()

	records := make([]invitationapp.ReceivedInvitationRecord, 0)
	for rows.Next() {
		record, err := scanReceivedInvitation(rows)
		if err != nil {
			return nil, err
		}
		records = append(records, *record)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate received invitations: %w", err)
	}
	return records, nil
}

func (r *InvitationRepository) AcceptInvitation(
	ctx context.Context,
	userID, invitationID uuid.UUID,
) (*invitationapp.AcceptInvitationRecord, error) {
	invitation, err := r.loadInvitationByIDForUser(ctx, invitationID, userID, true)
	if err != nil {
		return nil, err
	}
	if invitation == nil {
		return nil, domain.NotFoundError(domain.ErrorCodeInvitationNotFound, "The requested invitation does not exist.")
	}
	if invitation.Status != domain.InvitationStatusPending {
		return nil, domain.ConflictError(domain.ErrorCodeInvitationStateInvalid, "Only PENDING invitations can be accepted.")
	}

	event, err := r.loadInvitationEventState(ctx, invitation.EventID, true)
	if err != nil {
		return nil, err
	}
	if event == nil {
		return nil, domain.NotFoundError(domain.ErrorCodeEventNotFound, "The requested event does not exist.")
	}
	if event.Status == domain.EventStatusCanceled || event.Status == domain.EventStatusCompleted {
		return nil, domain.ConflictError(domain.ErrorCodeEventNotJoinable, "This event is no longer accepting participants.")
	}
	if event.Capacity != nil && event.ApprovedParticipantCount >= *event.Capacity {
		return nil, domain.ConflictError(domain.ErrorCodeCapacityExceeded, "This event has reached its maximum capacity.")
	}

	user, err := r.loadUserForEligibility(ctx, userID)
	if err != nil {
		return nil, err
	}
	if appErr := domain.CheckParticipationEligibility(user, event, time.Now().UTC()); appErr != nil {
		return nil, appErr
	}

	participation, err := r.insertOrReactivateApprovedParticipation(ctx, event, userID)
	if err != nil {
		return nil, err
	}

	updatedInvitation, err := r.updateInvitationStatus(ctx, invitationID, domain.InvitationStatusAccepted)
	if err != nil {
		return nil, err
	}

	return &invitationapp.AcceptInvitationRecord{
		Invitation:    updatedInvitation,
		Participation: participation,
	}, nil
}

func (r *InvitationRepository) DeclineInvitation(
	ctx context.Context,
	userID, invitationID uuid.UUID,
) (*domain.Invitation, error) {
	invitation, err := r.loadInvitationByIDForUser(ctx, invitationID, userID, true)
	if err != nil {
		return nil, err
	}
	if invitation == nil {
		return nil, domain.NotFoundError(domain.ErrorCodeInvitationNotFound, "The requested invitation does not exist.")
	}
	if invitation.Status != domain.InvitationStatusPending {
		return nil, domain.ConflictError(domain.ErrorCodeInvitationStateInvalid, "Only PENDING invitations can be declined.")
	}

	return r.updateInvitationStatus(ctx, invitationID, domain.InvitationStatusDeclined)
}

func (r *InvitationRepository) GetInvitationNotificationContext(
	ctx context.Context,
	invitationID uuid.UUID,
) (*invitationapp.InvitationNotificationContext, error) {
	var (
		record             invitationapp.InvitationNotificationContext
		eventImageURL      pgtype.Text
		hostDisplayName    pgtype.Text
		invitedDisplayName pgtype.Text
	)
	err := r.db.QueryRow(ctx, `
		SELECT
			inv.id,
			inv.event_id,
			e.title,
			e.image_url,
			e.start_time,
			inv.host_id,
			host.username,
			host_profile.display_name,
			inv.invited_user_id,
			invited.username,
			invited_profile.display_name
		FROM invitation inv
		JOIN event e ON e.id = inv.event_id
		JOIN app_user host ON host.id = inv.host_id
		LEFT JOIN profile host_profile ON host_profile.user_id = host.id
		JOIN app_user invited ON invited.id = inv.invited_user_id
		LEFT JOIN profile invited_profile ON invited_profile.user_id = invited.id
		WHERE inv.id = $1
	`, invitationID).Scan(
		&record.InvitationID,
		&record.EventID,
		&record.EventTitle,
		&eventImageURL,
		&record.EventStartTime,
		&record.HostUserID,
		&record.HostUsername,
		&hostDisplayName,
		&record.InvitedUserID,
		&record.InvitedUsername,
		&invitedDisplayName,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.NotFoundError(domain.ErrorCodeInvitationNotFound, "The requested invitation does not exist.")
		}
		return nil, fmt.Errorf("load invitation notification context: %w", err)
	}
	record.EventImageURL = textPtr(eventImageURL)
	record.HostDisplayName = textPtr(hostDisplayName)
	record.InvitedDisplayName = textPtr(invitedDisplayName)
	return &record, nil
}

func uniqueUsernames(usernames []string) ([]string, []string) {
	seen := make(map[string]struct{}, len(usernames))
	ordered := make([]string, 0, len(usernames))
	duplicates := make([]string, 0)
	for _, username := range usernames {
		if _, ok := seen[username]; ok {
			duplicates = append(duplicates, username)
			continue
		}
		seen[username] = struct{}{}
		ordered = append(ordered, username)
	}
	return ordered, duplicates
}

func partitionValidUsernames(usernames []string) ([]string, []string) {
	valid := make([]string, 0, len(usernames))
	invalid := make([]string, 0)
	for _, username := range usernames {
		if len(username) < 3 || len(username) > 32 || !invitationUsernamePattern.MatchString(username) {
			invalid = append(invalid, username)
			continue
		}
		valid = append(valid, username)
	}
	return valid, invalid
}

func invitationFailureForUser(
	event *domain.Event,
	userID uuid.UUID,
	existing *domain.Invitation,
	participation *domain.Participation,
	now time.Time,
) string {
	if userID == event.HostID {
		return invitationapp.FailureHostUser
	}
	if event.Capacity != nil && event.ApprovedParticipantCount >= *event.Capacity {
		return invitationapp.FailureCapacityExceeded
	}
	if participation != nil && !canReactivateLeavedParticipation(participation, event.StartTime) {
		return invitationapp.FailureAlreadyParticipating
	}
	if existing == nil {
		return ""
	}
	switch existing.Status {
	case domain.InvitationStatusPending, domain.InvitationStatusAccepted:
		return invitationapp.FailureAlreadyInvited
	case domain.InvitationStatusDeclined:
		if now.Before(existing.UpdatedAt.Add(domain.InvitationDeclineCooldown)) {
			return invitationapp.FailureDeclineCooldown
		}
		return ""
	case domain.InvitationStatusExpired:
		return ""
	default:
		return invitationapp.FailureAlreadyInvited
	}
}

func (r *InvitationRepository) loadInvitationEventState(
	ctx context.Context,
	eventID uuid.UUID,
	forUpdate bool,
) (*domain.Event, error) {
	query := `
		SELECT host_id, privacy_level, status, capacity, approved_participant_count,
		       start_time, minimum_age, preferred_gender
		FROM event
		WHERE id = $1
	`
	if forUpdate {
		query += ` FOR UPDATE`
	}

	var (
		hostID          uuid.UUID
		privacyLevel    string
		status          string
		capacity        pgtype.Int4
		approvedCount   int
		startTime       time.Time
		minimumAge      pgtype.Int4
		preferredGender pgtype.Text
	)
	err := r.db.QueryRow(ctx, query, eventID).Scan(
		&hostID,
		&privacyLevel,
		&status,
		&capacity,
		&approvedCount,
		&startTime,
		&minimumAge,
		&preferredGender,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("load invitation event state: %w", err)
	}

	event := &domain.Event{
		ID:                       eventID,
		HostID:                   hostID,
		PrivacyLevel:             domain.EventPrivacyLevel(privacyLevel),
		Status:                   domain.EventStatus(status),
		ApprovedParticipantCount: approvedCount,
		StartTime:                startTime,
	}
	if capacity.Valid {
		value := int(capacity.Int32)
		event.Capacity = &value
	}
	if minimumAge.Valid {
		value := int(minimumAge.Int32)
		event.MinimumAge = &value
	}
	if preferredGender.Valid {
		value := domain.EventParticipantGender(preferredGender.String)
		event.PreferredGender = &value
	}
	return event, nil
}

type invitationUser struct {
	ID       uuid.UUID
	Username string
}

func (r *InvitationRepository) loadUsersByUsername(
	ctx context.Context,
	usernames []string,
) (map[string]invitationUser, error) {
	if len(usernames) == 0 {
		return map[string]invitationUser{}, nil
	}
	rows, err := r.db.Query(ctx, `
		SELECT id, username
		FROM app_user
		WHERE username = ANY($1)
	`, usernames)
	if err != nil {
		return nil, fmt.Errorf("load invitation users: %w", err)
	}
	defer rows.Close()

	users := make(map[string]invitationUser, len(usernames))
	for rows.Next() {
		var user invitationUser
		if err := rows.Scan(&user.ID, &user.Username); err != nil {
			return nil, fmt.Errorf("scan invitation user: %w", err)
		}
		users[user.Username] = user
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate invitation users: %w", err)
	}
	return users, nil
}

func (r *InvitationRepository) loadInvitationsByEventAndUsers(
	ctx context.Context,
	eventID uuid.UUID,
	userIDs []uuid.UUID,
) (map[uuid.UUID]*domain.Invitation, error) {
	if len(userIDs) == 0 {
		return map[uuid.UUID]*domain.Invitation{}, nil
	}
	rows, err := r.db.Query(ctx, `
		SELECT id, event_id, host_id, invited_user_id, status, message, expires_at, created_at, updated_at
		FROM invitation
		WHERE event_id = $1
		  AND invited_user_id = ANY($2)
		FOR UPDATE
	`, eventID, userIDs)
	if err != nil {
		return nil, fmt.Errorf("load invitations by users: %w", err)
	}
	defer rows.Close()

	invitations := make(map[uuid.UUID]*domain.Invitation, len(userIDs))
	for rows.Next() {
		invitation, err := scanInvitation(rows)
		if err != nil {
			return nil, err
		}
		invitations[invitation.InvitedUserID] = invitation
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate invitations by users: %w", err)
	}
	return invitations, nil
}

func (r *InvitationRepository) loadParticipationsByEventAndUsers(
	ctx context.Context,
	eventID uuid.UUID,
	userIDs []uuid.UUID,
) (map[uuid.UUID]*domain.Participation, error) {
	if len(userIDs) == 0 {
		return map[uuid.UUID]*domain.Participation{}, nil
	}
	rows, err := r.db.Query(ctx, `
		SELECT id, user_id, status, created_at, updated_at
		FROM participation
		WHERE event_id = $1
		  AND user_id = ANY($2)
		FOR UPDATE
	`, eventID, userIDs)
	if err != nil {
		return nil, fmt.Errorf("load invitation participations: %w", err)
	}
	defer rows.Close()

	participations := make(map[uuid.UUID]*domain.Participation, len(userIDs))
	for rows.Next() {
		var (
			id        uuid.UUID
			userID    uuid.UUID
			status    string
			createdAt time.Time
			updatedAt time.Time
		)
		if err := rows.Scan(&id, &userID, &status, &createdAt, &updatedAt); err != nil {
			return nil, fmt.Errorf("scan invitation participation: %w", err)
		}
		parsedStatus, ok := domain.ParseParticipationStatus(status)
		if !ok {
			return nil, fmt.Errorf("unknown participation status %q", status)
		}
		participations[userID] = &domain.Participation{
			ID:        id,
			EventID:   eventID,
			UserID:    userID,
			Status:    parsedStatus,
			CreatedAt: createdAt,
			UpdatedAt: updatedAt,
		}
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate invitation participations: %w", err)
	}
	return participations, nil
}

func (r *InvitationRepository) insertInvitation(
	ctx context.Context,
	eventID, hostID, invitedUserID uuid.UUID,
	message *string,
) (*domain.Invitation, error) {
	invitation, err := scanInvitation(r.db.QueryRow(ctx, `
		INSERT INTO invitation (event_id, host_id, invited_user_id, status, message)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, event_id, host_id, invited_user_id, status, message, expires_at, created_at, updated_at
	`, eventID, hostID, invitedUserID, domain.InvitationStatusPending, message))
	if err != nil {
		return nil, fmt.Errorf("insert invitation: %w", err)
	}
	return invitation, nil
}

func (r *InvitationRepository) reactivateInvitation(
	ctx context.Context,
	invitationID uuid.UUID,
	message *string,
) (*domain.Invitation, error) {
	invitation, err := scanInvitation(r.db.QueryRow(ctx, `
		UPDATE invitation
		SET status = $2,
		    message = $3,
		    expires_at = NULL,
		    created_at = NOW(),
		    updated_at = NOW()
		WHERE id = $1
		RETURNING id, event_id, host_id, invited_user_id, status, message, expires_at, created_at, updated_at
	`, invitationID, domain.InvitationStatusPending, message))
	if err != nil {
		return nil, fmt.Errorf("reactivate invitation: %w", err)
	}
	return invitation, nil
}

func (r *InvitationRepository) loadInvitationByIDForUser(
	ctx context.Context,
	invitationID, userID uuid.UUID,
	forUpdate bool,
) (*domain.Invitation, error) {
	query := `
		SELECT id, event_id, host_id, invited_user_id, status, message, expires_at, created_at, updated_at
		FROM invitation
		WHERE id = $1
		  AND invited_user_id = $2
	`
	if forUpdate {
		query += ` FOR UPDATE`
	}
	invitation, err := scanInvitation(r.db.QueryRow(ctx, query, invitationID, userID))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return invitation, nil
}

func (r *InvitationRepository) updateInvitationStatus(
	ctx context.Context,
	invitationID uuid.UUID,
	status domain.InvitationStatus,
) (*domain.Invitation, error) {
	invitation, err := scanInvitation(r.db.QueryRow(ctx, `
		UPDATE invitation
		SET status = $2,
		    updated_at = NOW()
		WHERE id = $1
		RETURNING id, event_id, host_id, invited_user_id, status, message, expires_at, created_at, updated_at
	`, invitationID, status))
	if err != nil {
		return nil, fmt.Errorf("update invitation status: %w", err)
	}
	return invitation, nil
}

func (r *InvitationRepository) loadUserForEligibility(ctx context.Context, userID uuid.UUID) (*domain.User, error) {
	var (
		userIDValue uuid.UUID
		username    string
		email       string
		gender      pgtype.Text
		birthDate   pgtype.Date
	)
	err := r.db.QueryRow(ctx, `
		SELECT id, username, email, gender, birth_date
		FROM app_user
		WHERE id = $1
	`, userID).Scan(&userIDValue, &username, &email, &gender, &birthDate)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.NotFoundError(domain.ErrorCodeUserNotFound, "The requested user does not exist.")
		}
		return nil, fmt.Errorf("load invitation user eligibility: %w", err)
	}

	user := &domain.User{
		ID:       userIDValue,
		Username: username,
		Email:    email,
	}
	if gender.Valid {
		user.Gender = &gender.String
	}
	if birthDate.Valid {
		value := birthDate.Time
		user.BirthDate = &value
	}
	return user, nil
}

func (r *InvitationRepository) insertOrReactivateApprovedParticipation(
	ctx context.Context,
	event *domain.Event,
	userID uuid.UUID,
) (*domain.Participation, error) {
	participation, err := scanParticipation(r.db.QueryRow(ctx, `
		WITH reactivated AS (
			UPDATE participation
			SET status = $3,
			    created_at = NOW(),
			    updated_at = NOW()
			WHERE event_id = $1
			  AND user_id = $2
			  AND status = $4
			  AND updated_at < $5
			RETURNING id, status, created_at, updated_at
		),
		inserted AS (
			INSERT INTO participation (event_id, user_id, status)
			SELECT $1, $2, $3
			WHERE NOT EXISTS (SELECT 1 FROM reactivated)
			ON CONFLICT ON CONSTRAINT uq_event_user DO NOTHING
			RETURNING id, status, created_at, updated_at
		)
		SELECT id, status, created_at, updated_at
		FROM reactivated
		UNION ALL
		SELECT id, status, created_at, updated_at
		FROM inserted
		LIMIT 1
	`, event.ID, userID, domain.ParticipationStatusApproved, domain.ParticipationStatusLeaved, event.StartTime), event.ID, userID, "accept invitation participation")
	if err != nil {
		return nil, err
	}
	if participation != nil {
		return participation, nil
	}

	existing, err := loadParticipation(ctx, r.db, event.ID, userID, true)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return nil, mapJoinParticipationConflict(
			existing,
			event.StartTime,
			"You are already participating in this event.",
			"You cannot join this event after leaving once it has started.",
		)
	}
	return nil, fmt.Errorf("accept invitation participation: no row returned and no existing participation found")
}

func scanInvitation(row pgx.Row) (*domain.Invitation, error) {
	var (
		id            uuid.UUID
		eventID       uuid.UUID
		hostID        uuid.UUID
		invitedUserID uuid.UUID
		status        string
		message       pgtype.Text
		expiresAt     pgtype.Timestamptz
		createdAt     time.Time
		updatedAt     time.Time
	)
	err := row.Scan(&id, &eventID, &hostID, &invitedUserID, &status, &message, &expiresAt, &createdAt, &updatedAt)
	if err != nil {
		return nil, err
	}
	parsedStatus, ok := domain.ParseInvitationStatus(status)
	if !ok {
		return nil, fmt.Errorf("unknown invitation status %q", status)
	}
	invitation := &domain.Invitation{
		ID:            id,
		EventID:       eventID,
		HostID:        hostID,
		InvitedUserID: invitedUserID,
		Status:        parsedStatus,
		CreatedAt:     createdAt,
		UpdatedAt:     updatedAt,
	}
	if message.Valid {
		invitation.Message = &message.String
	}
	if expiresAt.Valid {
		invitation.ExpiresAt = &expiresAt.Time
	}
	return invitation, nil
}

func scanReceivedInvitation(rows pgx.Rows) (*invitationapp.ReceivedInvitationRecord, error) {
	var (
		record          invitationapp.ReceivedInvitationRecord
		status          string
		message         pgtype.Text
		expiresAt       pgtype.Timestamptz
		imageURL        pgtype.Text
		endTime         pgtype.Timestamptz
		eventStatus     string
		privacyLevel    string
		hostDisplayName pgtype.Text
		hostAvatarURL   pgtype.Text
	)
	if err := rows.Scan(
		&record.InvitationID,
		&status,
		&message,
		&expiresAt,
		&record.CreatedAt,
		&record.UpdatedAt,
		&record.Event.ID,
		&record.Event.Title,
		&imageURL,
		&record.Event.StartTime,
		&endTime,
		&eventStatus,
		&privacyLevel,
		&record.Event.ApprovedParticipantCount,
		&record.Host.ID,
		&record.Host.Username,
		&hostDisplayName,
		&hostAvatarURL,
	); err != nil {
		return nil, fmt.Errorf("scan received invitation: %w", err)
	}
	parsedStatus, ok := domain.ParseInvitationStatus(status)
	if !ok {
		return nil, fmt.Errorf("unknown invitation status %q", status)
	}
	record.Status = parsedStatus
	record.Event.Status = domain.EventStatus(eventStatus)
	record.Event.PrivacyLevel = domain.EventPrivacyLevel(privacyLevel)
	if message.Valid {
		record.Message = &message.String
	}
	if expiresAt.Valid {
		record.ExpiresAt = &expiresAt.Time
	}
	if imageURL.Valid {
		record.Event.ImageURL = &imageURL.String
	}
	if endTime.Valid {
		record.Event.EndTime = &endTime.Time
	}
	if hostDisplayName.Valid {
		record.Host.DisplayName = &hostDisplayName.String
	}
	if hostAvatarURL.Valid {
		record.Host.AvatarURL = &hostAvatarURL.String
	}
	return &record, nil
}
