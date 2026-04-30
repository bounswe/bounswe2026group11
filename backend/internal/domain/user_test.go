package domain

import "testing"

func TestParseUserRole(t *testing.T) {
	tests := []struct {
		name string
		raw  string
		want UserRole
		ok   bool
	}{
		{name: "user", raw: "USER", want: UserRoleUser, ok: true},
		{name: "admin", raw: "ADMIN", want: UserRoleAdmin, ok: true},
		{name: "trims and uppercases", raw: " admin ", want: UserRoleAdmin, ok: true},
		{name: "rejects unknown", raw: "OWNER", ok: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, ok := ParseUserRole(tt.raw)
			if ok != tt.ok {
				t.Fatalf("expected ok=%v, got %v", tt.ok, ok)
			}
			if got != tt.want {
				t.Fatalf("expected role %q, got %q", tt.want, got)
			}
		})
	}
}
