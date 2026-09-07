/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { Webview } from '@tauri-apps/api/webview'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { Window } from '@tauri-apps/api/window'

test('Tauri WebviewWindow focus is window focus, not WebView2 input focus', () => {
  assert.equal(WebviewWindow.prototype.setFocus, Window.prototype.setFocus)
  assert.notEqual(WebviewWindow.prototype.setFocus, Webview.prototype.setFocus)
})

test('Windows popup transfers focus to WebView2 before focusing the textarea', async () => {
  const input = await readFile(new URL('../components/popup/PopupInput.vue', import.meta.url), 'utf8')
  const start = input.indexOf('async function focusInput(')
  const body = input.slice(start, input.indexOf('const scrollableAncestors:', start))
  assert.match(body, /await webview\.setFocus\(\)[\s\S]*?if \(windowsPlatform\) \{\s+await getCurrentWebview\(\)\.setFocus\(\)/)
})
