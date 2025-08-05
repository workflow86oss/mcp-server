import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createTestServer, checkServiceRunning, checkPreconditions } from './test-utils';

describe('Workflow Tools Integration Tests', () => {
  let server: ReturnType<typeof createTestServer>;
  let testWorkflowId: string;
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

  describe('list-workflows', () => {
    it('should return paginated workflow summaries', async () => {
      checkServiceRunning(serviceRunning);
      
      const result = await server.callTool({
        name: 'list-workflows',
        arguments: { status: 'ALL', pageNumber: 0 },
      });

      expect(result.content).toBeDefined();
      expect(result.content?.[0]?.type).toBe('text');
      
      const response = JSON.parse(result.content![0].text!);
      expect(response).toHaveProperty('@pageNumber');
      expect(response).toHaveProperty('@links');
      expect(response).toHaveProperty('@schema');
      expect(response['@schema']).toHaveProperty('workflows');
      
      const workflows = response.workflows || [];
      workflows.forEach((workflow: any) => {
        expect(workflow).toHaveProperty('workflowId');
        expect(workflow).toHaveProperty('published');
        expect(workflow).toHaveProperty('draftVersion');
        expect(workflow).toHaveProperty('@links');
      });
    });

    it('should filter by publication status', async () => {
      const allResult = await server.callTool({
        name: 'list-workflows',
        arguments: { status: 'ALL', pageNumber: 0 },
      });

      const publishedResult = await server.callTool({
        name: 'list-workflows',
        arguments: { status: 'PUBLISHED', pageNumber: 0 },
      });

      expect(allResult.content?.[0]?.type).toBe('text');
      expect(publishedResult.content?.[0]?.type).toBe('text');
      
      const allResponse = JSON.parse(allResult.content![0].text!);
      const publishedResponse = JSON.parse(publishedResult.content![0].text!);
      
      expect(allResponse).toBeDefined();
      expect(publishedResponse).toBeDefined();
      
      const publishedWorkflows = publishedResponse.workflows || [];
      publishedWorkflows.forEach((workflow: any) => {
        expect(workflow.published).toBe(true);
      });
    });

    it('should handle pagination', async () => {
      const result = await server.callTool({
        name: 'list-workflows',
        arguments: { status: 'ALL', pageNumber: 0 },
      });

      expect(result.content?.[0]?.type).toBe('text');
      const firstPage = JSON.parse(result.content![0].text!);
      
      expect(firstPage['@pageNumber']).toBe(0);
      if (firstPage['@links']?.nextPage) {
        expect(firstPage['@links'].nextPage.arguments.pageNumber).toBe(1);
      }
    });
  });

  describe('get-workflow', () => {
    it('should return workflow details for PUBLISHED version', async () => {
      checkPreconditions(serviceRunning, testWorkflowId, 'PUBLISHED version test');

      try {
        const result = await server.callTool({
          name: 'get-workflow',
          arguments: {
            workflowId: testWorkflowId,
            workflowVersion: 'PUBLISHED',
          },
        });

        expect(result.content?.[0]?.type).toBe('text');
        const response = JSON.parse(result.content![0].text!);
        
        expect(response).toBeDefined();
        expect(response).toHaveProperty('workflowId');
        expect(response).toHaveProperty('version');
        expect(response).toHaveProperty('status');
        expect(response).toHaveProperty('@links');
        expect(response).toHaveProperty('@schema');
      } catch (error: any) {
        if (error?.message?.includes('410')) {
          console.warn('Workflow not published, which is expected for some tests');
        } else {
          throw error;
        }
      }
    });

    it('should return workflow details for DRAFT version', async () => {
      checkPreconditions(serviceRunning, testWorkflowId, 'DRAFT version test');

      const result = await server.callTool({
        name: 'get-workflow',
        arguments: {
          workflowId: testWorkflowId,
          workflowVersion: 'DRAFT',
        },
      });

      expect(result.content?.[0]?.type).toBe('text');
      const response = JSON.parse(result.content![0].text!);
      
      expect(response).toBeDefined();
      expect(response).toHaveProperty('workflowId');
      expect(response).toHaveProperty('version');
      expect(response).toHaveProperty('status');
      expect(response).toHaveProperty('@links');
      expect(response).toHaveProperty('@schema');
    });

    it('should handle non-existent workflow', async () => {
      await expect(
        server.callTool({
          name: 'get-workflow',
          arguments: {
            workflowId: '00000000-0000-0000-0000-000000000000',
            workflowVersion: 'DRAFT',
          },
        })
      ).rejects.toThrow();
    });
  });

  describe('get-workflow-history', () => {
    it('should return workflow version history', async () => {
      checkPreconditions(serviceRunning, testWorkflowId, 'workflow history test');

      const result = await server.callTool({
        name: 'get-workflow-history',
        arguments: {
          workflowId: testWorkflowId,
          pageNumber: 0,
        },
      });

      expect(result.content?.[0]?.type).toBe('text');
      const response = JSON.parse(result.content![0].text!);
      
      expect(response).toBeDefined();
      expect(response).toHaveProperty('@pageNumber');
      expect(response).toHaveProperty('@links');
      expect(response).toHaveProperty('@schema');
      
      const history = response.history || [];
      history.forEach((version: any) => {
        expect(version).toHaveProperty('version');
        expect(version).toHaveProperty('status');
        expect(version).toHaveProperty('timestamp');
      });
    });

    it('should handle pagination for workflow history', async () => {
      if (!testWorkflowId) {
        throw new Error('No test workflow available for pagination test. To set up test data:\n1. Ensure workflow exists with multiple versions\n2. Verify get-workflow-history supports pagination\n3. Check workflow version history is populated');
      }

      const result = await server.callTool({
        name: 'get-workflow-history',
        arguments: {
          workflowId: testWorkflowId,
          pageNumber: 0,
        },
      });

      expect(result.content?.[0]?.type).toBe('text');
      const firstPage = JSON.parse(result.content![0].text!);
      
      expect(firstPage['@pageNumber']).toBe(0);
    });
  });

  describe('publish-workflow', () => {
    it('should publish a workflow with minimal parameters', async () => {
      checkPreconditions(serviceRunning, testWorkflowId, 'publish test');

      const result = await server.callTool({
        name: 'publish-workflow',
        arguments: {
          workflowId: testWorkflowId,
        },
      });

      expect(result.content?.[0]?.type).toBe('text');
      const response = JSON.parse(result.content![0].text!);
      
      expect(response).toBeDefined();
      expect(response).toHaveProperty('workflowId');
      expect(response).toHaveProperty('publishedVersion');
      expect(response).toHaveProperty('draftVersion');
      expect(response).toHaveProperty('published');
      expect(response.published).toBe(true);
      expect(response).toHaveProperty('@schema');
    });

    it('should publish a workflow with comment and description', async () => {
      if (!testWorkflowId) {
        throw new Error('No test workflow available for publish with metadata test. To set up test data:\n1. Ensure workflow exists in publishable state\n2. Verify workflow metadata can be updated\n3. Check publish-workflow API supports comments/descriptions');
      }

      const result = await server.callTool({
        name: 'publish-workflow',
        arguments: {
          workflowId: testWorkflowId,
          comment: 'Integration test publish',
          description: 'Test workflow for integration testing',
        },
      });

      expect(result.content?.[0]?.type).toBe('text');
      const response = JSON.parse(result.content![0].text!);
      
      expect(response).toBeDefined();
      expect(response.published).toBe(true);
    });

    it('should handle invalid workflow ID', async () => {
      await expect(
        server.callTool({
          name: 'publish-workflow',
          arguments: {
            workflowId: 'invalid-uuid',
          },
        })
      ).rejects.toThrow();
    });

    it('should handle non-existent workflow', async () => {
      await expect(
        server.callTool({
          name: 'publish-workflow',
          arguments: {
            workflowId: '00000000-0000-0000-0000-000000000000',
          },
        })
      ).rejects.toThrow();
    });
  });

  describe('unpublish-workflow', () => {
    it('should unpublish a published workflow', async () => {
      if (!testWorkflowId) {
        throw new Error('No test workflow available for unpublish test. To set up test data:\n1. Ensure workflow exists and can be published\n2. Verify unpublish-workflow tool is accessible\n3. Check workflow state management and transitions');
      }

      // First ensure it's published
      await server.callTool({
        name: 'publish-workflow',
        arguments: {
          workflowId: testWorkflowId,
          comment: 'Preparing for unpublish test',
        },
      });

      // Then unpublish it
      const result = await server.callTool({
        name: 'unpublish-workflow',
        arguments: {
          workflowId: testWorkflowId,
        },
      });

      expect(result.content?.[0]?.type).toBe('text');
      const response = JSON.parse(result.content![0].text!);
      
      expect(response).toBeDefined();
      expect(response).toHaveProperty('workflowId');
      expect(response).toHaveProperty('draftVersion');
      expect(response).toHaveProperty('unpublished');
      expect(response.unpublished).toBe(true);
      expect(response).toHaveProperty('@schema');
    });

    it('should handle invalid workflow ID', async () => {
      await expect(
        server.callTool({
          name: 'unpublish-workflow',
          arguments: {
            workflowId: 'invalid-uuid',
          },
        })
      ).rejects.toThrow();
    });

    it('should handle non-existent workflow', async () => {
      await expect(
        server.callTool({
          name: 'unpublish-workflow',
          arguments: {
            workflowId: '99999999-9999-9999-9999-999999999999',
          },
        })
      ).rejects.toThrow();
    });

    it('should handle already unpublished workflow', async () => {
      if (!testWorkflowId) {
        throw new Error('No test workflow available for unpublished state test. To set up test data:\n1. Ensure workflow exists for state testing\n2. Verify workflow state transitions work correctly\n3. Check error handling for invalid state changes');
      }

      // Ensure it's unpublished first
      try {
        await server.callTool({
          name: 'unpublish-workflow',
          arguments: {
            workflowId: testWorkflowId,
          },
        });
      } catch (e) {
        // Ignore if already unpublished
      }

      // Try to unpublish again - should fail with meaningful error
      await expect(
        server.callTool({
          name: 'unpublish-workflow',
          arguments: {
            workflowId: testWorkflowId,
          },
        })
      ).rejects.toThrow();
    });

    it('should handle unpublishing draft-only workflow', async () => {
      // Find a workflow that was never published
      const result = await server.callTool({
        name: 'list-workflows',
        arguments: { status: 'ALL', pageNumber: 0 },
      });
      
      const workflowsResponse = JSON.parse(result.content![0].text!);
      const workflows = workflowsResponse.workflows || [];
      const draftOnlyWorkflow = workflows.find((w: any) => !w.published);
      
      if (draftOnlyWorkflow) {
        await expect(
          server.callTool({
            name: 'unpublish-workflow',
            arguments: {
              workflowId: draftOnlyWorkflow.workflowId!,
            },
          })
        ).rejects.toThrow();
      } else {
        throw new Error('No draft-only workflows found for unpublish test. To set up test data:\n1. Create a workflow that has never been published\n2. Ensure workflow exists in DRAFT state only\n3. Check workflow creation and status management');
      }
    });
  });

  describe('Integration scenarios', () => {
    it('should support publish -> unpublish -> republish cycle', async () => {
      if (!testWorkflowId) {
        throw new Error('No test workflow available for lifecycle cycle test. To set up test data:\n1. Ensure workflow exists for full lifecycle testing\n2. Verify publish/unpublish operations work\n3. Check workflow state persistence through transitions');
      }

      // Publish
      const publishResult = await server.callTool({
        name: 'publish-workflow',
        arguments: {
          workflowId: testWorkflowId,
          comment: 'Integration cycle test - publish',
        },
      });
      const publishResponse = JSON.parse(publishResult.content![0].text!);
      expect(publishResponse.published).toBe(true);

      // Unpublish
      const unpublishResult = await server.callTool({
        name: 'unpublish-workflow',
        arguments: {
          workflowId: testWorkflowId,
        },
      });
      const unpublishResponse = JSON.parse(unpublishResult.content![0].text!);
      expect(unpublishResponse.unpublished).toBe(true);

      // Republish
      const republishResult = await server.callTool({
        name: 'publish-workflow',
        arguments: {
          workflowId: testWorkflowId,
          comment: 'Integration cycle test - republish',
        },
      });
      const republishResponse = JSON.parse(republishResult.content![0].text!);
      expect(republishResponse.published).toBe(true);
      expect(republishResponse.publishedVersion).toBeGreaterThan(
        publishResponse.publishedVersion!
      );
    });

    it('should handle rapid publish/unpublish operations', async () => {
      if (!testWorkflowId) {
        throw new Error('No test workflow available for rapid operations test. To set up test data:\n1. Ensure workflow exists for concurrency testing\n2. Verify workflow API handles rapid state changes\n3. Check system stability under load');
      }

      // Rapid sequence of operations
      const operations = [];
      
      operations.push(
        server.callTool({
          name: 'publish-workflow',
          arguments: {
            workflowId: testWorkflowId,
            comment: 'Rapid test 1',
          },
        })
      );

      const results = await Promise.all(operations);
      const publishResponse = JSON.parse(results[0].content![0].text!);
      expect(publishResponse.published).toBe(true);

      // Now unpublish
      const unpublishResult = await server.callTool({
        name: 'unpublish-workflow',
        arguments: {
          workflowId: testWorkflowId,
        },
      });
      const unpublishResponse = JSON.parse(unpublishResult.content![0].text!);
      expect(unpublishResponse.unpublished).toBe(true);
    });

    it('should verify workflow state consistency across operations', async () => {
      if (!testWorkflowId) {
        throw new Error('No test workflow available for consistency validation. To set up test data:\n1. Ensure workflow management system is running\n2. Create at least one workflow via API or UI\n3. Verify workflow data is accessible through list-workflows\n4. Check workflow persistence and state management');
      }

      // Get initial state
      const initialResult = await server.callTool({
        name: 'list-workflows',
        arguments: { status: 'ALL', pageNumber: 0 },
      });
      
      const initialWorkflows = JSON.parse(initialResult.content![0].text!);
      const initialWorkflow = initialWorkflows.workflows?.find(
        (w: any) => w.workflowId === testWorkflowId
      );
      
      if (!initialWorkflow) {
        throw new Error('Test workflow not found in list');
      }

      // Publish and verify state change
      await server.callTool({
        name: 'publish-workflow',
        arguments: {
          workflowId: testWorkflowId,
          comment: 'State consistency test',
        },
      });

      const afterPublishResult = await server.callTool({
        name: 'list-workflows',
        arguments: { status: 'ALL', pageNumber: 0 },
      });
      
      const afterPublishWorkflows = JSON.parse(afterPublishResult.content![0].text!);
      const publishedWorkflow = afterPublishWorkflows.workflows?.find(
        (w: any) => w.workflowId === testWorkflowId
      );
      
      expect(publishedWorkflow?.published).toBe(true);
      expect(publishedWorkflow?.publishedVersion).toBeDefined();
    });
  });
});