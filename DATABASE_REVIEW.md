# Database Review

Engine: SQLAlchemy 2 models in `backend/app/models/entities.py`; SQLite by default (`DATABASE_URL`), PostgreSQL supported by SQLAlchemy but not tested.

## Entities and relationships

```
Writathon 1 ── n Lead (= one registration) n ── 1 Student
                  │  owner_id → User (lead owner)
                  ├── 1 StorySubmission (unique lead_id)
                  │        ├── 1 ManualPlagiarismReview (unique story_id, reviewer → User)
                  │        ├── 1 StoryReview            (unique story_id, reviewer → User)
                  │        ├── n Payment                (also lead_id)
                  │        └── 1 Publication            (unique story_id, publisher → User)
                  └── n CommunicationLog (every email, with delivery outcome)
EmailTemplate (one per template_code)
AuditLog (new) → User; entity_type + entity_id point at any row
```

- **Student** = one child + parent contact. Identity: lower-cased parent email + case-insensitive child name.
- **Lead** = that student's registration in one Writathon. It keeps its own copy of the form fields, so later
  registrations never overwrite what was submitted earlier. It holds the lead status, owner, tracking ID
  (`lead_id`) and private link token (`access_token`).
- Status fields are separate on purpose: `Lead.status` (lifecycle), `StorySubmission.status` (story),
  `ManualPlagiarismReview.status`, `StoryReview.decision` (eligibility), `Payment.status`, `Publication.publication_status`.

## Integrity problems found and changes made

| Problem | Change |
|---|---|
| Nothing in the DB stopped two registrations of the same student in the same Writathon, or two `Student` rows for the same child, if requests arrived together. | Unique index `uq_lead_writathon_student (writathon_id, student_id)` and unique expression index `uq_student_identity (parent_email, lower(child_name))`. API turns violations into 409. |
| No history: reviews, plagiarism checks, owner, statuses and settings were overwritten in place. | New `audit_logs` table (append-only from the app's point of view) with before/after values. |
| Payment `PAID` transition was read-then-write; duplicate webhooks could both run it. | Conditional `UPDATE … WHERE status != 'PAID'`; only the winner continues. |
| A failed DB write after saving an upload left an orphan file; replacing a story left the old file. | Upload deleted on failure; the replaced file is deleted after the new one is committed (recorded in the audit log). |
| Public form overwrote `Student` contact details. | Existing student rows are no longer changed by the public form. |

All checks: `backend/test_workflow.py` ("R30 …", "R25/R30 …", "R22 replaced file is deleted from storage").

## How schema changes are applied (migration concern)

- The app builds tables with `Base.metadata.create_all()` at startup. Alembic is set up, but its only migration is
  empty and no database has an `alembic_version` table. **Alembic is not actually in use.**
- `create_all` creates new tables (so `audit_logs` appeared automatically) but does not change existing tables.
  The new unique indexes are therefore added at startup by `ensure_constraints()` in `app/main.py`
  (`CREATE UNIQUE INDEX IF NOT EXISTS`). If duplicates already exist, index creation fails, the error is logged,
  and the app still starts. Remove the duplicates, then restart.
- Applied to the dev database on 2026-10-12 after taking a verified backup (`backend/backups/20261012-103607`).
  Row counts were unchanged and no rows were deleted.

**Before production:** generate a real Alembic baseline from the current models (`alembic revision --autogenerate`),
stamp existing databases, and make schema changes through migrations from then on. Enum values are stored as
strings; on PostgreSQL, adding a value to a status enum needs a migration.

## Duplicate prevention
Application check first (existing student → existing registration → 409), then DB unique indexes for races.
Shared parent emails don't merge siblings because the child name is part of the identity. A typo in the child
name creates a second student (safe, never a wrong merge); there is no staff merge tool yet.

## Historical data preservation
- No delete endpoints exist for Writathons, leads, students, submissions or payments.
- **Risk:** the ORM relationships use `cascade="all, delete-orphan"` from `Writathon → leads` and
  `Lead → submissions, communications, payments`. Deleting a Writathon row through the ORM (e.g. a future admin
  feature or a shell session) would delete every registration, story record and payment under it.
  **Recommendation:** remove those cascades, or use `ON DELETE RESTRICT`, before anyone adds delete features.
- `Lead.student_id` is nullable, but every current row has a student; make it `NOT NULL` in the first real migration.
- Timestamps are naive UTC in SQLite (the code adds `tzinfo` when comparing).

## Recommended improvements (not done)
1. Real Alembic baseline (above) and PostgreSQL for production.
2. Remove destructive cascades; `NOT NULL` on `Lead.student_id`.
3. A `marketing_opt_out` (or consent) column on `Student` once the business defines the rule.
4. Retention job (anonymise registrations older than the agreed period) once the period is decided.
5. Move uploads to private object storage with encryption at rest if the app runs on more than one server.
