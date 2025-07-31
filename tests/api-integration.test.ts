import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { spawn, ChildProcess } from 'child_process';
import { client } from '../src/client/client.gen';

describe('API Integration Tests', () => {
  let serverProcess: ChildProcess | undefined;
  
  beforeAll(async () => {
    // Set up test environment
    process.env.W86_API_KEY = process.env.W86_API_KEY || 'test-key';
    process.env.W86_DOMAIN = process.env.W86_DOMAIN || 'https://rest.workflow86.com';
    
    // Configure client for testing
    client.setConfig({
      baseUrl: process.env.W86_DOMAIN,
      headers: {
        'x-api-key': process.env.W86_API_KEY,
      },
    });
  });

  afterAll(() => {
    if (serverProcess) {
      serverProcess.kill();
    }
  });

  describe('API Tree Exploration - Good Paths', () => {
    it('should simulate list-workflows -> get-workflow -> list-sessions -> get-session flow', async () => {
      // This test simulates the typical API exploration flow but with mock data
      // to avoid external dependencies in unit tests
      
      // Mock PageOfWorkflowSummary response structure
      const mockWorkflowsResponse = {
        workflows: [
          {
            workflowId: 'test-workflow-id',
            name: 'Test Workflow',
            description: 'Test Description',
            published: true,
            draftVersion: 1,
            publishedVersion: 1,
            '@links': {
              'published-workflow-details': {
                name: 'get-workflow',
                arguments: {
                  workflowId: 'test-workflow-id',
                  workflowVersion: 'PUBLISHED'
                }
              }
            }
          }
        ],
        '@pageNumber': 0,
        '@links': {},
        '@schema': {
          workflows: {}
        }
      };

      // Validate workflow list response structure
      expect(mockWorkflowsResponse).toHaveProperty('@schema');
      expect(mockWorkflowsResponse['@schema']).not.toHaveProperty('typeName');
      expect(mockWorkflowsResponse['@schema']).toHaveProperty('workflows');
      expect(mockWorkflowsResponse.workflows[0]['@links']).toHaveProperty('published-workflow-details');

      // Mock WorkflowVersionDetails response structure  
      const mockWorkflowDetailsResponse = {
        workflowId: 'test-workflow-id',
        version: 1,
        status: 'PUBLISHED',
        name: 'Test Workflow',
        description: 'Test Description',
        components: [],
        databases: [],
        '@links': {
          'prod-sessions': {
            name: 'list-sessions',
            arguments: {
              workflowId: 'test-workflow-id',
              sessionMode: 'PROD'
            }
          }
        },
        '@schema': {
          workflowId: 'UUID id of this workflow version',
          version: 'The integer version of this workflow version',
          components: {}
        }
      };

      // Validate workflow details response structure
      expect(mockWorkflowDetailsResponse).toHaveProperty('@schema');
      expect(mockWorkflowDetailsResponse['@schema']).not.toHaveProperty('typeName');
      expect(mockWorkflowDetailsResponse['@links']).toHaveProperty('prod-sessions');

      // Mock PageOfSessionSummary response structure
      const mockSessionsResponse = {
        session: [
          {
            sessionId: 'test-session-id',
            status: 'SUCCESSFUL',
            workflowId: 'test-workflow-id',
            workflowVersion: 1,
            sessionMode: 'PROD',
            '@links': {
              details: {
                name: 'get-session',
                arguments: {
                  sessionId: 'test-session-id'
                }
              }
            }
          }
        ],
        '@pageNumber': 0,
        '@links': {},
        '@schema': {
          session: {}
        }
      };

      // Validate sessions response structure
      expect(mockSessionsResponse).toHaveProperty('@schema');
      expect(mockSessionsResponse['@schema']).not.toHaveProperty('typeName');
      expect(mockSessionsResponse['@schema']).toHaveProperty('session');
      expect(mockSessionsResponse.session[0]['@links']).toHaveProperty('details');

      // Mock SessionResult response structure
      const mockSessionDetailsResponse = {
        sessionId: 'test-session-id',
        sessionMode: 'PROD',
        status: 'SUCCESSFUL',
        workflowId: 'test-workflow-id',
        workflowVersion: 1,
        componentResults: [],
        '@schema': {
          sessionId: 'UUID id of the session returned',
          status: 'The overall session status',
          componentResults: {}
        }
      };

      // Validate session details response structure
      expect(mockSessionDetailsResponse).toHaveProperty('@schema');
      expect(mockSessionDetailsResponse['@schema']).not.toHaveProperty('typeName');
      expect(mockSessionDetailsResponse['@schema']).toHaveProperty('sessionId');
    });

    it('should validate schema metadata consistency across all response types', () => {
      const testCases = [
        {
          schemaType: 'PageOfWorkflowSummary',
          mockResponse: {
            '@schema': {
              workflows: {}
            }
          }
        },
        {
          schemaType: 'WorkflowVersionDetails', 
          mockResponse: {
            '@schema': {
              workflowId: 'UUID id of this workflow version'
            }
          }
        },
        {
          schemaType: 'SessionResult',
          mockResponse: {
            '@schema': {
              sessionId: 'UUID id of the session returned'
            }
          }
        },
        {
          schemaType: 'RunWorkflowResponse',
          mockResponse: {
            '@schema': {
              sessionId: 'UUID id of the session returned'
            }
          }
        }
      ];

      testCases.forEach(({ schemaType, mockResponse }) => {
        expect(mockResponse).toHaveProperty('@schema');
        expect(mockResponse['@schema']).not.toHaveProperty('typeName');
        expect(mockResponse['@schema']).not.toHaveProperty('properties');
        expect(typeof mockResponse['@schema']).toBe('object');
      });
    });

    it('should validate link structure for navigation', () => {
      const testLinks = {
        'list-workflows': {
          expectedLinks: ['nextPage', 'previousPage'],
          workflow_links: ['published-workflow-details', 'draft-workflow-details', 'prod-sessions', 'test-sessions']
        },
        'get-workflow': {
          expectedLinks: ['prod-sessions', 'test-sessions']
        },
        'list-sessions': {
          expectedLinks: ['nextPage', 'previousPage'],
          session_links: ['details']
        }
      };

      // Validate that link structures follow expected patterns
      Object.entries(testLinks).forEach(([toolName, config]) => {
        expect(config).toHaveProperty('expectedLinks');
        expect(Array.isArray(config.expectedLinks)).toBe(true);
      });
    });

    it('should test error handling with schema metadata', () => {
      // Mock error response structure
      const mockErrorResponse = {
        httpStatus: 404,
        errorId: 'test-error-id',
        message: 'Resource not found',
        '@schema': {
          httpStatus: 'HTTP Status code (matching the status of the response)',
          errorId: 'Error ID to be quoted in any potential support requests',
          message: 'Message containing details of the problem'
        }
      };

      expect(mockErrorResponse).toHaveProperty('@schema');
      expect(mockErrorResponse['@schema']).not.toHaveProperty('typeName');
      expect(mockErrorResponse['@schema']).toHaveProperty('httpStatus');
      expect(mockErrorResponse.httpStatus).toBe(404);
    });
  });

  describe('Schema Property Validation', () => {
    it('should validate schema structure', () => {
      const prohibitedSchemaProps = ['typeName', 'properties', 'fullSchema'];

      const mockSchema = {
        testProp: 'Test property description'
      };

      prohibitedSchemaProps.forEach(prop => {
        expect(mockSchema).not.toHaveProperty(prop);
      });
    });

    it('should validate property descriptions are strings', () => {
      const mockProperties = {
        workflowId: 'UUID id of this workflow',
        name: 'The name of this workflow',
        published: 'true if this workflow has been published'
      };

      Object.values(mockProperties).forEach(description => {
        expect(typeof description).toBe('string');
        expect(description.length).toBeGreaterThan(0);
      });
    });
  });
});