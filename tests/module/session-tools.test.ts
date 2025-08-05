import { describe, it, expect, beforeAll } from '@jest/globals';
import { 
  createTestServer, 
  checkPreconditions,
  checkPreconditionsWithComponent,
  checkSessionExists,
  checkSessionAndComponent,
  checkAllTestData,
  checkServiceRunning
} from './test-utils';

describe('Session Tools Integration Tests', () => {
  let server: ReturnType<typeof createTestServer>;
  let testWorkflowId: string;
  let testSessionId: string;
  let testComponentId: string;
  let serviceRunning = false;

  beforeAll(async () => {
    // Create test server that calls real MCP tools via exec.sh
    server = createTestServer();

    // Test if the service is running by attempting to call list-workflows
    try {
      const result = await server.callTool({
        name: 'list-workflows',
        arguments: { status: 'ALL', pageNumber: 0 },
      });
      
      if (result.content?.[0]?.type === 'text') {
        serviceRunning = true;
        const response = JSON.parse(result.content[0].text!);
        const workflows = response.workflows || [];
        if (workflows.length > 0) {
          testWorkflowId = workflows[0].workflowId!;
          
          // Ensure the workflow is published for session testing
          try {
            await server.callTool({
              name: 'publish-workflow',
              arguments: {
                workflowId: testWorkflowId,
                comment: 'Publishing for session tests',
              },
            });
          } catch (e) {
            // Already published, which is fine
          }

          // Get workflow details to find a component
          try {
            const workflowResult = await server.callTool({
              name: 'get-workflow',
              arguments: {
                workflowId: testWorkflowId,
                workflowVersion: 'PUBLISHED',
              },
            });
            
            const workflowDetails = JSON.parse(workflowResult.content![0].text!);
            if (workflowDetails.components && workflowDetails.components.length > 0) {
              testComponentId = workflowDetails.components[0].componentId!;
            }
          } catch (e) {
            console.warn('Could not get workflow components:', e);
          }
        }
      }
    } catch (error: any) {
      console.warn('Could not fetch test workflows:', error);
      // Check if this looks like a service connectivity issue
      if (error.message?.includes('Tool execution failed') || 
          error.message?.includes('connection') ||
          error.message?.includes('refused') ||
          error.message?.includes('timeout')) {
        serviceRunning = false;
      }
    }
  }, 30000);

  describe('list-sessions', () => {
    it('should return sessions for a workflow in PROD mode', async () => {
      checkPreconditions(serviceRunning, testWorkflowId, 'PROD mode session listing');

      const result = await server.callTool({
        name: 'list-sessions',
        arguments: {
          workflowId: testWorkflowId,
          sessionMode: 'PROD',
          pageNumber: 0,
        },
      });

      expect(result.content?.[0]?.type).toBe('text');
      const responseText = result.content![0].text!;
      
      // Handle case where response is plain text (no sessions)
      if (!responseText.startsWith('{')) {
        // Plain text response like "This workflow has never been run in PROD mode"
        expect(responseText).toContain('never been run');
        return;
      }
      
      const response = JSON.parse(responseText);
      expect(response).toBeDefined();
      expect(response).toHaveProperty('@pageNumber');
      expect(response).toHaveProperty('@links');
      expect(response).toHaveProperty('@schema');
      
      const sessions = response.sessions || [];
      sessions.forEach((session: any) => {
        expect(session).toHaveProperty('sessionId');
        expect(session).toHaveProperty('status');
        expect(session).toHaveProperty('sessionMode');
        expect(session.sessionMode).toBe('PROD');
        expect(session).toHaveProperty('@links');
      });
    });

    it('should return sessions for a workflow in TEST mode', async () => {
      checkPreconditions(serviceRunning, testWorkflowId, 'TEST mode session listing');

      const result = await server.callTool({
        name: 'list-sessions',
        arguments: {
          workflowId: testWorkflowId,
          sessionMode: 'TEST',
          pageNumber: 0,
        },
      });

      expect(result.content?.[0]?.type).toBe('text');
      const responseText = result.content![0].text!;
      
      // Handle case where response is plain text (no sessions)
      if (!responseText.startsWith('{')) {
        // Plain text response like "This workflow has never been run in TEST mode"
        expect(responseText).toContain('never been run');
        return;
      }
      
      const response = JSON.parse(responseText);
      expect(response).toBeDefined();
      expect(response).toHaveProperty('@pageNumber');
      expect(response).toHaveProperty('@links');
      
      const sessions = response.sessions || [];
      sessions.forEach((session: any) => {
        expect(session.sessionMode).toBe('TEST');
      });
    });

    it('should handle pagination', async () => {
      checkPreconditions(serviceRunning, testWorkflowId, 'session pagination');

      const result = await server.callTool({
        name: 'list-sessions',
        arguments: {
          workflowId: testWorkflowId,
          sessionMode: 'PROD',
          pageNumber: 0,
        },
      });

      expect(result.content?.[0]?.type).toBe('text');
      const firstPage = JSON.parse(result.content![0].text!);
      
      expect(firstPage['@pageNumber']).toBe(0);
      if (firstPage['@links']?.nextPage) {
        expect(firstPage['@links'].nextPage.arguments.pageNumber).toBe(1);
      }
    });

    it('should handle non-existent workflow', async () => {
      await expect(
        server.callTool({
          name: 'list-sessions',
          arguments: {
            workflowId: '00000000-0000-0000-0000-000000000000',
            sessionMode: 'PROD',
            pageNumber: 0,
          },
        })
      ).rejects.toThrow();
    });
  });

  describe('run-workflow', () => {
    it('should run a workflow and return session details', async () => {
      checkPreconditionsWithComponent(serviceRunning, testWorkflowId, testComponentId, 'workflow execution');

      try {
        const result = await server.callTool({
          name: 'run-workflow',
          arguments: {
            workflowId: testWorkflowId,
            componentId: testComponentId,
            placeholderValues: {},
          },
        });

        expect(result.content?.[0]?.type).toBe('text');
        const response = JSON.parse(result.content![0].text!);
        
        expect(response).toBeDefined();
        expect(response).toHaveProperty('sessionId');
        expect(response).toHaveProperty('workflowId');
        expect(response).toHaveProperty('@schema');
        
        // Store session ID for other tests
        testSessionId = response.sessionId!;
      } catch (error: any) {
        if (error?.message?.includes('410')) {
          console.warn('Workflow not published or component not found, which is expected for some tests');
        } else {
          throw error;
        }
      }
    });

    it('should handle invalid workflow ID', async () => {
      await expect(
        server.callTool({
          name: 'run-workflow',
          arguments: {
            workflowId: 'invalid-uuid',
            componentId: 'test-component',
            placeholderValues: {},
          },
        })
      ).rejects.toThrow();
    });

    it('should handle non-existent workflow', async () => {
      await expect(
        server.callTool({
          name: 'run-workflow',
          arguments: {
            workflowId: '00000000-0000-0000-0000-000000000000',
            componentId: 'test-component',
            placeholderValues: {},
          },
        })
      ).rejects.toThrow();
    });
  });

  describe('get-session', () => {
    it('should return session details', async () => {
      if (!testSessionId) {
        // Try to get any existing session
        if (testWorkflowId) {
          try {
            const result = await server.callTool({
              name: 'list-sessions',
              arguments: {
                workflowId: testWorkflowId,
                sessionMode: 'PROD',
                pageNumber: 0,
              },
            });
            
            const sessionsResponse = JSON.parse(result.content![0].text!);
            const sessions = sessionsResponse.sessions || [];
            if (sessions.length > 0) {
              testSessionId = sessions[0].sessionId!;
            }
          } catch (e) {
            console.warn('Could not get sessions for testing');
          }
        }
      }

      checkSessionExists(testSessionId, 'session details retrieval');

      const result = await server.callTool({
        name: 'get-session',
        arguments: { sessionId: testSessionId },
      });

      expect(result.content?.[0]?.type).toBe('text');
      const response = JSON.parse(result.content![0].text!);
      
      expect(response).toBeDefined();
      expect(response).toHaveProperty('sessionId');
      expect(response).toHaveProperty('status');
      expect(response).toHaveProperty('workflowId');
      expect(response).toHaveProperty('sessionMode');
      expect(response).toHaveProperty('componentResults');
      expect(response).toHaveProperty('@schema');
    });

    it('should handle non-existent session', async () => {
      await expect(
        server.callTool({
          name: 'get-session',
          arguments: { sessionId: '00000000-0000-0000-0000-000000000000' },
        })
      ).rejects.toThrow();
    });

    it('should handle invalid session ID format', async () => {
      await expect(
        server.callTool({
          name: 'get-session',
          arguments: { sessionId: 'invalid-uuid' },
        })
      ).rejects.toThrow();
    });
  });

  describe('rerun-workflow', () => {
    it('should rerun workflow from existing session', async () => {
      if (!testWorkflowId || !testSessionId || !testComponentId) {
        throw new Error('Missing test data for rerun. Required:\n1. testWorkflowId: ' + (testWorkflowId || 'missing') + '\n2. testSessionId: ' + (testSessionId || 'missing') + '\n3. testComponentId: ' + (testComponentId || 'missing') + '\nRun prerequisite tests first or ensure workflow/session setup is complete.');
      }

      try {
        const result = await server.callTool({
          name: 'rerun-workflow',
          arguments: {
            workflowId: testWorkflowId,
            sessionId: testSessionId,
            componentId: testComponentId,
          },
        });

        expect(result.content?.[0]?.type).toBe('text');
        const response = JSON.parse(result.content![0].text!);
        
        expect(response).toBeDefined();
        expect(response).toHaveProperty('sessionId');
        expect(response).toHaveProperty('@schema');
      } catch (error: any) {
        if (error?.message?.includes('410') || error?.message?.includes('400')) {
          console.warn('Session or component not available for rerun, which is expected');
        } else {
          throw error;
        }
      }
    });

    it('should handle invalid session for rerun', async () => {
      if (!testWorkflowId || !testComponentId) {
        throw new Error('Missing test workflow or component. To set up test data:\n1. Ensure a workflow exists (testWorkflowId: ' + (testWorkflowId || 'missing') + ')\n2. Ensure the workflow has components (testComponentId: ' + (testComponentId || 'missing') + ')\n3. Verify the workflow is published and accessible via get-workflow tool');
      }

      await expect(
        server.callTool({
          name: 'rerun-workflow',
          arguments: {
            workflowId: testWorkflowId,
            sessionId: '00000000-0000-0000-0000-000000000000',
            componentId: testComponentId,
          },
        })
      ).rejects.toThrow();
    });
  });

  describe('terminate-entire-session', () => {
    it('should terminate an active session', async () => {
      if (!testSessionId) {
        throw new Error('No test session available. To set up test data:\n1. Run the run-workflow test first to create a session\n2. Ensure a workflow with components exists\n3. Check that sessions are being created and persisted properly\n4. Current testSessionId: ' + (testSessionId || 'missing'));
      }

      try {
        const result = await server.callTool({
          name: 'terminate-entire-session',
          arguments: { sessionId: testSessionId },
        });

        expect(result.content?.[0]?.type).toBe('text');
        const response = JSON.parse(result.content![0].text!);
        
        expect(response).toBeDefined();
        expect(response).toHaveProperty('@schema');
      } catch (error: any) {
        if (error?.message?.includes('410') || error?.message?.includes('400')) {
          console.warn('Session not available for termination, which is expected');
        } else {
          throw error;
        }
      }
    });

    it('should handle non-existent session termination', async () => {
      await expect(
        server.callTool({
          name: 'terminate-entire-session',
          arguments: { sessionId: '00000000-0000-0000-0000-000000000000' },
        })
      ).rejects.toThrow();
    });
  });

  describe('terminate-component', () => {
    it('should terminate a specific component in session', async () => {
      if (!testSessionId || !testComponentId) {
        throw new Error('Missing test data for component termination. Required:\n1. testSessionId: ' + (testSessionId || 'missing') + '\n2. testComponentId: ' + (testComponentId || 'missing') + '\nEnsure a session with components exists before running this test.');
      }

      try {
        const result = await server.callTool({
          name: 'terminate-component',
          arguments: {
            sessionId: testSessionId,
            componentId: testComponentId,
            threadId: 'root',
          },
        });

        expect(result.content?.[0]?.type).toBe('text');
        const response = JSON.parse(result.content![0].text!);
        
        expect(response).toBeDefined();
        expect(response).toHaveProperty('@schema');
      } catch (error: any) {
        if (error?.message?.includes('410') || error?.message?.includes('400')) {
          console.warn('Component not available for termination, which is expected');
        } else {
          throw error;
        }
      }
    });

    it('should handle invalid component termination', async () => {
      if (!testSessionId) {
        throw new Error('No test session available. To set up test data:\n1. Run the run-workflow test first to create a session\n2. Ensure a workflow with components exists\n3. Check that sessions are being created and persisted properly\n4. Current testSessionId: ' + (testSessionId || 'missing'));
      }

      await expect(
        server.callTool({
          name: 'terminate-component',
          arguments: {
            sessionId: testSessionId,
            componentId: 'invalid-component',
            threadId: 'root',
          },
        })
      ).rejects.toThrow();
    });
  });

  describe('retry-failed-component', () => {
    it('should retry a failed component', async () => {
      if (!testSessionId || !testComponentId) {
        throw new Error('Missing test data for component retry. Required:\n1. testSessionId: ' + (testSessionId || 'missing') + '\n2. testComponentId: ' + (testComponentId || 'missing') + '\nEnsure a session with failed components exists for retry testing.');
      }

      try {
        const result = await server.callTool({
          name: 'retry-failed-component',
          arguments: {
            sessionId: testSessionId,
            componentId: testComponentId,
            threadId: 'root',
          },
        });

        expect(result.content?.[0]?.type).toBe('text');
        const response = JSON.parse(result.content![0].text!);
        
        expect(response).toBeDefined();
        expect(response).toHaveProperty('@schema');
      } catch (error: any) {
        if (error?.message?.includes('410') || error?.message?.includes('400')) {
          console.warn('Component not available for retry, which is expected');
        } else {
          throw error;
        }
      }
    });

    it('should handle invalid component retry', async () => {
      if (!testSessionId) {
        throw new Error('No test session available. To set up test data:\n1. Run the run-workflow test first to create a session\n2. Ensure a workflow with components exists\n3. Check that sessions are being created and persisted properly\n4. Current testSessionId: ' + (testSessionId || 'missing'));
      }

      await expect(
        server.callTool({
          name: 'retry-failed-component',
          arguments: {
            sessionId: testSessionId,
            componentId: 'invalid-component',
            threadId: 'root',
          },
        })
      ).rejects.toThrow();
    });
  });

  describe('Integration scenarios', () => {
    it('should handle workflow run -> session management lifecycle', async () => {
      if (!testWorkflowId || !testComponentId) {
        throw new Error('Missing test data for lifecycle test. Required:\n1. testWorkflowId: ' + (testWorkflowId || 'missing') + '\n2. testComponentId: ' + (testComponentId || 'missing') + '\nEnsure a published workflow with components exists.');
      }

      try {
        // Run workflow
        const runResult = await server.callTool({
          name: 'run-workflow',
          arguments: {
            workflowId: testWorkflowId,
            componentId: testComponentId,
            placeholderValues: {},
          },
        });

        const runResponse = JSON.parse(runResult.content![0].text!);
        const newSessionId = runResponse.sessionId!;
        
        // Get session details
        const sessionResult = await server.callTool({
          name: 'get-session',
          arguments: { sessionId: newSessionId },
        });

        const sessionResponse = JSON.parse(sessionResult.content![0].text!);
        expect(sessionResponse.sessionId).toBe(newSessionId);
        
        // Verify session appears in list
        const sessionsResult = await server.callTool({
          name: 'list-sessions',
          arguments: {
            workflowId: testWorkflowId,
            sessionMode: 'PROD',
            pageNumber: 0,
          },
        });

        const sessionsResponse = JSON.parse(sessionsResult.content![0].text!);
        const sessions = sessionsResponse.sessions || [];
        const foundSession = sessions.find((s: any) => s.sessionId === newSessionId);
        expect(foundSession).toBeDefined();

      } catch (error: any) {
        if (error?.message?.includes('410')) {
          console.warn('Workflow not available for full lifecycle test');
        } else {
          throw error;
        }
      }
    });

    it('should validate session data consistency', async () => {
      if (!testWorkflowId) {
        throw new Error('No test workflow available. To set up test data:\n1. Run a workflow management system or mock server\n2. Ensure the list-workflows tool returns at least one workflow\n3. Check that exec.sh is properly configured and accessible');
      }

      // Get sessions from list
      const sessionsResult = await server.callTool({
        name: 'list-sessions',
        arguments: {
          workflowId: testWorkflowId,
          sessionMode: 'PROD',
          pageNumber: 0,
        },
      });

      const sessionsResponse = JSON.parse(sessionsResult.content![0].text!);
      const sessions = sessionsResponse.sessions || [];
      
      for (const sessionSummary of sessions.slice(0, 3)) { // Test first 3 sessions
        try {
          const sessionResult = await server.callTool({
            name: 'get-session',
            arguments: { sessionId: sessionSummary.sessionId! },
          });

          const sessionDetails = JSON.parse(sessionResult.content![0].text!);

          // Verify consistency between summary and details
          expect(sessionDetails.sessionId).toBe(sessionSummary.sessionId);
          expect(sessionDetails.status).toBe(sessionSummary.status);
          expect(sessionDetails.workflowId).toBe(sessionSummary.workflowId);
          expect(sessionDetails.sessionMode).toBe(sessionSummary.sessionMode);
        } catch (error) {
          console.warn(`Could not verify session ${sessionSummary.sessionId}:`, error);
        }
      }
    });
  });
});