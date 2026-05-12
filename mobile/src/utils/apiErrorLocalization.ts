import i18n from '@/i18n';

const API_ERROR_MESSAGE_KEYS: Record<string, string> = {
  'An unexpected error occurred.': 'apiErrors.unexpected',
  'An internal error occurred.': 'apiErrors.internal',
  'The request body contains invalid fields. See error.details for field-specific messages.':
    'apiErrors.validation',
  'Authorization header with Bearer token is required.': 'apiErrors.missingToken',
  'The access token is invalid or expired.': 'apiErrors.invalidToken',
  'Admin access is required for this endpoint.': 'apiErrors.adminAccessRequired',

  'Too many requests. Try again later.': 'apiErrors.tooManyRequests',
  'Invalid username or password.': 'apiErrors.invalidCredentials',
  'The refresh token is invalid or expired.': 'apiErrors.invalidRefreshToken',
  'The refresh token has already been used.': 'apiErrors.refreshTokenReused',
  'The OTP is invalid or has expired.': 'apiErrors.invalidOtp',
  'The OTP can no longer be used. Request a new code.': 'apiErrors.otpAttemptsExceeded',
  'The password reset session is invalid or has expired.':
    'apiErrors.invalidPasswordResetToken',
  'The email is already in use.': 'apiErrors.emailAlreadyExists',
  'The username is already in use.': 'apiErrors.usernameAlreadyExists',
  'The phone number is already in use.': 'apiErrors.phoneNumberAlreadyExists',
  'Current password is incorrect.': 'apiErrors.passwordMismatch',

  'The requested user does not exist.': 'apiErrors.userNotFound',
  'One or more requested users do not exist.': 'apiErrors.oneOrMoreUsersNotFound',
  'Your account was not found.': 'apiErrors.profileAccountNotFound',
  'The requested event does not exist.': 'apiErrors.eventNotFound',
  'The host already has an event with this title.': 'apiErrors.eventTitleAlreadyExists',
  'Only the event host can edit this event.': 'apiErrors.eventHostEditOnly',
  'Only ACTIVE events that have not started can be edited.': 'apiErrors.eventNotEditable',
  'Capacity cannot be lower than the approved plus pending participant count.':
    'apiErrors.capacityBelowParticipantCount',
  'The event host cannot join their own event.': 'apiErrors.hostCannotJoin',
  'The event host cannot request to join their own event.': 'apiErrors.hostCannotRequestJoin',
  'The event host cannot reconfirm as a participant.': 'apiErrors.hostCannotReconfirm',
  'The event host cannot leave their own event.': 'apiErrors.hostCannotLeave',
  'Only PUBLIC events can be joined directly.': 'apiErrors.eventJoinPublicOnly',
  'Only PROTECTED events accept join requests.': 'apiErrors.eventJoinProtectedOnly',
  'This event has reached its maximum capacity.': 'apiErrors.capacityExceeded',
  'This event is no longer accepting participants.': 'apiErrors.eventNotJoinable',
  'This event is no longer accepting participant reconfirmations.':
    'apiErrors.eventNotAcceptingReconfirmations',
  'This event can no longer be left.': 'apiErrors.eventNotLeaveable',
  'Only approved or pending participants can leave this event.':
    'apiErrors.eventLeaveNotAllowed',
  'Only PENDING participations can be reconfirmed.':
    'apiErrors.participationReconfirmPendingOnly',
  'Only the event host can cancel this event.': 'apiErrors.eventCancelHostOnly',
  'Only ACTIVE events can be canceled.': 'apiErrors.eventCancelActiveOnly',
  'Only the event host can complete this event.': 'apiErrors.eventCompleteHostOnly',
  'The event cannot be completed because it is already CANCELED or COMPLETED.':
    'apiErrors.eventCompleteInvalidState',
  'Only the event host can access this management resource.':
    'apiErrors.eventHostManagementAccessOnly',

  'You are already participating in this event.': 'apiErrors.alreadyParticipating',
  'The user already has an active participation for this event.':
    'apiErrors.alreadyActiveParticipation',
  'You cannot rejoin an event after leaving once it has started.':
    'apiErrors.cannotRejoinAfterStarted',
  'You cannot request to join again after leaving once the event has started.':
    'apiErrors.cannotRequestAgainAfterStarted',
  'The requester is already participating in this event.':
    'apiErrors.requesterAlreadyParticipating',
  'The requester cannot rejoin this event after leaving once it has started.':
    'apiErrors.requesterCannotRejoinAfterStarted',
  'You cannot join this event after leaving once it has started.':
    'apiErrors.cannotJoinAfterStarted',

  'Only the event host can moderate join requests.':
    'apiErrors.joinRequestModerationHostOnly',
  'The requested join request does not exist.': 'apiErrors.joinRequestNotFound',
  'You do not have a join request for this event.':
    'apiErrors.joinRequestForEventNotFound',
  'Only PENDING join requests can be approved.':
    'apiErrors.joinRequestApprovePendingOnly',
  'Only PENDING join requests can be rejected.':
    'apiErrors.joinRequestRejectPendingOnly',
  'Only PENDING join requests can be canceled.':
    'apiErrors.joinRequestCancelPendingOnly',
  'You already have a pending join request for this event.': 'apiErrors.alreadyRequested',
  'You must wait 3 days after rejection before requesting to join this event again.':
    'apiErrors.joinRequestCooldown',

  'Only the event host can manage invitations.': 'apiErrors.invitationManageHostOnly',
  'Only PRIVATE events support host invitations.': 'apiErrors.invitationPrivateOnly',
  'Invitations are not available.': 'apiErrors.invitationNotAvailable',
  'The requested invitation does not exist.': 'apiErrors.invitationNotFound',
  'The requested pending invitation does not exist.': 'apiErrors.pendingInvitationNotFound',
  'Only PENDING invitations can be accepted.': 'apiErrors.invitationAcceptPendingOnly',
  'Only PENDING invitations can be declined.': 'apiErrors.invitationDeclinePendingOnly',
  'Only PENDING invitations can be canceled.': 'apiErrors.invitationCancelPendingOnly',

  'Users can save at most 3 favorite locations.': 'apiErrors.favoriteLocationLimit',
  'The requested favorite location does not exist.': 'apiErrors.favoriteLocationNotFound',

  'The requested equipment item does not exist.': 'apiErrors.profileEquipmentNotFound',
  'The requested showcase image does not exist.': 'apiErrors.profileShowcaseImageNotFound',
  'You can only modify your own profile resources.': 'apiErrors.profileMutationOwnOnly',

  'The confirm token is invalid or expired.': 'apiErrors.imageConfirmTokenInvalid',
  'Upload is incomplete. Upload both ORIGINAL and SMALL images before confirming.':
    'apiErrors.imageUploadIncomplete',
  'A newer avatar image upload has already been confirmed.':
    'apiErrors.imageAvatarVersionConflict',
  'A newer event image upload has already been confirmed.':
    'apiErrors.imageEventVersionConflict',
  'Only the event host can upload the event image.': 'apiErrors.imageEventHostOnly',
  'Join request image uploads are not available.':
    'apiErrors.imageJoinRequestUnavailable',

  'The requested ticket does not exist.': 'apiErrors.ticketNotFound',
  'The linked participation does not exist.': 'apiErrors.ticketLinkedParticipationNotFound',
  'The ticket can no longer be used.': 'apiErrors.ticketScanRejected',
  'Only the event host can scan tickets for this event.': 'apiErrors.ticketScanHostOnly',
  'This ticket operation is supported only by the mobile client.':
    'apiErrors.ticketMobileOnly',
  'Only ACTIVE tickets can issue QR tokens.': 'apiErrors.ticketQrActiveOnly',
  'The linked participation is not approved.': 'apiErrors.ticketParticipationNotApproved',
  'The event is not accepting ticket access.': 'apiErrors.ticketEventNotAcceptingAccess',
  'The ticket has expired.': 'apiErrors.ticketExpired',
  'You must be near the event location to show this ticket QR.':
    'apiErrors.ticketProximityRequired',

  'Comments are available only for PUBLIC and PROTECTED events.':
    'apiErrors.commentsPublicProtectedOnly',
  'Reviews are available only for PUBLIC and PROTECTED events.':
    'apiErrors.reviewsPublicProtectedOnly',
  'The requested discussion comment does not exist.': 'apiErrors.discussionCommentNotFound',
  'Comments are closed for canceled events.': 'apiErrors.commentsClosedCanceled',
  'Only review comments are allowed after the event is completed.':
    'apiErrors.commentsOnlyReviewAfterCompleted',
  'Only participants can comment while the event is in progress.':
    'apiErrors.commentsParticipantsInProgressOnly',
  'Review image uploads are not available.': 'apiErrors.reviewImagesUnavailable',
  'Review images are not allowed for canceled events.':
    'apiErrors.reviewImagesNotAllowedCanceled',
  'Review images are allowed only after the event is completed.':
    'apiErrors.reviewImagesCompletedOnly',
  'Only participants can upload review images.': 'apiErrors.reviewImagesParticipantsOnly',
  'Reviews are not allowed for canceled events.': 'apiErrors.reviewsNotAllowedCanceled',
  'Review comments are allowed only after the event is completed.':
    'apiErrors.reviewCommentsAfterCompleted',
  'Only participants can review this event.': 'apiErrors.reviewParticipantsOnly',
  'The event host cannot rate their own event.': 'apiErrors.hostCannotRateOwnEvent',
  'The event host cannot rate themselves.': 'apiErrors.hostCannotRateThemselves',
  'Only the event host can rate participants for this event.': 'apiErrors.ratingHostOnly',
  'Ratings are not allowed for canceled events.': 'apiErrors.ratingCanceledNotAllowed',
  'Only approved participants can be rated for this event.':
    'apiErrors.ratingApprovedParticipantsOnly',
  'Ratings can only be modified within 7 days after the event ends.':
    'apiErrors.ratingWindowClosed',
  'The requested event rating does not exist.': 'apiErrors.eventRatingNotFound',
  'The requested participant rating does not exist.': 'apiErrors.participantRatingNotFound',

  'Report images are allowed only while an event is in progress or completed.':
    'apiErrors.eventReportImagesInProgressOrCompletedOnly',
  'Report image uploads are not available.': 'apiErrors.eventReportImagesUnavailable',
  'The requested event report does not exist.': 'apiErrors.eventReportNotFound',
  'The requested notification does not exist.': 'apiErrors.notificationNotFound',
};

export function localizeApiErrorMessage(message: string): string {
  const key = API_ERROR_MESSAGE_KEYS[message.trim()];
  return key ? i18n.t(key, { defaultValue: message }) : message;
}

export function localizeApiErrorDetails(
  details?: Record<string, string>,
): Record<string, string> | undefined {
  if (!details) return undefined;

  return Object.fromEntries(
    Object.entries(details).map(([field, message]) => [
      field,
      localizeApiErrorMessage(message),
    ]),
  );
}
