# Iterate next-chat prompt — 2026-09-08

请接手并继续推进我本机现有的 Iterate / Windows 适配与官方 PR 项目。

## 一、不要重新创建项目

Windows 黄金工作区：

`C:\Users\33553\Desktop\项目\iterate\iterate-v064-staging-pr27-verify`

黄金分支：

`windows-v064-staging-pr27-verify-20260901`

黄金 commit：

`d991c66ccf1e5b54dc4dfdc9c8318dca8b5ffbeb`

官方仓库：

`https://github.com/co-iterate/iterate-desktop`

我的 fork：

`https://github.com/xiaohuihui-619/iterate-desktop`

不要 reset / clean / recreate 黄金工作区，不要把当前黄金分支直接作为一个大 PR 提交，也不要覆盖或丢失我本地已有的无关修改。

## 二、开始后先以磁盘和 GitHub 事实恢复上下文

优先完整读取：

1. `docs/ITERATE_PROJECT_HANDOFF_2026-09-08.md`
2. `docs/WINDOWS_REAL_ACCEPTANCE_HANDOFF_2026-09-07.md`（只作为历史调查记录；当前事实以 9/8 handoff 为准）
3. `CONTRIBUTING.md`

然后检查：

- 当前黄金分支 / commit / git status；
- `origin` 和 `userfork` 当前 refs；
- 官方 `release/windows-v0.6.4-staging` 最新状态；
- 官方 PR #27、#28、#29、#30、#31 当前状态；
- 特别检查 PR #31 是否已经被管理员批准 Actions、Windows Rust compile gate 是否真正运行、是否有 reviewer 评论或需要修改。

## 三、当前已知 Windows 基线

我的本机正式 runtime：

`C:\Users\33553\AppData\Local\iterate\bin`

Codex MCP 使用：

`C:\Users\33553\AppData\Local\iterate\bin\mcp-server.exe`

最终黄金 Windows build 对应 `d991c66`，已经 CI 构建、Artifact 哈希核验、安装，并由我本人做过 REAL 测试。当前相关 Windows 功能基本 PASS，可以作为我日常使用版本。

不要把旧的 2026-09-07 FAIL 清单误当作现在的状态。

## 四、当前官方 PR 状态

### PR #27

`https://github.com/co-iterate/iterate-desktop/pull/27`

`fix(windows): stabilize startup, popup replies, and keyboard focus`

对应我的 fork 分支：

`fix/windows-runtime-input-stability`

不要把后续其他功能继续硬塞进 #27。

### PR #31 — 当前最高优先级

`https://github.com/co-iterate/iterate-desktop/pull/31`

标题：

`feat(windows): add native global speech input`

base：

`release/windows-v0.6.4-staging`

head：

`xiaohuihui-619:pr/windows-native-speech`

commit：

`35a119bfc0bfeaec970c7904b865ef3202840ca8`

这条 PR 已经由 ChatGPT 直接创建，并已经从 Draft 改成 Ready for Review。GitHub GraphQL/timeline 已确认 `isDraft=false`、OPEN、MERGEABLE。

本地验证已经通过 lint/build/frontend/scripts/windows-experience/speech-services/OSS/diff/rustfmt 等。

当前唯一已知外部阻塞：

- upstream `Cross-Platform Impact` workflow 被触发；
- 结果为 `action_required`；
- 原因是 fork PR 的 Actions 需要 co-iterate 仓库管理员批准；
- 用我的 GitHub 身份尝试批准时 GitHub 返回 HTTP 403：`Must have admin rights to Repository.`

所以新对话开始后，第一件事就是检查这个状态是否已经变化。如果管理员已经批准，就继续跟踪 Windows/MSVC compile gate；若 CI 失败，直接定位并修 `pr/windows-native-speech` 分支、重新 push；如果 CI 全绿，再看 reviewer 评论并继续推进到可合并状态。

不要因为 CI 还没跑就把它误报为代码失败，也不要在 `action_required` 时声称 CI PASS。

## 五、后续 Windows PR 原则

完整黄金分支是“已真人验收的行为参考”，不是直接上游 PR 分支。

后续应继续把黄金版按独立功能抽成干净 PR，例如：

1. Windows 后台子进程 / terminal flash 隐藏；
2. Explorer clipboard + native file/folder picker；
3. Windows screenshot（最终 GDI 实现）；
4. Windows prevent-sleep；
5. Windows Codex Desktop integration：thread/project 跳转和顶部 `+` 的项目/非项目语义；
6. popup lifecycle/focus 中官方 #28/#29/#30 尚未覆盖的 delta。

每准备一条 PR 前，都先 fetch 最新 upstream，检查官方已有 PR 是否已合并/修改，避免重复实现。只提交最终 delta，不机械 cherry-pick 我们历史探索过程中的所有 commit。

`.ai-bridge`、本机安装脚本、Artifact、exe/zip、本地 runtime 状态、验收 handoff 等不要进入官方 feature PR。

如果 GitHub PR 创建、更新、评论等可以通过我现有已认证的 GitHub 凭据安全完成，就直接替我推进，不要停下来让我手动点网页。永远不要打印或暴露 token / credential。

## 六、Android 是下一阶段，但先找真实源码仓库

我和可鑫开会时了解到：当前项目整体主要在推进 Android；Windows 语音是明确可以上传 PR 的方向。

公开 `iterate-desktop` 仓库目前只能看到 Android roadmap（Issue #22）等规划级内容，不能据此认定 Android 客户端源码就在 `iterate-desktop`。

所以准备开始 Android 时：

1. 先找到项目实际使用的 Android 源码仓库；
2. 确认 GitHub remote / 本地目录 / 当前分支 / README / 架构 / 构建方式；
3. 以该仓库磁盘和 runtime 事实恢复上下文；
4. 再决定 Android v0 怎么推进；
5. 不要为了“开始 Android”就在 `iterate-desktop` 里凭空创建一套 Android 工程。

如果 Android 确实是另外的 repo，就把它视为单独代码库，但注意和 Desktop / Bridge 的协议兼容。

## 七、工作方式

- 默认自主推进，不要只给计划然后停下来让我说“继续”。
- 可以直接做 GitHub PR 准备、创建、更新、CI 跟踪和必要修复。
- 区分 SOURCE PASS / CI PASS / REAL PASS。
- 对已经 REAL PASS 的 Windows 功能不要无意义地反复全量人工验收。
- 不要强杀 Codex/Iterate 进程，除非我明确授权或确有必要且先说明。
- 不要 merge 官方 PR，除非我明确要求且账号有权限。
- 如果遇到真正只能由上游管理员/可鑫处理的权限门槛，明确指出具体操作和证据，然后继续推进其他不依赖该权限的工作。

本次新对话的主要目标：

**继续把 Windows 适配成果有序贡献回官方，首先把 PR #31 推到 CI / review / merge-ready；同时逐步确认下一个值得提交的 Windows PR，并开始定位真正的 Android 源码仓库，为 Android 开发接手做准备。**
