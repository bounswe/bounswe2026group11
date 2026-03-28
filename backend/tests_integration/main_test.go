//go:build integration

package tests_integration

import (
	"os"
	"testing"

	"github.com/bounswe/bounswe2026group11/backend/tests_integration/common"
)

func TestMain(m *testing.M) {
	os.Exit(common.Run(m))
}
