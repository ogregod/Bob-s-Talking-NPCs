/**
 * Bob's Talking NPCs - Service Executor Registry
 * Central registry mapping ServiceType to executor implementations.
 * Each executor knows how to validate and execute a specific category of services.
 */

const MODULE_ID = "bobs-talking-npcs";

/**
 * Map of serviceType -> executor
 * @type {Map<string, ServiceExecutor>}
 */
const executorMap = new Map();

/**
 * Map of executorId -> executor (for direct lookup)
 * @type {Map<string, ServiceExecutor>}
 */
const executorById = new Map();

/**
 * Register a service executor.
 * An executor handles one or more ServiceType values.
 *
 * @param {ServiceExecutor} executor
 * @param {string} executor.id - Unique executor identifier
 * @param {string[]} executor.serviceTypes - ServiceType values this executor handles
 * @param {function} executor.validate - (ctx) => { valid: boolean, errors: string[] }
 * @param {function} executor.execute - (ctx) => Promise<ServiceResult>
 * @param {function} [executor.getDescription] - (ctx) => string
 */
export function registerExecutor(executor) {
  if (!executor.id) {
    throw new Error("Executor must have an id");
  }
  if (!executor.serviceTypes || !Array.isArray(executor.serviceTypes)) {
    throw new Error(`Executor ${executor.id} must have a serviceTypes array`);
  }
  if (typeof executor.execute !== "function") {
    throw new Error(`Executor ${executor.id} must have an execute function`);
  }

  executorById.set(executor.id, executor);

  for (const serviceType of executor.serviceTypes) {
    executorMap.set(serviceType, executor);
  }

  console.log(`${MODULE_ID} | Registered executor "${executor.id}" for ${executor.serviceTypes.length} service types`);
}

/**
 * Get the executor for a given service type.
 * Falls back to the "generic" executor if no specific one is registered.
 *
 * @param {string} serviceType - ServiceType enum value
 * @returns {ServiceExecutor}
 */
export function getExecutor(serviceType) {
  return executorMap.get(serviceType) || executorById.get("generic") || null;
}

/**
 * Get an executor by its ID.
 * @param {string} executorId
 * @returns {ServiceExecutor|null}
 */
export function getExecutorById(executorId) {
  return executorById.get(executorId) || null;
}

/**
 * Execute a service using the appropriate executor.
 *
 * @param {string} serviceType - ServiceType enum value
 * @param {ServiceContext} context - Execution context
 * @returns {Promise<ServiceResult>}
 */
export async function executeService(serviceType, context) {
  const executor = getExecutor(serviceType);
  if (!executor) {
    return {
      success: false,
      message: `No executor registered for service type: ${serviceType}`
    };
  }

  // Validate first if the executor supports it
  if (typeof executor.validate === "function") {
    const validation = executor.validate(context);
    if (!validation.valid) {
      return {
        success: false,
        message: validation.errors.join("; ")
      };
    }
  }

  return executor.execute(context);
}

/**
 * Get all registered executors.
 * @returns {ServiceExecutor[]}
 */
export function getAllExecutors() {
  return [...executorById.values()];
}

/**
 * Check if a specific service type has a dedicated executor (not the generic fallback).
 * @param {string} serviceType
 * @returns {boolean}
 */
export function hasDedicatedExecutor(serviceType) {
  const executor = executorMap.get(serviceType);
  return executor ? executor.id !== "generic" : false;
}

/**
 * @typedef {object} ServiceContext
 * @property {Actor} actor - The player actor using the service
 * @property {object} merchant - The merchant data object
 * @property {object} serviceDef - The service definition from the merchant
 * @property {Item} [item] - The item being serviced (if applicable)
 * @property {object} options - Additional options passed by the caller
 * @property {number} gameTime - Current game world time
 * @property {Function} deductGold - Function to deduct gold from actor
 * @property {Function} [sendChatMessage] - Function to send chat messages
 */

/**
 * @typedef {object} ServiceResult
 * @property {boolean} success - Whether the service executed successfully
 * @property {number} [cost] - Gold cost deducted
 * @property {string} [message] - Result message
 * @property {boolean} [pending] - Whether the service is pending GM approval
 * @property {string} [requestId] - Service request ID if pending
 * @property {object} [data] - Additional result data
 */

/**
 * @typedef {object} ServiceExecutor
 * @property {string} id - Unique executor identifier
 * @property {string[]} serviceTypes - ServiceType values handled
 * @property {function} validate - Validation function
 * @property {function} execute - Execution function
 * @property {function} [getDescription] - Description function
 */
