import { describe, it, expect } from '@jest/globals';
import {
  relinkWorkflowPage,
  relinkWorkflowHistoryPage,
  relinkWorkflowVersion,
  relinkSessionPage,
} from '../../src/links';
import {
  PageOfWorkflowSummary,
  PageOfWorkflowHistory,
  WorkflowVersionDetails,
  PageOfSessionSummary,
  WorkflowSummary,
  WorkflowHistory,
  SessionSummary,
} from '../../src/client/types.gen';

describe('Links functionality with schema metadata', () => {
  describe('relinkWorkflowPage', () => {
    it('should add schema metadata to workflow page response', () => {
      const mockPage: PageOfWorkflowSummary = {
        _embedded: [
          {
            workflowId: '123',
            name: 'Test Workflow',
            description: 'Test Description',
            published: true,
            draftVersion: 1,
            publishedVersion: 1,
            _links: {}
          } as WorkflowSummary
        ],
        _pageNumber: 0,
        _lastPage: true,
        _links: {}
      };

      const result = relinkWorkflowPage(mockPage);

      // Check structure
      expect(result).toHaveProperty('workflows');
      expect(result).toHaveProperty('@pageNumber', 0);
      expect(result).toHaveProperty('@links');
      expect(result).toHaveProperty('@schema');

      // Check schema metadata
      expect(result['@schema']).not.toHaveProperty('typeName');
      expect(result['@schema']).not.toHaveProperty('properties');

      // Check individual workflows don't have schema (only page-level)
      expect(result.workflows[0]).not.toHaveProperty('@schema');
      expect(result.workflows[0]).toHaveProperty('@links');
    });

    it('should handle pagination links correctly', () => {
      const mockPage: PageOfWorkflowSummary = {
        _embedded: [],
        _pageNumber: 1,
        _lastPage: false,
        _links: {}
      };

      const result = relinkWorkflowPage(mockPage);

      expect(result['@links']).toHaveProperty('previousPage');
      expect(result['@links']).toHaveProperty('nextPage');
      expect(result['@links'].previousPage.arguments.pageNumber).toBe(0);
      expect(result['@links'].nextPage.arguments.pageNumber).toBe(2);
    });
  });

  describe('relinkWorkflowVersion', () => {
    it('should add schema metadata to workflow version details', () => {
      const mockWorkflow: WorkflowVersionDetails = {
        workflowId: '123',
        version: 1,
        status: 'PUBLISHED',
        name: 'Test Workflow',
        description: 'Test Description',
        components: [],
        tables: [],
        _links: {}
      };

      const result = relinkWorkflowVersion(mockWorkflow);

      expect(result).toHaveProperty('@schema');
      expect(result['@schema']).not.toHaveProperty('typeName');
      expect(result['@schema']).toHaveProperty('workflowId');
      expect(result['@schema']).toHaveProperty('components');
      expect(result['@schema']).not.toHaveProperty('fullSchema');
      expect(result).toHaveProperty('@links');
    });
  });

  describe('relinkSessionPage', () => {
    it('should add schema metadata to session page response', () => {
      const mockSessionPage: PageOfSessionSummary = {
        _embedded: [
          {
            sessionId: 'session-123',
            status: 'SUCCESSFUL',
            workflowId: 'workflow-123',
            workflowVersion: 1,
            sessionMode: 'PROD',
            startedAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:01:00Z',
            _links: {}
          } as SessionSummary
        ],
        _pageNumber: 0,
        _lastPage: true,
        _links: {}
      };

      const result = relinkSessionPage(mockSessionPage);

      expect(result).toHaveProperty('@schema');
      expect(result['@schema']).not.toHaveProperty('typeName');
      expect(result).toHaveProperty('session');
      expect(result.session[0]).toHaveProperty('@links');
      expect(result.session[0]).not.toHaveProperty('@schema'); // Only page-level schema
    });
  });

  describe('relinkWorkflowHistoryPage', () => {
    it('should add schema metadata to workflow history page', () => {
      const mockHistoryPage: PageOfWorkflowHistory = {
        _embedded: [
          {
            version: 1,
            status: 'PUBLISHED',
            name: 'Test Version',
            description: 'Test Description',  
            publishedAt: '2024-01-01T00:00:00Z',
            _links: {}
          } as WorkflowHistory
        ],
        _pageNumber: 0,
        _lastPage: true,
        _links: {}
      };

      const result = relinkWorkflowHistoryPage('workflow-123', mockHistoryPage);

      expect(result).toHaveProperty('@schema');
      expect(result['@schema']).not.toHaveProperty('typeName');
      expect(result).toHaveProperty('workflowId', 'workflow-123');
      expect(result).toHaveProperty('history');
      expect(result.history[0]).toHaveProperty('@links');
      expect(result.history[0]).not.toHaveProperty('@schema'); // Only page-level schema
    });
  });
});