import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const relay = await readFile(new URL('../src/rust/relay.rs', import.meta.url), 'utf8')
const mobileBridge = await readFile(new URL('../src/rust/bridge/bridge_test.html', import.meta.url), 'utf8')

function section(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker)
  const end = source.indexOf(endMarker, start)
  assert.ok(start >= 0, `missing start marker: ${startMarker}`)
  assert.ok(end > start, `missing end marker: ${endMarker}`)
  return source.slice(start, end)
}

test('mobile relay fail-closes mcp actions that cannot route back to the pending request', () => {
  const validation = section(
    relay,
    'fn relay_bridge_message_from_payload(payload: &Value) -> Result<Value>',
    'async fn post_local_bridge_publish',
  )

  assert.match(validation, /\.get\("project_path"\)[\s\S]*?missing project_path/)
  assert.match(validation, /\.get\("request_id"\)[\s\S]*?missing request_id/)
})

test('mobile bridge sends the pending request identity with every mcp action', () => {
  const routeContext = section(mobileBridge, 'function currentRouteContext()', 'function sendAction(action)')
  const sendAction = section(mobileBridge, 'function sendAction(action)', 'function handlePaste(event)')

  assert.match(routeContext, /const requestId = pickFirstString\(currentRequest, \['id', 'request_id', 'requestId'\]\)/)
  assert.match(routeContext, /request_id: requestId/)
  assert.match(sendAction, /\.\.\.currentRouteContext\(\)/)
})
