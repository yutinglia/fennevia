# Testing and Recovery

## 1. Always use a dedicated development profile

Do not develop the browser shell in a daily-use profile.

The development profile should:

- contain no unrelated userChrome, userContent, or custom loader;
- contain the minimum necessary extensions;
- be reproducible from a script or documented procedure;
- permit Browser Console and Browser Toolbox use;
- have an unambiguous name such as `my-firefox-shell-dev`;
- be disposable without affecting another profile.

Before each integration test, confirm the profile path, Firefox version, build ID, channel, executable, and project commit.

## 2. Minimum test matrix

| Case | Expected result |
|---|---|
| Clean cold start | Bootstrap and process runtime initialize exactly once |
| Browser restart | Shell reconstructs without stale behavior |
| Second normal window | One shell per window; no duplicate process runtime |
| Private window | Full initialization according to policy or complete native fallback |
| Close and reopen window | Hosts, listeners, observers, mappings, and roots are cleaned up |
| Missing manifest | Native Firefox UI works; clear bootstrap error |
| Malformed manifest | Native Firefox UI works; registration failure is clear |
| Missing or broken entry | Native Firefox UI works; complete phase and stack are logged |
| Broken frontend bundle | No active gate; native UI remains usable |
| Frontend mount throws | Partial hosts are cleaned up; native UI remains usable |
| Missing stylesheet | Shell does not activate and native UI is not permanently hidden |
| Missing bridge capability | Typed failure and fail-open behavior |
| Emergency fallback | Native UI becomes visible immediately without depending on Svelte |
| Safe start | Shell activation is skipped before native UI can be hidden |
| Fullscreen | Enter and exit remain operable |
| Customize mode | Native toolbox cannot become inaccessible or corrupt the layout |
| Browser Toolbox | Shell and retained native chrome remain inspectable |
| Install, update, uninstall | Only project-owned files are changed and stock startup is restored |

Every recorded result must be `pass`, `fail`, `blocked`, or `not run`, with evidence. A check mark alone is not sufficient.

## 3. Recovery design

### Health and activation gate

Native-UI hiding must depend on `data-mfs-active`. Set it only after all required steps succeed:

1. process runtime initialized;
2. window accepted by lifecycle policy;
3. hosts created;
4. bridge capabilities validated;
5. frontend mounted;
6. stylesheet and critical UI health checks passed;
7. emergency handler registered;
8. safe-start state checked.

If any step fails:

- do not set, or immediately remove, the active attribute;
- attempt to unmount and remove project-owned UI;
- dispose partial listeners and mappings;
- log the phase and complete stack with privacy-safe context;
- do not remove or mutate core native UI.

### Emergency fallback

Provide a privileged keyboard handler that does not depend on a Svelte component, store, CSS animation, or bridge feature. It must immediately clear the active gate and reveal native UI.

Choose a binding that does not conflict with common Firefox or OS shortcuts. Document and test it on every supported platform.

### Safe start

Select at least one mechanism that can be evaluated before shell activation:

- a preference such as `myFirefoxShell.safeStart=true`;
- a sentinel file in the project profile package;
- another source-validated early mechanism.

Safe start may load minimal logging needed for diagnosis, but it must not mount or activate the custom shell.

### Hard disable and uninstall

Document a recovery procedure that does not require deleting the entire profile:

1. Close Firefox.
2. Disable or remove the project AutoConfig entry in the exact program directory.
3. Disable or rename the project manifest, or remove the project-owned profile package.
4. Apply only the validated startup-cache cleanup step if required.
5. Restart Firefox and confirm that native UI appears and Browser Console contains no project startup error.
6. Run the ownership-manifest-based uninstaller when available.

## 4. Diagnostic tools

### Browser Console

Use for AutoConfig, registration, module import, lifecycle, bridge, and frontend exceptions. Logs should have stable prefixes such as:

```text
[MFS bootstrap]
[MFS runtime]
[MFS window]
[MFS bridge]
[MFS shell]
```

Normal logs must follow the privacy policy and avoid complete browsing data.

### Browser Toolbox

Use it to:

- inspect host namespace and placement;
- inspect health attributes and computed style;
- verify that native UI still exists;
- find duplicate hosts or retained listeners;
- manually clear the active attribute as a recovery step;
- inspect focus, fullscreen, customize-mode, and popup behavior.

### Development diagnostic API

A later runtime may expose a read-only local debug object such as:

```text
window.MyFirefoxShellDebug
```

It must be development-only, must not expose sensitive browsing state, and must never become a production UI dependency.

## 5. Failure-injection policy

Development builds should provide controlled ways to simulate:

- missing manifest;
- failed module import;
- host creation failure;
- missing required capability;
- frontend mount exception;
- missing CSS;
- health-check timeout;
- disposer called twice;
- stale tab or window handle.

Failure injection must be impossible or explicitly disabled in installed production artifacts unless a documented local diagnostic mode is enabled.

## 6. Firefox stable-update procedure

For every stable update:

1. Record the last passing Firefox build and project commit.
2. Test the new build with a clean clone and development profile.
3. Start in smoke or safe-start mode before enabling native-UI hiding.
4. Run the minimum test matrix.
5. On failure, follow `docs/research-playbook.md`.
6. Update the internal dependency inventory and source references.
7. Re-enable active mode only after recovery tests pass.
8. Leave a compatibility record in an issue and move durable conclusions into documentation.

Never claim compatibility from version-number inspection alone.

## 7. Automation boundary

Suitable for automation:

- formatting, linting, typechecking, and unit tests;
- deterministic builds and artifact sanity checks;
- manifest, schema, and import-boundary checks;
- pure bridge mapping and state-reducer tests;
- install-layout and owned-file validation;
- checks for HMR, CDN, remote fonts, unexpected fetches, bare imports, and unexpected chunks.

Likely to require real Firefox smoke testing:

- AutoConfig startup;
- browser-chrome layout and namespaces;
- private and second-window lifecycle;
- native dialogs, fullscreen, customize mode, and Browser Toolbox;
- failure recovery after an installed artifact breaks.

Maintain repeatable manual procedures until reliable Firefox automation is proven. Fragile automation must not replace real evidence.
