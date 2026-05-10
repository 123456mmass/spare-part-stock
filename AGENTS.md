<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This project uses a newer Next.js version with breaking changes. APIs, conventions, and file structure may differ from training data. Before writing or editing Next.js code, read the relevant local guide in `node_modules/next/dist/docs/` when it exists. Heed deprecation notices from Next.js, React, TypeScript, ESLint, Prisma, and build output.
<!-- END:nextjs-agent-rules -->

# Spare Part Stock Agent Rules

This repository is a spare-parts inventory system at `C:\Internship\spare-part-stock`.

Project stack:

- Next.js 16.2.6
- React 19.2.4
- Prisma 7.8.0
- SQLite local database
- Tailwind CSS 4
- better-auth
- ExcelJS / xlsx
- QR code and scanner flows

Follow these rules for every task in this repository.

## Model Routing

- Plan mode should use `mimo-v2.5-pro`.
- Normal implementation work should use `MiniMax-M2.7`.
- Background or lightweight work can use `mimo-v2.5`.
- Review, test, verification, and second-opinion checks can use `deepseek-v4-pro` when available from the model selector.
- If model routing appears wrong, inspect the local gateway debug endpoints before changing project code.

## Required MCP Usage

- Use `sequential-thinking` MCP for complex plans, architecture decisions, root-cause debugging, database migrations, risky refactors, and multi-step inventory logic.
- Use Context7 MCP before coding against Next.js, React, Prisma, Tailwind, Radix, better-auth, react-hook-form, zod, ExcelJS, xlsx, qrcode, or QR scanner APIs.
- Use `shadcn` MCP when adding or changing shadcn/ui-style components or Radix-based component composition.
- Use Playwright MCP after significant UI, routing, auth, forms, scanner, import/export, stock movement, or dashboard changes.
- Use Tavily MCP only when current external facts or docs are needed and local docs or Context7 are insufficient.
- Use database-related MCP/tools before modifying Prisma schema, migrations, seed data, or stock movement logic.

## Required Skills

- Use `frontend-ux` for UI, layout, responsiveness, accessibility, dashboards, tables, forms, modals, toasts, and scanner flows.
- Use `fullstack-delivery` for work that crosses UI, server actions/API routes, auth, Prisma, database, and validation.
- Use `database-workflow` for Prisma schema, migrations, SQLite data, seed data, indexes, relations, and stock-integrity checks.
- Use `excel-workbook` for Excel import/export, `.xlsx`, `.csv`, report generation, embedded images, and workbook QA.
- Use `barcode-qr` for QR codes, barcodes, scanner flows, labels, inventory tags, and code validation.

## Planning Rules

- Always plan before coding.
- For any non-trivial change, first identify affected files, data flow, validation points, and verification commands.
- For risky changes, use `sequential-thinking` MCP before editing.
- Keep changes scoped to the requested behavior and the existing project architecture.
- Do not invent new abstractions unless they remove real duplication or match an established local pattern.

## Next.js Rules

- Inspect `node_modules/next/dist/docs/` before writing or editing App Router, server actions, caching, middleware/proxy, route handlers, metadata, config, or deployment behavior.
- Do not rely on memory for behavior that may have changed in the installed Next.js version.
- Prefer server components by default.
- Use client components only for interactivity, browser APIs, forms, scanner/camera access, charts, or local UI state.
- Keep route handlers, server actions, and database calls server-side.
- Do not expose secrets or database URLs to client components.

## Inventory and Database Rules

- Never allow negative stock.
- Use database transactions for stock movement, stock adjustments, imports, and any multi-step write.
- Validate all stock movement input with zod or equivalent schema validation before mutating data.
- Keep stock ledger/history consistent with current quantity.
- Treat destructive database actions as unsafe unless the user explicitly approves them.
- For Prisma changes, update schema, migrations, seed data, generated types, and usages together.
- Preserve auditability for stock changes: who/what/when/why should be recoverable when the app model supports it.
- Do not silently discard duplicate SKU/item codes during imports. Report duplicates clearly.

## Frontend Rules

- Use mobile-first responsive design.
- Use existing UI components and conventions before creating new abstractions.
- Use lucide-react icons for common actions.
- Keep dashboard, table, form, and inventory views dense, clear, and operational.
- Avoid marketing-style layouts for internal stock-management screens.
- Include loading, empty, success, validation error, permission error, and failure states for user-facing workflows.
- Make scanner flows explicit about camera permission, invalid code, duplicate item, item not found, and successful scan states.
- Ensure text does not overflow buttons, cards, table cells, dialogs, or mobile screens.

## Excel Rules

- Use ExcelJS for Excel work that needs formatting, images, tables, or precise workbook output.
- For Excel embedded images, map images by worksheet row position.
- Verify import/export row counts, required columns, numeric parsing, duplicate SKU/item codes, and generated totals.
- Do not mutate stock from Excel imports without validation, duplicate checks, and transaction boundaries.
- Show import previews or clear import summaries when the workflow affects inventory data.

## Barcode and QR Rules

- Validate code format before generating QR codes, barcodes, labels, or inventory tags.
- Keep QR/barcode payloads stable and documented by project convention.
- Do not invent external product-code standards unless the user explicitly asks.
- Scanner flows must handle camera unavailable, permission denied, invalid code, duplicate scan, item not found, and success states.

## Auth and Security Rules

- Keep auth checks close to protected server actions, route handlers, and pages.
- Do not trust client-side role or permission state for protected mutations.
- Never log secrets, database URLs, auth tokens, session tokens, or API keys.
- Do not commit `.env` values or generated local secrets.
- For file imports, validate file type, size, row shape, required columns, and numeric ranges.

## Verification Rules

- Always run `npm run lint` after meaningful code changes unless a blocker prevents it.
- Always run `npm run build` after meaningful code changes unless a blocker prevents it.
- Run Prisma validation, migration, generation, or seed checks when database files change.
- After each major feature, test the affected user flow with Playwright MCP.
- For Excel changes, verify generated files can be opened and imported/exported counts match expectations.
- For QR/barcode changes, verify generation and scanner parsing with representative valid and invalid codes.
- Report what was verified and any remaining risk.

## Debugging Rules

- Reproduce the failure before changing code when feasible.
- Check terminal output, browser console, server logs, Prisma errors, and network responses.
- If Claude model routing or gateway behavior is suspicious, inspect gateway debug endpoints and server logs before changing app code.
- Prefer small fixes with clear verification over broad rewrites.

## Prohibited Actions

- Do not allow stock quantity to go below zero.
- Do not skip validation for inventory mutations.
- Do not perform destructive database resets, deletes, or migrations without explicit user approval.
- Do not expose secrets in client code, logs, screenshots, or markdown output.
- Do not bypass MCP/skill requirements for the task category.
- Do not rely on outdated Next.js assumptions when local docs are available.
