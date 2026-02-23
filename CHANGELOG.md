# Changelog

All notable changes to Bob's Talking NPCs will be documented in this file.

## [0.4.0] - 2026-02-22

### 🏦 Banking Management System

Complete overhaul of banking with world-wide bank management, faction integration, and multi-location branches:

#### Added - Banking Management System
- **Banking Manager** (`/bobsnpc bank` command for GMs):
  - Comprehensive UI for creating and managing banks across the world
  - View all banks with filterable grid (by faction, scene, network type)
  - Create, edit, and delete banks with full configuration
  - Visual bank cards showing accounts, loans, branches, bankers, reserves

- **Faction-Based Banking**:
  - Assign banks to factions for thematic organization
  - Faction-owned banks can span multiple cities/regions
  - Example: "Iron Bank Faction" with branches across Waterdeep, Baldur's Gate, Neverwinter
  - Filter banks by faction ownership in manager

- **Branch System**:
  - Create unlimited branches for parent banks
  - Each branch can have different location, scene, and banker NPCs
  - Branches inherit parent bank's settings (fees, rates, services)
  - Branch management tab shows all branches with location and stats
  - Parent banks track all branch IDs

- **Inter-Branch Configuration**:
  - Configurable inter-branch transfer fees (flat gold amount)
  - Item retrieval fees for accessing lock boxes from different branches
  - Lock box policies: branch-specific OR global access with fees
  - Example: Store sword at Waterdeep branch, retrieve from Baldur's Gate for 10gp fee

- **Multi-Banker Support**:
  - Assign multiple NPC bankers to each bank location
  - `bankerNpcUuids` array replaces single NPC limitation
  - Any assigned NPC can trigger banking dialogue node
  - Perfect for large bank branches with multiple tellers

- **Enhanced Bank Model** (bank-model.mjs):
  - `factionId` - Ties bank to faction system
  - `parentBankId` / `branchIds` - Branch hierarchy
  - `isBranch` - Quick branch identification flag
  - `interBranchFees` - Transfer and item retrieval fees
  - `lockBoxPolicy` - Branch-specific vs remote access rules
  - `bankerNpcUuids` - Array of banker NPCs

- **New BankHandler Methods**:
  - `deleteBank()` - Remove bank and all branches
  - `getBranchesForBank()` - Get all branches of parent
  - `getBanksForFaction()` - Query banks by faction
  - `getBankForBanker()` - Find bank for banker NPC (supports new array)

- **Banking Manager Templates**:
  - `manager-header.hbs` - Title bar with create button
  - `manager-tabs.hbs` - Navigation (All Banks, Branches, Settings)
  - `manager-content.hbs` - Comprehensive forms for all bank configuration

- **65+ New Localization Strings**:
  - Complete BankManager localization section
  - All UI labels, tooltips, help text
  - Form field descriptions and validation messages

#### Modified - Banking Clarification
- **Money Changer Business** (formerly "Bank & Exchange"):
  - Renamed to "Money Changer" to distinguish from full banking
  - Removed LOAN service (use Banking System instead)
  - Removed SAFE_DEPOSIT service (use Banking System instead)
  - Kept CURRENCY_EXCHANGE, MONEY_TRANSFER, APPRAISE services
  - Changed icon from fa-landmark to fa-coins
  - Updated description to clarify it's NOT a full bank

#### Banking System Architecture
**Standalone Banking** (BANK dialogue node → BankWindow):
- Comprehensive account management (checking, savings, custom funds)
- Full loan system with collateral & interest calculations
- Transaction logs with game time tracking
- Interest accrual on savings accounts
- Account-to-account transfers
- Safe deposit boxes with item storage

**Money Changer** (SHOP dialogue node → ShopWindow):
- Currency exchange (CP/SP/EP/GP/PP conversions)
- Inter-city money wire transfers
- Financial appraisals
- Short-term vault storage
- NO account management or loans

#### Use Cases
- **Global Banking Network**: Create "Iron Bank" faction, add branches in every major city
- **Regional Banks**: Create separate banks per region with local branches
- **Faction Exclusive**: Harpers Bank (requires Harper faction membership)
- **Branch Fees**: Transfer money between branches for small fee, or visit branch directly for free
- **Lock Box Retrieval**: Store items at home branch, pay fee to access from distant branch

#### Files Changed
- `scripts/data/bank-model.mjs` - Added faction/branch fields to createBank()
- `scripts/handlers/bank-handler.mjs` - Added branch/faction management methods
- `scripts/apps/bank-manager.mjs` - NEW: Banking Management ApplicationV2
- `templates/bank/manager-header.hbs` - NEW: Manager header template
- `templates/bank/manager-tabs.hbs` - NEW: Manager tabs template
- `templates/bank/manager-content.hbs` - NEW: Manager content with all forms
- `scripts/module.mjs` - Added BankingManager import/export, `/bobsnpc bank` command
- `scripts/data/business-registry.mjs` - Refactored BANK_EXCHANGE to Money Changer
- `lang/en.json` - Added 65+ BankManager localization strings

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

#### Clarified: Banking vs Money Changer

To avoid confusion between the comprehensive Banking System and merchant services:

**Standalone Banking System** (accessed via BANK dialogue nodes):
- Comprehensive account management (checking, savings, party, guild, custom funds)
- Full loan system with collateral, interest rates, and payment schedules
- Transaction logs with complete game time history
- Interest accrual on savings accounts
- Account-to-account transfers
- Safe deposit box rentals

**Money Changer Business** (accessed via SHOP dialogue nodes):
- Renamed from "Bank & Exchange" to "Money Changer"
- Utility financial services only (NO full banking)
- Currency exchange (CP/SP/EP/GP/PP conversions)
- Inter-city money transfers
- Financial appraisals
- Short-term vault storage

**What Changed**:
- Removed LOAN service from Money Changer (use Banking System instead)
- Removed SAFE_DEPOSIT service from Money Changer (use Banking System instead)
- Updated business description to clarify it's NOT a full bank
- Changed icon from fa-landmark to fa-coins
- Updated tags to emphasize currency exchange focus

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
