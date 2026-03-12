async function search() {
  const query = document.getElementById("query").value.trim();
  const container = document.getElementById("results");

  if (!query) {
    container.innerHTML = "<p>Please enter a location.</p>";
    return;
  }

  container.innerHTML = "<p>Searching...</p>";

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=8`,
      { headers: { "Accept-Language": "en" } }
    );
    const data = await res.json();

    if (data.length === 0) {
      container.innerHTML = "<p>No results found.</p>";
      return;
    }

    container.innerHTML = data.map(place => `
      <div class="location-card">
        <h3>${place.display_name.split(",")[0]}</h3>
        <p>📍 ${place.display_name}</p>
        <p>🌐 Lat: ${parseFloat(place.lat).toFixed(4)}, Lon: ${parseFloat(place.lon).toFixed(4)}</p>
        <p>🏷️ Type: ${place.type}</p>
      </div>
    `).join("");
  } catch (err) {
    container.innerHTML = `<p style="color:red">Error: ${err.message}</p>`;
  }
}

// Allow search on Enter key
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("query").addEventListener("keydown", e => {
    if (e.key === "Enter") search();
  });
});