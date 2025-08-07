import { describe, it, expect } from '@jest/globals';
import { getSchemaMetadata } from '../src/schema';

describe('Nested Field Descriptions', () => {
  it('should provide nested field descriptions for WorkflowVersionDetails', () => {
    const metadata = getSchemaMetadata('WorkflowVersionDetails');
    const components = (metadata['@schema'] as any).components;
    
    // Should have nested component fields without extra description wrapper
    expect(components).toHaveProperty('description', 'Description of the Component'); // This is the actual field from the schema
    expect(components).toHaveProperty('componentId', 'UUID identifier of the Component');
    expect(components).toHaveProperty('type', 'Type of the Component');
    expect(components).toHaveProperty('name', 'Name of the Component');
    expect(components).toHaveProperty('nextComponents', 'UUID IDs of the components that will be executed after this one');
  });

  it('should provide nested field descriptions for SessionResult', () => {
    const metadata = getSchemaMetadata('SessionResult');
    const componentResults = (metadata['@schema'] as any).componentResults;
    
    // Should have nested result fields
    expect(componentResults).toHaveProperty('resultId', 'UUID identifier of this Component Result');
    expect(componentResults).toHaveProperty('componentId', 'UUID identifier of the Component this result is for');
    expect(componentResults).toHaveProperty('status', 'The status of the execution of this Component');
    expect(componentResults).toHaveProperty('thread', 'The thread this Component was run in - either \'root\' or a UUID identifier');
  });

  it('should provide deeply nested field descriptions', () => {
    const metadata = getSchemaMetadata('WorkflowVersionDetails');
    const databases = (metadata['@schema'] as any).databases;
    
    // Should have database fields and nested column fields
    expect(databases).toHaveProperty('name', 'The name of the Workflow86 Database');
    expect(databases).toHaveProperty('columns');
    
    const columns = databases.columns;
    expect(columns).toHaveProperty('columnName', 'The column name');
    expect(columns).toHaveProperty('columnType', 'The column type');
  });

  it('should not include fullSchema in any response', () => {
    const schemaTypes = [
      'WorkflowVersionDetails',
      'SessionResult', 
      'PageOfWorkflowSummary',
      'ComponentResult'
    ] as const;

    schemaTypes.forEach(schemaType => {
      const metadata = getSchemaMetadata(schemaType);
      expect(metadata['@schema']).not.toHaveProperty('fullSchema');
    });
  });

  it('should handle simple properties without nesting', () => {
    const metadata = getSchemaMetadata('WorkflowSummary');
    // Simple string properties should just be descriptions
    expect(typeof (metadata['@schema'] as any).workflowId).toBe('string');
    expect(typeof (metadata['@schema'] as any).name).toBe('string');
    expect(typeof (metadata['@schema'] as any).published).toBe('string');
    expect((metadata['@schema'] as any).workflowId).toBe('UUID identifier of this workflow');
  });

  it('should show both array-level and nested descriptions', () => {
    const metadata = getSchemaMetadata('WorkflowVersionDetails');
    
    // Components should have nested field descriptions
    expect((metadata['@schema'] as any).components.description).toBe('Description of the Component');
    expect((metadata['@schema'] as any).components.componentId).toBe('UUID identifier of the Component');
    
    // Databases should have nested field descriptions
    expect((metadata['@schema'] as any).databases.name).toBe('The name of the Workflow86 Database');
  });
});