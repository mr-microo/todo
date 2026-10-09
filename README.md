# Daymark To-Do

A responsive Flask and SQLite task manager with a quiet Three.js wireframe backdrop. Tasks are managed through a JSON REST API and stored in SQLite.

## Run locally

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
python app.py
```

Open <http://127.0.0.1:5000>. The SQLite database is created automatically in `instance/todo.db`. `.env` is loaded for local development. Debug mode is off by default; set `FLASK_DEBUG=1` only for local development.

Three.js is loaded as an ES module from jsDelivr. When the module or WebGL is unavailable, the canvas hides and the task interface remains usable.

## API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Database health |
| GET | `/api/tasks` | List tasks |
| GET | `/api/tasks/<id>` | Read one task |
| POST | `/api/tasks` | Create a task |
| PATCH | `/api/tasks/<id>` | Update task fields |
| DELETE | `/api/tasks/<id>` | Delete a task |

Task JSON uses `title` (required, max 160 characters), optional `description` (max 5000), `completed` (boolean), `priority` (`Low`, `Medium`, or `High`), and `due_date` (ISO 8601 datetime or null). Errors return `{"error":{"message":"..."}}`.

## Verify

```powershell
pip install -r requirements-dev.txt
python -m pytest -q
```

## GitHub and Vercel deployment

The repository includes a GitHub Actions workflow at `.github/workflows/tests.yml`. It runs the API test suite for pushes and pull requests.

1. Push this repository to GitHub.
2. Import the repository from [Vercel](https://vercel.com/new). Vercel detects the Flask app from the top-level `app.py`; `vercel.json` includes the Jinja templates in the function bundle. Frontend files live under `public/static` so Vercel can serve them from its CDN.
3. In the Vercel project settings, add `DATABASE_URL` and `SECRET_KEY` for both Preview and Production. Use a managed PostgreSQL database for `DATABASE_URL` (for example, a Neon connection string), and use a long random value for `SECRET_KEY`. The app accepts `postgres://`, `postgresql://`, and `postgresql+psycopg://` URLs.
4. Deploy. Vercel will create Preview deployments for branches and Production deployments for the production branch.

Vercel's filesystem is ephemeral. If `DATABASE_URL` is missing, the app uses a SQLite file under `/tmp` so a preview can start, but that data is not durable. Configure managed PostgreSQL before using the production deployment. Local development continues to use SQLite by default.

For a local Vercel runtime check, install the [Vercel CLI](https://vercel.com/docs/cli) and run `vercel dev` from the repository root.
