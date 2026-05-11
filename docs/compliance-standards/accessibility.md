# Accessibility

This document records WCAG 2.1 AA implementation evidence for Social Event Mapper's web and mobile interfaces.

## Keyboard Access and Bypass Blocks

WCAG 2.1 AA expects keyboard users to reach core content without being forced through repeated navigation on every page. The web shell includes a skip link and a focusable main landmark in `frontend/src/components/AppShell.tsx`:

```tsx
<a className="skip-link" href="#main-content">
  Skip to main content
</a>

<nav
  id={PRIMARY_NAV_ID}
  className={`shell-nav ${menuOpen ? 'open' : ''}`}
  aria-label="Primary navigation"
>
  ...
</nav>

<main
  id="main-content"
  tabIndex={-1}
  className={`shell-main ${isAdminPanel ? 'admin-panel-main' : ''} ${
    isDiscoverRoute && viewMode === 'map' ? 'discover-map-main' : ''
  }`}
>
  <Outlet />
</main>
```

The matching CSS in `frontend/src/styles/global.css` keeps the link visually hidden until focused and provides a clear global keyboard focus indicator:

```css
.skip-link {
  position: fixed;
  top: 12px;
  left: 12px;
  z-index: 1000;
  padding: 10px 14px;
  color: #ffffff;
  background: #111827;
  border-radius: 8px;
  font-weight: 700;
  text-decoration: none;
  transform: translateY(-160%);
  transition: transform 0.15s ease;
}

.skip-link:focus-visible {
  transform: translateY(0);
}

:focus-visible {
  outline: 3px solid #2563eb;
  outline-offset: 3px;
}
```

## Reduced Motion

The global stylesheet honors `prefers-reduced-motion` for users with motion sensitivity:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
  }
}
```

## Semantic Navigation Controls

Auth pages use React Router `Link`, preserving navigation behavior while exposing proper link semantics to keyboard and screen-reader users.

Example from `frontend/src/views/auth/LoginView.tsx`:

```tsx
<Link to="/forgot-password" className="link" style={{ fontSize: '0.875rem' }}>
  Forgot Password?
</Link>

<Link to="/register" className="link">
  Sign Up
</Link>
```

The same semantic pattern is used in:

- `frontend/src/views/auth/RegisterView.tsx`
- `frontend/src/views/auth/ForgotPasswordView.tsx`

## Error Announcement and Form Relationships

Auth API errors are announced through live regions, and field errors are linked to their inputs. This supports WCAG criteria around error identification, labels, and robust assistive technology parsing.

Example from `frontend/src/views/auth/LoginView.tsx`:

```tsx
{vm.apiError && (
  <div className="error-banner" role="alert" aria-live="assertive">
    {vm.apiError}
  </div>
)}

<input
  id="username"
  className={`field-input ${vm.errors.username ? 'has-error' : ''}`}
  type="text"
  value={vm.formData.username}
  onChange={(e) => vm.updateField('username', e.target.value)}
  autoComplete="username"
  disabled={vm.isLoading}
  aria-invalid={!!vm.errors.username}
  aria-describedby={vm.errors.username ? 'username-error' : undefined}
/>

{vm.errors.username && (
  <p className="field-error" id="username-error" role="alert">
    {vm.errors.username}
  </p>
)}
```

The same pattern is applied to email, password, OTP, birth date, phone number, and password confirmation fields in the register and forgot-password flows.

## Header and Menu State

Controls that open menus or switch view modes expose state explicitly in `frontend/src/components/AppShell.tsx`:

```tsx
<button
  type="button"
  className="shell-hamburger"
  onClick={() => setMenuOpen((prev) => !prev)}
  aria-label="Toggle navigation"
  aria-controls={PRIMARY_NAV_ID}
  aria-expanded={menuOpen}
>
  ...
</button>
```

```tsx
<button
  type="button"
  className="shell-user-btn"
  onClick={() => setUserMenuOpen((prev) => !prev)}
  aria-haspopup="menu"
  aria-expanded={userMenuOpen}
  aria-label="Open user menu"
>
  ...
</button>

{userMenuOpen && (
  <div className="shell-dropdown" role="menu">
    <NavLink to="/profile" className="shell-dropdown-item" role="menuitem">
      Profile
    </NavLink>
  </div>
)}
```

The discover view toggle uses `aria-pressed` and explicit labels:

```tsx
<button
  type="button"
  className={`shell-view-toggle-btn ${viewMode === 'map' ? 'active' : ''}`}
  onClick={() => setViewMode('map')}
  aria-pressed={viewMode === 'map'}
  aria-label="Show events on a map"
  title="Map view"
>
  ...
</button>
```

## Mobile Accessibility Parity

The mobile app uses React Native accessibility props for screen-reader support.

Auth inputs and actions expose labels and state in `mobile/src/views/auth/LoginView.tsx`:

```tsx
<TextInput
  style={[styles.input, vm.errors.username && styles.inputError]}
  placeholder="maplover"
  value={vm.formData.username}
  onChangeText={(v) => vm.updateField('username', v)}
  autoCapitalize="none"
  autoComplete="username"
  editable={!vm.isLoading}
  accessibilityLabel="Username"
  accessibilityState={{ disabled: vm.isLoading }}
/>

<TouchableOpacity
  style={[styles.button, vm.isLoading && styles.buttonDisabled]}
  onPress={handleSubmit}
  disabled={vm.isLoading}
  accessibilityRole="button"
  accessibilityLabel={vm.isLoading ? 'Signing in' : 'Sign in'}
  accessibilityState={{ disabled: vm.isLoading, busy: vm.isLoading }}
>
  ...
</TouchableOpacity>
```

Choice controls expose selected state in `mobile/src/views/auth/RegisterView.tsx`:

```tsx
<TouchableOpacity
  key={opt.value}
  style={[
    styles.genderOption,
    vm.formData.gender === opt.value && styles.genderOptionSelected,
  ]}
  onPress={() => vm.updateField('gender', opt.value)}
  disabled={vm.isLoading}
  accessibilityRole="button"
  accessibilityLabel={`Gender ${opt.label}`}
  accessibilityState={{
    selected: vm.formData.gender === opt.value,
    disabled: vm.isLoading,
  }}
>
  <Text>{opt.label}</Text>
</TouchableOpacity>
```

Event cards provide a meaningful combined label in `mobile/src/components/events/EventCard.tsx`:

```tsx
const accessibleSummary =
  `${event.title}. ${categoryPresentation.label}. ${formatPrivacyLabel(event.privacy_level)} event. ` +
  `${formatEventDateLabel(event.start_time, event.end_time)}. ` +
  `${formatEventLocation(event.location_address)}. ${participantLabel} participants. ${hostRatingLabel}.`;

return (
  <TouchableOpacity
    activeOpacity={0.92}
    onPress={() => onPress?.(event.id)}
    style={styles.card}
    accessibilityRole="button"
    accessibilityLabel={accessibleSummary}
  >
    ...
  </TouchableOpacity>
);
```

The bottom-tab create action has an explicit accessible name in `mobile/src/components/common/BottomTabBar.tsx`:

```tsx
<TouchableOpacity
  activeOpacity={0.85}
  style={styles.primaryWrapper}
  onPress={() => router.push('/event/create' as Href)}
  accessibilityRole="button"
  accessibilityLabel="Create event"
>
  ...
</TouchableOpacity>
```

Map markers and callouts are named in `mobile/src/components/home/EventMapView.tsx`:

```tsx
<Marker
  identifier={event.id}
  coordinate={coordinate}
  onPress={() => onSelect(event.id)}
  accessibilityLabel={`${event.title} map marker`}
  accessibilityRole="button"
>
  ...
  <Callout
    tooltip
    accessibilityLabel={`Open ${event.title}`}
    accessibilityRole="button"
    onPress={() => onOpen(event.id)}
  >
    ...
  </Callout>
</Marker>
```

