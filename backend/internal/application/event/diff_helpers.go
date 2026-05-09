package event

import "reflect"

func buildEventDetailDiff(from, to *EventHistorySnapshotRecord) *EventDetailDiff {
	if from == nil || to == nil || from.VersionNo >= to.VersionNo {
		return nil
	}

	comparisons := []struct {
		field string
		old   any
		new   any
	}{
		{"title", from.Snapshot.Title, to.Snapshot.Title},
		{"description", from.Snapshot.Description, to.Snapshot.Description},
		{"image_url", from.Snapshot.ImageURL, to.Snapshot.ImageURL},
		{"privacy_level", from.Snapshot.PrivacyLevel, to.Snapshot.PrivacyLevel},
		{"status", from.Snapshot.Status, to.Snapshot.Status},
		{"start_time", from.Snapshot.StartTime, to.Snapshot.StartTime},
		{"end_time", from.Snapshot.EndTime, to.Snapshot.EndTime},
		{"capacity", from.Snapshot.Capacity, to.Snapshot.Capacity},
		{"minimum_age", from.Snapshot.MinimumAge, to.Snapshot.MinimumAge},
		{"preferred_gender", from.Snapshot.PreferredGender, to.Snapshot.PreferredGender},
		{"child_friendly", from.Snapshot.ChildFriendly, to.Snapshot.ChildFriendly},
		{"family_oriented", from.Snapshot.FamilyOriented, to.Snapshot.FamilyOriented},
		{"category", from.Snapshot.Category, to.Snapshot.Category},
		{"location", from.Snapshot.Location, to.Snapshot.Location},
		{"tags", from.Snapshot.Tags, to.Snapshot.Tags},
		{"constraints", from.Snapshot.Constraints, to.Snapshot.Constraints},
	}

	changes := make([]EventDetailDiffChange, 0)
	changedFields := make([]string, 0)
	for _, comparison := range comparisons {
		if reflect.DeepEqual(comparison.old, comparison.new) {
			continue
		}
		changedFields = append(changedFields, comparison.field)
		changes = append(changes, EventDetailDiffChange{
			Field:    comparison.field,
			OldValue: comparison.old,
			NewValue: comparison.new,
		})
	}
	if len(changes) == 0 {
		return nil
	}

	return &EventDetailDiff{
		FromVersionNo: from.VersionNo,
		ToVersionNo:   to.VersionNo,
		ChangedFields: changedFields,
		Changes:       changes,
	}
}
