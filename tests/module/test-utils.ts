import { execSync } from 'child_process';
import * as path from 'path';

/**
 * Call a tool on the actual MCP server using exec.sh
 */
export async function callTool(name: string, arguments_: Record<string, any>) {
  const execPath = path.join(__dirname, '..', '..', 'exec.sh');
  const argsJson = JSON.stringify(arguments_);
  
  try {
    // Set W86_WITH=node to use the local build
    const env = { ...process.env, W86_WITH: 'node' };
    
    
    const result = execSync(`"${execPath}" "${name}" '${argsJson}'`, {
      encoding: 'utf8',
      env,
      timeout: 30000, // 30 second timeout
    });
    
    // Parse the JSON response from the MCP server
    const lines = result.split('\n').filter(line => line.trim());
    
    // Find the JSON response (skip the debug output)
    let jsonResponse = '';
    for (const line of lines) {
      if (line.startsWith('{') && (line.includes('"result"') || line.includes('"error"'))) {
        jsonResponse = line;
        break;
      }
    }
    
    if (!jsonResponse) {
      throw new Error(`No valid JSON response found in output: ${result}`);
    }
    
    const parsed = JSON.parse(jsonResponse);
    
    if (parsed.error) {
      throw new Error(parsed.error.message || 'Tool execution failed');
    }
    
    // Check if the result content contains an error message
    const content = parsed.result?.content || [];
    if (content.length > 0 && content[0].text) {
      const text = content[0].text;
      if (text.startsWith('An unexpected') || text.includes('error occurred') || text.includes('failure occurred')) {
        throw new Error(text);
      }
    }
    
    return {
      content: content.length > 0 ? content : [
        {
          type: 'text',
          text: JSON.stringify(parsed.result)
        }
      ]
    };
  } catch (error: any) {
    if (error.status) {
      // execSync error - include stderr
      const stderr = error.stderr?.toString() || '';
      const stdout = error.stdout?.toString() || '';
      throw new Error(`Tool execution failed: ${error.message}\nStdout: ${stdout}\nStderr: ${stderr}`);
    }
    throw error;
  }
}

/**
 * Helper functions for generating consistent error messages when test data is missing
 */
export function createMissingDataError(testType: string, missingItems: Array<{name: string, value?: string}>, setupInstructions: string[]): Error {
  const missingList = missingItems.map(item => 
    `${item.name}: ${item.value || 'missing'}`
  ).join('\\n');
  
  const instructions = setupInstructions.map((instruction, index) => 
    `${index + 1}. ${instruction}`
  ).join('\\n');
  
  return new Error(`Missing test data for ${testType}. Required:\\n${missingList}\\n${instructions}`);
}

export function createWorkflowMissingError(context: string = 'test'): Error {
  return new Error(`No test workflow available for ${context}. To set up test data:
1. Run a project service or mock server
2. Ensure the list-workflows tool returns at least one workflow
3. Check that exec.sh is properly configured and accessible
4. Verify workflow API endpoints are responding`);
}

export function createServiceNotRunningError(): Error {
  return new Error(`Project service is not running or not accessible. To fix this:
1. Start the project service
2. Verify the service is running on the expected endpoint (https://rest.w86dev.click)
3. Check network connectivity and authentication
4. Ensure the MCP server can connect to the workflow API
5. Verify exec.sh is configured with correct service endpoints`);
}

export function createSessionMissingError(context: string = 'test'): Error {
  return new Error(`No test session available for ${context}. To set up test data:
1. Run the run-workflow test first to create a session
2. Ensure a workflow with components exists
3. Check that sessions are being created and persisted properly`);
}

export function createWorkflowComponentMissingError(testWorkflowId?: string, testComponentId?: string): Error {
  return createMissingDataError('workflow with components', [
    {name: 'testWorkflowId', value: testWorkflowId},
    {name: 'testComponentId', value: testComponentId}
  ], [
    'Ensure a workflow exists and is accessible',
    'Ensure the workflow has components', 
    'Verify the workflow is published and accessible via get-workflow tool'
  ]);
}

export function createSessionComponentMissingError(testSessionId?: string, testComponentId?: string, context: string = 'operation'): Error {
  return createMissingDataError(`session with components for ${context}`, [
    {name: 'testSessionId', value: testSessionId},
    {name: 'testComponentId', value: testComponentId}
  ], [
    'Ensure a session with components exists',
    'Run prerequisite tests that create sessions first',
    'Verify session and component management is working'
  ]);
}

export function createFullTestDataMissingError(testWorkflowId?: string, testSessionId?: string, testComponentId?: string): Error {
  return createMissingDataError('complete test data', [
    {name: 'testWorkflowId', value: testWorkflowId},
    {name: 'testSessionId', value: testSessionId}, 
    {name: 'testComponentId', value: testComponentId}
  ], [
    'Run prerequisite tests first or ensure workflow/session setup is complete',
    'Verify end-to-end workflow functionality',
    'Check that all test dependencies are properly configured'
  ]);
}

/**
 * Shared precondition checking methods
 */
export function checkServiceRunning(serviceRunning: boolean): void {
  if (!serviceRunning) {
    throw createServiceNotRunningError();
  }
}

export function checkWorkflowExists(testWorkflowId?: string, context: string = 'test'): void {
  if (!testWorkflowId) {
    throw createWorkflowMissingError(context);
  }
}

export function checkSessionExists(testSessionId?: string, context: string = 'test'): void {
  if (!testSessionId) {
    throw createSessionMissingError(context);
  }
}

export function checkWorkflowAndComponent(testWorkflowId?: string, testComponentId?: string): void {
  if (!testWorkflowId || !testComponentId) {
    throw createWorkflowComponentMissingError(testWorkflowId, testComponentId);
  }
}

export function checkSessionAndComponent(testSessionId?: string, testComponentId?: string, context: string = 'operation'): void {
  if (!testSessionId || !testComponentId) {
    throw createSessionComponentMissingError(testSessionId, testComponentId, context);
  }
}

export function checkAllTestData(testWorkflowId?: string, testSessionId?: string, testComponentId?: string): void {
  if (!testWorkflowId || !testSessionId || !testComponentId) {
    throw createFullTestDataMissingError(testWorkflowId, testSessionId, testComponentId);
  }
}

export function checkPreconditions(serviceRunning: boolean, testWorkflowId?: string, context?: string): void {
  checkServiceRunning(serviceRunning);
  checkWorkflowExists(testWorkflowId, context);
}

export function checkPreconditionsWithSession(serviceRunning: boolean, testWorkflowId?: string, testSessionId?: string, context?: string): void {
  checkServiceRunning(serviceRunning);
  checkWorkflowExists(testWorkflowId, context);
  checkSessionExists(testSessionId, context);
}

export function checkPreconditionsWithComponent(serviceRunning: boolean, testWorkflowId?: string, testComponentId?: string, context?: string): void {
  checkServiceRunning(serviceRunning);
  checkWorkflowAndComponent(testWorkflowId, testComponentId);
}

/**
 * Create a server-like object that matches the test API
 */
export function createTestServer() {
  return {
    callTool: async (params: { name: string; arguments: Record<string, any> }) => {
      return callTool(params.name, params.arguments);
    }
  };
}