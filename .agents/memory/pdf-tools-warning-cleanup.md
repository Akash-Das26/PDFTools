---
name: PDF Tools warning cleanup
description: Runtime and build-warning constraints for the PDF Tools monorepo.
---

Optional native packages used by a bundled server must be declared as direct runtime dependencies of the workspace that starts the server.

**Why:** pnpm's strict workspace resolution can leave a package present in the store but unavailable from the bundled server's resolution path, causing optional native-loading warnings.

**How to apply:** When a runtime library dynamically loads an optional native package, declare the matching package directly in that workspace and refresh the lockfile.

Vite React builds should not carry Next.js-only module directives such as `'use client'`.

**Why:** Rollup treats those directives as module-level warnings and can emit misleading sourcemap errors even though the production bundle succeeds.

**How to apply:** Keep those directives out of Vite-only components; reserve them for frameworks that use them for server/client boundaries.