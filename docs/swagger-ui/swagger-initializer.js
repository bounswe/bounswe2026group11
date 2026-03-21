async function loadSpecs() {
  const response = await fetch("./openapi/specs.json", {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to load OpenAPI manifest: ${response.status}`);
  }

  const specs = await response.json();
  if (!Array.isArray(specs) || specs.length === 0) {
    throw new Error("OpenAPI manifest is empty.");
  }

  return specs;
}

function getPrimarySpec(specs) {
  const requestedSpec = new URLSearchParams(window.location.search).get("spec");
  return specs.find((spec) => spec.name === requestedSpec) ?? specs[0];
}

function getSpecDisplayName(spec) {
  return spec.displayName ?? spec.name;
}

function updateDocumentTitle(spec) {
  document.title = `Social Event Mapper Docs · ${getSpecDisplayName(spec)}`;
}

function renderError(error) {
  const container = document.getElementById("swagger-ui");
  const section = document.createElement("section");
  const heading = document.createElement("h1");
  const message = document.createElement("p");

  section.className = "docs-error";
  heading.textContent = "API docs could not be loaded";
  message.textContent = error.message;

  section.appendChild(heading);
  section.appendChild(message);
  container.replaceChildren(section);
}

window.onload = async function () {
  try {
    const specs = await loadSpecs();
    const primarySpec = getPrimarySpec(specs);
    updateDocumentTitle(primarySpec);

    window.ui = SwaggerUIBundle({
      dom_id: "#swagger-ui",
      customSiteTitle: `Social Event Mapper Docs · ${getSpecDisplayName(primarySpec)}`,
      deepLinking: true,
      displayRequestDuration: true,
      displayOperationId: true,
      docExpansion: "list",
      defaultModelExpandDepth: 3,
      defaultModelsExpandDepth: 1,
      filter: true,
      persistAuthorization: true,
      showCommonExtensions: true,
      showExtensions: true,
      syntaxHighlight: {
        activated: true,
        theme: "nord",
      },
      tagsSorter: "alpha",
      operationsSorter: "alpha",
      tryItOutEnabled: true,
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
      layout: "StandaloneLayout",
      urls: specs.map((spec) => ({
        url: spec.url,
        name: getSpecDisplayName(spec),
      })),
      "urls.primaryName": getSpecDisplayName(primarySpec),
    });
  } catch (error) {
    renderError(error);
  }
};
