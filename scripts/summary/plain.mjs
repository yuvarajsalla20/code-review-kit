// Plain-language wording for every script finding, so the summary reads without jargon.
// `meaning` says what is wrong; `impact` says what it costs the user or the project; `term` is explained once in the glossary.
// `level` is the severity of a review (not gated) row; housekeeping checks are Low so the decision table leads with what can hurt users. Default Medium.
const t = (term, meaning) => ({ term, meaning });

const SECRET = { meaning: 'A password or key is written into the project files', impact: 'Anyone who can read the code or the app can use it, so it must be moved out and replaced.' };

export const PLAIN = {
  secrets: {
    privateKey: { meaning: 'A private key is stored in the project files', impact: SECRET.impact },
    serviceAccount: { meaning: 'A server account key file is stored in the project', impact: 'It gives full access to the backend, so anyone who can read the code can read or delete every user\'s data.' },
    awsKey: { meaning: 'An Amazon Web Services key is written into the code', impact: SECRET.impact },
    stripeKey: { meaning: 'A live payment key is written into the code', impact: 'Anyone who can read the code can take payments or refunds in your name.' },
    githubToken: { meaning: 'A GitHub access token is written into the code', impact: 'Anyone who can read the code can read or change your repositories.' },
    slackToken: { meaning: 'A Slack token is written into the code', impact: 'Anyone who can read the code can read or post in your workspace.' },
    assignment: SECRET,
  },
  // The owner's own rules: one wording for all of them, with the rule's name in the row.
  forbidden: {
    '*': { meaning: 'Code the project has banned is still in the files', impact: 'It was banned for a reason, such as debug output or unfinished work, and it ships to users unless it is removed or accepted.' },
  },
  structure: {
    cycles: { meaning: 'Parts of the code depend on each other in a loop', impact: 'A change in one can break the other, and loops make bugs hard to trace or can stop the app from starting.', term: t('circular import', 'Files that import each other in a loop.') },
    layers: { meaning: 'A part of the code reaches into a part it should not know about', impact: 'Changing one area forces changes in others, so new features get slower and riskier.', term: t('layer', 'A group of folders with a rule about which other groups it may use, for example screens may use data, but data may not use screens.') },
    restricted: { meaning: 'A package is used outside the one place meant to own it', impact: 'Replacing or upgrading it later means editing many files, and mistakes can break the backend.' },
    owned: { meaning: 'The app does itself something a shared kit already owns', impact: 'Fixes and rules in the kit do not reach this copy, so the app and the kit drift apart and the same bug is fixed twice.' },
    duplicates: { level: 'Low', meaning: 'The same code is written in more than one place', impact: 'A fix in one copy can be missed in the other, so the copies drift apart and one stays buggy.' },
    repeated: { level: 'Low', meaning: 'The same list or text is written in several places', impact: 'One copy gets updated and another does not, so the app shows conflicting things.' },
    size: { level: 'Low', meaning: 'A file or function does too many jobs', impact: 'It is harder to understand and change safely, so bugs hide there.' },
  },
  release: {
    lockfile: { meaning: 'The dependency lock file does not match the package list, so a clean install fails', impact: 'The build service cannot build the app, so you cannot ship.', term: t('lock file', 'The file that pins the exact version of every package so every build installs the same ones.') },
    appConfig: { meaning: 'A setting the store needs is missing or wrong', impact: 'The store can reject the app, or the build can fail.' },
    permissions: { meaning: 'The app asks for a permission without a clear reason text', impact: 'Apple rejects apps that ask for a permission without telling the user why.' },
    permissionUse: { meaning: 'A permission prompt says the app uses something less than the code does', impact: 'Apple checks that the prompt text is accurate, so the app can be rejected, and people are told less than is true.' },
    kitTests: { level: 'Low', meaning: 'A shared kit runs its tests on older versions than the app ships', impact: 'The kit can pass its own tests and still break inside the app.' },
    storeKeys: { meaning: 'A store build could ship with a test or wrong key', impact: 'Real customers could see fake or broken purchases, and App Review can reject the app.' },
    tracked: { meaning: 'A secret file is stored in the repository', impact: 'Anyone who can read the repository can read the secret, so it must be replaced.' },
    kits: { meaning: 'The kit version labels do not match the kits the app actually installs, or a newer kit exists', impact: 'You may think the app has a fix it does not, or miss one it could have.' },
    privacy: { meaning: 'The privacy policy does not mention something the app uses', impact: 'The store can reject the app, and users are not told what is collected.' },
  },
  tests: {
    untested: { level: 'Low', meaning: 'Important code that no test covers', impact: 'A change there can break something the project promises, such as a feature that stops working, without anyone noticing.' },
  },
  agents: {
    frontmatter: { meaning: "A reviewer's setup block is wrong or missing", impact: 'The reviewer may not load, may have the wrong permissions, or may be able to edit your code.' },
    sections: { meaning: 'A reviewer is missing a required section', impact: 'Its reports can be incomplete or inconsistent.' },
    references: { meaning: 'A file or reviewer is mentioned that does not exist', impact: 'A reviewer or skill will not find what it needs and will review without it.' },
    shared: { meaning: 'A reviewer does not point to the shared rules', impact: 'It may follow different rules from the others, so reports disagree.' },
    repeated: { meaning: 'The same instruction is written in several reviewers', impact: 'One copy gets updated and another does not, so reviewers behave differently.' },
    orphan: { meaning: 'No skill starts this reviewer', impact: 'It never runs.' },
    size: { meaning: 'A reviewer file is very long', impact: 'Long instructions are followed less carefully.' },
  },
  speed: {
    assets: { level: 'Low', meaning: 'An image, sound or video file is very large', impact: 'It makes the download bigger and uses a lot of memory when shown, so the app starts slower and can be closed by the phone on older devices.' },
    heavy: { meaning: 'The app uses a package known to be large', impact: 'It adds weight to every download and slows the first start, for little benefit when a smaller package does the same job.' },
    animation: { meaning: 'An animation runs on the same thread as the app logic', impact: 'When the app is busy, the animation stutters instead of staying smooth.', term: t('native driver', 'A setting that lets the phone run an animation itself, so it stays smooth even when the app is busy.') },
    cleanup: { meaning: 'Something is started and never stopped', impact: 'It keeps running after the screen is gone, draining battery and, for live database listeners, using up reads you may pay for.' },
    lists: { level: 'Low', meaning: 'A long list is drawn all at once instead of only what is on screen', impact: 'The screen opens slower and uses more memory as the list grows, until it lags or the app is closed.' },
  },
  links: {
    unguarded: { meaning: 'Text from outside the app is decoded with no safety net', impact: 'A bad link or a broken file can crash the app, and anyone can send a link.' },
    handlers: { meaning: 'Opening a link may throw away what the person was typing', impact: 'A half-written item is lost with no warning when a widget, notification or link opens another screen.' },
  },
  integrity: {
    cachedSnapshot: { meaning: 'Opened without internet, the app may take an empty saved answer as the real data', impact: 'People can see an empty list and a zero total, and the app can overwrite its own saved copy or allow a delete it should refuse.', term: t('cached answer', 'What the database library answers from the phone before the server replies. Offline, with no disk cache, it is empty.') },
    uploadRetry: { meaning: 'Saving a file on a weak or missing connection can wait up to 10 minutes', impact: 'People watch a spinner with no message, then see a failure, and may think their item is lost.' },
    storagePaths: { meaning: 'Any signed-in account can upload any number of files anywhere under its folder', impact: 'One abusive account can run up the storage bill, and the files are not tied to anything the person owns.' },
    decimalComma: { level: 'High', meaning: 'A number typed with a decimal comma is read ten or more times too big', impact: 'On phones set to a region that types "2,5", amounts or weights are saved wrong with no warning, so totals are wrong.' },
  },
  widgets: {
    lockscreen: { meaning: 'A widget or Lock Screen activity shows personal text on a locked phone', impact: 'Anyone who picks up the phone can read it, even when the person hides notification previews.', term: t('Live Activity', 'A live card on the iPhone Lock Screen and Dynamic Island, such as a countdown.') },
    timeline: { meaning: 'A widget is given a fixed list of future screens that can run out', impact: 'iOS does not ask the app for more, so the widget can show an item that has already passed.' },
  },
  mutation: {
    survivors: { meaning: 'The code was changed to be wrong, and every test still passed', impact: 'A real mistake in this spot would not be caught before release.', term: t('mutation check', 'A trial where the code is changed a little on purpose, to see whether the tests notice. Advisory: it never blocks a release.') },
  },
};

export const AREA_TITLES = { secrets: 'Secrets', forbidden: 'Banned code', structure: 'Code structure', release: 'Release readiness', tests: 'Tests', agents: 'Review agents', security: 'Security', usability: 'Usability', speed: 'Speed and cost', links: 'Links and parsing', integrity: 'Data integrity', widgets: 'Widgets and Lock Screen', mutation: 'Test strength (advisory)', design: 'Design' };

export const GATED = t('gated check', 'A check that must pass, or be accepted by you in the config, before release.');

/** What no script can see, in plain words, per area. */
export const COULD_NOT = {
  secrets: 'Secrets in the git history, in built files, or in a format no pattern knows: the scan reads only the files as they are now.',
  forbidden: 'Whether each match is really a problem: a rule is a text match, so the owner accepts the ones that are meant to be there.',
  structure: 'Whether two similar pieces of code should really be one, and how the app is wired while it runs.',
  release: 'The signed build, the live store listing and the store account settings: these need the build service and App Store Connect.',
  tests: 'Whether a test checks the right thing, and behaviour only a real phone shows (alerts firing, permissions, the keyboard).',
  agents: 'Whether each reviewer finds real problems (that needs a trial on a project with planted defects) and whether an installed plugin finds its files.',
  mutation: 'Only a sample of simple changes was tried, and some changes make no difference, so a missed change is a question for a person, not a proven gap.',
  links: 'Whether a guard before the parse already makes it safe, and what iOS does with a link while the app is closed.',
  integrity: 'How quickly an offline listener answers on a real phone, which key the number pad shows in each region, and whether the deployed rules match the file.',
  widgets: 'How iOS draws and refreshes widgets and Live Activities, StandBy and the Dynamic Island: these need a device.',
  speed: 'Launch time, smoothness, memory and battery on a real, older phone, and how the stored data grows: a script only spots patterns that often cost speed.',
};
