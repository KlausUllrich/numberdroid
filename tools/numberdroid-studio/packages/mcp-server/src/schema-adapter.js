import * as z from 'zod/v4';

function singleType(schema) {
  const types = Array.isArray(schema.type) ? schema.type : [schema.type];
  const nullable = types.includes('null');
  return { type: types.find((candidate) => candidate !== 'null'), nullable };
}

/**
 * Convert the deliberately small JSON-Schema subset used by the Studio
 * command catalog into the official SDK's Standard Schema input.
 */
export function jsonSchemaToZod(schema) {
  if (!schema || typeof schema !== 'object') return z.unknown();
  const { type, nullable } = singleType(schema);
  let result;

  if (schema.enum) {
    result = z.enum(schema.enum);
  } else if (type === 'string') {
    result = z.string();
    if (schema.minLength !== undefined) result = result.min(schema.minLength);
    if (schema.maxLength !== undefined) result = result.max(schema.maxLength);
    if (schema.pattern) result = result.regex(new RegExp(schema.pattern));
  } else if (type === 'integer') {
    result = z.number().int();
    if (schema.minimum !== undefined) result = result.min(schema.minimum);
  } else if (type === 'number') {
    result = z.number();
    if (schema.minimum !== undefined) result = result.min(schema.minimum);
  } else if (type === 'boolean') {
    result = z.boolean();
  } else if (type === 'array') {
    result = z.array(jsonSchemaToZod(schema.items));
    if (schema.minItems !== undefined) result = result.min(schema.minItems);
  } else if (type === 'object') {
    const required = new Set(schema.required ?? []);
    const shape = Object.fromEntries(Object.entries(schema.properties ?? {}).map(([name, propertySchema]) => {
      const property = jsonSchemaToZod(propertySchema);
      return [name, required.has(name) ? property : property.optional()];
    }));
    result = z.object(shape);
    if (schema.additionalProperties === false) result = result.strict();
    else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
      result = z.object(shape).catchall(jsonSchemaToZod(schema.additionalProperties));
    }
  } else {
    result = z.unknown();
  }

  return nullable ? result.nullable() : result;
}
