# Windows REAL Acceptance Handoff — 2026-09-07

## Purpose

This document is the current source-of-truth handoff for the Windows 0.6.4 Iterate / Codex Desktop parity and REAL acceptance work after commit `c2f53dc` was built, downloaded, hash-verified, installed into the canonical local runtime, and manually tested by the user.

Do not treat prior CI/SOURCE PASS as REAL PASS. The user is manually testing visible UX. Fix only the failing visible items below; do not broadly retest already-passed features.

## Canonical workspace / branch

Workspace root:

`C:\Users\33553\Desktop\项目\iterate\iterate-v064-staging-pr27-verify`

Branch:

`windows-v064-staging-pr27-verify-20260901`

Canonical local runtime:

`C:\Users\33553\AppData\Local\iterate\bin`

Codex MCP config points to:

`C:\Users\33553\AppData\Local\iterate\bin\mcp-server.exe`

## Current installed candidate

Commit:

`c2f53dcb230a320b77552d1752aebed15854720e`

Short SHA:

`c2f53dc`

Commit message:

`fix(windows): stabilize popup and background MCP`

GitHub Actions run:

`34081779167`

Run conclusion:

`success`

Artifact ID:

`10004163930`

Artifact name:

`iterate-windows-v064-staging-pr27-verify`

Artifact SHA256:

`d87c0dcd01d93ac8db86b4f0243579db62ea2b87ec602a3826f27828b5fce4c8`

Candidate extraction directory:

`C:\Users\33553\Desktop\项目\iterate\downloads\candidate-v064-pr27-c2f53dc-20260907`

The installed `iterate.exe`, `mcp-server.exe`, and `WebView2Loader.dll` were hash-compared against this Artifact and matched exactly.

## What c2f53dc attempted to fix

1. First-use popup input/focus:
   - Added Windows native activation in `activate_app_window` using `ShowWindow(SW_RESTORE)`, `BringWindowToTop`, `SetForegroundWindow`, then Tauri `set_focus()`.
   - Added delayed second activation/focus retry around 450 ms for first request-visible focus.

2. Background terminal flashing:
   - Previous `95ba9db` changed `mcp-server.exe` itself to Windows GUI subsystem so the MCP server console window is hidden.
   - `c2f53dc` additionally changed the auto-checkpoint monitor's frequent `git status --porcelain --untracked-files=all` process to use Windows `CREATE_NO_WINDOW`.

3. Top `+` / Codex behavior:
   - Frontend Windows branch was changed to call `open_codex_project` and return before `open_new_codex_chat_with_text`, intended to stop `codex://new?prompt=zhi&path=...` from creating a `zhi` project/workspace.

Local verification before push:

- `node --test scripts/windows-experience-contract.test.mjs` → 25/25 PASS
- `pnpm run lint:check` → PASS
- `rustfmt --edition 2021 --check src/rust/ui/commands.rs src/rust/mcp/tools/checkpoint/mod.rs` → PASS
- Local `cargo check --lib` was not usable because the shell resolved an incompatible `link.exe`; this was an environment/toolchain issue. The cloud Windows build later succeeded, so the exact candidate compiled in CI.

## Latest user REAL test results on c2f53dc

### 1. First invocation input — FAIL

User report:

- First Iterate invocation still cannot normally enter content.
- Subsequent second invocation works.

Important conclusion:

- `request-visible + activate_app_window + native SetForegroundWindow + delayed retry` did **not** solve the REAL first-use input problem.
- Do not keep stacking more ordinary `focus()` retries without first identifying what differs between the first and second invocation.
- The symptom historically includes typing/paste/F8 becoming usable only on the second invocation, which still strongly indicates an activation/input ownership lifecycle difference rather than only textarea focus.

Recommended next investigation:

- Compare first vs second invocation runtime lifecycle and window/process state.
- Determine whether first call is handled by resident IPC or cold MCP-shell/UI startup, and whether first call has a different WebView/window activation path.
- Instrument/inspect actual foreground HWND and focus HWND before/after the first popup appears rather than guessing.
- Prefer a lifecycle/source fix (window created hidden/positioned/focused before reveal; reuse resident main window correctly) over more frontend timers.

### 2. Terminal flashing — PARTIAL PASS / STILL FAILS ON SEND

User report:

- The continuous every-few-seconds flashing problem is largely fixed.
- New current behavior: after entering content in Iterate and clicking Send, the desktop rapidly flashes terminal windows about **three times**.

Important conclusion:

- Hiding the monitor's high-frequency `git status` fixed only the polling path.
- Other Git child processes executed during send/checkpoint creation still spawn visible consoles.
- Likely paths include multiple `Command::new("git")` calls in checkpoint/autocommit/git_ops/send completion flows.

Recommended next investigation/fix:

- Trace the exact child processes created on one Send and identify the three commands.
- Do not disable checkpoint behavior.
- Apply the Windows `CREATE_NO_WINDOW` policy at the correct common Git/background-command abstraction so all background Git children in MCP/checkpoint paths inherit it, instead of patching one command at a time.
- Verify that no other shell/PowerShell child is involved before broadening the fix.

### 3. Top `+` Codex behavior — FAIL

User report:

- Clicking the top `+` still opens Codex into the `zhi` project/workspace, starts a new conversation, and puts `zhi` in the prompt box.
- Therefore the intended c2f53dc Windows frontend early-return did not change the REAL behavior.

Known evidence:

- Local Codex session history contains a `zhi` workspace/session under:
  `C:\Users\33553\Documents\Codex\2026-09-07\zhi`
- The old Windows path used `codex://new?prompt=zhi&path=<current project>`.
- The user previously confirmed `Ctrl + click` on the popup project path now correctly jumps back to the current Codex conversation. That path is REAL PASS and should not be broken.

Important conclusion:

- Do not assume the button event is hitting the edited `AppContent.vue::handleNewChat` branch simply because SOURCE says it should.
- Identify the actual handler/runtime code path used by the visible top `+` in the installed build.
- Confirm whether `navigator.platform` branching is executed in this WebView and whether another `newChat` handler or older popup path is active.
- Simplest desired Windows behavior for now: top `+` should open the current project in official Codex without creating a `zhi` workspace and without auto-prefilling/sending `zhi`, unless a clearer product requirement is intentionally chosen.
- Keep the current-conversation jump (`Ctrl + project path`) unchanged.

### 4. Speech input — REAL PASS

User report:

- Speech input is usable.

Do not modify or broadly retest this unless another change directly affects speech.

Current intended semantics remain:

- Press `Ctrl+Shift+Space` once.
- Speak.
- Stop speaking.
- Silence auto-finishes recognition.
- UI text remains concise: `正在聆听`.

### 5. Popup initially appears at desktop top-left, then jumps to center — NEW FAIL

User report:

- When Iterate is invoked, the window first appears at the top-left corner of the desktop, then moves to the center.

Desired behavior:

- It should appear directly in the intended centered position without a visible top-left flash/jump.

Recommended next investigation:

- Trace window creation/show/center ordering for the first MCP request.
- Current frontend request watcher calls `center_window` after the popup/window is already visible; that can naturally produce a visible jump.
- Prefer positioning before first visible show, or create/show the popup hidden until its initial position is known.
- Avoid cosmetic delay hacks that only mask the jump.

### 6. Closing the invoked Iterate window exits the resident Iterate app — NEW FAIL / REQUIREMENT CLARIFIED

User report:

- If the user clicks the native `X` on the invoked Iterate window, the Iterate main program exits completely.
- Then Codex cannot invoke Iterate again until the user manually starts Iterate.

Desired behavior now clarified by the user:

- Closing the currently invoked Iterate interaction must **not** kill the resident Iterate service/app needed for future Codex invocations.
- After closing/cancelling the current popup, Codex should still be able to invoke Iterate again without manually relaunching Iterate.

Important note:

- Older contract language in the repo may say the native titlebar exits the app. The latest explicit user requirement above is authoritative for this Windows workflow and should be reconciled deliberately rather than silently preserving the old contract.

Recommended product behavior:

- If an MCP interaction is active: native `X` should close/cancel/end only that interaction and hide/close the popup UI while keeping the resident Iterate process alive.
- Decide separately what `X` should mean on the standalone main window when no MCP interaction is active.
- Ensure closing an interaction also resolves the MCP request cleanly so no transport/channel hangs remain.

## Already REAL PASS / do not broadly retest

From the latest/manual rounds, keep these out of broad acceptance loops unless directly touched:

- Markdown/options
- images/files
- F8 screenshot after the popup is properly active (first-call focus relationship remains relevant, screenshot implementation itself was already PASS)
- prevent sleep
- popup content features
- restart behavior previously passed outside the new native-X resident-process issue
- multi-session
- `Ctrl + click` project path → current Codex conversation
- speech input (latest explicit PASS)

## Current highest-priority next tasks

Fix only these four failing areas, in this order unless investigation shows a dependency:

1. **Terminal flashes on Send** — trace the three child processes, then centralize hidden background Git spawning on Windows.
2. **First invocation input/focus** — compare first vs second invocation lifecycle/foreground/focus ownership; stop guessing with repeated frontend focus timers.
3. **Top `+` actual runtime path** — prove which handler is executed and remove `zhi` project/new-thread side effect on Windows.
4. **Window lifecycle UX** — center before visible show; native `X` during MCP interaction should keep the resident Iterate app alive.

The order can be adjusted if one root-cause area (for example first-call cold-start window lifecycle) explains both first-input and top-left positioning.

## Testing philosophy — must preserve

- Visible UX that takes 10–30 seconds: let the user manually test.
- Automate only hidden/safety/regression/build integrity.
- Do not build more fragile UIA/WScript/PostMessage visible-UX acceptance rigs unless diagnosing a specific failure.
- Do not rerun already-passed visible features after every build.
- After fixes: build exact Windows Artifact, download via the user's existing logged-in GitHub browser session if API auth is unavailable, verify SHA256, install exact binaries into the canonical runtime, restart only the necessary Iterate/MCP/Codex processes, then ask the user to test only the failed items.

## Safety / architecture boundaries

Do not:

- merge official PR or publish Release without explicit user request;
- modify the system `codex://` association or CodexMultiProfile registry state;
- reintroduce a generic system protocol fallback that can be hijacked;
- disable checkpoint functionality merely to suppress terminal flashes;
- change speech UI wording back to verbose explanatory text;
- delete rollback candidates/backups or `.ai-bridge` artifacts casually;
- claim SOURCE/CI PASS as REAL PASS.

Official Codex Desktop should continue to be targeted directly, and automatic Enter must remain guarded so keystrokes are never sent to the wrong foreground app.

## New-conversation acceptance target

A Windows candidate can be considered ready for closure only after the user manually confirms all of the following on the exact installed Artifact:

- first Iterate invocation immediately accepts typing and paste;
- no terminal windows flash at idle **or on Send**;
- top `+` no longer creates/opens a `zhi` project/workspace unless intentionally specified;
- `Ctrl + project path` still returns to the current Codex conversation;
- popup appears directly at the intended centered position without top-left jump;
- closing the invoked Iterate interaction does not kill the resident Iterate app, and Codex can invoke it again immediately;
- speech remains usable.

