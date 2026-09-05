import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const relay = await readFile(new URL('../src/rust/relay.rs', import.meta.url), 'utf8')
const mobileBridge = await readFile(new URL('../src/rust/bridge/bridge_test.html', import.meta.url), 'utf8')
const bridgeWs = await readFile(new URL('../src/rust/bridge/ws.rs', import.meta.url), 'utf8')
const networkParse = await readFile(new URL('../src/rust/bridge/network_parse.rs', import.meta.url), 'utf8')

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
  assert.match(sendAction, /const routeContext = currentRouteContext\(\)/)
  assert.match(sendAction, /!routeContext\.request_id \|\| !routeContext\.project_path/)
  assert.match(sendAction, /\.\.\.routeContext/)
})

test('mobile bridge surfaces relay rejection and retries state sync instead of looking sent', () => {
  const socketHandler = section(mobileBridge, 'ws.onmessage = (event) =>', 'ws.onerror = () =>')

  assert.match(socketHandler, /msg\.message_type === 'relay_error'/)
  assert.match(socketHandler, /回复未送达，正在重新同步/)
  assert.match(socketHandler, /btn\.disabled = false/)
  assert.match(socketHandler, /requestSync\(\)/)
})

test('mobile LAN discovery rejects RFC 2544 fake-IP routes and recovers the private Windows default-route interface', () => {
  assert.match(networkParse, /Some\(\[198, second, _, _\]\).*\(18\.\.=19\)/)
  assert.match(networkParse, /Some\(\[10, _, _, _\]\).*Some\(\[172, 16\.\.=31, _, _\]\).*Some\(\[192, 168, _, _\]\)/s)
  assert.match(networkParse, /columns\[0\] != "0\.0\.0\.0" \|\| columns\[1\] != "0\.0\.0\.0"/)
  assert.match(networkParse, /parse_windows_private_default_route_ipv4\(routes\)/)

  const lanDetection = section(bridgeWs, 'fn detect_windows_private_lan_ipv4_from_routes', 'struct PairingCandidatesResult')
  assert.match(lanDetection, /Command::new\("route"\)/)
  assert.match(lanDetection, /\.args\(\["print", "-4"\]\)/)
  assert.match(lanDetection, /CREATE_NO_WINDOW/)
  assert.match(lanDetection, /is_rfc2544_benchmark_ipv4\(&ip\)/)
  assert.match(lanDetection, /detect_windows_private_lan_ipv4_from_routes\(\)/)
})
