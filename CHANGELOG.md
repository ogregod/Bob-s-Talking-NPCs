# Changelog

All notable changes to Bob's Talking NPCs will be documented in this file.

## [0.3.0] - 2025-02-22

### 🏦 Banking System Enhancements

The comprehensive banking system has been enhanced with custom savings funds (like "Sword Fund", "House Fund", etc.):

#### Added
- **Custom Named Savings Funds** (`AccountType.CUSTOM_FUND`):
  - Create unlimited custom savings accounts with your own names
  - Set optional savings goals with visual progress tracking
  - Enable/disable interest per fund
  - Perfect for saving toward specific purchases (gear, property, mounts, etc.)

- **Enhanced Account Management**:
  - Rename custom funds at any time
  - Close custom funds with automatic balance return
  - View all custom funds in accounts tab
  - Goal progress bars showing % complete
  - Amount remaining display

- **Account Metadata System**:
  - Added `metadata` field to bank accounts for extensibility
  - Supports savings goals, custom notes, and future features
  - Preserved through saves and migrations

- **Improved Localization**:
  - 16 new Bank localization strings
  - Custom fund creation prompts
  - Goal tracking messages
  - Account management confirmations

#### Modified
- `bank-model.mjs`: Added CUSTOM_FUND account type and metadata field
- `bank-handler.mjs`: Updated openAccount to support custom funds and metadata
- `bank-window.mjs`: Added 3 new action handlers (openCustomFund, closeAccount, renameAccount)
- `bank-window.mjs`: Enhanced _prepareAccount to show goal progress for custom funds
- `templates/bank/content.hbs`: Added custom fund UI with goal tracking, rename/close buttons, and fund creation section
- `lang/en.json`: Added 9 new banking localization strings + 2 Common strings (Or, Rename)

#### Banking System Overview
The existing banking system (3,268 lines) includes:
- ✓ Multiple account types (checking, savings, custom funds)
- ✓ Loans with interest calculations and payment schedules
- ✓ Time-based interest accrual using game time
- ✓ Transaction logging with full history
- ✓ Safe deposit boxes for item storage
- ✓ Inter-account transfers
- ✓ Global bank networks
- ✓ Full dialogue integration via BANK nodes

## [0.2.001] - 2025-02-22

### 🎉 Major Features

#### 1. Dynamic Pricing System

Complete overhaul of the service pricing system across all 69 business types and 150+ services.

#### 2. Dialogue Preview System

Full-featured dialogue testing tool for rapid iteration and debugging.

#### Added
- **4 New Pricing Modes**:
  - `itemValue`: Percentage of item value with minimum floor (for custom crafting)
  - `spellLevel`: Base + (level × multiplier) formula (for spell services)
  - `enchantment`: Integration with enchantment rarity system
  - `tiered`: Multiple service quality levels with different prices

- **Service Selection Dialog** (Player UI):
  - Beautiful tier card selection for tiered services
  - Real-time spell level pricing calculator
  - Enchantment picker integration
  - Affordability checks with visual feedback
  - Price breakdowns and summaries

- **Enhanced Service Database Manager** (GM Tool):
  - Support for all 9 pricing modes (4 existing + 4 new + variable)
  - Conditional form fields that show/hide based on pricing type
  - Tier management UI with add/remove/reorder functionality
  - Pricing summary display in template list
  - Enhanced save logic for all new pricing fields

- **Centralized Pricing System**:
  - New `service-pricing.mjs` module with unified pricing calculations
  - `calculateServicePrice()` function used by all service executors
  - `getPricingSummary()` for human-readable pricing descriptions
  - `validatePricingConfig()` for configuration validation

- **Automatic Migration**:
  - Backward compatibility for existing campaigns
  - Auto-upgrades services to appropriate pricing modes:
    - ENCHANT → enchantment pricing
    - SPELL_COPYING → spell level pricing
    - SCRIBE_SCROLL → spell level pricing
    - BREW_POTION → spell level pricing
    - CUSTOM_ORDER → item value pricing
  - Migrates service templates, merchant shops, and active orders
  - Version tracking with idempotent execution

#### Changed
- **45 Service Updates Across 69 Businesses**:
  - **Magic Services**: Wizard's Tower, Enchanter, Scribe, Library, Apothecary, Alchemist
  - **Healing Services**: Temple (4-tier healing, 4-tier resurrection), Shrine
  - **Custom Crafting**: All blacksmiths, armorers, leatherworkers, tailors, jewelers, luthiers
  - **Specialty Services**: Menagerie, Shipyard, Courier, Falconer, Glasshouse

- **Updated Service Templates**:
  - Custom Order: 100% of item value
  - Enchant Item: Enchantment rarity-based
  - Spell Copying: 10 + (level × 50)gp
  - Healing: 4 tiers (10gp-100gp) with dice rolls
  - Resurrection: 4 tiers (500gp-50,000gp)

- **Service Executors**:
  - All executors now use centralized pricing calculator
  - Healing executor supports tiered pricing with dice roll formulas
  - Enchant executor uses enchantment system pricing
  - Item creation executor uses spell level pricing
  - Repair executor uses dynamic cost calculation

#### Technical Details
- **Pricing System**:
  - Files Created: 3 (service-pricing.mjs, service-selection-dialog.mjs, service-pricing-v2-migration.mjs)
  - Files Modified: 11 (merchant-model, executors, templates, business registry, UI, styles, module entry)
  - Lines of Code: ~2,000 new lines across pricing system, UI, and migration
  - CSS Styling: 387 lines of new styles for service selection dialog

- **Dialogue Preview**:
  - Files Created: 5 (dialogue-preview.mjs + 4 templates)
  - Files Modified: 3 (dialogue-editor.mjs, en.json, dialogue.css)
  - Lines of Code: ~560 lines of preview logic + 250 lines of CSS
  - Templates: header, content, responses, footer

#### Integration
- ✅ Works with existing faction discount system
- ✅ Works with reputation-based pricing
- ✅ Works with charisma modifiers
- ✅ Works with conversation dialogue integration
- ✅ Works with multiplayer socket sync

#### Dialogue Preview Features
- **Interactive Testing**: Test dialogue trees without needing actual NPCs
- **Typewriter Effect**: Realistic text animation with skip option
- **Navigation**: Forward, back, and restart controls
- **Node Type Visualization**: Clear indicators for SHOP, QUEST, SKILL_CHECK, etc.
- **Condition Simulation**: Test dialogue branches with simulated conditions
- **Special Node Handling**: Shows what shops/quests/services would open
- **History Tracking**: Back button to explore different dialogue paths
- **No Side Effects**: Preview mode doesn't modify game state

#### Example Pricing
- **Spell Copying**: Level 1 = 60gp, Level 5 = 260gp, Level 9 = 460gp
- **Temple Healing**: Minor (1d8+1) = 10gp, Full = 100gp
- **Temple Resurrection**: Revivify = 500gp, True Resurrection = 50,000gp
- **Custom Forging**: Scales with item value (10gp dagger vs 1500gp plate armor)
- **Enchanting**: Common item = base cost, Legendary = base cost × 5

---

## [0.5.0] - Previous Release

(Previous version history would go here)

---

## Version Format

This project uses [Semantic Versioning](https://semver.org/):
- **MAJOR**: Incompatible API changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)
