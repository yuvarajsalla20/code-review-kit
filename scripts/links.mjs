#!/usr/bin/env node
// Incoming links and parsing that can throw:
//   node path/to/review-kit/scripts/links.mjs [review.config.json] [--report out.md] [--json]
// Works without a config; the `links` block changes the settings. Run from the project root.
import { runCli } from './lib/cli.mjs';
import { areaRun } from './areas.mjs';
import { toMarkdown } from './links/report.mjs';

runCli({ run: areaRun('links'), toMarkdown, optionalConfig: true });
