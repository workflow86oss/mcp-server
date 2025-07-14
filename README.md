# Workflow86 MCP Server

This is a fairly standard Node MCP Server implementation against the workflow86.com public API.

## Standard Setup (Test PR)

Normal users will only need to follow some fairly standard setup steps:
1. Create an API Key from the [Organization page](https://app.workflow86.com/organization) of workflow86.com
2. Setup your MCP client
   * If you are using Cursor your config file will be at `~/.cursor/mcp.json`  
   * Claude on MacOS has a config file at `~/Library/Application\ Support/Claude/claude_desktop_config.json`  
   * For other tools please follow their setup instructions
   * Most tools use configuration in the following format:
   ```json
   {
       "mcpServers": {
         "workflow86": {
             "command": "npx",
             "args": ["@npm-workflow86/mcp-server"],
             "env": {
                 "W86_API_KEY": "<API Key for your W86 Organization>"
             }
         }
       }
   }
   ```
   To use the latest unreleased build specify the canary tag eg.
   ```
             "args": ["@npm-workflow86/mcp-server@canary"],
   ```

3. Check your Node Version  
   Make sure your system default node version is v22 or greater (20 may also work but your mileage may vary)
   ```bash
   node -v
   ```
### Test Integration
#### Cursor
Goto `Cursor` -> `Settings` -> `Cursor Settings` -> `Tools & Integrations`

There should be a workflow86 entry in the MCP Tools section. If something's gone wrong an error message will display here.

## Contributor Setup

For other folk that would like to run the server against source for whatever reason setup is a little more involved.
If you don't already have the source run: 
```bash
 git clone git@github.com:workflow86oss/mcp-server.git
```

### Build
`npm install && npm run build`

### Run with CLI
This is particularly useful to get at logs easily if things are going wrong or for quick testing:

First setup your Dev API Key (you might like to add this to your shell init script)
```bash
  export W86_API_KEY=<api key>
```

Then you can invoke commands via jsonrpc like this:
```bash
  echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list-workflows","arguments":{}}}' | node build/server.js
```

### Configure a MCP Client
To configure a MCP Client to run against your local checkout put this config in the correct place for your desired tool:
```json
{
    "mcpServers": {
      "workflow86": {
          "command": "node",
          "args": ["/<absolute-checkout-path>/mcp-server/build/server.js"],
          "env": {
              "W86_API_KEY": "<API Key for your W86 Client>"
          }
      }
    }
}
```

### Regenerate Generated Client Code
`src/client` contains a typescript client generated based on the OpenAPI spec at https://rest.workflow86.com/v3/api-docs. This client can be regenerated if it is not up to date with the OpenAPI spec published. To update it run:

```bash
npm run genclient
```

## References

Workflow86 homepage: https://www.workflow86.com  
MCP Spec: https://modelcontextprotocol.io/specification/2025-06-18
