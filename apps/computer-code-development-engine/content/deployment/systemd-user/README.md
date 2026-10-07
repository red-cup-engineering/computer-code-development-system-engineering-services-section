# JSNode server on Bare Cedar Fog

This user service keeps the JSNode operations through the shared MCP HTTP
transport at `http://127.0.0.1:18808/mcp`. It observes package manifests
and built TypeScript declarations beneath `/home/emsenn/info`; it does not own
those packages or mutate the repository.

The checked-in unit is a deployment record, not proof that the service is
installed or running. Observe live state with:

```sh
systemctl --user status jsnode-server.service
curl --fail http://127.0.0.1:18808/mcp \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -H 'mcp-protocol-version: 2025-06-18' \
  --data '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"jsnode_status","arguments":{}}}'
codex mcp list
```

Install or refresh the unit on Bare Cedar Fog with:

```sh
install -Dm644 content/deployment/systemd-user/jsnode-server.service \
  /home/emsenn/.config/systemd/user/jsnode-server.service
systemctl --user daemon-reload
systemctl --user enable --now jsnode-server.service
codex mcp add info_code --url http://127.0.0.1:18808/mcp
```

The Codex registration and the systemd unit are separate observed states. A
registered URL is not evidence that the service is running, and a running unit
is not evidence that Codex has registered it.
