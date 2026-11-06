#!/usr/bin/env node
// Advisory mutation check on its own (slow; works on a temporary copy, never edits the project):
//   node path/to/review-kit/scripts/mutate.mjs [review.config.json] [--report out.md] [--json]
// Needs a `mutation` block in review.config.json. Run from the project root.
import { runCli } from './lib/cli.mjs';
import { areaRun } from './areas.mjs';
import { toMarkdown } from './mutation/report.mjs';

runCli({ run: areaRun('mutation'), toMarkdown });
