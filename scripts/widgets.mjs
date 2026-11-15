#!/usr/bin/env node
// Home Screen widgets and Lock Screen Live Activities:
//   node path/to/review-kit/scripts/widgets.mjs [review.config.json] [--report out.md] [--json]
// Works without a config; the `widgets` block changes the settings. Run from the project root.
import { runCli } from './lib/cli.mjs';
import { areaRun } from './areas.mjs';
import { toMarkdown } from './widgets/report.mjs';

runCli({ run: areaRun('widgets'), toMarkdown, optionalConfig: true });
