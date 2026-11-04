#!/usr/bin/env node
// Speed and cost candidates on their own:
//   node path/to/review-kit/scripts/perf.mjs [review.config.json] [--report out.md] [--json]
// Works without a config (the defaults). Rows are candidates for performance-reviewer; nothing gates unless `speed.gate` names a check. Run from the project root.
import { runCli } from './lib/cli.mjs';
import { runPerf } from './perf/index.mjs';
import { toMarkdown } from './perf/report.mjs';

runCli({ run: runPerf, toMarkdown, optionalConfig: true });
