import * as z from 'zod/v4';

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${canonicalJson(value[key])}`
    )).join(',')}}`;
  }
  return JSON.stringify(value);
}

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
  if (Object.hasOwn(schema, 'const')) return z.literal(schema.const);
  if (schema.oneOf) {
    const alternatives = schema.oneOf.map(jsonSchemaToZod);
    return z.union(alternatives).refine(value => alternatives.filter(variant => variant.safeParse(value).success).length === 1,
      { message: 'Value must match exactly one documented shape.' });
  }
  const declaredTypes = Array.isArray(schema.type) ? schema.type : [schema.type];
  const nonNullTypes = declaredTypes.filter((candidate) => candidate && candidate !== 'null');
  const nullable = declaredTypes.includes('null');
  // A null-only alternative is a type, not an unconstrained nullable value.
  // Keeping it exact also preserves oneOf exclusivity for non-null values.
  if (nullable && nonNullTypes.length === 0) return z.null();
  if (!schema.enum && nonNullTypes.length > 1) {
    const variants = nonNullTypes.map((type) => jsonSchemaToZod({ ...schema, type }));
    const union = z.union(variants);
    return nullable ? union.nullable() : union;
  }
  const { type } = singleType(schema);
  let result;

  if (schema.enum) {
    const literals = schema.enum.map((value) => z.literal(value));
    result = literals.length === 1 ? literals[0] : z.union(literals);
  } else if (type === 'string') {
    result = z.string();
    if (schema.minLength !== undefined) result = result.min(schema.minLength);
    if (schema.maxLength !== undefined) result = result.max(schema.maxLength);
    if (schema.pattern) result = result.regex(new RegExp(schema.pattern));
  } else if (type === 'integer') {
    result = z.number().int();
    if (schema.minimum !== undefined) result = result.min(schema.minimum);
    if (schema.maximum !== undefined) result = result.max(schema.maximum);
  } else if (type === 'number') {
    result = z.number();
    if (schema.minimum !== undefined) result = result.min(schema.minimum);
    if (schema.maximum !== undefined) result = result.max(schema.maximum);
    if (schema.exclusiveMinimum !== undefined) result = result.gt(schema.exclusiveMinimum);
    if (schema.exclusiveMaximum !== undefined) result = result.lt(schema.exclusiveMaximum);
  } else if (type === 'boolean') {
    result = z.boolean();
  } else if (type === 'array') {
    result = z.array(jsonSchemaToZod(schema.items));
    if (schema.minItems !== undefined) result = result.min(schema.minItems);
    if (schema.maxItems !== undefined) result = result.max(schema.maxItems);
    if (schema.uniqueItems === true) {
      result = result.refine(
        (items) => new Set(items.map(canonicalJson)).size === items.length,
        { message: 'Array items must be unique.' },
      );
    }
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
    } else result = result.catchall(z.unknown());
  } else {
    result = z.unknown();
  }

  return nullable ? result.nullable() : result;
}
