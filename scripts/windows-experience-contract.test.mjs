import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
}

test('Windows registry liveness check does not spawn tasklist', () => {
  const registry = source('src/rust/ui/window_registry.rs')
  assert.doesNotMatch(registry, /Command::new\("tasklist"\)/)
  assert.match(registry, /OpenProcess\(PROCESS_QUERY_LIMITED_INFORMATION/)
})

test('bridge health probe uses reqwest only on Windows and preserves the Unix curl path', () => {
  const setup = source('src/rust/app/setup.rs')
  assert.match(setup, /#\[cfg\(target_os = "windows"\)\]\s*fn bridge_http_healthy[\s\S]*?reqwest::blocking::Client::builder/)
  assert.match(setup, /#\[cfg\(not\(target_os = "windows"\)\)\]\s*fn bridge_http_healthy[\s\S]*?command_stdout\("curl"/)
})

test('Windows root tunnel diagnostics use native HTTP and hide fallback child consoles', () => {
  const bridge = source('src/rust/bridge/ws.rs')
  const start = bridge.indexOf('async fn inspect_root_tunnel_runtime()')
  const end = bridge.indexOf('async fn diagnostic_command_stdout', start)
  assert.ok(start >= 0 && end > start)
  const rootTunnel = bridge.slice(start, end)

  assert.match(rootTunnel, /probe_root_tunnel_ha_connections\(ROOT_TUNNEL_METRICS_URL\)/)
  assert.doesNotMatch(rootTunnel, /diagnostic_command_stdout\(\s*"sh"/)
  assert.match(bridge, /fn parse_root_tunnel_ha_connections[\s\S]*?tunnel_ha_connections/)
  assert.match(bridge, /async fn diagnostic_command_stdout[\s\S]*?#\[cfg\(target_os = "windows"\)\][\s\S]*?CREATE_NO_WINDOW[\s\S]*?as_std_mut\(\)\.creation_flags/)
})

test('Windows shows the main window before background setup while non-Windows keeps blocking setup', () => {
  const builder = source('src/rust/app/builder.rs')
  const showIndex = builder.indexOf('window.show()')
  const setupIndex = builder.lastIndexOf('start_application_setup(app_handle)')
  assert.ok(showIndex >= 0 && setupIndex > showIndex)
  assert.match(builder, /#\[cfg\(target_os = "windows"\)\][\s\S]*?start_application_setup\(app_handle\)/)
  assert.match(builder, /#\[cfg\(not\(target_os = "windows"\)\)\][\s\S]*?async_runtime::block_on/)
})

test('Windows speech startup failure degrades without blocking the main application', () => {
  const app = source('src/frontend/App.vue')
  const windowsFallback = /if \(windowsPlatform\) \{\s*try \{\s*await speechRuntimeHost\.initialize\(\)\s*\}\s*catch \(error\) \{([\s\S]*?)\}\s*\}\s*else \{\s*await speechRuntimeHost\.initialize\(\)\s*\}/
  const fallbackMatch = windowsFallback.exec(app)

  assert.ok(fallbackMatch, 'speech initialization should degrade only on Windows')
  assert.match(fallbackMatch[1], /console\.warn\('语音运行时初始化失败，主界面将继续启动:', error\)/)
  assert.match(fallbackMatch[1], /onMounted:speechRuntimeDegraded/)
  assert.doesNotMatch(fallbackMatch[1], /\breturn\b/)

  const mcpShellIndex = app.indexOf('if (mcpLaunchContext.value.isMcp)')
  const mcpInitializeIndex = app.indexOf('await initializeApplication({ mcpShell: true })', mcpShellIndex)
  const mcpReturnIndex = app.indexOf('return', mcpInitializeIndex)
  const speechFallbackIndex = fallbackMatch.index
  const speechFallbackEnd = speechFallbackIndex + fallbackMatch[0].length
  const activationGateIndex = app.indexOf('const activationGateRequired = await requiresActivationGate()', speechFallbackIndex)
  const initializeApplicationIndex = app.indexOf('await initializeApplication()', activationGateIndex)
  const speechInitializeIndexes = [...app.matchAll(/await speechRuntimeHost\.initialize\(\)/g)].map(match => match.index)
  const activationGateCalls = [...app.matchAll(/await requiresActivationGate\(\)/g)]

  assert.ok(mcpShellIndex >= 0 && mcpInitializeIndex > mcpShellIndex, 'MCP shell should initialize the popup application')
  assert.ok(mcpReturnIndex > mcpInitializeIndex && mcpReturnIndex < speechFallbackIndex, 'MCP shell should return before speech startup')
  assert.doesNotMatch(app.slice(mcpShellIndex, mcpReturnIndex), /speechRuntimeHost\.initialize|requiresActivationGate/)
  assert.equal(speechInitializeIndexes.length, 2, 'startup should contain only the Windows and non-Windows speech calls')
  assert.ok(
    speechInitializeIndexes.every(index => index >= speechFallbackIndex && index < speechFallbackEnd),
    'all speech initialization calls should stay inside the platform fallback block',
  )
  assert.equal(activationGateCalls.length, 1, 'startup should perform exactly one activation gate call')
  assert.ok(activationGateIndex > speechFallbackIndex, 'activation checks should continue after degraded speech startup')
  assert.ok(initializeApplicationIndex > activationGateIndex, 'main application initialization should remain reachable')
})

test('window registry cleanup runs off the UI thread at low frequency', () => {
  const events = source('src/rust/ui/window_events.rs')
  const builder = source('src/rust/app/builder.rs')
  assert.match(events, /WINDOW_REGISTRY_CLEANUP_INTERVAL[^;]*Duration::from_secs\(5 \* 60\)/s)
  assert.match(events, /start_window_registry_cleanup_task[\s\S]*spawn_blocking[\s\S]*get_all_instances/)
  assert.match(builder, /start_window_registry_cleanup_task\(\)/)
})

test('close flow exits without recursively closing the window', () => {
  const exit = source('src/rust/ui/exit.rs')
  const lifecycle = source('src/rust/app/windows_lifecycle.rs')
  assert.match(exit, /exit_in_progress\.swap/)
  assert.match(exit, /#\[cfg\(target_os = "windows"\)\][\s\S]*?window\.hide\(\)/)
  assert.match(exit, /#\[cfg\(not\(target_os = "windows"\)\)\][\s\S]*?window\.close\(\)/)
  assert.match(exit, /request_global_shutdown\(\)/)
  assert.match(lifecycle, /CreateEventW/)
  assert.match(lifecycle, /QueryFullProcessImageNameW/)
  assert.match(lifecycle, /GetProcessTimes/)
  assert.match(lifecycle, /OpenProcessToken/)
  assert.match(lifecycle, /GetTokenInformation/)
  assert.match(lifecycle, /TerminateProcess/)
  assert.doesNotMatch(lifecycle, /taskkill|tasklist|Stop-Process|Command::new/)
})

test('frontend and package defaults preserve macOS behavior', () => {
  const app = source('src/frontend/App.vue')
  const content = source('src/frontend/components/AppContent.vue')
  const settings = source('src/frontend/composables/useSettings.ts')
  const pkg = JSON.parse(source('package.json'))
  assert.match(app, /windowsPlatform && startupStatus\.phase !== 'ready'/)
  assert.match(content, /\? 'iterate'\s*: `iterate - \$\{resolvedProjectPath\}`/)
  assert.match(settings, /if \(!windowsPlatform\)[\s\S]*?reloadAllSettings\(\)/)
  assert.equal(pkg.scripts.tauri, 'cargo tauri')
  assert.equal(pkg.scripts['tauri:build'], 'cargo tauri build')
})

test('manual close blocks automatic zhi startup until a shortcut launch clears it', () => {
  const lifecycle = source('src/rust/app/windows_lifecycle.rs')
  const main = source('src/rust/main.rs')
  const mcpServer = source('src/bin/mcp-server.rs')
  assert.match(lifecycle, /args\.len\(\) != 1/)
  assert.match(lifecycle, /remove_file\(manual_stop_path\(\)\)/)
  assert.match(main, /activate_manual_launch_if_requested/)
  assert.match(mcpServer, /is_manually_stopped\(\)/)
  assert.match(mcpServer, /MANUALLY_STOPPED_MESSAGE/)
})

test('explicit conversation end is exact and is normalized at the response boundary', () => {
  const command = source('src/rust/conversation/end_command.rs')
  const cli = source('src/rust/app/cli.rs')
  const interaction = source('src/rust/mcp/tools/interaction/mcp.rs')
  const popup = source('src/frontend/components/popup/PopupInput.vue')
  const frontendCommand = source('src/frontend/utils/conversationEndCommand.ts')
  assert.match(command, /"结束对话"/)
  assert.match(command, /"\/end"/)
  assert.match(command, /eq_ignore_ascii_case/)
  assert.match(command, /selected_options[\s\S]*?is_explicit_conversation_end/)
  assert.match(cli, /keep_going: !interaction_ended/)
  assert.match(cli, /EXPLICIT_CONVERSATION_END_SOURCE/)
  assert.match(cli, /POPUP_CLOSED_SOURCE/)
  assert.match(interaction, /继续对话: false/)
  assert.match(popup, /输入“结束对话”或 \/end 可结束本次交互/)
  assert.match(frontendCommand, /isExplicitConversationEndInput/)
  assert.ok(
    popup.indexOf('isExplicitConversationEndInput(clipboardText)')
    < popup.indexOf('extractClipboardPaths(clipboardText)'),
    'explicit end commands must bypass clipboard path attachment handling',
  )
  assert.match(
    popup,
    /!isExplicitConversationEndInput\(userInput\.value\)[\s\S]*?generateConditionalContent\(\)/,
    'explicit end commands must reach the Rust response boundary without appended context',
  )
})

test('popup close ends only the current interaction while the native titlebar still exits', () => {
  const header = source('src/frontend/components/popup/PopupHeader.vue')
  const content = source('src/frontend/components/AppContent.vue')
  const app = source('src/frontend/App.vue')
  const handler = source('src/frontend/composables/useMcpHandler.ts')
  const windowEvents = source('src/rust/ui/window_events.rs')
  assert.match(header, /closeCurrentDialog/)
  assert.match(header, /结束当前对话（iterate 继续运行）/)
  assert.match(content, /mcpCloseCurrentDialog/)
  assert.match(app, /mcp-close-current-dialog/)
  assert.match(handler, /handleMcpCloseCurrentDialog/)
  assert.match(handler, /source: 'popup_closed'/)
  assert.match(handler, /resolvingRequestIds/)
  assert.match(windowEvents, /handle_system_exit_request[\s\S]*?true/)
})

test('Windows reqwest enables HTTP2 when ALPN can negotiate h2', () => {
  const cargo = source('Cargo.toml')
  assert.match(
    cargo,
    /\[target\.'cfg\(target_os = "windows"\)'\.dependencies\][\s\S]*?reqwest = \{[\s\S]*?features = \[[\s\S]*?"native-tls-alpn"[\s\S]*?"http2"[\s\S]*?\]/,
  )
})

test('Windows popup movement skips the blur-focus IME position hack', () => {
  const popupInput = source('src/frontend/components/popup/PopupInput.vue')
  assert.match(popupInput, /const windowsPlatform = typeof navigator !== 'undefined' && navigator\.platform\.toUpperCase\(\)\.includes\('WIN'\)/)
  assert.match(
    popupInput,
    /webview\.onMoved\(\(\) => \{[\s\S]*?if \(windowsPlatform\)[\s\S]*?return[\s\S]*?fixIMEPosition\(\)/,
  )
})

test('Windows bundle uses a current-user NSIS installer', () => {
  const config = JSON.parse(source('tauri.conf.json'))
  assert.equal(config.bundle.windows.nsis.installMode, 'currentUser')
})

test('Windows package smoke waits for the GUI-subsystem activation probe and captures its output', () => {
  for (const path of [
    'scripts/windows-install-smoke.ps1',
    'scripts/windows-installer-smoke.ps1',
  ]) {
    const smoke = source(path)
    assert.match(smoke, /System\.Diagnostics\.ProcessStartInfo/, path)
    assert.match(smoke, /UseShellExecute\s*=\s*\$false/, path)
    assert.match(smoke, /RedirectStandardOutput\s*=\s*\$true/, path)
    assert.match(smoke, /RedirectStandardError\s*=\s*\$true/, path)
    assert.match(smoke, /WaitForExit\(\)/, path)
    assert.doesNotMatch(smoke, /\$ActivationProbe\s*=\s*&/, path)
  }
})

test('Windows popup shortcuts use the new defaults and safely migrate only the complete legacy set', () => {
  const settings = source('src/rust/config/settings.rs')
  const storage = source('src/rust/config/storage.rs')
  const shortcuts = source('src/frontend/composables/useShortcuts.ts')
  const popupInput = source('src/frontend/components/popup/PopupInput.vue')
  const popupActions = source('src/frontend/components/popup/PopupActions.vue')

  assert.match(settings, /let is_macos = cfg!\(target_os = "macos"\)/)
  assert.match(settings, /quick_submit[\s\S]*?shift: !is_macos,[\s\S]*?meta: is_macos/)
  assert.match(settings, /enhance[\s\S]*?ctrl: !is_macos,[\s\S]*?alt: is_macos,[\s\S]*?shift: !is_macos/)
  assert.match(settings, /continue[\s\S]*?ctrl: !is_macos,[\s\S]*?shift: is_macos/)

  assert.match(storage, /fn has_complete_legacy_popup_defaults/)
  assert.match(storage, /if has_complete_legacy_popup_defaults\(config\)/)
  assert.match(storage, /for key in \["quick_submit", "continue", "enhance"\]/)
  assert.match(storage, /if !config\.shortcut_config\.shortcuts\.contains_key\(&key\)/)
  assert.match(storage, /merge_migrates_only_the_complete_legacy_popup_default_set/)
  assert.match(storage, /merge_preserves_the_whole_set_when_one_legacy_binding_was_customized/)
  assert.doesNotMatch(storage, /is_old_ctrl_shift|is_old_ctrl|is_old_shift|is_old_alt/)

  assert.match(shortcuts, /event\.isComposing/)
  assert.match(shortcuts, /event\.keyCode === 229/)
  assert.match(shortcuts, /event\.repeat/)
  assert.match(shortcuts, /document\.visibilityState !== 'hidden' && document\.hasFocus\(\)/)
  assert.match(shortcuts, /event\.ctrlKey === shortcutKey\.ctrl[\s\S]*?event\.shiftKey === shortcutKey\.shift/)
  assert.match(popupInput, /isComposing\.value \|\| event\.isComposing \|\| event\.keyCode === 229 \|\| event\.repeat/)

  assert.match(popupActions, /props\.canSubmit && !props\.submitting[\s\S]*?handleSubmit\(\)/)
  assert.match(popupActions, /props\.canSubmit && !props\.submitting[\s\S]*?handleGoalSubmit\(\)/)
  assert.match(popupActions, /!props\.submitting[\s\S]*?handleContinue\(\)/)
})
test('Windows popup accepts Explorer file clipboard data and drive-letter paths', () => {
  const popup = source('src/frontend/components/popup/PopupInput.vue')
  const commands = source('src/rust/ui/commands.rs')
  const cargo = source('Cargo.toml')

  assert.match(popup, /Explorer copies absolute paths with drive letters or UNC prefixes/)
  assert.match(popup, /decodedPath\.slice\(1\)/)
  assert.match(popup, /path\.split\(\/\[\\\\\/\]\//)
  assert.match(commands, /#\[cfg\(target_os = "windows"\)\][\s\S]*?read_clipboard_file_paths[\s\S]*?CF_HDROP[\s\S]*?DragQueryFileW/)
  assert.match(commands, /CLIPBOARD_OPEN_ATTEMPTS:\s*usize\s*=\s*5/)
  assert.match(commands, /CLIPBOARD_RETRY_DELAY_MS:\s*u64\s*=\s*20/)
  assert.match(commands, /for attempt in 0\.\.CLIPBOARD_OPEN_ATTEMPTS[\s\S]*?OpenClipboard[\s\S]*?std::thread::sleep/)
  assert.match(commands, /#\[cfg\(not\(any\(target_os = "macos", target_os = "windows"\)\)\)\]/)
  assert.match(cargo, /"Win32_System_DataExchange"/)
  assert.match(cargo, /"Win32_System_Ole"/)
  assert.match(cargo, /"Win32_UI_Shell"/)
})

test('Browser settings use the real WebSocket runtime state', () => {
  const websocket = source('src/rust/browser/websocket.rs')
  const commands = source('src/rust/browser/commands.rs')
  const settings = source('src/frontend/components/settings/BrowserSettings.vue')

  assert.match(websocket, /pub async fn browser_ws_server_running\(\)[\s\S]*?WS_SERVER\.read\(\)\.await[\s\S]*?server\.running\.read\(\)\.await/)
  assert.match(websocket, /pub async fn browser_extension_connected\(\)[\s\S]*?BROWSER_TX\.read\(\)\.await\.is_some\(\)/)
  assert.match(websocket, /let server_task = tokio::spawn[\s\S]*?self\.server_task\.write\(\)\.await = Some\(server_task\)/)
  assert.match(websocket, /pub async fn stop\(&self\)[\s\S]*?server_task\.abort\(\)[\s\S]*?server_task\.await/)
  assert.match(commands, /get_browser_monitor_status\(\)[\s\S]*?connected: browser_extension_connected\(\)\.await,[\s\S]*?monitoring: browser_ws_server_running\(\)\.await/)
  assert.doesNotMatch(commands, /connected:\s*true[\s\S]{0,80}monitoring:\s*true/)
  assert.match(settings, /invoke<BrowserMonitorStatus>\('get_browser_monitor_status'\)/)
  assert.match(settings, /async function startMonitoring\(\)[\s\S]*?start_browser_monitoring[\s\S]*?await syncMonitoringStatus\(\)/)
  assert.match(settings, /async function stopMonitoring\(\)[\s\S]*?stop_browser_monitoring[\s\S]*?await syncMonitoringStatus\(\)/)
  assert.match(settings, /onMounted\(async \(\) => \{[\s\S]*?await syncMonitoringStatus\(\)/)
  assert.doesNotMatch(settings, /isMonitoring\.value\s*=\s*(?:true|false)/)
})

test('Windows file and folder selection uses the native dialog plugin instead of an empty stub', () => {
  const commands = source('src/rust/ui/commands.rs')
  const windowsSelector = /#\[cfg\(not\(target_os = "macos"\)\)\]\s*#\[tauri::command\]\s*pub async fn select_files_and_folders[\s\S]*?\.blocking_pick_folder\(\)[\s\S]*?\.blocking_pick_files\(\)/
  assert.match(commands, windowsSelector)
  assert.doesNotMatch(commands, /pub async fn select_files_and_folders\([\s\S]{0,240}?Ok\(vec!\[\]\)/)
})

test('Windows prevent-sleep uses SetThreadExecutionState on a dedicated guard thread', () => {
  const commands = source('src/rust/ui/commands.rs')
  const cargo = source('Cargo.toml')
  assert.match(cargo, /"Win32_System_Power"/)
  assert.match(commands, /#\[cfg\(target_os = "windows"\)\][\s\S]*?WindowsPreventSleepGuard/)
  assert.match(commands, /SetThreadExecutionState\(ES_CONTINUOUS \| ES_SYSTEM_REQUIRED\)/)
  assert.match(commands, /name\("iterate-prevent-sleep"\.to_string\(\)\)/)
  assert.match(commands, /SetThreadExecutionState\(ES_CONTINUOUS\)/)
})

test('Windows Codex automation has project, thread and safe new-chat routes', () => {
  const commands = source('src/rust/ui/commands.rs')
  const cargo = source('Cargo.toml')
  assert.match(commands, /#\[cfg\(target_os = "windows"\)\]\s*fn codex_desktop_cli_candidates/)
  assert.match(commands, /\.args\(\["app", project_path\]\)/)
  assert.match(commands, /ShellExecuteW/)
  assert.match(commands, /GetForegroundWindow/)
  assert.match(commands, /GetWindowThreadProcessId/)
  assert.match(commands, /Codex 未成为前台窗口，为避免误发按键已取消自动发送/)
  assert.match(commands, /keybd_event\(VK_RETURN as u8/)
  assert.match(commands, /#\[cfg\(target_os = "windows"\)\]\s*#\[tauri::command\]\s*pub async fn open_codex_project/)
  assert.match(commands, /#\[cfg\(target_os = "windows"\)\]\s*#\[tauri::command\]\s*pub async fn open_codex_thread/)
  assert.match(commands, /#\[cfg\(target_os = "windows"\)\]\s*#\[tauri::command\]\s*pub async fn open_new_codex_chat_with_text/)
  assert.match(commands, /fn is_codex_desktop_foreground_path\(path: &Path\)/)
  assert.match(commands, /file_name\.as_deref\(\) == Some\("codex\.exe"\)/)
  assert.match(commands, /file_name\.as_deref\(\) != Some\("chatgpt\.exe"\)/)
  assert.match(commands, /contains\("\/windowsapps\/openai\.codex_"\)/)
  assert.match(cargo, /"Win32_UI_Input_KeyboardAndMouse"/)
  assert.match(cargo, /"Win32_UI_WindowsAndMessaging"/)
})

test('Windows global screenshot keeps the Mac capability with a native Windows capture path', () => {
  const setup = source('src/rust/app/setup.rs')
  const commands = source('src/rust/ui/commands.rs')
  const input = source('src/frontend/components/popup/PopupInput.vue')
  const cargo = source('Cargo.toml')
  assert.match(setup, /#\[cfg\(target_os = "macos"\)\][\s\S]*?Shift\+Cmd\+K/)
  assert.doesNotMatch(setup, /Shift\+Ctrl\+K/)
  assert.match(setup, /capture_screenshot\(\)\.await/)
  assert.match(input, /async function handleWindowsScreenshotShortcut\(event: KeyboardEvent\)/)
  assert.match(input, /event\.code !== 'F8'[\s\S]*?event\.ctrlKey[\s\S]*?event\.altKey[\s\S]*?event\.shiftKey[\s\S]*?event\.metaKey/)
  assert.match(input, /await webview\.hide\(\)[\s\S]*?invoke<string>\('capture_screenshot'\)[\s\S]*?await webview\.show\(\)[\s\S]*?await webview\.setFocus\(\)/)
  assert.match(input, /window\.addEventListener\('keydown', handleWindowsScreenshotShortcut\)/)
  assert.match(input, /window\.removeEventListener\('keydown', handleWindowsScreenshotShortcut\)/)
  assert.match(commands, /#\[cfg\(target_os = "windows"\)\][\s\S]*?CreateDIBSection[\s\S]*?BitBlt/)
  assert.match(commands, /PngEncoder::new[\s\S]*?ExtendedColorType::Rgba8/)
  assert.doesNotMatch(commands, /iterate_screenshot_[\s\S]*?System\.Windows\.Forms/)
  assert.match(cargo, /"Win32_Graphics_Gdi"/)
  assert.match(cargo, /image = \{ version = "0\.25\.10"/)
})

test('Windows global speech uses a real local recognizer and reuses iterate post-processing', () => {
  const setup = source('src/rust/app/setup.rs')
  const speech = source('src/rust/native_speech/windows.rs')
  const host = source('src/frontend/composables/useGlobalSpeechRuntimeHost.ts')
  const input = source('src/frontend/composables/useGlobalSpeechInput.ts')
  const overlay = source('src/rust/native_speech/overlay.rs')
  const settings = source('src/frontend/components/settings/GlobalSpeechSettings.vue')

  assert.match(setup, /WINDOWS_SPEECH_SHORTCUT/)
  assert.match(speech, /WINDOWS_SPEECH_SHORTCUT: &str = "Shift\+Ctrl\+Space"/)
  assert.match(speech, /System\.Speech\.Recognition\.SpeechRecognitionEngine/)
  assert.match(speech, /SetInputToDefaultAudioDevice/)
  assert.match(speech, /speech:\/\/windows-transcript/)
  assert.match(speech, /speech:\/\/windows-state/)
  assert.match(speech, /super::reveal_overlay\(&app\)/)
  assert.match(speech, /super::hide_overlay\(&app\)/)
  assert.match(speech, /GetForegroundWindow/)
  assert.match(speech, /SetForegroundWindow/)
  assert.match(speech, /keybd_event\(VK_CONTROL as u8/)
  assert.match(host, /processWindowsTranscript[\s\S]*?applySpeechPostprocess/)
  assert.match(host, /persistMemoryWriteback\(processed\)/)
  assert.match(host, /commit_windows_speech_text/)
  assert.match(host, /if \(windowsPlatform\) \{[\s\S]*?speech:\/\/windows-error[\s\S]*?return[\s\S]*?unlistenSnapshot/)
  assert.match(speech, /failure_app[\s\S]*?语音线程启动失败[\s\S]*?hide_overlay\(&failure_app\)/)
  assert.match(input, /speech:\/\/windows-state/)
  assert.match(input, /windowsState\.value = event\.payload/)
  assert.match(overlay, /ensure_windows_overlay/)
  assert.match(setup, /ensure_windows_overlay\(app_handle\)/)
  assert.match(settings, /Windows 全局语音输入/)
  assert.match(settings, /get_windows_speech_capability/)
  assert.match(settings, /v-if="windowsPlatform"/)
  assert.match(settings, /<template v-else>/)
})
