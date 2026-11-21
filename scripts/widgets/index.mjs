// Home Screen widgets and Lock Screen Live Activities: what shows on a locked phone, and what the widget shows once its planned entries run out.
// iOS never wakes the app to ask for more; the widget repeats what it was given. Text matches, so every row is a candidate the reviewer opens.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SOURCE, checkedFiles, readText } from '../lib/files.mjs';
import { assemble } from '../lib/findings.mjs';
import { lineFinder, stripComments } from '../lib/source.mjs';

export const CHECKS = ['lockscreen', 'timeline'];
const DEFAULTS = { roots: ['src', 'App.tsx', 'widgets', 'targets'], ignore: ['tests'], gate: [] };

/** Packages that put an app's content on the Home Screen or Lock Screen. */
export const WIDGET_PACKAGES = ['expo-widgets', 'react-native-widget-extension', '@bacons/apple-targets', 'react-native-android-widget', 'expo-live-activity'];
/** A file that draws a Live Activity or a widget view. */
const DRAWS = /\b(?:LiveActivity|createLiveActivity|startLiveActivity|Activity\.request|ActivityConfiguration|createWidget|WidgetConfiguration)\b|['"]widget['"]/;
/** Modifiers that let iOS hide private text while the phone is locked. */
const PRIVATE = /privacySensitive|redacted|privacy-sensitive/;
/** Where a widget timeline is planned. */
const TIMELINE = /\b(updateTimeline|reloadTimelines?|setTimeline|timeline)\s*[(:=]/i;
const CAP = /\b(MAX_[A-Z_]*ENTRIES|MAX_ENTRIES|maxEntries)\b\s*=\s*(\d+)/;
/** A plan that ends on an entry asking to open the app: once it shows, nothing out of date is on screen. */
const REFRESH_END = /\b(?:refresh|stale|openToRefresh)\s*:\s*true\b/;
/** A call that hands iOS a single entry (which never goes out of date) or a plan built by a function (checked where it is built). */
const HANDS_ON = /(?:updateTimeline|setTimeline)\s*\(\s*(?:\[\s*\{[^\]]*\}\s*\]|[A-Za-z_$][\w$.]*\s*\()/y;

/** The first place a timeline is planned in this text, skipping calls that only hand one over. */
const firstPlan = (text) => {
  const all = new RegExp(TIMELINE.source, 'gi');
  for (let m = all.exec(text); m; m = all.exec(text)) {
    HANDS_ON.lastIndex = m.index;
    if (!HANDS_ON.test(text)) return m;
  }
  return null;
};

/** True when the project uses one of the widget packages (or has none to check). */
export const usesWidgets = (root) => {
  const path = join(root, 'package.json');
  if (!existsSync(path)) return false;
  try {
    const p = JSON.parse(readFileSync(path, 'utf8'));
    return WIDGET_PACKAGES.some((n) => p.dependencies?.[n] || p.devDependencies?.[n]);
  } catch {
    return false;
  }
};

export function runWidgets(config, root) {
  const s = { ...DEFAULTS, ...config.widgets };
  const files = checkedFiles(root, s.roots, { label: 'widgets.roots', configured: config.widgets?.roots !== undefined, ignore: s.ignore, match: SOURCE });
  const lockscreen = [];
  const timeline = [];
  for (const file of files) {
    const text = stripComments(readText(root, file));
    const at = lineFinder(text);
    const draws = DRAWS.exec(text);
    if (draws && /<Text\b|\bText\s*\(/.test(text) && !PRIVATE.test(text)) {
      const line = at(draws.index);
      lockscreen.push({ where: `${file}:${line}`, what: 'A widget or Live Activity draws text with no privacySensitive or redacted marker, so it shows in full on a locked phone, whatever the person set for notification previews', fix: 'Mark personal text (reminder names, amounts, people) privacySensitive so iOS hides it while locked. Consider a setting to hide names on the Lock Screen.', effort: 'small', places: [{ file, from: line }] });
    }
    const cap = CAP.exec(text);
    const plan = firstPlan(text) ?? (cap && /timeline/i.test(text) ? cap : null);
    if (plan && /date|Date|entries|at:/.test(text) && !REFRESH_END.test(text)) {
      const line = at((cap ?? plan).index);
      timeline.push({ where: `${file}:${line}`, what: `A widget timeline is planned here${cap ? ` with at most ${cap[2]} entries` : ''}. Once the last entry passes, iOS keeps showing it and does not wake the app; repeating items must show their next time, not the last one`, fix: 'Plan a fixed span (for example 7 days, capped around 100 entries), end on a neutral "Open the app to refresh" entry, and test with a daily repeating item.', effort: 'medium', places: [{ file, from: line }] });
    }
  }
  return { ...assemble(CHECKS, { lockscreen, timeline }, s.gate), files: files.length, settings: s };
}
