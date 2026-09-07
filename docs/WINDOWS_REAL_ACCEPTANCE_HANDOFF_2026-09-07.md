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

## Follow-up source investigation — 2026-09-07 (not a new REAL result)

The user narrowed the current agent's responsibility to root-cause investigation and critical fixes; another agent can perform packaging, comprehensive build checks, push, Artifact download, and installation. The changes below are **uncommitted source changes**, not an installed candidate. The installed files remain the hash-verified `c2f53dc` files described above. Do not overwrite the original manual FAIL/PASS results with these source findings.

### Confirmed actual call path, correcting the initial IPC hypothesis

The registered binary implements `call_zhi` in `src/bin/mcp-server.rs`, which calls the HTTP dialog service. `src/rust/app/cli.rs::handle_serve_mode` handles those dialogs by spawning a separate GUI child for every request. This is distinct from the library's `src/rust/mcp/handlers/popup.rs` resident TCP IPC path.

Existing local evidence in `C:\tmp\iterate-instance-debug.log` shows:

- At `2026-09-07 12:42:23`, serve PID `37172` started popup PID `41820`.
- The same serve PID subsequently started popup PIDs `33940`, `36244`, `46024`, and `31904` for separate requests.
- The spawn records resolve the GUI executable to `C:\Users\33553\AppData\Local\iterate\bin\iterate.exe`.

Therefore first-versus-second input failure must not be explained as reuse of the same GUI HWND on this actual path. Compare separate GUI startups under the same serve, including WebView2 input ownership and initialization. The helper-script window manager was not running in the process snapshot. The old diagnostic helper still hard-codes `.local\bin`; do not mistake its old path for the installed runtime.

### Critical source fixes prepared

1. **Native X and resident survival.** The prior native handler called `handle_system_exit_request(..., true)`, which sets global shutdown/manual-stop state and terminates registered instances. Windows now delegates native close to the current frontend request. Active interaction close uses the existing structured `popup_closed` response and existing per-request response routing. It does not use raw `CANCELLED`: the actual serve response parser can interpret that string as empty input with `keep_going: true`. A standalone GUI exits through the existing response completion path, leaving `iterate --serve` alive. A resident GUI hides and ends its current request without draining other channels. An in-flight Send/close is ignored rather than being turned into global exit. Idle-main-window close retains its previous exit semantics, with a backend pending-request recheck.

2. **Position before first reveal.** Windows standalone GUI no longer calls `show()` from builder setup before the frontend has loaded its request. Windows native-close listeners are registered before `checkMcpMode`. The existing `McpPopup` request watcher then calls `center_window`, whose order is position, unminimize, show, focus. No new timer or post-show repositioning was added. Ordinary Windows main-window launch also calls the same center-before-show operation. macOS setup/show behavior is preserved.

3. **Window versus WebView focus API.** Verified against the locally installed `@tauri-apps/api` JavaScript implementation: `WebviewWindow` mixes in `[Window, Webview]` without overwriting existing methods. Consequently `getCurrentWebviewWindow().setFocus()` invokes `plugin:window|set_focus`, not `plugin:webview|set_webview_focus`. The existing `PopupInput.focusInput` was only explicitly focusing the top-level window before its DOM textarea. Windows now additionally awaits `getCurrentWebview().setFocus()` before DOM focus. This fixes the actual API-target mismatch; it does **not** prove it was the sole cause of the user's first-call failure. No additional focus timer was introduced. Speech recognition and speech UI logic were not changed.

### Diagnostic points that work on the actual serve path

The actual serve launcher sets `RUST_LOG=off` on GUI children and discards stdout/stderr. Ordinary `log::info!` / frontend `debug_log` instrumentation is therefore insufficient.

New evidence uses the existing direct-file timeline logger at:

`C:\Users\33553\Library\Logs\iterate\timeline-debug.log`

- `windows-real/PopupHeader.plus`: actual top-button entry and `navigator.platform` / project path.
- `windows-real/AppContent.handleNewChat`: selected frontend route and resolved project path.
- `windows-real/open-project`, `project-launcher`, `deeplink-launcher`: native route, PID, official executable, and target.
- `windows-real/input`: activation-before/after and explicit WebView-focus checkpoints, including GUI PID/TID, top HWND, foreground HWND, `GetGUIThreadInfo` active/focus HWND, and standalone status.

Top `+` behavior has **not** been guessed at or rewritten again. Correlate these records for one actual click before selecting its fix. Ctrl-click project-path routing remains unchanged.

### Still unresolved / do not claim fixed

- **Send terminal flashes:** the actual `call_zhi` completion calls `record_conversation`, which reaches the conversation logger's `hostname`, `git add`, and `git commit`. This is a strong source lead for three flashes, not an observed process trace. Checkpoint creation also has unhidden Git commands, but it occurs before the dialog in this actual call path. No checkpoint/Git command patches were made during this investigation. First capture actual Send children, then centralize the background command policy across the confirmed logger/checkpoint paths; preserve checkpoint behavior.
- A probe of `Win32_ProcessStartTrace` subscription was denied under the non-administrator token. No permissions or system audit settings were changed. `.ai-bridge/capture-real-process-focus.py` is an untracked bounded read-only polling aid; it can miss short-lived processes, so an empty sample does not prove no children were created. Do not submit or publish `.ai-bridge`.
- First-call input, initial position, native X, and top `+` have no new REAL verdict. The first three have source changes; `+` has instrumentation only.

### Verification and next executor

- `pnpm run test:windows-experience` — **35/35 passed**. Includes new close-decision behavior tests, a test against the actual Tauri method identities, and targeted source contracts. These new checks were added to this existing package script so CI executes them.
- `PopupHeader.codexProjectOpen.test.ts` — **2/2 passed** during this investigation.
- ESLint on all changed frontend files — passed; a full lint run initially exposed the new Node test imports, which were corrected using the repository's existing per-file convention.
- `rustfmt --edition 2021 --check src/rust/ui/commands.rs src/rust/ui/window_events.rs src/rust/app/builder.rs` — passed.
- Rust compilation and Windows build are **not verified for these changes**. A worker hit an account usage limit and its unfinished patch was reviewed and corrected by the main agent; do not assume the worker completed compilation. An incidental Cargo.lock edit was removed.

Next executor: retain this workspace/branch and uncommitted diff; inspect it, run the targeted checks and Windows compile/build, then follow the existing commit/push/exact-Artifact/hash/backup/install process. Do not build from the unchanged HEAD and call it this fix. Do not merge upstream or publish a Release. After installation ask only for the changed failures; obtain one `+` click's route evidence and one Send process trace as diagnosis, without retesting previously passed content/speech features. Full success remains dependent on user REAL acceptance.
