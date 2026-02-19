/**
 * Deep freeze utility for enforcing runtime immutability
 * Recursively freezes objects and arrays to prevent modification
 */

/**
 * Deep freeze an object and all nested objects/arrays
 */
export function deepFreeze<T>(obj: T): Readonly<T> {
  // Freeze the object itself
  Object.freeze(obj);

  // Recursively freeze all properties
  Object.getOwnPropertyNames(obj).forEach((prop) => {
    const value = (obj as any)[prop];
    
    if (value !== null && (typeof value === 'object' || typeof value === 'function')) {
      // Only freeze if not already frozen
      if (!Object.isFrozen(value)) {
        deepFreeze(value);
      }
    }
  });

  return obj as Readonly<T>;
}

/**
 * Check if an object is deeply frozen
 */
export function isDeepFrozen(obj: any): boolean {
  if (!Object.isFrozen(obj)) {
    return false;
  }

  // Check all properties
  for (const prop of Object.getOwnPropertyNames(obj)) {
    const value = obj[prop];
    
    if (value !== null && typeof value === 'object') {
      if (!isDeepFrozen(value)) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Create a deep readonly copy of an object
 */
export function createImmutableCopy<T>(obj: T): Readonly<T> {
  // Create a deep copy first
  const copy = JSON.parse(JSON.stringify(obj));
  // Then freeze it
  return deepFreeze(copy);
}
