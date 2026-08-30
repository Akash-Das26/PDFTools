---
name: Optional AI configuration
description: Keeps the PDF API usable when AI summarization credentials are not configured.
---

The AI provider is an optional capability, not a server startup requirement. Initialize provider clients only when credentials are present, and return a clear configuration response from AI-only endpoints when they are absent.

**Why:** Local PDF processing and the rest of the toolkit must remain usable without requiring users to configure a paid AI provider.

**How to apply:** Treat missing AI credentials as a handled feature-unavailable state, not as an import-time exception or generic server crash.