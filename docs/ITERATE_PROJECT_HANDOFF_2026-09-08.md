# Iterate Project Handoff — 2026-09-08

## 1. Purpose / source of truth

This is the current handoff for the user's local Iterate Windows parity work and upstream PR contribution work as of 2026-09-08.

For current status, prefer this document over the older historical handoff:

- `docs/WINDOWS_REAL_ACCEPTANCE_HANDOFF_2026-09-07.md`

The 2026-09-07 document is still useful as investigation history, but its early FAIL/PASS snapshot is superseded by the later Windows REAL acceptance described here.

## 2. Canonical Windows golden workspace

Canonical workspace:

`C:\Users\33553\Desktop\项目\iterate\iterate-v064-staging-pr27-verify`

Golden branch:

`windows-v064-staging-pr27-verify-20260901`

Golden commit:

`d991c66ccf1e5b54dc4dfdc9c8318dca8b5ffbeb`

Commit message:

`fix(windows): hide cold-start knowledge sync console`

Fork remote:

`https://github.com/xiaohuihui-619/iterate-desktop.git`

Upstream remote:

`https://github.com/co-iterate/iterate-desktop.git`

The golden branch is also pushed to the user's fork:

`xiaohuihui-619/iterate-desktop:windows-v064-staging-pr27-verify-20260901`

Do not confuse this with the fork's default `main`. The golden Windows build is the branch above, not `userfork/main`.

## 3. Canonical installed Windows runtime

Installed runtime:

`C:\Users\33553\AppData\Local\iterate\bin`

Codex MCP config points to:

`C:\Users\33553\AppData\Local\iterate\bin\mcp-server.exe`

The exact `d991c66` Artifact was downloaded, SHA256-verified, backed up, and installed into this canonical runtime without forcibly killing Codex/Iterate processes.

Latest candidate hashes:

- `iterate.exe`: `AD2642BDFBBB1014657FCC823980C83A71CC48326D439DA16AED12EF70B3AAD5`
- `mcp-server.exe`: `B6BF2ECDDC80731834ED44C5858E87F544DE035E4C2312FBAA902DBA989F409A`
- `WebView2Loader.dll`: `8427B1FC58EC707813E5C0A51EB5D69397BB333250A7B891BE4D3B123F1E0F1C`

Backup made before that install:

`C:\Users\33553\AppData\Local\iterate\backups\pre-d991c66-20260908-001940`

CI / Artifact for the final golden build:

- GitHub Actions run: `34140393420`
- conclusion: `success`
- Artifact ID: `10026202011`
- Artifact digest: `sha256:5d600f567316e3baa26f2fa2c2ec5a535dc7148c1a4805cef3621977707a04f8`

## 4. Windows REAL acceptance status

The user manually tested the final Windows build and reported that the relevant changed functionality was basically PASS.

Important REAL conclusions:

- Windows speech: REAL PASS.
- Project / standalone top `+` behavior: REAL PASS in the final round.
- Ctrl + click project/conversation navigation: REAL PASS.
- Popup / interaction behavior exercised in the final Windows build: broadly PASS.
- The remaining terminal flash on the first `zhi` invocation was traced to a cold-start `.cunzhi-knowledge` `git pull` in `src/bin/mcp-server.rs` using raw `Command::new("git")`.
- `d991c66` changed that cold-start Git process to the existing Windows `CREATE_NO_WINDOW` background-command helper.
- After installing/restarting and testing the final build, the user reported the relevant functionality basically PASS.

Do not revert to the earlier 2026-09-07 FAIL list as the current acceptance state.

## 5. First-principles Windows conclusion

The Windows port is not a literal 1:1 copy of macOS internals. It should preserve product-level parity while using native Windows mechanisms.

Examples:

- macOS speech: Fn / Apple Speech / Accessibility / Input Monitoring.
- Windows speech: `Shift+Ctrl+Space` / local `System.Speech` / Win32 foreground window + writeback.

The user's golden branch should be treated as the current Windows reference implementation for behavior that was manually accepted.

## 6. Upstream PR status

### PR #27 — existing Windows stability PR

Official PR:

`https://github.com/co-iterate/iterate-desktop/pull/27`

Title:

`fix(windows): stabilize startup, popup replies, and keyboard focus`

Head branch in the user's fork:

`fix/windows-runtime-input-stability`

This PR predates the later golden-branch work. Do not stuff unrelated later features into #27.

### PR #31 — Windows native speech

Official PR:

`https://github.com/co-iterate/iterate-desktop/pull/31`

Title:

`feat(windows): add native global speech input`

Base:

`release/windows-v0.6.4-staging`

Head:

`xiaohuihui-619:pr/windows-native-speech`

Commit:

`35a119bfc0bfeaec970c7904b865ef3202840ca8`

This PR was deliberately extracted from the golden implementation as a clean feature slice rather than cherry-picking the historical mixed Windows parity commit.

PR scope is Windows speech only:

- `Shift+Ctrl+Space` global dictation shortcut.
- local `System.Speech.Recognition.SpeechRecognitionEngine`.
- Windows speech overlay/state events.
- capture original foreground HWND.
- reuse Iterate's existing speech post-processing / memory writeback pipeline.
- restore/write processed text to the original target window.
- Windows-specific speech capability UI instead of pretending macOS permission semantics apply.
- Windows background PowerShell uses `CREATE_NO_WINDOW`.

Explicitly excluded from PR #31:

- screenshot support;
- Codex top `+` integration;
- file/folder picker work;
- prevent-sleep;
- MCP lifecycle fixes;
- unrelated terminal-flash fixes;
- `.ai-bridge` files;
- installers / Artifacts / local acceptance handoff files.

PR #31 local verification on the extracted branch:

- `pnpm run lint:check` — PASS
- `pnpm run build` — PASS
- `pnpm run test:frontend` — PASS
- `pnpm run test:scripts` — PASS
- `pnpm run test:windows-experience` — 14/14 PASS
- `pnpm run test:speech-services` — 36/36 PASS
- `pnpm run test:desktop-oss-readiness` — PASS
- `pnpm run oss:check` — PASS
- `git diff --check` — PASS
- `rustfmt --check` on all Rust files changed by #31 — PASS

Local full Rust linking is not authoritative on this PC because `where link.exe` resolves only:

`D:\Git\usr\bin\link.exe`

and no usable local MSVC linker was found.

The official PR triggered the upstream `Cross-Platform Impact` workflow, which is configured to run a Windows Rust compile gate (`cargo check --locked --lib --bin mcp-server`) when Rust/Cargo files change.

Current external block:

- workflow conclusion is `action_required` because this is a fork PR and the upstream repository requires an administrator to approve the workflow run;
- attempting to approve it with the user's GitHub identity returned HTTP 403: `Must have admin rights to Repository.`

Therefore this is a genuine upstream-maintainer/admin gate, not a current source-code failure.

PR #31 was moved to Ready for Review. GitHub GraphQL/timeline confirmed:

- `isDraft = false`
- state `OPEN`
- `mergeable = MERGEABLE`
- `ready_for_review` event recorded for `xiaohuihui-619`

Do not claim CI green until an upstream admin approves the fork Actions run and the actual Windows compile gate finishes.

## 7. Recommended remaining Windows PR extraction plan

Do not PR the entire golden branch directly. It is a verification/reference branch containing many cumulative commits and is too broad for upstream review.

Continue extracting focused PRs from the final golden behavior, roughly along these boundaries:

1. Background Windows child processes / console-flash suppression.
2. Windows file input parity: Explorer clipboard + native file/folder picker.
3. Windows screenshot support (final GDI implementation + relevant shortcut behavior).
4. Windows prevent-sleep support.
5. Windows Codex Desktop integration: exact thread/project return and correct top `+` project/standalone semantics.
6. Popup lifecycle/focus delta not already covered by upstream PRs #28/#29/#30.

Before preparing each PR, re-fetch upstream and compare against whatever #28/#29/#30 or newer changes have landed. Submit only the remaining delta; do not duplicate upstream work.

Use the golden branch as behavioral reference, not as the PR base.

## 8. Public upstream project context observed on 2026-09-08

The upstream desktop repository currently still has the Windows staging branch:

`release/windows-v0.6.4-staging`

At the time of this handoff, open PRs included Windows/MCP work (#27–#31).

The user reports from an internal meeting with 可鑫 that Windows speech is an acceptable contribution target and that current project attention is mainly moving toward Android.

Public GitHub evidence for Android in this desktop repository is currently only planning-level:

- Issue #22 is an Android roadmap / first usable version plan.
- Public roadmap language says Android is still planned / not implemented there and no usable APK is available from this desktop repository.
- A public branch only links that roadmap into README; it is not evidence of the Android client implementation itself.

Therefore, for Android work:

- do **not** start implementing Android inside `iterate-desktop` merely because Issue #22 exists;
- first identify the actual Android source repository used by the project/team;
- confirm its canonical local/remote repo and current architecture;
- then recover context from that repository before changing code.

If the Android source is in another repository, treat it as a separate codebase while preserving product/protocol compatibility with Iterate Desktop / Bridge.

## 9. Fork / branch model — important

The user's fork is:

`xiaohuihui-619/iterate-desktop`

It contains multiple branches with different roles:

- `windows-v064-staging-pr27-verify-20260901` — full Windows golden/reference branch used by the user.
- `fix/windows-runtime-input-stability` — clean upstream PR #27 branch.
- `pr/windows-native-speech` — clean upstream PR #31 branch.
- other Windows verification / focused branches may exist.

Do not say that the fork's `main` itself is the user's complete Windows port. The complete accepted Windows reference is the golden branch above.

## 10. Safety / workflow rules for the next chat

- Preserve the golden workspace and branch. Do not reset, clean, recreate, or squash it away.
- Preserve unrelated user changes; never stage them into an upstream PR.
- Do not submit `.ai-bridge`, local installers, downloaded Artifacts, local runtime state, or handoff-only documents to upstream feature PRs.
- Do not claim source/CI PASS as REAL PASS.
- Do not claim upstream CI PASS while the workflow is still `action_required`.
- When a PR can be created/updated via the user's authenticated GitHub credentials, perform it directly rather than telling the user to click it manually.
- Never expose or print GitHub credentials/tokens.
- Do not merge an upstream PR unless the user explicitly asks and the account has permission.
- For Android, first locate/recover the real Android repository before implementing anything.

## 11. Immediate next actions

Recommended next-chat order:

1. Re-read this handoff and inspect disk/runtime facts.
2. Check official PR #31 current status first:
   - whether upstream admin approved Actions;
   - whether the Windows Rust compile gate ran;
   - whether maintainers left review comments;
   - fix/update the PR branch if needed.
3. Check #27 and other open Windows PRs for changed/merged status.
4. Continue extracting the next highest-value clean Windows PR from the golden branch only when it does not duplicate upstream work.
5. In parallel or after the current PR queue is stable, identify the actual Android source repository. Do not assume `iterate-desktop` is the Android implementation repo.

The user's current strategic direction is: finish pushing appropriate Windows fixes upstream, while preparing to move development attention toward the actual Android codebase once its source repository is identified.
