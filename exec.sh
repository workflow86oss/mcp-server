#!/bin/bash
TOOL_NAME="$1"
ARGS="$2"

# Build the JSON-RPC payload
PAYLOAD="{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/call\",\"params\":{\"name\":\"$TOOL_NAME\",\"arguments\":$ARGS}}"

if [[ "${W86_WITH}" = "node" ]]; then
  COMMAND='node build/server.js'
elif [[ "${W86_WITH}" = "canary" ]]; then
  COMMAND='npx @npm-workflow86/mcp-server@canary'
else
  COMMAND='npx @npm-workflow86/mcp-server@latest'
fi
echo "CALLING[$W86_WITH] ${PAYLOAD}"
echo

echo "$PAYLOAD" | $COMMAND
