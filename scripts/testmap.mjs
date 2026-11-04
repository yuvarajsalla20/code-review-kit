#!/usr/bin/env node
// Which risky files no test reaches:
//   node path/to/review-kit/scripts/testmap.mjs [review.config.json] [--report out.md] [--json]
// Set `tests.risky` (folders that must never fail) in review.config.json. Run from the project root.
import { runCli } from './lib/cli.mjs';
import { runTestMap } from './testmap/index.mjs';
import { toMarkdown } from './testmap/report.mjs';

runCli({ run: runTestMap, toMarkdown });
