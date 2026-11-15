// End-to-end starters: how testable the screens are (test IDs), and Maestro flows written from the config's `e2e` block.
// Pure functions; e2e.mjs does the reading and writing.

/** How many source files set a testID, and how many draw buttons or inputs: few IDs means flows tap visible words, which break on every copy change. */
export function testIdCoverage(texts) {
  let withIds = 0;
  let interactive = 0;
  for (const text of texts.values()) {
    const touch = /<(Pressable|TouchableOpacity|TouchableHighlight|Button|TextInput|Switch)\b/.test(text);
    if (touch) interactive++;
    if (/\btestID\s*=/.test(text)) withIds++;
  }
  return { withIds, interactive };
}

/** For each path the app handles (scheme://path/...), the same path with a stray %, a cut-off escape and a very long id, plus an unknown path. */
export function brokenLinks(urls) {
  const bases = [...new Set(urls.map((u) => /^([a-z][a-z0-9+.-]*:\/\/[^/?#]*)/i.exec(u)?.[1]).filter(Boolean))];
  const scheme = bases[0]?.split('://')[0] ?? 'app';
  return [...bases.flatMap((b) => [`${b}/%`, `${b}/%E0%A4%A`, `${b}/${'9'.repeat(300)}`]), `${scheme}://does-not-exist`];
}

const yaml = (appId, steps) => [`appId: ${appId}`, '---', ...steps, ''].join('\n');
const tap = (t) => `- tapOn: ${JSON.stringify(t)}`;
const see = (t) => `- assertVisible: ${JSON.stringify(t)}`;

/**
 * Starter Maestro flows. `e2e`: { appId, firstScreen, signIn?: { button, email, password, done }, add?: { open, field, save },
 * links?: [{ url, expect }], back?: string }. Text is what the screen shows. Returns { name: yaml }.
 */
export function maestroFlows(e2e) {
  const flows = {};
  flows['01-launch.yaml'] = yaml(e2e.appId, ['- launchApp:', '    clearState: true', `- extendedWaitUntil:\n    visible: ${JSON.stringify(e2e.firstScreen)}\n    timeout: 20000`]);
  const signIn = e2e.signIn
    ? ['- runFlow: 01-launch.yaml', tap(e2e.signIn.button), tap(e2e.signIn.email), '- inputText: ${EMAIL}', tap(e2e.signIn.password), '- inputText: ${PASSWORD}', tap(e2e.signIn.button), `- extendedWaitUntil:\n    visible: ${JSON.stringify(e2e.signIn.done)}\n    timeout: 20000`]
    : ['- runFlow: 01-launch.yaml'];
  flows['02-sign-in.yaml'] = yaml(e2e.appId, signIn);
  if (e2e.add) {
    const name = 'E2E item';
    flows['03-add-restart.yaml'] = yaml(e2e.appId, ['- runFlow: 02-sign-in.yaml', tap(e2e.add.open), tap(e2e.add.field), `- inputText: "${name}"`, tap(e2e.add.save), see(name), '- stopApp', '- launchApp', `- extendedWaitUntil:\n    visible: "${name}"\n    timeout: 15000`]);
  }
  if (e2e.links?.length) {
    const home = e2e.signIn?.done ?? e2e.firstScreen;
    // Every link the app handles, then broken ones: a stray %, a cut-off escape, an unknown path. None may crash the app.
    flows['04-links.yaml'] = yaml(e2e.appId, ['- runFlow: 02-sign-in.yaml', ...e2e.links.flatMap((l) => [`- openLink: ${JSON.stringify(l.url)}`, see(l.expect), ...(e2e.back ? [tap(e2e.back)] : ['- back'])]), ...brokenLinks(e2e.links.map((l) => l.url)).flatMap((u) => [`- openLink: ${JSON.stringify(u)}`, see(home)])]);
  }
  return flows;
}

export const README = (count) => `# End-to-end starter flows (Maestro)

Written by the review kit. Run on a Mac with a simulator build, or a dev build on a phone:

1. Install Maestro: \`curl -fsSL "https://get.maestro.mobile.dev" | bash\`
2. Start the app in the simulator (\`npx expo run:ios\`).
3. \`maestro test . -e EMAIL=<test account> -e PASSWORD=<password>\` (use a throwaway account).

${count} flows. They tap visible words; add \`testID\` props to the main buttons and fields to make them sturdier.
Alerts, widgets, Live Activities, Apple and Google sign-in and real purchases cannot be driven by Maestro: test those on a device (templates/manual-test.md).
`;
