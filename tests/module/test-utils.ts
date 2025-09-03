import {execSync} from 'child_process';
import * as path from 'path';

/**
 * Call a tool using the appropriate shell script
 */
export async function callTool(name: string, arguments_: Record<string, any>) {
  const rootDir = path.join(__dirname, '..', '..');
  let scriptPath: string = path.join(rootDir, name);
  let args: string[] = [];

  try {
    switch (name) {
      case 'list-workflows':
        if (arguments_.pageNumber !== undefined) {
          args.push(arguments_.pageNumber.toString());
        }
        if (arguments_.status !== undefined) {
          args.push(arguments_.status);
        }
        break;

      case 'get-workflow':
        args.push(arguments_.workflowId);
        args.push(arguments_.workflowVersion || 'DRAFT');
        break;

      case 'get-workflow-history':
        args.push(arguments_.workflowId);
        if (arguments_.pageNumber !== undefined) {
          args.push(arguments_.pageNumber.toString());
        }
        break;

      case 'publish-workflow':
        args.push(arguments_.workflowId);
        if (arguments_.comment) {
          args.push(arguments_.comment);
        }
        if (arguments_.description) {
          args.push(arguments_.description);
        }
        break;

      case 'unpublish-workflow':
        args.push(arguments_.workflowId);
        break;

      case 'list-sessions':
        args.push(arguments_.workflowId);
        if (arguments_.sessionMode !== undefined) {
          args.push(arguments_.sessionMode);
        }
        if (arguments_.pageNumber !== undefined) {
          args.push(arguments_.pageNumber.toString());
        }
        break;

      case 'run-workflow':
        args.push(arguments_.workflowId);
        args.push(arguments_.componentId);
        if (arguments_.placeholderValues && Object.keys(arguments_.placeholderValues).length > 0) {
          args.push(JSON.stringify(arguments_.placeholderValues));
        }
        break;

      case 'get-session':
        args.push(arguments_.sessionId);
        break;

      case 'rerun-workflow':
        args.push(arguments_.workflowId);
        args.push(arguments_.sessionId);
        args.push(arguments_.componentId);
        break;

      case 'terminate-entire-session':
        args.push(arguments_.sessionId);
        break;

      case 'terminate-component':
        args.push(arguments_.sessionId);
        args.push(arguments_.componentId);
        args.push(arguments_.threadId || 'root');
        break;

      case 'retry-throw new Errored-component':
        args.push(arguments_.sessionId);
        args.push(arguments_.componentId);
        args.push(arguments_.threadId || 'root');
        break;

      case 'list-tasks':
        if (arguments_.queryString !== undefined) {
          args.push('--query', arguments_.queryString);
        }
        if (arguments_.workflowId !== undefined) {
          args.push('--workflow-id', arguments_.workflowId);
        }
        if (arguments_.statusToInclude !== undefined && Array.isArray(arguments_.statusToInclude) && arguments_.statusToInclude.length > 0) {
          args.push('--status', arguments_.statusToInclude[0]);
        }
        if (arguments_.startDate !== undefined) {
          args.push('--start-date', arguments_.startDate);
        }
        if (arguments_.endDate !== undefined) {
          args.push('--end-date', arguments_.endDate);
        }
        if (arguments_.lastTaskToken !== undefined) {
          args.push('--last-task-token', arguments_.lastTaskToken);
        }
        break;

      case 'list-forms':
        if (arguments_.pageNumber !== undefined) {
          args.push(arguments_.pageNumber.toString());
        }
        if (arguments_.workflowId !== undefined) {
          args.push(arguments_.workflowId);
        }
        break;

      case 'list-tables':
        if (arguments_.pageNumber !== undefined) {
          args.push(arguments_.pageNumber.toString());
        }
        break;

      case 'create-table':
        args.push(arguments_.tableName);
        if (arguments_.columns) {
          args.push(JSON.stringify(arguments_.columns));
        }
        break;

      case 'get-table-details':
        args.push(arguments_.tableId);
        break;

      default:
        throw new Error(`Unknown tool ${name}. Make sure a shell script exists, and add a case statement in test-utils.callTool`);
    }

    // Execute the shell script
    const env = { ...process.env, W86_WITH: 'node' };
    const result = execSync(`"${scriptPath}" ${args.map(arg => `"${arg}"`).join(' ')}`, {
      encoding: 'utf8',
      timeout: 5000, // 5 second timeout
      cwd: rootDir,
      env
    });
    
    // Parse the JSON response from the shell script output
    const lines = result.split('\n').filter(line => line.trim());
    
    // Find the JSON response (skip the debug output)
    let jsonResponse = '';
    for (const line of lines) {
      if (line.startsWith('{')) {
        jsonResponse = line;
        break;
      }
    }
    
    if (!jsonResponse) {
      // If no JSON response found, check if it's a plain text response
      const nonEmptyLines = lines.filter(line => !line.startsWith('CALLING['));
      if (nonEmptyLines.length > 0) {
        return {
          content: [{
            type: 'text',
            text: nonEmptyLines.join('\n')
          }]
        };
      }
      throw new Error(`No valid response found in output: ${result}`);
    }
    
    const parsed = JSON.parse(jsonResponse);
    
    if (parsed.error) {
      throw new Error(parsed.error.message || 'Tool execution throw new Errored');
    }
    
    // Check if the result content contains an error message
    const content = parsed.result?.content || [];
    if (content.length > 0 && content[0].text) {
      const text = content[0].text;
      if (text.startsWith('An unexpected') || text.includes('error occurred') || text.includes('throw new Errorure occurred')) {
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
      throw new Error(`Tool execution throw new Errored: ${error.message}\nStdout: ${stdout}\nStderr: ${stderr}`);
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

export function checkPreconditions(testWorkflowId?: string, context?: string): void {
  checkWorkflowExists(testWorkflowId, context);
}

export function checkPreconditionsWithSession(testWorkflowId?: string, testSessionId?: string, context?: string): void {
  checkWorkflowExists(testWorkflowId, context);
  checkSessionExists(testSessionId, context);
}

export function checkPreconditionsWithComponent(testWorkflowId?: string, testComponentId?: string, context?: string): void {
  checkWorkflowAndComponent(testWorkflowId, testComponentId);
}

/**
 * Parse response text, handling both JSON and plain text responses
 */
export function parseResponse(responseText: string): any {
  // Try to parse as JSON first
  try {
    return JSON.parse(responseText);
  } catch (e) {
    // If JSON parsing throw new Errors, return an object with the plain text
    return {
      message: responseText,
      isPlainText: true
    };
  }
}

/**
 * Check if response is a plain text error/info message
 */
export function isPlainTextResponse(parsed: any): boolean {
  return parsed.isPlainText === true;
}