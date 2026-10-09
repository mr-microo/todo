import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, jsonify, render_template, request
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import CheckConstraint
from sqlalchemy.exc import SQLAlchemyError

db = SQLAlchemy()
PRIORITIES = {"Low", "Medium", "High"}
load_dotenv()


class Task(db.Model):
    __table_args__ = (
        CheckConstraint("length(trim(title)) > 0", name="ck_task_title_nonempty"),
        CheckConstraint("priority IN ('Low', 'Medium', 'High')", name="ck_task_priority"),
    )
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(160), nullable=False)
    description = db.Column(db.Text, nullable=False, default="")
    completed = db.Column(db.Boolean, nullable=False, default=False)
    priority = db.Column(db.String(10), nullable=False, default="Medium")
    due_date = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(
        db.DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "completed": self.completed,
            "priority": self.priority,
            "due_date": self.due_date.isoformat() if self.due_date else None,
            "created_at": self.created_at.isoformat() + "Z",
            "updated_at": self.updated_at.isoformat() + "Z",
        }


def error(message, status):
    return jsonify({"error": {"message": message}}), status


def parse_payload(payload, partial=False):
    if not isinstance(payload, dict):
        raise ValueError("Request body must be a JSON object.")
    allowed = {"title", "description", "completed", "priority", "due_date"}
    unknown = set(payload) - allowed
    if unknown:
        raise ValueError(f"Unknown field: {sorted(unknown)[0]}.")
    if not partial and "title" not in payload:
        raise ValueError("Title is required.")
    values = {}
    if "title" in payload:
        title = payload["title"]
        if not isinstance(title, str) or not title.strip():
            raise ValueError("Title must contain at least one non-space character.")
        if len(title.strip()) > 160:
            raise ValueError("Title must be 160 characters or fewer.")
        values["title"] = title.strip()
    if "description" in payload:
        description = payload["description"]
        if not isinstance(description, str):
            raise ValueError("Description must be text.")
        if len(description) > 5000:
            raise ValueError("Description must be 5000 characters or fewer.")
        values["description"] = description.strip()
    if "completed" in payload:
        if not isinstance(payload["completed"], bool):
            raise ValueError("Completed must be true or false.")
        values["completed"] = payload["completed"]
    if "priority" in payload:
        if not isinstance(payload["priority"], str) or payload["priority"] not in PRIORITIES:
            raise ValueError("Priority must be Low, Medium, or High.")
        values["priority"] = payload["priority"]
    if "due_date" in payload:
        raw_date = payload["due_date"]
        if raw_date in (None, ""):
            values["due_date"] = None
        elif isinstance(raw_date, str):
            try:
                parsed = datetime.fromisoformat(raw_date.replace("Z", "+00:00"))
                # Keep local wall time for datetime-local input; normalize offset dates to UTC.
                if parsed.tzinfo:
                    parsed = parsed.astimezone().replace(tzinfo=None)
                values["due_date"] = parsed
            except ValueError as exc:
                raise ValueError("Due date must be a valid ISO 8601 date/time.") from exc
        else:
            raise ValueError("Due date must be a valid ISO 8601 date/time or null.")
    return values


def create_app(test_config=None):
    app = Flask(
        __name__,
        instance_relative_config=True,
        static_folder="public/static",
        static_url_path="/static",
    )
    default_db = Path(app.instance_path) / "todo.db"
    database_url = os.environ.get("DATABASE_URL")
    if database_url:
        if database_url.startswith("postgres://"):
            database_url = database_url.replace("postgres://", "postgresql+psycopg://", 1)
        elif database_url.startswith("postgresql://"):
            database_url = database_url.replace("postgresql://", "postgresql+psycopg://", 1)
    elif os.environ.get("VERCEL"):
        # Vercel's filesystem is read-only except for /tmp. Set DATABASE_URL to
        # a managed database for persistence across function instances.
        temp_db = Path(tempfile.gettempdir()) / "daymark-todo.db"
        database_url = f"sqlite:///{temp_db.as_posix()}"
    else:
        database_url = f"sqlite:///{default_db.as_posix()}"
    app.config.from_mapping(
        SECRET_KEY=os.environ.get("SECRET_KEY", "local-development-key"),
        SQLALCHEMY_DATABASE_URI=database_url,
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
    )
    if test_config:
        app.config.update(test_config)
    if not os.environ.get("VERCEL"):
        Path(app.instance_path).mkdir(parents=True, exist_ok=True)
    db.init_app(app)

    with app.app_context():
        db.create_all()

    @app.get("/")
    def index():
        return render_template("index.html")

    @app.get("/api/health")
    def health():
        try:
            db.session.execute(db.select(1))
            return jsonify({"status": "ok"})
        except SQLAlchemyError:
            db.session.rollback()
            return error("Database is unavailable.", 500)

    @app.get("/api/tasks")
    def list_tasks():
        tasks = db.session.execute(
            db.select(Task).order_by(Task.created_at.desc(), Task.id.desc())
        ).scalars().all()
        return jsonify([task.to_dict() for task in tasks])

    @app.route("/api/tasks/<int:task_id>", methods=["GET", "PATCH", "DELETE"])
    def task_detail(task_id):
        task = db.session.get(Task, task_id)
        if task is None:
            return error("Task not found.", 404)
        if request.method == "GET":
            return jsonify(task.to_dict())
        if request.method == "DELETE":
            db.session.delete(task)
            db.session.commit()
            return "", 204
        try:
            values = parse_payload(request.get_json(silent=True), partial=True)
        except ValueError as exc:
            return error(str(exc), 400)
        if not values:
            return error("Provide at least one field to update.", 400)
        for key, value in values.items():
            setattr(task, key, value)
        db.session.commit()
        return jsonify(task.to_dict())

    @app.post("/api/tasks")
    def create_task():
        try:
            values = parse_payload(request.get_json(silent=True))
        except ValueError as exc:
            return error(str(exc), 400)
        task = Task(**values)
        db.session.add(task)
        db.session.commit()
        return jsonify(task.to_dict()), 201

    @app.errorhandler(400)
    def bad_request(_exc):
        return error("Request must contain valid JSON.", 400)

    @app.errorhandler(404)
    def not_found(_exc):
        if request.path.startswith("/api/"):
            return error("Resource not found.", 404)
        return _exc

    @app.errorhandler(500)
    def server_error(_exc):
        db.session.rollback()
        return error("An unexpected server error occurred.", 500)

    return app


app = create_app()

if __name__ == "__main__":
    app.run(debug=os.environ.get("FLASK_DEBUG", "0") == "1")
