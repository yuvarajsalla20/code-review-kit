#!/usr/bin/env node
// Structure checks on their own, with a report you can hand to the owner:
//   node path/to/review-kit/scripts/structure.mjs [review.config.json] [--report out.md] [--json]
// Exit code 1 when a gated check finds something. Run from the project root.
import { runCli } from './lib/cli.mjs';
import { areaRun } from './areas.mjs';
import { toMarkdown } from './structure/report.mjs';

runCli({ run: areaRun('structure'), toMarkdown });
