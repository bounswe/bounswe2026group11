package event

import (
	"strings"
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

// toCreateEventResult maps the created domain.Event to the API response shape.
func toCreateEventResult(e *domain.Event) *CreateEventResult {
	return &CreateEventResult{
		ID:           e.ID.String(),
		Title:        e.Title,
		PrivacyLevel: string(e.PrivacyLevel),
		Status:       string(e.Status),
		StartTime:    e.StartTime,
		EndTime:      e.EndTime,
		CreatedAt:    e.CreatedAt,
	}
}

// toCreateEventParams maps a validated CreateEventInput to the repository params
// expected by the repository.
func toCreateEventParams(hostID uuid.UUID, input CreateEventInput) CreateEventParams {
	constraints := make([]EventConstraintParams, len(input.Constraints))
	for i, c := range input.Constraints {
		constraints[i] = EventConstraintParams{
			Type: strings.TrimSpace(c.Type),
			Info: strings.TrimSpace(c.Info),
		}
	}

	description := strings.TrimSpace(*input.Description)
	params := CreateEventParams{
		HostID:          hostID,
		Title:           strings.TrimSpace(input.Title),
		Description:     description,
		ImageURL:        input.ImageURL,
		CategoryID:      *input.CategoryID,
		StartTime:       input.StartTime,
		EndTime:         input.EndTime,
		PrivacyLevel:    input.PrivacyLevel,
		Capacity:        input.Capacity,
		MinimumAge:      input.MinimumAge,
		PreferredGender: input.PreferredGender,
		LocationType:    input.LocationType,
		Address:         input.Address,
		Tags:            input.Tags,
		Constraints:     constraints,
	}

	switch input.LocationType {
	case domain.LocationPoint:
		params.Point = &domain.GeoPoint{
			Lat: *input.Lat,
			Lon: *input.Lon,
		}
	case domain.LocationRoute:
		params.RoutePoints = toDomainRoutePoints(input.RoutePoints)
	}

	return params
}

func toDiscoverableEventItem(record DiscoverableEventRecord) DiscoverableEventItem {
	return DiscoverableEventItem{
		ID:                       record.ID.String(),
		Title:                    record.Title,
		CategoryName:             record.CategoryName,
		ImageURL:                 record.ImageURL,
		StartTime:                record.StartTime,
		LocationAddress:          record.LocationAddress,
		PrivacyLevel:             string(record.PrivacyLevel),
		ApprovedParticipantCount: record.ApprovedParticipantCount,
		FavoriteCount:            record.FavoriteCount,
		IsFavorited:              record.IsFavorited,
		HostScore:                toEventHostScoreSummary(record.HostScore),
	}
}

func toEventDetailResult(record *EventDetailRecord, now time.Time) *GetEventDetailResult {
	ratingWindow := domain.NewRatingWindow(record.StartTime, record.EndTime)
	isRatingWindowActive := ratingWindow.IsActive(now)
	if record.Status == domain.EventStatusCanceled {
		isRatingWindowActive = false
	}

	result := &GetEventDetailResult{
		ID:                       record.ID.String(),
		Title:                    record.Title,
		Description:              record.Description,
		ImageURL:                 record.ImageURL,
		PrivacyLevel:             string(record.PrivacyLevel),
		Status:                   string(record.Status),
		StartTime:                record.StartTime,
		EndTime:                  record.EndTime,
		Capacity:                 record.Capacity,
		MinimumAge:               record.MinimumAge,
		ApprovedParticipantCount: record.ApprovedParticipantCount,
		PendingParticipantCount:  record.PendingParticipantCount,
		FavoriteCount:            record.FavoriteCount,
		CreatedAt:                record.CreatedAt,
		UpdatedAt:                record.UpdatedAt,
		Host:                     toEventDetailPerson(record.Host),
		HostScore:                toEventHostScoreSummary(record.HostScore),
		Location:                 toEventDetailLocation(record.Location),
		Tags:                     append([]string{}, record.Tags...),
		Constraints:              toEventDetailConstraints(record.Constraints),
		RatingWindow: EventDetailRatingWindow{
			OpensAt:  ratingWindow.OpensAt,
			ClosesAt: ratingWindow.ClosesAt,
			IsActive: isRatingWindowActive,
		},
		ViewerEventRating: toEventDetailRating(record.ViewerEventRating),
		ViewerContext: EventDetailViewerContext{
			IsHost:              record.ViewerContext.IsHost,
			IsFavorited:         record.ViewerContext.IsFavorited,
			ParticipationStatus: string(record.ViewerContext.ParticipationStatus),
		},
	}

	if record.Category != nil {
		result.Category = &EventDetailCategory{
			ID:   record.Category.ID,
			Name: record.Category.Name,
		}
	}
	if record.PreferredGender != nil {
		preferredGender := string(*record.PreferredGender)
		result.PreferredGender = &preferredGender
	}
	if record.HostContext != nil {
		result.HostContext = &EventDetailHostContext{
			ApprovedParticipants: toEventDetailApprovedParticipants(record.HostContext.ApprovedParticipants),
			PendingJoinRequests:  toEventDetailPendingJoinRequests(record.HostContext.PendingJoinRequests),
			Invitations:          toEventDetailInvitations(record.HostContext.Invitations),
		}
	}

	return result
}

func toEventDetailLocation(record EventDetailLocationRecord) EventDetailLocation {
	location := EventDetailLocation{
		Type:    string(record.Type),
		Address: record.Address,
	}

	if record.Point != nil {
		location.Point = &EventDetailPoint{
			Lat: record.Point.Lat,
			Lon: record.Point.Lon,
		}
	}
	if len(record.RoutePoints) > 0 {
		location.RoutePoints = make([]EventDetailPoint, len(record.RoutePoints))
		for i, point := range record.RoutePoints {
			location.RoutePoints[i] = EventDetailPoint{
				Lat: point.Lat,
				Lon: point.Lon,
			}
		}
	}

	return location
}

func toEventDetailConstraints(records []EventDetailConstraintRecord) []EventDetailConstraint {
	constraints := make([]EventDetailConstraint, len(records))
	for i, record := range records {
		constraints[i] = EventDetailConstraint(record)
	}
	return constraints
}

func toEventDetailApprovedParticipants(records []EventDetailApprovedParticipantRecord) []EventDetailApprovedParticipant {
	participants := make([]EventDetailApprovedParticipant, len(records))
	for i, record := range records {
		participants[i] = EventDetailApprovedParticipant{
			ParticipationID: record.ParticipationID.String(),
			Status:          record.Status,
			CreatedAt:       record.CreatedAt,
			UpdatedAt:       record.UpdatedAt,
			HostRating:      toEventDetailRating(record.HostRating),
			User:            toEventDetailHostContextUser(record.User),
		}
	}
	return participants
}

func toEventDetailPendingJoinRequests(records []EventDetailPendingJoinRequestRecord) []EventDetailPendingJoinRequest {
	requests := make([]EventDetailPendingJoinRequest, len(records))
	for i, record := range records {
		requests[i] = EventDetailPendingJoinRequest{
			JoinRequestID: record.JoinRequestID.String(),
			Status:        record.Status,
			Message:       record.Message,
			CreatedAt:     record.CreatedAt,
			UpdatedAt:     record.UpdatedAt,
			User:          toEventDetailHostContextUser(record.User),
		}
	}
	return requests
}

func toEventDetailInvitations(records []EventDetailInvitationRecord) []EventDetailInvitation {
	invitations := make([]EventDetailInvitation, len(records))
	for i, record := range records {
		invitations[i] = EventDetailInvitation{
			InvitationID: record.InvitationID.String(),
			Status:       string(record.Status),
			Message:      record.Message,
			ExpiresAt:    record.ExpiresAt,
			CreatedAt:    record.CreatedAt,
			UpdatedAt:    record.UpdatedAt,
			User:         toEventDetailHostContextUser(record.User),
		}
	}
	return invitations
}

func toEventDetailPerson(record EventDetailPersonRecord) EventDetailPerson {
	return EventDetailPerson{
		ID:          record.ID.String(),
		Username:    record.Username,
		DisplayName: record.DisplayName,
		AvatarURL:   record.AvatarURL,
	}
}

func toEventDetailHostContextUser(record EventDetailHostContextUserRecord) EventDetailHostContextUser {
	return EventDetailHostContextUser{
		ID:          record.ID.String(),
		Username:    record.Username,
		DisplayName: record.DisplayName,
		AvatarURL:   record.AvatarURL,
		FinalScore:  record.FinalScore,
		RatingCount: record.RatingCount,
	}
}

func toEventHostScoreSummary(record EventHostScoreSummaryRecord) EventHostScoreSummary {
	return EventHostScoreSummary(record)
}

func toEventDetailRating(record *EventDetailRatingRecord) *EventDetailRating {
	if record == nil {
		return nil
	}

	return &EventDetailRating{
		ID:        record.ID.String(),
		Rating:    record.Rating,
		Message:   record.Message,
		CreatedAt: record.CreatedAt,
		UpdatedAt: record.UpdatedAt,
	}
}

func toDomainRoutePoints(points []RoutePointInput) []domain.GeoPoint {
	domainPoints := make([]domain.GeoPoint, len(points))
	for i, point := range points {
		domainPoints[i] = domain.GeoPoint{
			Lat: *point.Lat,
			Lon: *point.Lon,
		}
	}
	return domainPoints
}
