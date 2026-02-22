/**
 * Bob's Talking NPCs - Service Pricing V2 Migration
 * Migrates existing campaign data to use the new dynamic pricing system
 * Ensures backward compatibility while enabling new pricing features
 */

const MODULE_ID = "bobs-talking-npcs";

import { PriceType } from "../data/merchant-model.mjs";

/**
 * Current migration version
 */
const MIGRATION_VERSION = "2.0.0";
const MIGRATION_KEY = "servicePricingVersion";

/**
 * Main migration function
 * @returns {Promise<boolean>} True if migration ran, false if already migrated
 */
export async function migrateServicePricingToV2() {
  console.log(`${MODULE_ID} | Checking service pricing migration...`);

  // Check if already migrated
  const currentVersion = game.settings.get(MODULE_ID, MIGRATION_KEY) || "1.0.0";
  if (currentVersion === MIGRATION_VERSION) {
    console.log(`${MODULE_ID} | Service pricing already at version ${MIGRATION_VERSION}`);
    return false;
  }

  console.log(`${MODULE_ID} | Migrating service pricing from ${currentVersion} to ${MIGRATION_VERSION}...`);

  try {
    // Migrate in sequence
    await _migrateServiceTemplates();
    await _migrateMerchantShops();
    await _migrateActiveServiceOrders();

    // Update migration version
    await game.settings.set(MODULE_ID, MIGRATION_KEY, MIGRATION_VERSION);

    console.log(`${MODULE_ID} | Service pricing migration completed successfully`);
    ui.notifications.info("Service pricing system updated to V2");

    return true;

  } catch (error) {
    console.error(`${MODULE_ID} | Service pricing migration failed:`, error);
    ui.notifications.error("Service pricing migration failed - check console for details");
    return false;
  }
}

/**
 * Migrate service templates in settings
 * @private
 */
async function _migrateServiceTemplates() {
  console.log(`${MODULE_ID} | Migrating service templates...`);

  const templates = game.settings.get(MODULE_ID, "serviceTemplates") || [];
  let migrated = 0;

  const migratedTemplates = templates.map(template => {
    const updated = _upgradeServiceDefinition(template);
    if (updated !== template) migrated++;
    return updated;
  });

  if (migrated > 0) {
    await game.settings.set(MODULE_ID, "serviceTemplates", migratedTemplates);
    console.log(`${MODULE_ID} | Migrated ${migrated} service templates`);
  } else {
    console.log(`${MODULE_ID} | No service templates needed migration`);
  }
}

/**
 * Migrate merchant shop data stored in scene flags
 * @private
 */
async function _migrateMerchantShops() {
  console.log(`${MODULE_ID} | Migrating merchant shops...`);

  let totalShopsMigrated = 0;
  let totalServicesMigrated = 0;

  // Iterate through all scenes
  for (const scene of game.scenes) {
    const merchants = scene.getFlag(MODULE_ID, "merchants") || {};
    let sceneMigrated = false;

    for (const [merchantId, merchantData] of Object.entries(merchants)) {
      if (!merchantData.services || merchantData.services.length === 0) continue;

      const originalServices = [...merchantData.services];
      const migratedServices = merchantData.services.map(service => {
        const updated = _upgradeServiceDefinition(service);
        if (updated !== service) {
          totalServicesMigrated++;
          return updated;
        }
        return service;
      });

      // Check if any services changed
      if (JSON.stringify(originalServices) !== JSON.stringify(migratedServices)) {
        merchantData.services = migratedServices;
        merchants[merchantId] = merchantData;
        sceneMigrated = true;
        totalShopsMigrated++;
      }
    }

    // Save updated merchants for this scene
    if (sceneMigrated) {
      await scene.setFlag(MODULE_ID, "merchants", merchants);
    }
  }

  console.log(`${MODULE_ID} | Migrated ${totalServicesMigrated} services across ${totalShopsMigrated} merchant shops`);
}

/**
 * Migrate active service orders
 * @private
 */
async function _migrateActiveServiceOrders() {
  console.log(`${MODULE_ID} | Migrating active service orders...`);

  const orders = game.settings.get(MODULE_ID, "activeServiceOrders") || [];
  let migrated = 0;

  const migratedOrders = orders.map(order => {
    // Upgrade service definition if it exists
    if (order.serviceDef) {
      const updated = _upgradeServiceDefinition(order.serviceDef);
      if (updated !== order.serviceDef) {
        migrated++;
        return { ...order, serviceDef: updated };
      }
    }
    return order;
  });

  if (migrated > 0) {
    await game.settings.set(MODULE_ID, "activeServiceOrders", migratedOrders);
    console.log(`${MODULE_ID} | Migrated ${migrated} active service orders`);
  } else {
    console.log(`${MODULE_ID} | No active service orders needed migration`);
  }
}

/**
 * Upgrade a service definition to V2 pricing format
 * @param {object} serviceDef - Service definition to upgrade
 * @returns {object} Upgraded service definition
 * @private
 */
function _upgradeServiceDefinition(serviceDef) {
  if (!serviceDef) return serviceDef;

  // Clone to avoid mutations
  const upgraded = { ...serviceDef };

  // Normalize priceType to enum values
  if (typeof upgraded.priceType === "string") {
    upgraded.priceType = _normalizePriceType(upgraded.priceType);
  }

  // Auto-upgrade specific service types to new pricing modes
  const serviceType = upgraded.type;

  // ENCHANT services → Use enchantment pricing
  if (serviceType === "enchant" && upgraded.priceType === PriceType.FIXED) {
    upgraded.priceType = PriceType.ENCHANTMENT;
    upgraded.useEnchantmentPricing = true;
    upgraded.enchantmentPriceModifier = 1.0;
    console.log(`${MODULE_ID} | Auto-upgraded ENCHANT service to enchantment pricing`);
  }

  // SPELL_COPYING services → Use spell level pricing
  if (serviceType === "spellCopying" && upgraded.priceType === PriceType.FIXED) {
    upgraded.priceType = PriceType.SPELL_LEVEL;
    upgraded.spellLevelBase = 10;
    upgraded.spellLevelMultiplier = 50;
    console.log(`${MODULE_ID} | Auto-upgraded SPELL_COPYING service to spell level pricing`);
  }

  // SCRIBE_SCROLL services → Use spell level pricing
  if (serviceType === "scribeScroll" && upgraded.priceType === PriceType.FIXED) {
    upgraded.priceType = PriceType.SPELL_LEVEL;
    upgraded.spellLevelBase = 25;
    upgraded.spellLevelMultiplier = 25;
    console.log(`${MODULE_ID} | Auto-upgraded SCRIBE_SCROLL service to spell level pricing`);
  }

  // BREW_POTION services → Use spell level pricing
  if (serviceType === "brewPotion" && upgraded.priceType === PriceType.FIXED) {
    upgraded.priceType = PriceType.SPELL_LEVEL;
    upgraded.spellLevelBase = 25;
    upgraded.spellLevelMultiplier = 25;
    console.log(`${MODULE_ID} | Auto-upgraded BREW_POTION service to spell level pricing`);
  }

  // CUSTOM_ORDER services → Use item value pricing
  if (serviceType === "customOrder" && upgraded.priceType === PriceType.FIXED) {
    upgraded.priceType = PriceType.ITEM_VALUE;
    upgraded.itemValuePercent = 100; // 100% of item value
    upgraded.itemValueMinimum = 0;   // No minimum by default
    console.log(`${MODULE_ID} | Auto-upgraded CUSTOM_ORDER service to item value pricing`);
  }

  // HEALING services → Keep as FIXED unless already tiered
  // (Don't auto-upgrade healing as it requires tier definitions)

  // RESURRECTION services → Keep as FIXED unless already tiered
  // (Don't auto-upgrade resurrection as it requires tier definitions)

  // Ensure all new pricing fields exist with defaults
  upgraded.itemValuePercent = upgraded.itemValuePercent ?? 10;
  upgraded.itemValueMinimum = upgraded.itemValueMinimum ?? 0;
  upgraded.spellLevelBase = upgraded.spellLevelBase ?? 25;
  upgraded.spellLevelMultiplier = upgraded.spellLevelMultiplier ?? 50;
  upgraded.useEnchantmentPricing = upgraded.useEnchantmentPricing ?? false;
  upgraded.enchantmentPriceModifier = upgraded.enchantmentPriceModifier ?? 1.0;
  upgraded.pricingTiers = upgraded.pricingTiers || [];

  return upgraded;
}

/**
 * Normalize old priceType strings to PriceType enum values
 * @param {string} oldType - Old price type string
 * @returns {string} Normalized PriceType enum value
 * @private
 */
function _normalizePriceType(oldType) {
  // Map old string values to new enum values
  const typeMap = {
    "fixed": PriceType.FIXED,
    "percent": PriceType.PERCENT,
    "perDay": PriceType.PER_DAY,
    "per-day": PriceType.PER_DAY,
    "perItem": PriceType.PER_ITEM,
    "per-item": PriceType.PER_ITEM,
    "variable": PriceType.VARIABLE,
    "itemValue": PriceType.ITEM_VALUE,
    "item-value": PriceType.ITEM_VALUE,
    "spellLevel": PriceType.SPELL_LEVEL,
    "spell-level": PriceType.SPELL_LEVEL,
    "enchantment": PriceType.ENCHANTMENT,
    "tiered": PriceType.TIERED
  };

  return typeMap[oldType] || PriceType.FIXED;
}

/**
 * Register migration setting
 */
export function registerMigrationSetting() {
  game.settings.register(MODULE_ID, MIGRATION_KEY, {
    name: "Service Pricing Version",
    hint: "Internal setting tracking service pricing migration version",
    scope: "world",
    config: false,
    type: String,
    default: "1.0.0"
  });
}

/**
 * Run migration on module initialization (if needed)
 * @returns {Promise<void>}
 */
export async function checkAndRunMigration() {
  // Only run for GMs
  if (!game.user.isGM) return;

  // Wait for ready hook to ensure all data is loaded
  Hooks.once("ready", async () => {
    await migrateServicePricingToV2();
  });
}
