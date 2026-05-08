package notification

import (
	"context"
	"testing"
	"testing/fstest"

	"github.com/bounswe/bounswe2026group11/backend/internal/i18n"
	"github.com/google/uuid"
)

// TestSendNotificationTranslatesPerRecipient asserts that two recipients
// with different stored locales receive notification rows with text
// translated to their respective locales when the call site supplies
// TitleKey/BodyKey instead of literal text.
func TestSendNotificationTranslatesPerRecipient(t *testing.T) {
	fsys := fstest.MapFS{
		"l/en.json": &fstest.MapFile{Data: []byte(`{
"notification.event.cancelled.title":"Event cancelled",
"notification.event.cancelled.body":"The event %q has been cancelled."
}`)},
		"l/tr.json": &fstest.MapFile{Data: []byte(`{
"notification.event.cancelled.title":"Etkinlik iptal edildi",
"notification.event.cancelled.body":"%q etkinliği iptal edildi."
}`)},
	}
	cat, err := i18n.LoadFromFS(fsys, "l")
	if err != nil {
		t.Fatalf("load: %v", err)
	}

	enUser := uuid.New()
	trUser := uuid.New()
	repo := newFakeNotificationRepo()
	repo.locales = map[uuid.UUID]string{
		enUser: "en",
		trUser: "tr",
	}

	svc := NewService(repo, &fakePushSender{}, fakeUnitOfWork{})
	svc.SetTranslator(cat)

	_, err = svc.SendNotificationToUsers(context.Background(), SendNotificationInput{
		UserIDs:        []uuid.UUID{enUser, trUser},
		Title:          "Event cancelled",
		TitleKey:       "notification.event.cancelled.title",
		Body:           "The event \"Yoga\" has been cancelled.",
		BodyKey:        "notification.event.cancelled.body",
		BodyArgs:       []any{"Yoga"},
		IdempotencyKey: "EVENT_CANCELED:test",
	})
	if err != nil {
		t.Fatalf("SendNotificationToUsers: %v", err)
	}

	got := map[uuid.UUID]string{}
	gotBody := map[uuid.UUID]string{}
	for _, n := range repo.notifications {
		got[n.ReceiverUserID] = n.Title
		gotBody[n.ReceiverUserID] = n.Body
	}

	if got[enUser] != "Event cancelled" {
		t.Errorf("en title = %q, want %q", got[enUser], "Event cancelled")
	}
	if got[trUser] != "Etkinlik iptal edildi" {
		t.Errorf("tr title = %q, want %q", got[trUser], "Etkinlik iptal edildi")
	}
	if gotBody[enUser] != "The event \"Yoga\" has been cancelled." {
		t.Errorf("en body = %q", gotBody[enUser])
	}
	if gotBody[trUser] != "\"Yoga\" etkinliği iptal edildi." {
		t.Errorf("tr body = %q", gotBody[trUser])
	}
}

// TestSendNotificationFallsBackToLiteralWhenNoTranslator confirms that a
// service without a translator persists the literal Title/Body even when
// the call site supplies keys (back-compat path).
func TestSendNotificationFallsBackToLiteralWhenNoTranslator(t *testing.T) {
	user := uuid.New()
	repo := newFakeNotificationRepo()
	svc := NewService(repo, &fakePushSender{}, fakeUnitOfWork{})
	// no SetTranslator call

	_, err := svc.SendNotificationToUsers(context.Background(), SendNotificationInput{
		UserIDs:        []uuid.UUID{user},
		Title:          "literal title",
		TitleKey:       "notification.event.cancelled.title",
		Body:           "literal body",
		BodyKey:        "notification.event.cancelled.body",
		IdempotencyKey: "k",
	})
	if err != nil {
		t.Fatalf("SendNotificationToUsers: %v", err)
	}
	for _, n := range repo.notifications {
		if n.Title != "literal title" || n.Body != "literal body" {
			t.Fatalf("got title=%q body=%q, want literal fallback", n.Title, n.Body)
		}
	}
}
