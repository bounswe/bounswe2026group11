#!/usr/bin/env python3
"""
Merge docs/openapi/*.yaml into one Postman Collection v2.1 JSON.

Dependencies: PyYAML (see docs/postman/requirements.txt; use the local venv).

Usage (from repo root):
  docs/postman/generate.sh

Or manually:
  docs/postman/.venv/bin/python docs/postman/generate_from_openapi.py

Output:
  docs/postman/Social-Event-Mapper.postman_collection.json
"""

from __future__ import annotations

import json
import re
import uuid
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parents[2]
OPENAPI_DIR = REPO_ROOT / "docs" / "openapi"
OUTPUT = Path(__file__).resolve().parent / "Social-Event-Mapper.postman_collection.json"

HTTP_METHODS = frozenset(
    {"get", "put", "post", "patch", "delete", "options", "head", "trace"}
)


def openapi_files() -> list[Path]:
    return sorted(OPENAPI_DIR.glob("*.yaml"))


def folder_title(stem: str) -> str:
    mapping = {
        "auth": "Auth",
        "admin": "Admin",
        "category": "Categories",
        "event": "Events",
        "favorite_location": "Favorite locations",
        "notification": "Notifications",
        "profile": "Profile",
        "ticket": "Tickets",
    }
    return mapping.get(stem, stem.replace("_", " ").title())


def build_url(api_prefix: str, path_tpl: str, op: dict) -> dict:
    """Postman fills Protocol / Host / Path when these fields are set (not only `raw`)."""
    tpl = path_tpl.strip("/")
    path_params = {
        p["name"]: p for p in (op.get("parameters") or []) if p.get("in") == "path"
    }
    path_segments: list[str] = [api_prefix]
    variables: list[dict] = []
    for seg in tpl.split("/"):
        if not seg:
            continue
        m = re.fullmatch(r"\{([^}]+)\}", seg)
        if m:
            name = m.group(1)
            pv = path_params.get(name, {})
            schema = pv.get("schema") or {}
            ex = schema.get("example", "")
            variables.append(
                {
                    "key": name,
                    "value": "" if ex == "" or ex is None else str(ex),
                    **({"description": pv["description"]} if pv.get("description") else {}),
                }
            )
            path_segments.append(f"{{{{{name}}}}}")
        else:
            path_segments.append(seg)

    path_joined = "/".join(path_segments)
    raw = f"{{{{protocol}}}}://{{{{base_host}}}}/{path_joined}"
    out: dict = {
        "raw": raw,
        "protocol": "{{protocol}}",
        "host": ["{{base_host}}"],
        "path": path_segments,
    }
    if variables:
        out["variable"] = variables
    return out


def json_body_from_operation(op: dict) -> tuple[str | None, str | None]:
    rb = op.get("requestBody")
    if not rb:
        return None, None
    content = rb.get("content") or {}
    app_json = content.get("application/json")
    if not app_json:
        return None, None
    examples = app_json.get("examples")
    if isinstance(examples, dict) and examples:
        first = next(iter(examples.values()))
        val = first.get("value") if isinstance(first, dict) else None
        if val is not None:
            return json.dumps(val, ensure_ascii=False, indent=2), "application/json"
    ex = app_json.get("example")
    if ex is not None:
        return json.dumps(ex, ensure_ascii=False, indent=2), "application/json"
    return "{}", "application/json"


def query_params(op: dict) -> list[dict]:
    out: list[dict] = []
    for p in op.get("parameters") or []:
        if p.get("in") != "query":
            continue
        name = p["name"]
        schema = p.get("schema") or {}
        entry: dict = {
            "key": name,
            "value": _example_for_schema(schema),
            "description": p.get("description") or "",
            "disabled": p.get("required") is not True,
        }
        out.append(entry)
    return out


def header_params(op: dict) -> list[dict]:
    out: list[dict] = []
    for p in op.get("parameters") or []:
        if p.get("in") != "header":
            continue
        out.append(
            {
                "key": p["name"],
                "value": _example_for_schema((p.get("schema") or {})),
                "description": p.get("description") or "",
            }
        )
    return out


def _example_for_schema(schema: dict) -> str:
    if not schema:
        return ""
    if "example" in schema:
        return str(schema["example"])
    if schema.get("type") == "integer":
        return str(schema.get("default", "0"))
    if schema.get("type") == "boolean":
        return "true"
    return ""


def operation_description(op: dict) -> str:
    parts: list[str] = []
    oid = op.get("operationId")
    if oid:
        parts.append(f"operationId: `{oid}`")
    summ = op.get("summary")
    if summ:
        parts.append(summ)
    desc = op.get("description")
    if desc and desc != summ:
        parts.append(desc.strip())
    return "\n\n".join(parts) if parts else ""


def request_name(method: str, path_tpl: str, op: dict) -> str:
    return op.get("summary") or f"{method.upper()} {path_tpl}"


def parse_server_url(doc: dict) -> str:
    servers = doc.get("servers") or [{"url": "/api"}]
    url = servers[0].get("url", "/api").strip("/")
    if url == "api":
        return "api"
    if url.startswith("/"):
        url = url.strip("/")
    return url or "api"


def collect_operations(doc_path: Path, doc: dict) -> list[tuple[str, str, str, dict]]:
    """List of (tag, path_template, method_lower, operation_dict)."""
    out: list[tuple[str, str, str, dict]] = []
    paths = doc.get("paths") or {}
    for path_tpl, path_item in paths.items():
        if not isinstance(path_item, dict):
            continue
        for method, op in path_item.items():
            if method.lower() not in HTTP_METHODS:
                continue
            if not isinstance(op, dict):
                continue
            tags = op.get("tags") or ["Default"]
            tag = tags[0]
            out.append((tag, path_tpl, method.lower(), op))
    return out


def group_by_tag(ops: list[tuple[str, str, str, dict]]) -> dict[str, list[tuple[str, str, dict]]]:
    groups: dict[str, list[tuple[str, str, dict]]] = {}
    for tag, path_tpl, method, op in ops:
        groups.setdefault(tag, []).append((path_tpl, method, op))
    return groups


def build_request(
    api_prefix: str, path_tpl: str, method: str, op: dict, domain_stem: str
) -> dict:
    body_str, body_mode = json_body_from_operation(op)
    headers = header_params(op)
    queries = query_params(op)

    req: dict = {
        "method": method.upper(),
        "header": headers,
        "url": build_url(api_prefix, path_tpl, op),
    }
    desc = operation_description(op)
    if queries:
        req["url"]["query"] = queries
    if body_str is not None:
        req["body"] = {
            "mode": "raw",
            "raw": body_str,
            "options": {"raw": {"language": "json"}},
        }
        if body_mode:
            req["header"] = [*headers, {"key": "Content-Type", "value": body_mode}]
    item: dict = {
        "name": request_name(method, path_tpl, op),
        "request": req,
    }
    if desc:
        item["request"]["description"] = desc
    # Avoid sending an empty Authorization header on login/register flows.
    if domain_stem == "auth":
        item["request"]["auth"] = {"type": "noauth"}
    return item


def main() -> None:
    collection_items: list[dict] = []

    for doc_path in openapi_files():
        stem = doc_path.stem
        with doc_path.open(encoding="utf-8") as f:
            doc = yaml.safe_load(f)
        if not isinstance(doc, dict) or "paths" not in doc:
            continue

        api_prefix = parse_server_url(doc)
        ops = collect_operations(doc_path, doc)
        by_tag = group_by_tag(ops)

        tag_folders: list[dict] = []
        for tag in sorted(by_tag.keys()):
            requests = [
                build_request(api_prefix, path_tpl, method, op, stem)
                for path_tpl, method, op in by_tag[tag]
            ]
            tag_folders.append({"name": tag, "item": requests})

        # When the spec uses a single OpenAPI tag (most files), omit the extra tag folder so we
        # get Admin / GET … instead of Admin / Admin / GET …
        if len(tag_folders) == 1:
            nested_items: list = tag_folders[0]["item"]
        else:
            nested_items = tag_folders

        domain_folder = {
            "name": folder_title(stem),
            "description": (doc.get("info") or {}).get("description", "").strip()
            or None,
            "item": nested_items,
        }
        if domain_folder["description"] is None:
            del domain_folder["description"]
        collection_items.append(domain_folder)

    collection = {
        "info": {
            "_postman_id": str(uuid.uuid4()),
            "name": "Social Event Mapper API",
            "description": "Generated from docs/openapi/*.yaml — run docs/postman/generate_from_openapi.py to refresh.",
            "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
        },
        "auth": {
            "type": "bearer",
            "bearer": [{"key": "token", "value": "{{access_token}}", "type": "string"}],
        },
        "variable": [
            {
                "key": "protocol",
                "value": "https",
                "description": "Local dev example: http",
            },
            {
                "key": "base_host",
                "value": "socialeventmapper.com",
                "description": "Hostname only; path includes the `api` segment. Local example: localhost:8080",
            },
            {"key": "access_token", "value": ""},
        ],
        "item": collection_items,
    }

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT.open("w", encoding="utf-8") as f:
        json.dump(collection, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"Wrote {OUTPUT.relative_to(REPO_ROOT)} ({len(collection_items)} domain folders)")


if __name__ == "__main__":
    main()
