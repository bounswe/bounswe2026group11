package notification

import (
	"context"
	"sync"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

const realtimeSubscriptionBuffer = 16

type brokerSubscription struct {
	id     uuid.UUID
	userID uuid.UUID
	events chan domain.Notification
}

// Broker stores active in-process SSE subscriptions by user id.
type Broker struct {
	mu            sync.Mutex
	subscriptions map[uuid.UUID]map[uuid.UUID]*brokerSubscription
}

var _ RealtimeBroker = (*Broker)(nil)

func NewBroker() *Broker {
	return &Broker{subscriptions: map[uuid.UUID]map[uuid.UUID]*brokerSubscription{}}
}

func (b *Broker) Subscribe(userID uuid.UUID) *Subscription {
	if b == nil {
		return nil
	}

	sub := &brokerSubscription{
		id:     uuid.New(),
		userID: userID,
		events: make(chan domain.Notification, realtimeSubscriptionBuffer),
	}

	b.mu.Lock()
	if b.subscriptions == nil {
		b.subscriptions = map[uuid.UUID]map[uuid.UUID]*brokerSubscription{}
	}
	if b.subscriptions[userID] == nil {
		b.subscriptions[userID] = map[uuid.UUID]*brokerSubscription{}
	}
	b.subscriptions[userID][sub.id] = sub
	b.mu.Unlock()

	return &Subscription{
		ID:     sub.id,
		UserID: userID,
		Events: sub.events,
		Cancel: func() {
			b.unsubscribe(userID, sub.id)
		},
	}
}

func (b *Broker) Publish(_ context.Context, userID uuid.UUID, notification domain.Notification) int {
	if b == nil {
		return 0
	}

	var stale []*brokerSubscription
	delivered := 0

	b.mu.Lock()
	for id, sub := range b.subscriptions[userID] {
		select {
		case sub.events <- notification:
			delivered++
		default:
			delete(b.subscriptions[userID], id)
			stale = append(stale, sub)
		}
	}
	if len(b.subscriptions[userID]) == 0 {
		delete(b.subscriptions, userID)
	}
	b.mu.Unlock()

	for _, sub := range stale {
		close(sub.events)
	}

	return delivered
}

func (b *Broker) unsubscribe(userID, subscriptionID uuid.UUID) {
	b.mu.Lock()
	sub, ok := b.subscriptions[userID][subscriptionID]
	if ok {
		delete(b.subscriptions[userID], subscriptionID)
		if len(b.subscriptions[userID]) == 0 {
			delete(b.subscriptions, userID)
		}
	}
	b.mu.Unlock()

	if ok {
		close(sub.events)
	}
}
