#!/bin/bash
PAYLOAD=$1

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
