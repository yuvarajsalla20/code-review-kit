# Security

- [ ] No secrets in code, git history, build output or logs (private keys, service accounts, API secrets, passwords).
- [ ] `.env` and credential files are git-ignored.
- [ ] Sign-in errors do not reveal whether an email exists beyond what the provider forces.
- [ ] Destructive actions (delete account, wipe data) require recent re-authentication.
- [ ] Sign-out clears in-memory and on-device user data, including module-level maps (address caches, unsaved form drafts) and not only the stores the app registers for clearing.
- [ ] A value the app hides until a PIN or Face ID (amounts, notes) stays hidden everywhere it appears: edit forms that prefill it, keyboard bars that repeat it, exports, share sheets and notifications.
- [ ] A local secret that does not travel in backups (a PIN in the Keychain marked this-device-only) is checked together with what does travel (a sign-in session in AsyncStorage). When the session is restored but the PIN is missing, the person signs in again before a new PIN can be set.
- [ ] User input is never used to build HTML, URLs, file paths or queries without encoding.
- [ ] Links opened from the app use https and a known host.
- [ ] Uploaded images are size-limited and re-encoded; file names are not trusted.
- [ ] Third-party packages: no known critical advisories (`npm audit`), no abandoned packages on the main path.
- [ ] Logs and error messages do not include personal data or tokens.
- [ ] Privacy policy matches what the app actually collects and stores.
