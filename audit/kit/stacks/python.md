# Python services stack module (Django / FastAPI / Flask)

**Detection signals:** `pyproject.toml`, `requirements*.txt`, `Pipfile`, `poetry.lock`, `manage.py` (Django), `settings.py`, `wsgi.py`/`asgi.py`, imports of `fastapi`, `flask`, `django`, `pydantic`, `sqlalchemy`.

**Loads with dimensions:** security, data, performance, reliability, testing, code-health.

## Vulnerability and defect patterns

### Security
- `pickle.load(s)`, `shelve`, `marshal`, `dill`, `jsonpickle` on untrusted data: code execution. Also pickled data in caches or queues that others can write to.
- `yaml.load(x)` without `Loader=yaml.SafeLoader`, or `yaml.unsafe_load`: code execution. `yaml.safe_load` is fine.
- `eval`, `exec`, `compile` on input; `__import__`/`importlib` with user-controlled names.
- `subprocess.*(..., shell=True)`, `os.system`, `os.popen` with interpolated input: command injection. Prefer an args list with `shell=False`.
- SQL built with f-strings, `%` or `.format` and passed to `cursor.execute`, `text()`, `.raw()`, `.extra()`, `RawSQL`: SQL injection. Parameterised `execute(sql, params)` is fine.
- Path traversal: `open(os.path.join(base, user))`, `send_file`, `send_from_directory` misuse, `zipfile.extractall`/`tarfile.extractall` on untrusted archives (zip-slip).
- SSRF: `requests.get(user_url)` with no allow-list; `verify=False` on requests disables TLS checks.
- Weak crypto: `hashlib.md5/sha1` for passwords or tokens, `random` instead of `secrets` for tokens, hardcoded keys, `jwt.decode(..., options={"verify_signature": False})` or algorithms not pinned.
- Jinja2 `Template(user_string)` / `render_template_string` with user input: server-side template injection. `|safe` and `mark_safe` on user data: XSS.
- Auth and permissions: FastAPI routes with no `Depends(...)` for auth; Django views with no `login_required`/permission classes; Flask routes with no decorator; object lookups with no owner filter (IDOR).
- Django REST framework: `permission_classes = [AllowAny]`, serializers with `fields = '__all__'` (leaks columns, allows mass assignment).
- Mass assignment: `Model(**request.data)` or `**request.json`.
- Debug or admin endpoints reachable in production (`/docs`, `/redoc`, `/openapi.json` for internal APIs, Django admin on a guessable path, Flask `debug=True`).

### Data
- Missing validation: request bodies read as raw `dict`/`request.json` instead of `pydantic` models (FastAPI) or serializers/forms (Django); no length, range, or enum limits.
- `pydantic` models with `extra='allow'` or loose `Any` fields; `.dict()`/`.model_dump()` returned directly leaking internal fields (use response models).
- Django migrations editing live tables unsafely (adding `NOT NULL` without default, `RunPython` with no reverse); `unique=True` missing on natural keys.
- Naive datetimes (`datetime.now()`, `utcnow()`) mixed with aware ones; `USE_TZ = False` in Django.
- SQLAlchemy sessions not closed or committed on error paths; shared session across requests.

### Performance
- Blocking calls inside `async def` (FastAPI): `requests`, `time.sleep`, sync DB drivers, file and CPU-heavy work; they stall the event loop. Use async clients or `run_in_threadpool`/sync `def` routes.
- N+1: Django missing `select_related`/`prefetch_related`; SQLAlchemy lazy loading in loops (`selectinload`/`joinedload`).
- `.all()` with no pagination; `len(queryset)` instead of `.count()`; loading whole files into memory.
- No connection pooling or pool too small; creating a new client per request.

### Reliability
- Mutable default arguments (`def f(x=[])`, `def f(x={})`): state shared across calls.
- Bare `except:` and `except Exception: pass`: errors swallowed; `assert` used for runtime validation (removed under `-O`).
- Outbound calls with no `timeout=` (`requests` has no default timeout).
- Background work started in-request with no retry and no persistence (`BackgroundTasks`, threads); Celery tasks that are not idempotent.
- No graceful shutdown or lifespan handling (FastAPI `lifespan`) for clients and pools.
- Logging secrets or request bodies; `print` instead of `logging`.

### Testing
- No tests for permission failures and validation errors; tests that call real external services; `pytest` fixtures sharing mutable state.
- Django `TestCase` vs `TransactionTestCase` misuse hiding transaction bugs.

### Code health
- Missing type hints and no `mypy`/`pyright`; wildcard imports; circular imports; large `views.py`/`main.py`; unused dependencies in `requirements.txt` and unpinned versions.

## Framework misconfigurations

- Django: `DEBUG = True` in production; hardcoded `SECRET_KEY`; `ALLOWED_HOSTS = ['*']` or empty with debug off; `CsrfViewMiddleware` removed or `@csrf_exempt` on state-changing views.
- Django: `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE`, `SECURE_SSL_REDIRECT`, `SECURE_HSTS_SECONDS`, `SECURE_CONTENT_TYPE_NOSNIFF`, `X_FRAME_OPTIONS` unset; `python manage.py check --deploy` lists these.
- Django: `CORS_ALLOW_ALL_ORIGINS = True` (django-cors-headers); password validators removed; default `MD5PasswordHasher` or weak hashers.
- FastAPI: `CORSMiddleware` with `allow_origins=['*']` plus `allow_credentials=True`; docs exposed; no trusted host or HTTPS redirect at the proxy.
- Flask: `app.run(debug=True)`; weak `SECRET_KEY`; `SESSION_COOKIE_SECURE`/`SAMESITE` unset; no CSRF protection (`Flask-WTF`) for cookie-auth forms.
- `gunicorn`/`uvicorn` bound to `0.0.0.0` with `--reload` in production; one worker only; no request timeout.

## Scanner and project commands

All run only if approved at Checkpoint A.
- SAST: `bandit -r <src>`; `semgrep` with a Python ruleset.
- Dependency audit: `pip-audit -r requirements.txt` (can resolve over the network; prefer a temp environment) or `osv-scanner`.
- Lint and format check: `ruff check .` (and `ruff format --check .`), or `flake8`/`pylint` if configured.
- Typecheck: `mypy .` or `pyright`.
- Tests: `pytest`; Django: `python manage.py test`.
- Coverage: `pytest --cov=<package>` (needs `pytest-cov`) or `coverage run -m pytest` then `coverage report`.
- Django deploy checks: `python manage.py check --deploy` (imports settings; run only in a safe environment).
- Dead code: `vulture .`; import layering: `import-linter`.

## Where to look first

- Django: `<project>/settings*.py`, `urls.py`, `*/views.py`, `*/serializers.py`, `*/permissions.py`, `*/migrations/`, `*/tests/`.
- FastAPI: `app/main.py`, `app/routers/`, `app/dependencies.py`, `app/core/config.py`, `app/models/`, `alembic/versions/`, `tests/`.
- Flask: `app.py`, `app/__init__.py` (factory), `blueprints/`, `config.py`, `migrations/`, `tests/`.
- Dependencies: `pyproject.toml`, `requirements*.txt`, lock files, `Dockerfile`.

## Looks wrong but is fine

- `subprocess.run([...], shell=False)` with a fixed list of arguments.
- `yaml.safe_load`, `pickle` used only on trusted local files that the program itself wrote.
- `assert` in test files.
- `DEBUG = True` or `SECRET_KEY = 'dev'` in `settings_local.py`, `settings/dev.py`, or test settings that are not used in production.
- `random` for non-security uses (sampling, jitter, test data).
- `# noqa` or `# nosec` with a clear reason next to it.
- Mutable defaults that are never mutated and are documented (rare, still worth a quick look).

## Version notes

- Pydantic v1 vs v2: `.dict()`/`.parse_obj()` vs `.model_dump()`/`.model_validate()`; `orm_mode` vs `from_attributes`; validators differ. Identify the major.
- SQLAlchemy 1.4 vs 2.0: query style and async session API differ.
- Django LTS releases and Python versions reach end of life; check against vendor support dates.
- Flask and Werkzeug 2.x/3.x changed some APIs and defaults; `utcnow()` is deprecated from Python 3.12.
- Verify against the installed version.
