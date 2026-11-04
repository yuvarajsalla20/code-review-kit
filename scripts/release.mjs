#!/usr/bin/env node
// Release readiness on its own:
//   node path/to/review-kit/scripts/release.mjs [review.config.json] [--report out.md] [--json]
// Exit code 1 when a gated check finds something. Run from the project root.
import { runCli } from './lib/cli.mjs';
import { runRelease } from './release/index.mjs';
import { toMarkdown } from './release/report.mjs';

runCli({ run: runRelease, toMarkdown });
