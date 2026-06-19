# Prompt Instructions

Use this text at the start of future prompts when asking for code, database, frontend, backend, or architecture changes.

## Full Version

```text
Before making any code or database changes, read and follow AGENTS.md and all relevant files in the documents folder.

Follow these rules strictly:
- Use simple, clear names and labels that non-native English speakers and less technical staff can understand.
- For frontend work, follow documents/FRONTEND_BEST_PRACTICES.md.
- For backend work, follow documents/BACKEND_BEST_PRACTICES.md.
- For database, Prisma, inventory, stock, accounting, or reporting work, follow documents/DATABASE_DESIGN_RULES.md and documents/INVENTORY_TABLES.md.
- Keep frontend and backend as separate apps with separate dependencies and containers.
- Do not start the frontend; it is already running on port 3000.
- Use backend/.env for backend database connection.
- Do not add Redis unless I explicitly ask or there is a clear requirement.
- Explain the plan first if the change affects database schema, business rules, or architecture.
```

## Short Version

```text
Follow AGENTS.md and the documents folder before making changes. Use simple user-friendly names. Apply frontend, backend, and database standards based on the work type. Do not start the frontend on port 3000. Share a plan first for schema or architecture changes.
```
