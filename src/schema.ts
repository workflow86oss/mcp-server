// This file provides schema description lookup functionality
import * as schemas from "./client/schemas.gen";
import { type } from "node:os";
import { z, ZodTypeAny } from "zod";
import { ZodType } from "zod/src/v3/types";
import { JSONSchema } from "zod/v4/core/json-schema";

// Type mapping from generated types to schema objects - used internally for $ref resolution
// Dynamically build schema mapping from generated schemas
// Converts schema names like "RunWorkflowCommandSchema" to type names like "RunWorkflowCommand"
const SCHEMA_MAP = Object.keys(schemas)
  .filter((key) => key.endsWith("Schema"))
  .reduce(
    (acc, schemaKey) => {
      // Convert "RunWorkflowCommandSchema" -> "RunWorkflowCommand"
      // Strip "Schema" suffix and all underscores
      const typeName = schemaKey.replace(/Schema$/, "").replace(/_/g, "");

      acc[typeName] = (schemas as any)[schemaKey];
      return acc;
    },
    {} as Record<string, any>,
  );

export type SchemaTypeName = keyof typeof SCHEMA_MAP;

/**
 * Get the main description of a schema
 */
export function getSchemaMainDescription<T extends SchemaTypeName>(
  typeName: T,
): string {
  const schema = SCHEMA_MAP[typeName];
  return (schema as any).description || "";
}

/**
 * Get the description of a specific property from a schema
 */
export function getSchemaPropertyDescription<T extends SchemaTypeName>(
  typeName: T,
  propertyName: string,
): string {
  const schema = SCHEMA_MAP[typeName];
  const properties = (schema as any).properties;
  if (properties && properties[propertyName]) {
    return properties[propertyName].description || "";
  }
  return "";
}

/**
 * Get the example of a specific property from a schema
 */
export function getSchemaPropertyExample<T extends SchemaTypeName>(
  typeName: T,
  propertyName: string,
): any {
  const schema = SCHEMA_MAP[typeName];
  const properties = (schema as any).properties;
  if (properties && properties[propertyName]) {
    return properties[propertyName].example;
  }
  return undefined;
}

/**
 * Create a schema-aware describe function for a specific schema type
 * This simplifies the lookup by creating a bound function
 */
export function createSchemaDescriber<T extends SchemaTypeName>(typeName: T) {
  return {
    main: () => getSchemaMainDescription(typeName),
    prop: (propertyName: string) =>
      getSchemaPropertyDescription(typeName, propertyName),
    example: (propertyName: string) =>
      getSchemaPropertyExample(typeName, propertyName),
    /**
     * Get description with example if available
     */
    describe: (propertyName: string) => {
      const description = getSchemaPropertyDescription(typeName, propertyName);
      const example = getSchemaPropertyExample(typeName, propertyName);
      return example
        ? `${description}\nExample: ${typeof example === "object" ? JSON.stringify(example, null, 2) : example}`
        : description;
    },
  };
}

/**
 * Map schema type names to their output field names when _embedded is renamed
 */
const EMBEDDED_FIELD_MAPPING = {
  PageOfWorkflowSummary: "workflows",
  PageOfWorkflowHistory: "history",
  PageOfSessionSummary: "session",
} as const;

/**
 * Get the schema description object for a given type name (used for $ref resolution and backwards compatibility)
 */
export function getSchemaDescription<T extends SchemaTypeName>(
  typeName: T,
): (typeof SCHEMA_MAP)[T] {
  return SCHEMA_MAP[typeName];
}

/**
 * Resolve $ref to actual schema
 */
function resolveRef(ref: string): any {
  // Extract schema name from $ref like "#/components/schemas/ComponentDetails"
  const schemaName = ref.split("/").pop();
  if (schemaName && SCHEMA_MAP[schemaName as SchemaTypeName]) {
    return SCHEMA_MAP[schemaName as SchemaTypeName];
  }
  return null;
}

/**
 * Extract property descriptions from a schema object, including nested properties
 */
export function getPropertyDescriptions(schema: any): Record<string, any> {
  const descriptions: Record<string, any> = {};

  if (schema?.properties) {
    for (const [key, prop] of Object.entries(schema.properties)) {
      if (key.includes("_") && key !== "_embedded") {
        continue;
      }

      if (typeof prop === "object" && prop !== null) {
        const typedProp = prop as any;

        // Handle direct $ref properties (like nodeInput, nodeOutput)
        if (typedProp.$ref) {
          const refSchema = resolveRef(typedProp.$ref);
          if (refSchema) {
            const nestedProps = getPropertyDescriptions(refSchema);
            // If the referenced schema has no properties but has a description, use the description
            if (
              Object.keys(nestedProps).length === 0 &&
              refSchema.description
            ) {
              descriptions[key] = refSchema.description;
            } else {
              descriptions[key] = nestedProps;
            }
          }
        }
        // Handle properties with descriptions
        else if (typedProp.description) {
          // For arrays with items that have $ref
          if (typedProp.type === "array" && typedProp.items?.$ref) {
            const refSchema = resolveRef(typedProp.items.$ref);
            if (refSchema) {
              const nestedProps = getPropertyDescriptions(refSchema);
              descriptions[key] = nestedProps;
            } else {
              descriptions[key] = typedProp.description;
            }
          }
          // For arrays with items that have properties
          else if (typedProp.type === "array" && typedProp.items?.properties) {
            descriptions[key] = getPropertyDescriptions(typedProp.items);
          }
          // For objects with additional properties
          else if (
            typedProp.type === "object" &&
            typedProp.additionalProperties?.properties
          ) {
            descriptions[key] = getPropertyDescriptions(
              typedProp.additionalProperties,
            );
          }
          // For objects with direct properties
          else if (typedProp.type === "object" && typedProp.properties) {
            descriptions[key] = getPropertyDescriptions(typedProp);
          }
          // For simple properties, just use the description
          else {
            descriptions[key] = typedProp.description;
          }
        }
      }
    }
  }

  return descriptions;
}

/**
 * Get complete schema metadata including main description and property descriptions
 */
export function getSchemaMetadata<T extends SchemaTypeName>(typeName: T): any;
export function getSchemaMetadata(schema: any, embeddedFieldName?: string): any;
export function getSchemaMetadata<T extends SchemaTypeName>(
  schemaOrTypeName: T | any,
  embeddedFieldName?: string,
): any {
  let schema: any;
  let embedFieldName: string | undefined = embeddedFieldName;

  // Handle backwards compatibility: if first argument is a string, treat as type name
  if (typeof schemaOrTypeName === "string") {
    const typeName = schemaOrTypeName as T;
    schema = getSchemaDescription(typeName);

    // Use embedded field mapping for type names
    if (typeName in EMBEDDED_FIELD_MAPPING) {
      embedFieldName =
        EMBEDDED_FIELD_MAPPING[typeName as keyof typeof EMBEDDED_FIELD_MAPPING];
    }
  } else {
    schema = schemaOrTypeName;
  }

  const properties = getPropertyDescriptions(schema);

  // Handle _embedded field renaming for page types
  if (embedFieldName && properties._embedded) {
    properties[embedFieldName] = properties._embedded;
    delete properties._embedded;
  }

  return {
    "@schema": {
      ...properties,
    },
  };
}

/**
 * Add schema metadata to an object based on the provided schema
 */
export function addSchemaMetadataByType<T extends SchemaTypeName>(
  obj: any,
  typeName: T,
): any;
export function addSchemaMetadataByType(
  obj: any,
  schema: any,
  embeddedFieldName?: string,
): any;
export function addSchemaMetadataByType<T extends SchemaTypeName>(
  obj: any,
  schemaOrTypeName: T | any,
  embeddedFieldName?: string,
): any {
  if (!obj || typeof obj !== "object") {
    return obj;
  }

  const metadata = getSchemaMetadata(schemaOrTypeName, embeddedFieldName);
  return {
    ...obj,
    ...metadata,
  };
}

export function schemaToZod(schema: any): ZodTypeAny {
  let result: ZodTypeAny = zodType(schema);
  if (schema.description) {
    result = result.describe(schema.description);
  }
  return result;
}

function zodType(schema: any): ZodTypeAny {
  if (schema.enum) {
    return z.enum(schema.enum);
  }
  switch (schema.type) {
    case "string": {
      // map common formats
      if (schema.format === "date-time") return z.string().datetime(); // or z.coerce.date()
      if (schema.format === "uuid") return z.string().uuid();
      if (schema.format === "email") return z.string().email();
      return z.string();
    }
    case "integer":
      return z.number().int();
    case "number":
      return z.number();
    case "boolean":
      return z.boolean();
    case "array":
      throw new Error("Handle arrays manually");
    case "object": {
      throw new Error("Handle objects manually");
    }
    default:
      return z.any();
  }
}
