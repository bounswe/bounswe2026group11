package invitation

func toCreateInvitationsResult(record *CreateInvitationsRecord) *CreateInvitationsResult {
	if record == nil {
		return &CreateInvitationsResult{}
	}

	successful := make([]CreatedInvitation, len(record.SuccessfulInvitations))
	for i, item := range record.SuccessfulInvitations {
		successful[i] = CreatedInvitation{
			InvitationID:  item.Invitation.ID.String(),
			EventID:       item.Invitation.EventID.String(),
			InvitedUserID: item.Invitation.InvitedUserID.String(),
			Username:      item.Username,
			Status:        item.Invitation.Status.String(),
			CreatedAt:     item.Invitation.CreatedAt,
		}
	}

	failed := make([]InvitationFailure, len(record.Failed))
	for i, item := range record.Failed {
		failed[i] = InvitationFailure(item)
	}

	return &CreateInvitationsResult{
		SuccessCount:          len(successful),
		InvalidUsernameCount:  len(record.InvalidUsernames),
		FailedCount:           len(failed),
		SuccessfulInvitations: successful,
		InvalidUsernames:      record.InvalidUsernames,
		Failed:                failed,
	}
}

func toReceivedInvitation(record ReceivedInvitationRecord) ReceivedInvitation {
	return ReceivedInvitation{
		InvitationID: record.InvitationID.String(),
		Status:       record.Status.String(),
		Message:      record.Message,
		ExpiresAt:    record.ExpiresAt,
		CreatedAt:    record.CreatedAt,
		UpdatedAt:    record.UpdatedAt,
		Event: ReceivedInvitationEvent{
			ID:                       record.Event.ID.String(),
			Title:                    record.Event.Title,
			ImageURL:                 record.Event.ImageURL,
			StartTime:                record.Event.StartTime,
			EndTime:                  record.Event.EndTime,
			Status:                   string(record.Event.Status),
			PrivacyLevel:             string(record.Event.PrivacyLevel),
			ApprovedParticipantCount: record.Event.ApprovedParticipantCount,
		},
		Host: ReceivedInvitationUser{
			ID:          record.Host.ID.String(),
			Username:    record.Host.Username,
			DisplayName: record.Host.DisplayName,
			AvatarURL:   record.Host.AvatarURL,
		},
	}
}
