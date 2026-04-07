import { useAuth } from '@/contexts/AuthContext';
import { useFavoriteLocationsViewModel } from '@/viewmodels/favorites/useFavoriteLocationsViewModel';
import '@/styles/favorites.css';

export default function FavoriteLocationsTab() {
  const { token } = useAuth();
  const vm = useFavoriteLocationsViewModel(token);

  return (
    <div className="fav-loc">
      {/* Header with count + add button */}
      <div className="fav-loc-header">
        <span className="fav-loc-count">
          {vm.locations.length} / {vm.maxLocations} locations
        </span>
        <button
          type="button"
          className="fav-loc-add-btn"
          onClick={vm.openAddModal}
          disabled={!vm.canAddMore}
        >
          + Add Location
        </button>
      </div>

      {/* Limit reached info */}
      {!vm.canAddMore && !vm.isLoading && (
        <div className="fav-loc-limit-banner">
          You have reached the maximum of {vm.maxLocations} favorite locations. Remove one to add a new location.
        </div>
      )}

      {/* Loading */}
      {vm.isLoading && (
        <div className="me-loading">
          <span className="spinner" />
          <p>Loading locations...</p>
        </div>
      )}

      {/* Error */}
      {vm.error && (
        <div className="me-error">
          <p>{vm.error}</p>
          <button type="button" className="me-retry-btn" onClick={vm.retry}>
            Retry
          </button>
        </div>
      )}

      {/* Empty state */}
      {!vm.isLoading && !vm.error && vm.locations.length === 0 && (
        <div className="me-empty">
          <p>No favorite locations yet. Add up to {vm.maxLocations} locations for quick access!</p>
        </div>
      )}

      {/* Location cards */}
      {!vm.isLoading && !vm.error && vm.locations.length > 0 && (
        <div className="fav-loc-list">
          {vm.locations.map((loc) => (
            <div key={loc.id} className="fav-loc-card">
              <div className="fav-loc-card-icon">📍</div>
              <div className="fav-loc-card-info">
                <h3 className="fav-loc-card-name">{loc.name}</h3>
                <p className="fav-loc-card-address">{loc.address}</p>
              </div>
              <button
                type="button"
                className="fav-loc-card-remove"
                onClick={() => vm.handleRemove(loc.id)}
                disabled={vm.removingId === loc.id}
                aria-label={`Remove ${loc.name}`}
              >
                {vm.removingId === loc.id ? <span className="spinner" /> : '×'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add location modal */}
      {vm.showAddModal && (
        <div className="fav-loc-modal-overlay" onClick={vm.closeAddModal}>
          <div className="fav-loc-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="fav-loc-modal-title">Add Favorite Location</h2>

            {vm.addError && (
              <div className="fav-loc-modal-error">{vm.addError}</div>
            )}

            <div className="fav-loc-modal-field">
              <label className="fav-loc-modal-label" htmlFor="loc-name">Name</label>
              <input
                id="loc-name"
                type="text"
                className="field-input"
                placeholder="e.g. Home, Work, Gym"
                maxLength={64}
                value={vm.addName}
                onChange={(e) => vm.setAddName(e.target.value)}
                disabled={vm.isSubmitting}
              />
            </div>

            <div className="fav-loc-modal-field">
              <label className="fav-loc-modal-label" htmlFor="loc-search">Search Address</label>
              <div className="fav-loc-search-wrapper">
                <input
                  id="loc-search"
                  type="text"
                  className="field-input"
                  placeholder="Search for an address..."
                  value={vm.addQuery}
                  onChange={(e) => vm.handleSearchChange(e.target.value)}
                  disabled={vm.isSubmitting}
                />
                {vm.isSearching && (
                  <span className="fav-loc-searching">Searching...</span>
                )}
                {vm.addSuggestions.length > 0 && (
                  <ul className="fav-loc-suggestions">
                    {vm.addSuggestions.map((s, i) => (
                      <li key={i}>
                        <button
                          type="button"
                          className="fav-loc-suggestion-item"
                          onClick={() => vm.selectSuggestion(s)}
                        >
                          {s.display_name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {vm.selectedSuggestion && (
              <div className="fav-loc-selected">
                📍 {vm.selectedSuggestion.display_name}
              </div>
            )}

            <div className="fav-loc-modal-actions">
              <button
                type="button"
                className="fav-loc-modal-cancel"
                onClick={vm.closeAddModal}
                disabled={vm.isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="fav-loc-modal-save"
                onClick={vm.handleAdd}
                disabled={vm.isSubmitting || !vm.addName.trim() || !vm.selectedSuggestion}
              >
                {vm.isSubmitting ? <span className="spinner" /> : 'Save Location'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
