#!/usr/bin/env node
// Data integrity: offline listeners, upload retries, Storage rule paths and number parsing:
//   node path/to/review-kit/scripts/integrity.mjs [review.config.json] [--report out.md] [--json]
// Works without a config; the `integrity` block changes the settings. Run from the project root.
import { runCli } from './lib/cli.mjs';
import { areaRun } from './areas.mjs';
import { toMarkdown } from './integrity/report.mjs';

runCli({ run: areaRun('integrity'), toMarkdown, optionalConfig: true });
