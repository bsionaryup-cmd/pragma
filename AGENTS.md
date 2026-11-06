<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:ocp-rules -->
# Operational Consistency Program (OCP)

For certification, consistency, or cross-module coherence work, follow **`docs/OCP-MASTER-EXECUTION-PROTOCOL.md`** exactly:

- Register a **baseline** before editing (`docs/ocp/baselines/`).
- One **certified commit per domain** before advancing state.
- Track domain state in **`docs/ocp/DOMAIN-REGISTRY.md`** (OPEN → CLOSED).
- Use **`docs/ocp/templates/PHASE-DELIVERABLE-TEMPLATE.md`** for the 18-point deliverable.
- **Deploy to production** requires explicit owner approval; do not auto-deploy.
- On failure: rollback the current phase only, restore baseline, document, continue.
<!-- END:ocp-rules -->

<!-- BEGIN:cloud-agent -->
# Cloud Agent

The environment boots local PostgreSQL and the Next.js dev server. Dependency install is `npm ci` from `/agent/repos/pragma` (Node is already on `PATH`).

- App: http://localhost:3000 — open `localhost`, not `127.0.0.1` (Next.js dev origin). `npm run dev` uses webpack.
- Database: `postgresql://pragma:pragma@127.0.0.1:5432/pragma`. Boot creates the role and database if needed, then runs `npx prisma migrate deploy`. Keep this local URL; do not point it at production.
- Clerk runs in keyless mode until `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` are present. Public pages and lead capture work without those keys.
<!-- END:cloud-agent -->
