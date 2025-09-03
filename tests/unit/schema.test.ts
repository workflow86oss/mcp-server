import { describe, it, expect } from '@jest/globals';
import { getSchemaMetadata, addSchemaMetadataByType, SchemaTypeName } from '../../src/schema';

describe('Schema functionality', () => {
  describe('getSchemaMetadata', () => {
    it('should return schema metadata for WorkflowSummary', () => {
      const metadata = getSchemaMetadata('WorkflowSummary');
      
      expect(metadata).toHaveProperty('@schema');
      expect(metadata['@schema']).toHaveProperty('description');
      expect(metadata['@schema']).not.toHaveProperty('typeName');
      expect(metadata['@schema']).not.toHaveProperty('properties');
      expect(metadata['@schema']).not.toHaveProperty('fullSchema');
      
      // Check properties are directly in @schema
      expect(metadata['@schema']).toHaveProperty('workflowId');
      expect(metadata['@schema']).toHaveProperty('name');
      expect(metadata['@schema']).toHaveProperty('published');
    });

    it('should return schema metadata for PageOfWorkflowSummary', () => {
      const metadata = getSchemaMetadata('PageOfWorkflowSummary');
      
      expect(metadata['@schema']).not.toHaveProperty('typeName');
      expect(metadata['@schema']).toHaveProperty('workflows'); // _embedded renamed to workflows
      expect(metadata['@schema']).not.toHaveProperty('_embedded'); // Should be renamed
      // Internal pagination fields should be filtered out
      expect(metadata['@schema']).not.toHaveProperty('_pageNumber');
      expect(metadata['@schema']).not.toHaveProperty('_lastPage');
      expect(metadata['@schema']).not.toHaveProperty('_links');
    });

    it('should return schema metadata for SessionResult', () => {
      const metadata = getSchemaMetadata('SessionResult');
      
      expect(metadata['@schema']).not.toHaveProperty('typeName');
      expect(metadata['@schema']).toHaveProperty('sessionId');
      expect(metadata['@schema']).toHaveProperty('status');
      expect(metadata['@schema']).toHaveProperty('componentResults');
    });
  });

  describe('addSchemaMetadataByType', () => {
    it('should add schema metadata to an object', () => {
      const testObject = {
        workflowId: '123',
        name: 'Test Workflow',
        published: true
      };
      
      const result = addSchemaMetadataByType(testObject, 'WorkflowSummary');
      
      expect(result).toHaveProperty('@schema');
      expect(result['@schema']).not.toHaveProperty('typeName');
      expect(result.workflowId).toBe('123');
      expect(result.name).toBe('Test Workflow');
    });

    it('should handle null/undefined objects', () => {
      expect(addSchemaMetadataByType(null, 'WorkflowSummary')).toBeNull();
      expect(addSchemaMetadataByType(undefined, 'WorkflowSummary')).toBeUndefined();
    });

    it('should handle non-object types', () => {
      expect(addSchemaMetadataByType('string', 'WorkflowSummary')).toBe('string');
      expect(addSchemaMetadataByType(123, 'WorkflowSummary')).toBe(123);
    });
  });

  describe('Schema coverage', () => {
    const schemaTypes: SchemaTypeName[] = [
      'RunWorkflowCommand',
      'StandardWorkflow86Exception', 
      'RunWorkflowResponse',
      'RerunWorkflowCommand',
      'ComponentResult',
      'JsonNode',
      'SessionResult',
      'RetryWorkflowResponse',
      'PageOfWorkflowSummary',
      'WorkflowSummary',
      'ColumnDetails',
      'ComponentDetails',
      'WorkflowVersionDetails',
      'PageOfSessionSummary',
      'SessionSummary',
      'PageOfWorkflowHistory',
      'WorkflowHistory'
    ];

    it.each(schemaTypes)('should have valid schema metadata for %s', (schemaType) => {
      const metadata = getSchemaMetadata(schemaType);
      
      expect(metadata).toHaveProperty('@schema');
      expect(metadata['@schema']).not.toHaveProperty('typeName');
      expect(metadata['@schema']).not.toHaveProperty('properties');
      expect(metadata['@schema']).not.toHaveProperty('fullSchema');
      expect(typeof metadata['@schema']).toBe('object');
    });
  });
});