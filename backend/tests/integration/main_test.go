//go:build integration

package integration

import (
	"os"
	"testing"

	"github.com/bounswe/bounswe2026group11/backend/tests/integration/common"
)

func TestMain(m *testing.M) {
	os.Exit(common.Run(m))
}
