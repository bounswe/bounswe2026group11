# Postman Collection

`generate.sh` rebuilds `Social-Event-Mapper.postman_collection.json` from every YAML file in `docs/openapi/`.

Run it from anywhere in the repo:

```bash
bash docs/postman/generate.sh
```

What it does:

1. Creates `docs/postman/.venv` if it does not exist.
2. Installs Python dependencies from `requirements.txt`.
3. Runs `generate_from_openapi.py`.
4. Writes `Social-Event-Mapper.postman_collection.json`.

The generated collection uses variables:

- `protocol`: defaults to `https`; use `http` for local development.
- `base_host`: defaults to `socialeventmapper.com`; use `localhost:8080` for local development.
- `access_token`: bearer token used by authenticated requests.

After changing `docs/openapi/*.yaml`, run this script and review the generated collection diff.
