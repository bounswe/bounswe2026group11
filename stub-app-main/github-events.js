var statusEl = document.getElementById("status");
var eventListEl = document.getElementById("event-list");
var reloadButton = document.getElementById("reload-button");
var apiUrl = "https://api.github.com/events";

function setStatus(message, isError) {
  statusEl.textContent = message;
  statusEl.className = isError ? "status error" : "status";
}

function renderEvent(eventItem) {
  eventListEl.innerHTML = "";

  var details = [
    ["Event Type", eventItem.type || "Unknown"],
    [
      "Repository",
      eventItem.repo && eventItem.repo.name ? eventItem.repo.name : "Unknown",
    ],
    [
      "Actor",
      eventItem.actor && eventItem.actor.login ? eventItem.actor.login : "Unknown",
    ],
    ["Created At", eventItem.created_at || "Unknown"],
  ];

  details.forEach(function (detail) {
    var item = document.createElement("div");
    item.className = "event-item";

    var label = document.createElement("strong");
    label.textContent = detail[0];

    var value = document.createElement("span");
    value.textContent = detail[1];

    item.appendChild(label);
    item.appendChild(value);
    eventListEl.appendChild(item);
  });
}

function loadLatestEvent() {
  setStatus("Loading data...");
  reloadButton.disabled = true;

  fetch(apiUrl)
    .then(function (response) {
      if (!response.ok) {
        throw new Error("API request failed with status " + response.status);
      }

      return response.json();
    })
    .then(function (events) {
      if (!Array.isArray(events) || events.length === 0) {
        throw new Error("No events were returned by the API.");
      }

      renderEvent(events[0]);
      setStatus("Loaded the most recent public GitHub event.");
    })
    .catch(function (error) {
      eventListEl.innerHTML = "";
      setStatus(error.message, true);
    })
    .finally(function () {
      reloadButton.disabled = false;
    });
}

reloadButton.addEventListener("click", loadLatestEvent);
loadLatestEvent();
