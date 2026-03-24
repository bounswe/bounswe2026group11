'use strict';

/**
 * React 19 expects this flag so updates scheduled inside `act()` (including from
 * react-test-renderer) are treated as valid. Without it, tests pass but log:
 * "The current testing environment is not configured to support act(...)"
 *
 * @see https://react.dev/reference/react/act#setup
 */
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
