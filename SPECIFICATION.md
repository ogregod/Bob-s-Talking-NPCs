# Bob's Talking NPCs - Technical Specification

**Module ID:** `bobs-talking-npcs`
**Display Name:** Bob's Talking NPCs
**Tagline:** The complete NPC interaction system
**Author:** Arcana5e
**License:** GPL
**Compatibility:** Foundry VTT V13 (Build 351), D&D 5e 5.2.4
**Dependencies:** None (standalone)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Core Systems](#2-core-systems)
3. [Quest System](#3-quest-system)
4. [Dialogue System](#4-dialogue-system)
5. [Merchant System](#5-merchant-system)
6. [Relationship System](#6-relationship-system)
7. [Faction System](#7-faction-system)
8. [Loot System](#8-loot-system)
9. [Banking System](#9-banking-system)
10. [Hireling & Companion System](#10-hireling--companion-system)
11. [Mount System](#11-mount-system)
12. [Crime & Consequences System](#12-crime--consequences-system)
13. [Services System](#13-services-system)
14. [Property System](#14-property-system)
15. [Storage & Vault System](#15-storage--vault-system)
16. [Player Trading System](#16-player-trading-system)
17. [World State & Events](#17-world-state--events)
18. [User Interface](#18-user-interface)
19. [GM Tools](#19-gm-tools)
20. [Settings & Configuration](#20-settings--configuration)
21. [Technical Architecture](#21-technical-architecture)
22. [File Structure](#22-file-structure)
23. [Data Schemas](#23-data-schemas)
24. [API Reference](#24-api-reference)
25. [Accessibility](#25-accessibility)
26. [Performance](#26-performance)
27. [Module Compatibility](#27-module-compatibility)
28. [Distribution & Community](#28-distribution--community)

---

## 1. Overview

### 1.1 Purpose

Bob's Talking NPCs is a comprehensive, standalone module that replaces the need for multiple modules including:
- Simple Quest (quest management)
- Item Piles (merchants, loot, storage)
- Monk's Active Tile Triggers (quest board interactions)

### 1.2 Core Philosophy

- **GM Customization:** Nearly every feature is configurable by the GM
- **Player Agency:** Players have their own settings and preferences
- **Party-Focused:** Quests and content are designed for party play with individual options
- **Deep Integration:** Tight integration with D&D 5e mechanics
- **Professional Quality:** Clean, accessible, well-documented

### 1.3 Key Features Summary

| System | Description |
|--------|-------------|
| Quests | Party-based quests with objectives, rewards, branching paths |
| Dialogue | Visual node-based conversation editor with conditions |
| Merchants | Full buy/sell system with haggling and dynamic pricing |
| Factions | Reputation and rank system with inter-faction relationships |
| Relationships | Per-player NPC relationships affecting all interactions |
| Banking | Deposit, withdraw, loans, interest |
| Hirelings | Hire NPCs for combat and utility |
| Mounts | Purchase, stable, and ride mounts |
| Crime | Stealing, bounties, consequences |
| Properties | Own and manage buildings and businesses |

---

## 2. Core Systems

### 2.1 Party Definition

The party can be defined by:
- **Folder-based:** A designated actor folder
- **Primary Party:** Using the D&D 5e Primary Party feature
- **Manual:** GM-defined list of actors

Reward distribution is editable before payout - GM can exclude absent players or include disconnected ones.

### 2.2 NPC Roles

A single NPC can have multiple roles simultaneously:
- Quest Giver
- Quest Turn-in
- Merchant/Shopkeeper
- Banker
- Stable Master
- Innkeeper
- Service Provider (trainer, enchanter, etc.)
- Information Broker
- Hireling Recruiter
- Fence (black market)
- Faction Representative

### 2.3 Interaction Method

- **Primary:** Double left-click on NPC token
- **Secondary:** Right-click context menu options
- All interactions route through the dialogue system

### 2.4 Multiplayer Behavior

- Nearby players see shared conversations
- Players can join active conversations
- Initiating player makes dialogue choices
- Other players can vote on responses (visible to initiator)
- Dialogue state auto-saves on disconnect
- Rejoining continues where left off

---

## 3. Quest System

### 3.1 Quest Properties

```javascript
{
  id: "unique-quest-id",
  name: "Quest Name",
  description: "Full quest description",
  category: "side_quest", // main_story, side_quest, bounty, daily, guild_contract, custom
  customCategory: null, // GM-defined category name
  rank: "iron", // Faction rank requirement
  status: "available", // available, accepted, in_progress, completed, failed
  hidden: false, // Hidden until discovered
  repeatable: {
    enabled: false,
    type: "none", // none, daily, weekly, infinite, cooldown
    cooldownDays: 0
  },

  // Quest Giver
  giver: {
    actorUuid: "Actor.xxxxx",
    turnInActorUuid: "Actor.yyyyy", // Can be different from giver
    turnInAlternatives: [] // Backup NPCs if main dies
  },

  // Party Tracking
  acceptedBy: [], // Actor UUIDs
  visibility: "party", // party, individual, class_specific, secret
  visibleToClasses: [], // If class_specific
  visibleToActors: [], // If secret

  // Objectives
  objectives: [
    {
      id: "obj-1",
      text: "Slay the basilisk",
      type: "manual", // manual, kill_count, item_collect, location
      completed: false,
      // Type-specific data
      killTarget: null,
      killCount: 0,
      killCurrent: 0,
      itemId: null,
      itemCount: 0,
      locationSceneId: null
    }
  ],

  // Rewards
  rewards: {
    distribution: "split", // split, full_each, gm_choice
    gold: 500,
    xp: 1000,
    items: [
      { compendiumId: "Compendium.dnd5e.items.xxxxx", quantity: 1 }
    ],
    choices: [
      {
        type: "pick_one", // pick_one, pick_x
        pickCount: 1,
        options: [
          { type: "gold", amount: 200 },
          { type: "item", compendiumId: "...", quantity: 1 }
        ]
      }
    ],
    reputation: [
      { factionId: "faction-1", amount: 50 }
    ],
    relationship: [
      { actorUuid: "Actor.xxxxx", amount: 10 }
    ],
    unlocks: {
      dialogueOptions: [],
      areas: [],
      shops: []
    },
    companion: null, // Actor UUID if quest grants companion
    property: null, // Scene UUID if quest grants property
    titles: ["Basilisk Slayer"],
    custom: [] // GM-defined text rewards
  },

  // Prerequisites
  prerequisites: {
    level: 0,
    quests: [], // Quest IDs that must be completed
    factionRank: { factionId: null, rank: null },
    relationship: { actorUuid: null, minimum: 0 },
    items: [], // Items required to accept
    custom: [] // GM-defined requirements
  },

  // Branching
  branches: [
    {
      id: "branch-1",
      name: "Side with bandits",
      condition: "dialogue_choice", // How this branch activates
      rewards: { /* Different rewards */ },
      consequences: { /* World state changes */ }
    }
  ],

  // Abandonment
  abandonment: {
    allowed: true,
    consequences: {
      reputationLoss: [],
      cooldownDays: 0,
      relationshipLoss: []
    }
  },

  // On NPC Death
  onGiverDeath: "gm_prompt", // gm_prompt, fail, continue, use_alternative

  // Conflicts
  conflictsWith: [], // Quest IDs that become failed if this completes
  mutuallyExclusive: [], // Quest IDs that can't be accepted simultaneously

  // Display
  displayPrerequisites: "locked", // locked (show as locked), hidden (don't show)

  // Handouts
  handouts: [
    { type: "image", url: "/path/to/map.png", name: "Treasure Map" },
    { type: "journal", pageId: "JournalEntryPage.xxxxx" }
  ],

  // Notes
  partyNotes: "",
  playerNotes: {} // Per-player notes
}
```

### 3.2 Quest States

```
available → accepted → in_progress → completed
                    ↘           ↗
                      → failed
```

- **Available:** Quest can be accepted
- **Accepted:** Quest is in player's log but not started
- **In Progress:** At least one objective attempted
- **Completed:** All required objectives done, rewards claimed
- **Failed:** Quest failed (time, death, choices, abandonment)

### 3.3 Quest Categories

Default categories (GM can add custom):
- Main Story
- Side Quest
- Bounty
- Daily
- Guild Contract

### 3.4 Quest Templates

Pre-built templates for quick quest creation:
- **Kill Quest:** Defeat X enemies
- **Fetch Quest:** Collect X items
- **Escort Quest:** Protect NPC to destination
- **Investigation Quest:** Discover information
- **Delivery Quest:** Bring item to NPC
- **Blank:** Empty template

### 3.5 Quest Journal

Completed quests are moved to a "Completed Quests" journal for historical record.

### 3.6 Kill Verification

- GM manually confirms kills in Quest Overlay
- Item-based verification (bring trophy items)
- Auto-detect items in inventory for collection quests

---

## 4. Dialogue System

### 4.1 Dialogue Structure

```javascript
{
  id: "dialogue-id",
  actorUuid: "Actor.xxxxx",
  name: "Innkeeper Dialogue",

  // Starting node
  startNodeId: "node-1",

  // Alternative start for wrong location
  alternativeStartNodeId: "node-alt",
  expectedScenes: ["Scene.xxxxx"],

  // Nodes
  nodes: {
    "node-1": {
      id: "node-1",
      type: "npc_speech", // npc_speech, player_choice, skill_check, shop, quest_offer, reward, branch, end

      // NPC Speech
      text: "Welcome to the Rusty Tankard!",
      speaker: "self", // self, or Actor UUID for other NPC

      // Voice
      voiceLine: {
        type: "file", // file, url
        path: "/audio/innkeeper-welcome.mp3",
        url: null
      },

      // Portrait
      portrait: {
        type: "token", // token, actor, custom
        customPath: null
      },

      // Responses (for npc_speech nodes)
      responses: [
        {
          id: "resp-1",
          text: "I need a room.",
          nextNodeId: "node-2",
          conditions: [], // Conditions to show this option
          effects: [] // Effects when chosen
        }
      ],

      // Conditions to reach this node
      conditions: [],

      // Effects when reaching this node
      effects: []
    }
  }
}
```

### 4.2 Node Types

| Type | Description |
|------|-------------|
| `npc_speech` | NPC says something, player picks response |
| `player_choice` | Multiple player options without NPC speech |
| `skill_check` | Roll a skill check, branch on result |
| `shop` | Open merchant interface |
| `quest_offer` | Offer a quest to accept/decline |
| `quest_turnin` | Complete a quest and give rewards |
| `reward` | Give rewards without quest |
| `service` | Open service interface (training, etc.) |
| `bank` | Open banking interface |
| `hire` | Open hireling recruitment |
| `stable` | Open mount stable |
| `branch` | Invisible node that branches based on conditions |
| `end` | End the conversation |

### 4.3 Conditions

Conditions can check:

```javascript
{
  type: "quest_status",
  questId: "quest-1",
  status: "completed" // available, accepted, in_progress, completed, failed
}

{
  type: "quest_objective",
  questId: "quest-1",
  objectiveId: "obj-1",
  completed: true
}

{
  type: "faction_rank",
  factionId: "faction-1",
  rank: "silver",
  comparison: "gte" // gte, lte, eq
}

{
  type: "faction_reputation",
  factionId: "faction-1",
  value: 50,
  comparison: "gte"
}

{
  type: "relationship",
  value: 25,
  comparison: "gte"
}

{
  type: "player_level",
  value: 5,
  comparison: "gte"
}

{
  type: "player_class",
  classes: ["paladin", "cleric"]
}

{
  type: "player_race",
  races: ["elf", "half-elf"]
}

{
  type: "has_item",
  itemId: "Item.xxxxx",
  quantity: 1
}

{
  type: "has_gold",
  amount: 100
}

{
  type: "flag",
  scope: "world", // world, actor
  key: "metTheKing",
  value: true
}

{
  type: "time",
  from: 6, // Hour (0-23)
  to: 18
}

{
  type: "previous_choice",
  dialogueId: "dialogue-1",
  choiceId: "resp-3"
}
```

### 4.4 Effects

Effects triggered by dialogue choices:

```javascript
{
  type: "modify_relationship",
  amount: 10 // Can be negative
}

{
  type: "modify_faction_reputation",
  factionId: "faction-1",
  amount: 25
}

{
  type: "set_flag",
  scope: "world",
  key: "metTheKing",
  value: true
}

{
  type: "give_item",
  itemId: "Item.xxxxx",
  quantity: 1
}

{
  type: "take_item",
  itemId: "Item.xxxxx",
  quantity: 1
}

{
  type: "give_gold",
  amount: 50
}

{
  type: "take_gold",
  amount: 50
}

{
  type: "start_quest",
  questId: "quest-1"
}

{
  type: "complete_objective",
  questId: "quest-1",
  objectiveId: "obj-1"
}

{
  type: "add_bounty",
  amount: 100,
  region: "region-1"
}

{
  type: "chat_message",
  content: "The innkeeper looks pleased.",
  whisper: false
}

{
  type: "unlock_area",
  sceneId: "Scene.xxxxx"
}
```

### 4.5 Skill Checks

```javascript
{
  id: "node-skillcheck",
  type: "skill_check",
  skill: "persuasion", // Any D&D 5e skill
  dc: 15,

  // Per-NPC settings (set in NPC config)
  // canRetry: false,
  // failureConsequence: "price_increase" | "refuse_service" | "relationship_loss" | "none"

  successNodeId: "node-success",
  failureNodeId: "node-fail",

  // Optional critical results
  critSuccessNodeId: null,
  critFailureNodeId: null
}
```

Haggling-specific settings per NPC:
- Persuasion DC
- Intimidation DC
- Deception DC
- Failure consequences per skill type

### 4.6 NPC Memory

NPCs remember:
- Previous conversations (stored in flags)
- Choices made by players
- Number of visits
- Relationship history

Memory enables:
- "Back again, I see" type greetings
- References to past choices
- Progressive dialogue unlocks

### 4.7 Dialogue History

All conversations are auto-logged to journal entries in a "Conversation History" journal. Searchable by NPC, date, player.

### 4.8 Visual Node Editor

The dialogue editor is a visual flowchart interface:
- Drag-and-drop nodes
- Visual connections between nodes
- Color-coded node types
- Condition/effect panels
- Preview mode (test without affecting game state)
- Zoom and pan
- Mini-map for large dialogues
- Undo/redo
- Copy/paste nodes
- Search nodes by text

---

## 5. Merchant System

### 5.1 Merchant Configuration

```javascript
{
  actorUuid: "Actor.xxxxx",
  type: "merchant", // merchant, fence, stable, bank

  // Inventory
  inventory: [
    {
      itemId: "Item.xxxxx",
      quantity: -1, // -1 = infinite
      priceOverride: null, // null = use item price
      condition: [] // Conditions to show item
    }
  ],

  // Pricing
  pricing: {
    buyMultiplier: 1.0, // Player buys at this multiplier
    sellMultiplier: 0.5, // Player sells at this multiplier

    // Modifiers
    factionDiscount: {
      factionId: "faction-1",
      perRank: 0.05 // 5% discount per rank
    },
    relationshipDiscount: {
      threshold: 50,
      discount: 0.1
    },
    charismaBonus: true // Apply CHA modifier to prices
  },

  // Haggling
  haggling: {
    enabled: true,
    persuasionDC: 15,
    intimidationDC: 18,
    deceptionDC: 16,

    successDiscount: 0.1, // 10% off on success

    failureConsequences: {
      persuasion: "none",
      intimidation: "price_increase", // 10% price increase
      deception: "refuse_service" // Won't sell to player
    },

    refuseServiceDuration: "session" // session, day, permanent
  },

  // Stock Management
  stock: {
    finite: false,
    restocks: true,
    restockInterval: "day", // day, week, session, manual
    restockAmount: "full" // full, partial, random
  },

  // Buy-only / Sell-only
  canBuy: true,
  canSell: true,

  // Stolen goods
  acceptsStolenGoods: false, // Fence would have this true
  stolenGoodsPriceMultiplier: 0.3,

  // Notable items (known as stolen if sold elsewhere)
  notableItems: [] // Item IDs that are tracked as stolen
}
```

### 5.2 Currency Handling

Display format: Gold as primary, show denominations below gold only.
- Example: `11gp 7sp 4cp` (not `1pp 1gp 7sp 4cp`)

Full D&D 5e currency support (cp, sp, ep, gp, pp) with automatic conversion.

### 5.3 Shopping Interface

- Grid/list view toggle
- Search and filter
- Sort by name, price, type
- Category tabs
- Shopping cart (batch purchases)
- Quick-buy option (if enabled in settings)
- Price breakdown showing discounts

### 5.4 Player Shops

GMs can create player-owned shops:
- Player sets prices for their items
- Other players can browse and buy
- Profits go to player's currency
- Player manages inventory
- Shop can be linked to a scene location

---

## 6. Relationship System

### 6.1 Relationship Data

```javascript
{
  actorUuid: "Actor.xxxxx", // NPC
  relationships: {
    "Actor.player1": {
      value: 25, // -100 to 100
      history: [
        { date: "...", change: 10, reason: "Completed quest" }
      ]
    }
  }
}
```

### 6.2 Relationship Tiers

| Range | Tier | Description |
|-------|------|-------------|
| -100 to -75 | Hostile | Attacks on sight |
| -74 to -50 | Hated | Refuses all interaction |
| -49 to -25 | Unfriendly | Limited interaction, high prices |
| -24 to 24 | Neutral | Standard interaction |
| 25 to 49 | Friendly | Better prices, more dialogue |
| 50 to 74 | Trusted | Discounts, special quests |
| 75 to 100 | Allied | Best prices, unique content |

### 6.3 Relationship Changes

Sources of relationship change:
- Dialogue choices (GM marks options with +/- relationship)
- Quest completion (for quest giver)
- Successful/failed haggling
- Gifts (give items to NPC)
- Crimes against NPC
- Faction reputation (if NPC belongs to faction)
- GM manual adjustment

### 6.4 Relationship Effects

- Dialogue options locked/unlocked
- Price modifiers in shops
- Quest availability
- NPC behavior (hostile, helpful)
- Information willingness
- Service availability

---

## 7. Faction System

### 7.1 Faction Data

```javascript
{
  id: "faction-1",
  name: "Adventurer's Guild",
  description: "A guild for professional adventurers...",
  icon: "/icons/factions/guild.png",
  color: "#gold",

  // Headquarters
  headquarters: {
    sceneId: "Scene.xxxxx",
    specialDialogue: true // Rank-up ceremonies, etc.
  },

  // Ranks
  ranks: [
    {
      id: "copper",
      name: "Copper",
      order: 0,
      requirements: {
        reputation: 0
      },
      benefits: {
        questAccess: ["copper"],
        priceDiscount: 0,
        dialogueUnlocks: [],
        titles: [],
        rewards: [] // Items/gold granted on reaching rank
      }
    },
    {
      id: "iron",
      name: "Iron",
      order: 1,
      requirements: {
        reputation: 100,
        questsCompleted: 5,
        rankUpQuest: "quest-iron-trial" // Optional trial quest
      },
      benefits: {
        questAccess: ["copper", "iron"],
        priceDiscount: 0.05,
        dialogueUnlocks: ["guild-secrets"],
        titles: ["Guild Member"],
        rewards: [{ type: "gold", amount: 100 }]
      }
    }
    // ... more ranks
  ],

  // Default ranks
  defaultRanks: ["copper", "iron", "silver", "gold", "platinum", "mythril"],

  // Reputation
  reputation: {
    min: -100,
    max: 1000,
    decay: {
      enabled: false,
      amount: 1,
      interval: "week"
    }
  },

  // Relationships with other factions
  factionRelationships: {
    "faction-2": {
      type: "allied", // allied, neutral, rival, enemy
      reputationEffect: 0.25 // Gain 25% rep with allies
    },
    "faction-3": {
      type: "rival",
      reputationEffect: -0.5 // Lose 50% rep when gaining with rival
    }
  },

  // Members
  members: ["Actor.xxxxx", "Actor.yyyyy"],

  // Player standings
  playerStandings: {
    "Actor.player1": {
      reputation: 150,
      rank: "iron",
      history: []
    }
  }
}
```

### 7.2 Faction Relationships

| Type | Effect |
|------|--------|
| Allied | Gain reputation with one, gain smaller amount with ally |
| Neutral | No effect |
| Rival | Gain reputation with one, lose with rival |
| Enemy | Mutually exclusive membership |

### 7.3 Rank Progression

Methods (all configurable):
- Accumulate reputation points
- Complete X quests for faction
- Complete specific rank-up trial quest
- GM manual promotion

### 7.4 Rank Demotion

Causes (configurable):
- Failed faction quests
- Crimes against faction/members
- Helping rival/enemy factions
- GM manual demotion

### 7.5 Hostile Standing

When reputation goes negative:
- Banned from faction services
- Faction NPCs hostile
- Attacked by faction guards
- Bounty within faction territory
- Redemption quests to restore standing

### 7.6 Rank-Up Ceremonies

When reaching a new rank:
- Chat notification
- Optional fanfare sound
- Special dialogue at HQ
- Reward package granted
- Badge/title unlocked

### 7.7 Faction UI

Dedicated faction overview screen:
- List all factions with current reputation/rank
- Progress bar to next rank
- Benefits at each tier
- Relationship web visualization
- History of reputation changes

---

## 8. Loot System

### 8.1 Loot Containers

```javascript
{
  type: "container", // container, corpse_pile

  // Contents
  contents: [
    { itemId: "Item.xxxxx", quantity: 1 }
  ],

  // Or loot table
  lootTable: {
    tableId: "RollTable.xxxxx",
    rolls: 3
  },

  // Lock
  locked: true,
  lockDC: 15,
  keyItemId: "Item.key",

  // Behavior
  oneTime: true,
  respawn: {
    enabled: false,
    interval: "day"
  },

  // Trap (optional)
  trap: {
    enabled: false,
    dc: 14,
    damage: "2d6",
    type: "poison"
  }
}
```

### 8.2 Corpse Loot

When combat encounter ends:
- All loot from dead enemies consolidated into single chest
- Chest appears at encounter location
- Contains: weapons, armor, items from creature inventories
- One-click "Loot All" option

### 8.3 Loot Distribution

Options (GM configurable):
- **Free for all:** First to click takes it
- **Need/Greed:** Roll system for contested items
- **Round robin:** Alternate who gets first pick
- **Party vault:** All goes to party storage
- **GM distributes:** GM manually assigns

---

## 9. Banking System

### 9.1 Bank Configuration

```javascript
{
  actorUuid: "Actor.xxxxx",
  type: "bank",
  name: "First Bank of Waterdeep",

  // Features
  features: {
    deposit: true,
    withdraw: true,
    transfer: true, // Between players
    loans: true,
    interest: true
  },

  // Interest
  interest: {
    savingsRate: 0.01, // 1% per interval
    loanRate: 0.05, // 5% per interval
    interval: "week"
  },

  // Loans
  loans: {
    maxAmount: 1000,
    requiresReputation: 50, // Faction rep or relationship
    defaultConsequence: "bounty" // bounty, reputation_loss, both
  },

  // Fees
  fees: {
    deposit: 0,
    withdraw: 0,
    transfer: 0.01 // 1% transfer fee
  },

  // Vault
  vaultEnabled: true, // Item storage
  vaultSlots: 50
}
```

### 9.2 Bank Interface

- Account balance display
- Deposit/withdraw gold
- Transfer to other players
- View/pay loans
- Access item vault
- Transaction history

### 9.3 Bank Heist

GM can create "bank heist" quests:
- Rob the bank as a quest objective
- Consequences if caught
- Vault contents as reward

---

## 10. Hireling & Companion System

### 10.1 Hireling Data

```javascript
{
  actorUuid: "Actor.xxxxx",
  type: "hireling", // hireling, companion

  // Category
  category: "combat", // combat, utility, labor, specialist

  // Employment
  employment: {
    employer: "Actor.player1",
    startDate: "...",
    duration: "weekly", // daily, weekly, per_job, retainer, permanent
    wage: {
      amount: 10,
      currency: "gp",
      interval: "day"
    },
    lastPaid: "..."
  },

  // Loyalty
  loyalty: {
    value: 75, // 0-100
    factors: {
      payment: 0, // Modifier from payment status
      danger: 0, // Modifier from dangerous situations
      treatment: 0 // Modifier from player treatment
    }
  },

  // Behavior
  behavior: {
    fleeThreshold: 25, // HP percentage
    moraleLowWarning: true,
    canBetray: true,
    betrayThreshold: 20 // Loyalty below this may betray
  },

  // Control
  control: {
    controller: "gm", // gm, player
    assignedPlayer: null
  }
}
```

### 10.2 Hireling Categories

| Category | Examples | Typical Wage |
|----------|----------|--------------|
| Combat | Fighters, archers, mages | 2gp/day |
| Utility | Lockpickers, scouts, translators | 1gp/day |
| Labor | Porters, torch-bearers, cooks | 5sp/day |
| Specialist | Healers, alchemists, enchanters | 5gp/day |

### 10.3 Hiring Interface

Through dialogue with recruiter NPC:
- Browse available hirelings
- View stats, skills, wage
- Negotiate terms
- Sign contract

### 10.4 Hireling Management

- Payment tracking (auto-deduct if enabled)
- Loyalty meter visible to employer
- Warnings for low morale/HP
- Assignment to player control (GM permission)
- Contract renewal/termination

### 10.5 Companions

Same as hirelings mechanically, but:
- No wage requirement (can be set to free)
- Higher base loyalty
- Personal quests (optional)
- Deeper relationship integration
- Often quest rewards

---

## 11. Mount System

### 11.1 Mount Data

```javascript
{
  actorUuid: "Actor.xxxxx",
  type: "mount",

  // Owner
  owner: "Actor.player1",

  // Stats
  stats: {
    speed: 60,
    carryCapacity: 480
  },

  // Equipment
  equipment: {
    saddle: "Item.xxxxx",
    barding: null,
    saddlebags: null
  },

  // Stabling
  stabling: {
    stableId: "stable-1",
    stabledAt: "Scene.xxxxx",
    dailyCost: 5 // sp
  }
}
```

### 11.2 Stable Services

- Purchase mounts
- Sell mounts
- Stable mount (safe storage)
- Retrieve stabled mount
- Mount equipment
- Healing/veterinary services

### 11.3 Mounted Combat

Uses D&D 5e mounted combat rules:
- Mount and rider share space
- Mount has separate HP
- Mount can be targeted
- Controlled vs independent mount

### 11.4 Mount Summoning

- Place mount token on scene
- Mount token linked to actor
- Quick-summon button for owned mounts

---

## 12. Crime & Consequences System

### 12.1 Crime Types

| Crime | Base Bounty | Reputation Effect |
|-------|-------------|-------------------|
| Pickpocketing | 25gp | -10 with lawful factions |
| Theft | 50gp | -15 with lawful factions |
| Assault | 100gp | -25 with lawful factions |
| Murder | 500gp | -50 with lawful factions |
| Trespassing | 10gp | -5 with lawful factions |

### 12.2 Stealing Mechanics

```javascript
{
  // Attempt to steal
  targetActorUuid: "Actor.xxxxx",
  targetItemId: "Item.yyyyy",

  // Check
  skill: "sleight_of_hand",
  dc: 15, // NPC's passive perception or set DC

  // Results
  success: {
    // Player gets item
    relationshipChange: -5 // If noticed later
  },
  failure: {
    caught: true,
    consequences: ["guards_called", "bounty_added", "reputation_loss"]
  }
}
```

### 12.3 Bounty System

```javascript
{
  playerId: "Actor.player1",
  bounties: {
    "region-1": {
      amount: 150,
      crimes: ["theft", "assault"],
      witnesses: ["Actor.guard1"]
    }
  }
}
```

### 12.4 Bounty Consequences

- Guards attack on sight
- Banned from legitimate shops
- Can't use banks
- Bounty hunters dispatched (optional)
- Other players can claim bounty (optional PvP)

### 12.5 Clearing Bounty

- Pay fine to guards/official
- Serve jail time (time skip or escape quest)
- Bribe officials
- Wait for statute of limitations (optional)
- Complete redemption quest

### 12.6 Black Market

Fence NPCs (black market merchants):
- Buy stolen goods (at lower prices)
- Sell illegal items
- No questions asked
- Required for notable stolen items
- Builds reputation with criminal factions

### 12.7 Notable Items

GM can mark items as "notable":
- Selling to normal merchant flags as stolen
- Guards may recognize and confiscate
- Only fence will buy without issue

---

## 13. Services System

### 13.1 Service Types

All services accessed through dialogue system:

#### Repair
```javascript
{
  type: "repair",
  items: ["weapons", "armor", "all"],
  priceMultiplier: 0.1, // 10% of item value
  timeRequired: "instant" // instant, hours, days
}
```

#### Training
```javascript
{
  type: "training",
  offerings: [
    {
      type: "skill_proficiency",
      skill: "stealth",
      price: 250,
      timeRequired: 10, // days
      requirements: { level: 1 }
    },
    {
      type: "tool_proficiency",
      tool: "thieves_tools",
      price: 100,
      timeRequired: 5
    },
    {
      type: "language",
      language: "elvish",
      price: 50,
      timeRequired: 5
    }
  ]
}
```

#### Enchanting
```javascript
{
  type: "enchanting",
  offerings: [
    {
      enchantment: "+1 weapon",
      price: 1000,
      timeRequired: 7,
      requirements: { baseItem: "weapon" }
    }
  ]
}
```

#### Transportation
```javascript
{
  type: "transportation",
  destinations: [
    {
      name: "Waterdeep",
      sceneId: "Scene.xxxxx",
      price: 50,
      travelTime: "2 days"
    }
  ]
}
```

#### Information
```javascript
{
  type: "information",
  rumors: [
    {
      topic: "Dragon sightings",
      price: 10,
      revealsQuest: "quest-dragon",
      reliability: 0.8 // 80% accurate
    }
  ]
}
```

#### Room Rental
```javascript
{
  type: "inn",
  rooms: [
    {
      name: "Common Room",
      price: 5, // sp
      quality: "poor",
      benefits: ["long_rest"]
    },
    {
      name: "Private Room",
      price: 5, // gp
      quality: "comfortable",
      benefits: ["long_rest", "storage"],
      storageSlots: 10
    },
    {
      name: "Suite",
      price: 20, // gp
      quality: "luxurious",
      benefits: ["long_rest", "storage", "private_meeting"],
      storageSlots: 20
    }
  ]
}
```

---

## 14. Property System

### 14.1 Property Data

```javascript
{
  id: "property-1",
  name: "The Rusty Anchor",
  type: "tavern", // house, shop, tavern, warehouse, other

  // Location
  sceneId: "Scene.xxxxx",

  // Ownership
  owner: "Actor.player1", // or party

  // Staff (hirelings assigned here)
  staff: [
    { actorUuid: "Actor.bartender", role: "bartender" }
  ],

  // Income (if business)
  income: {
    enabled: true,
    baseAmount: 10, // gp
    interval: "week",
    modifiers: {
      reputation: 0.1, // Per 10 reputation points
      staff: 0.05, // Per staff member
      upgrades: 0.2 // From upgrades
    }
  },

  // Upkeep
  upkeep: {
    amount: 5, // gp
    interval: "week",
    staffWages: true // Auto-pay staff
  },

  // Upgrades
  upgrades: [
    { name: "Better Furniture", cost: 100, incomeBonus: 0.1, purchased: false }
  ],

  // Events
  vulnerableToEvents: true // Can be robbed, damaged, etc.
}
```

### 14.2 Property Management

- View owned properties
- Assign staff
- Check income/expenses
- Purchase upgrades
- Handle events (robbery, fire, inspection)

### 14.3 Property Acquisition

- Quest reward
- Purchase from NPC
- Faction benefit (at certain rank)
- Deed item grants ownership

---

## 15. Storage & Vault System

### 15.1 Storage Implementation

Storage uses Actors with special flags:

```javascript
{
  actorUuid: "Actor.chest-1",
  type: "storage",

  // Storage type
  storageType: "personal", // personal, party

  // Ownership
  owner: "Actor.player1", // For personal
  partyAccess: ["Actor.player1", "Actor.player2"], // For party

  // Capacity
  capacity: {
    type: "slots", // slots, weight, unlimited
    slots: 50,
    weight: null
  },

  // Contents stored in actor's items

  // Visual
  tokenImages: [
    "/modules/bobs-talking-npcs/assets/chests/wooden-chest.png",
    "/modules/bobs-talking-npcs/assets/chests/iron-chest.png",
    "/modules/bobs-talking-npcs/assets/chests/ornate-chest.png"
  ],
  selectedImage: 0,
  customImage: null
}
```

### 15.2 Included Chest Images

Module includes variety of chest/storage images:
- Wooden chest
- Iron chest
- Ornate chest
- Barrel
- Crate
- Sack
- Lockbox

Players can also use custom images.

### 15.3 Storage Interface

- Grid view of stored items
- Drag and drop to/from inventory
- Search and sort
- Capacity indicator

---

## 16. Player Trading System

### 16.1 Trade Window

```javascript
{
  initiator: "Actor.player1",
  recipient: "Actor.player2",

  initiatorOffer: {
    gold: 50,
    items: ["Item.xxxxx"]
  },

  recipientOffer: {
    gold: 0,
    items: ["Item.yyyyy", "Item.zzzzz"]
  },

  status: "pending", // pending, confirmed_initiator, confirmed_recipient, completed, cancelled
}
```

### 16.2 Trade Flow

1. Player A initiates trade with Player B
2. Trade window opens for both
3. Each player adds items/gold to their side
4. Each player confirms their offer
5. When both confirm, trade executes
6. Items/gold swapped atomically

### 16.3 Quick Send

Alternative to trade window:
- Right-click item → "Send to Player"
- Select recipient
- Item transferred immediately (no confirmation needed)

---

## 17. World State & Events

### 17.1 World State Flags

Quests and dialogues can set/check world state:

```javascript
// In world flags
game.world.flags["bobs-talking-npcs"].worldState = {
  "kingIsAlive": true,
  "bridgeDestroyed": false,
  "plagueActive": false,
  "currentSeason": "summer"
}
```

### 17.2 Quest Consequences

Completing quests can trigger:
- NPC moves to new scene
- NPC dies/disappears
- Shop inventory changes
- New NPCs appear
- Scene changes (if GM has prepared alternate scene)
- Faction relationship changes
- New quests become available

### 17.3 Dynamic Events

GM can create world events:

```javascript
{
  id: "event-festival",
  name: "Harvest Festival",

  // Trigger
  trigger: {
    type: "manual", // manual, calendar, quest_completion
    calendarDate: null,
    questId: null
  },

  // Duration
  duration: {
    type: "days",
    value: 7
  },

  // Effects
  effects: [
    { type: "shop_discount", factionId: "merchants", discount: 0.2 },
    { type: "special_quests", questIds: ["quest-festival-1"] },
    { type: "npc_dialogue", dialogueOverrides: { "npc-1": "dialogue-festival" } }
  ],

  // Announcement
  announcement: {
    chatMessage: "The Harvest Festival has begun!",
    showBanner: true
  }
}
```

---

## 18. User Interface

### 18.1 Main Windows

| Window | Access | Description |
|--------|--------|-------------|
| Quest Log | J key (default) | View all quests |
| Faction Overview | Hotkey | View faction standings |
| Dialogue | Double-click NPC | Conversation interface |
| Shop | Via dialogue | Buy/sell interface |
| Bank | Via dialogue | Banking interface |
| GM Dashboard | Settings icon | Central control panel |

### 18.2 Quest Log

- Tabs: Active, Available, Completed, Failed
- Quest cards with objectives, rewards, giver
- Pinning (pinned quests at top)
- Personal and party notes
- Filters by category, faction
- Search by name
- Share quest link in chat

### 18.3 Quest Tracker HUD

- Minimal overlay showing active quest
- Current objective
- Progress indicators
- Toggle on/off (player setting)
- Position adjustable

### 18.4 Dialogue Window

- NPC portrait (token, actor, or custom)
- NPC name and faction badge
- Typewriter text effect
- Response buttons
- Voice playback controls (if voice line exists)
- Relationship indicator
- Skill check rolls visible

### 18.5 Theming

Default theme: Dark

Customization options:
- Dark/Light base theme
- Accent color
- Font size
- Font family
- Window opacity
- Custom CSS injection (advanced)

Included themes:
- Dark (default)
- Light
- Parchment/Fantasy
- High Contrast

### 18.6 Token Indicators

Visual icons on NPC tokens:
- Yellow "!" - Quest available
- Yellow "?" - Quest turn-in ready
- Coin bag - Merchant
- Speech bubble - Dialogue available
- Custom icons per NPC role

Toggle in settings (GM can enable/disable globally, players can hide locally).

### 18.7 Notifications

- Toast notifications (corner pop-ups)
- Chat messages
- Center banners for major events
- Sound effects

All configurable by player for intrusiveness level.

---

## 19. GM Tools

### 19.1 Central Dashboard

Single window to access:
- All NPCs (with role indicators)
- All quests (with status)
- All factions (with member counts)
- All active dialogues
- Statistics

### 19.2 Statistics

- Quests completed (total, per quest)
- Items sold (total value)
- Gold earned by players
- Faction reputation averages
- Most visited NPCs
- Popular dialogue choices

### 19.3 NPC Editor

- Basic info (name, portrait, roles)
- Dialogue tree editor
- Shop inventory editor
- Service configuration
- Faction membership
- Relationship settings
- Voice line management

### 19.4 Quest Editor

- Basic info (name, description, category)
- Objectives editor
- Rewards editor (with choice configuration)
- Prerequisites editor
- Branching paths
- Conflict configuration
- Template selection

### 19.5 Faction Editor

- Basic info (name, icon, color)
- Rank configuration
- Inter-faction relationships
- Member management
- Event triggers

### 19.6 Dialogue Node Editor

Visual flowchart interface:
- Canvas with grid
- Node palette (drag to add)
- Connection lines between nodes
- Node inspector panel
- Condition/effect builders
- Preview mode
- Validation warnings

### 19.7 Templates & Presets

**Included Faction Templates:**
- Adventurer's Guild
- Thieves Guild
- Merchant Consortium
- City Watch
- Mage's College

**Included NPC Templates:**
- Blacksmith
- Innkeeper
- Guard Captain
- Merchant
- Quest Giver
- Banker
- Stable Master

**Included Quest Templates:**
- Kill Quest
- Fetch Quest
- Escort Quest
- Delivery Quest
- Investigation Quest
- Bounty Quest

### 19.8 Import/Export

Export formats:
- Single NPC (with dialogue, shop)
- Single quest
- Single faction
- Content pack (multiple items)
- Full world data

Import:
- Validate data structure
- Conflict resolution (replace/skip/rename)
- Preview before import

### 19.9 Backup System

- Manual backup button
- Auto-backup before major edits
- Export world data to file
- Restore from backup
- No version history (storage concern)

### 19.10 Debug/Testing Mode

- Preview dialogues without game effects
- Test as specific player
- View all dialogue branches
- Reset quest/dialogue state
- Validate data integrity
- Console logging toggle

### 19.11 Quick Edit Access

Right-click context menus on:
- NPC tokens → Edit NPC, Edit Dialogue, Edit Shop
- Quest in log → Edit Quest
- Faction in overview → Edit Faction

### 19.12 Bulk Operations

- Multi-select items
- Batch assign to faction
- Batch change category
- Copy/paste NPCs, quests
- Duplicate with one click

### 19.13 Search & Filter

Global search across:
- NPCs (by name, faction, role, scene)
- Quests (by name, category, status, giver)
- Factions (by name)
- Dialogues (by text content)

---

## 20. Settings & Configuration

### 20.1 GM Settings (World-level)

```javascript
{
  // Party
  "partyDefinition": "primary_party", // folder, primary_party, manual
  "partyFolder": null,
  "partyManualList": [],

  // Quests
  "questDistribution": "split", // split, full_each, gm_choice
  "allowQuestAbandonment": true,
  "showLockedQuests": true,
  "questMarkers": true,

  // NPCs
  "npcIndicators": true,
  "defaultInteraction": "double_click",

  // Economy
  "currencyDisplay": "gold_down", // gold_down, all
  "hagglingEnabled": true,
  "charismaAffectsPrices": true,

  // Crime
  "crimeEnabled": true,
  "stealingEnabled": true,
  "bountyEnabled": true,

  // Quick Actions
  "quickBuyEnabled": false,
  "quickAcceptEnabled": false,
  "quickTurnInEnabled": false,

  // Multiplayer
  "sharedDialogues": true,
  "dialogueVoting": true,

  // Audio
  "soundEffectsEnabled": true,

  // Chat
  "chatQuestAccepted": true,
  "chatQuestCompleted": true,
  "chatPurchases": false,
  "chatRelationshipChanges": false,
  "chatFactionChanges": true,
  "chatSkillChecks": true,

  // Permissions
  "trustedPlayerPermissions": ["view_dashboard"],
  "assistantGmPermissions": ["edit_npcs", "edit_quests", "view_dashboard"],

  // Dice
  "skillCheckVisibility": "public", // public, private, gm_choice

  // NPC Schedules
  "scheduleEnabled": true,

  // Loot
  "lootDistribution": "need_greed", // free, need_greed, round_robin, party_vault, gm
  "corpseConsolidation": true
}
```

### 20.2 Player Settings (Client-level)

```javascript
{
  // Display
  "questTrackerEnabled": true,
  "questTrackerPosition": { x: 10, y: 200 },

  // Notifications
  "notificationLevel": "normal", // minimal, normal, verbose
  "toastEnabled": true,
  "soundEnabled": true,

  // Hotkeys
  "hotkeyQuestLog": "KeyJ",
  "hotkeyFactions": "KeyF",
  "hotkeyTracker": "KeyT",

  // Dialogue
  "typewriterSpeed": "normal", // slow, normal, fast, instant

  // Favorites
  "favoriteNpcs": [],
  "favoriteFactions": [],

  // Theme
  "theme": "dark", // dark, light, parchment, high_contrast
  "fontSize": "medium",
  "customCss": ""
}
```

### 20.3 Per-NPC Settings

Configured in NPC editor, overrides world settings for that NPC.

### 20.4 Per-Quest Settings

Configured in quest editor, overrides world settings for that quest.

---

## 21. Technical Architecture

### 21.1 Technology Stack

- **Language:** JavaScript (ES Modules)
- **Framework:** Foundry VTT V13 API
- **UI Framework:** ApplicationV2
- **Templates:** Handlebars
- **Styling:** CSS (with CSS custom properties for theming)
- **Data Storage:** Foundry Flags system + JournalEntryPages

### 21.2 Data Storage Strategy

| Data Type | Storage Location |
|-----------|------------------|
| Quests | JournalEntryPage flags |
| NPC Config | Actor flags |
| Dialogues | Actor flags |
| Factions | World flags (custom document-like structure) |
| Relationships | Actor flags (on NPC) |
| Player Settings | Client settings |
| World Settings | World settings |
| World State | World flags |
| Bounties | World flags |

### 21.3 Socket Events

For multiplayer synchronization:

| Event | Description |
|-------|-------------|
| `dialogueStart` | Player started dialogue |
| `dialogueChoice` | Player made choice |
| `dialogueEnd` | Dialogue ended |
| `dialogueJoin` | Player joined dialogue |
| `dialogueVote` | Player voted on response |
| `questUpdate` | Quest state changed |
| `tradeRequest` | Trade initiated |
| `tradeUpdate` | Trade offer changed |
| `tradeComplete` | Trade executed |

### 21.4 Hooks

Events emitted for other modules/macros:

```javascript
Hooks.call("btnpc.dialogueStart", { npcId, players });
Hooks.call("btnpc.dialogueChoice", { npcId, nodeId, choiceId, player });
Hooks.call("btnpc.dialogueEnd", { npcId, players });
Hooks.call("btnpc.questAccepted", { questId, players });
Hooks.call("btnpc.questCompleted", { questId, players, rewards });
Hooks.call("btnpc.questFailed", { questId, players, reason });
Hooks.call("btnpc.factionRankUp", { factionId, playerId, newRank });
Hooks.call("btnpc.relationshipChange", { npcId, playerId, oldValue, newValue });
Hooks.call("btnpc.itemPurchased", { npcId, playerId, itemId, price });
Hooks.call("btnpc.itemSold", { npcId, playerId, itemId, price });
Hooks.call("btnpc.bountyAdded", { playerId, region, amount, crime });
Hooks.call("btnpc.bountyCleared", { playerId, region, method });
```

---

## 22. File Structure

```
bobs-talking-npcs/
├── module.json
├── CHANGELOG.md
├── README.md
├── LICENSE
│
├── scripts/
│   ├── module.mjs                    # Entry point
│   ├── init.mjs                      # Initialization & hooks
│   ├── settings.mjs                  # Settings registration
│   ├── socket.mjs                    # Socket handling
│   ├── api.mjs                       # Public API
│   │
│   ├── data/
│   │   ├── quest-model.mjs           # Quest data schema
│   │   ├── dialogue-model.mjs        # Dialogue data schema
│   │   ├── faction-model.mjs         # Faction data schema
│   │   ├── npc-model.mjs             # NPC configuration schema
│   │   ├── merchant-model.mjs        # Merchant data schema
│   │   ├── relationship-model.mjs    # Relationship data schema
│   │   ├── bounty-model.mjs          # Bounty/crime data schema
│   │   ├── hireling-model.mjs        # Hireling data schema
│   │   ├── mount-model.mjs           # Mount data schema
│   │   ├── property-model.mjs        # Property data schema
│   │   ├── storage-model.mjs         # Storage/vault data schema
│   │   ├── bank-model.mjs            # Banking data schema
│   │   ├── service-model.mjs         # Services data schema
│   │   └── event-model.mjs           # World event data schema
│   │
│   ├── apps/
│   │   ├── quest-log.mjs             # Quest log window
│   │   ├── quest-tracker.mjs         # Quest tracker HUD
│   │   ├── quest-editor.mjs          # GM quest editor
│   │   ├── dialogue-window.mjs       # Player dialogue UI
│   │   ├── dialogue-editor.mjs       # Visual node editor
│   │   ├── shop-window.mjs           # Merchant interface
│   │   ├── bank-window.mjs           # Banking interface
│   │   ├── faction-overview.mjs      # Faction standings
│   │   ├── faction-editor.mjs        # GM faction editor
│   │   ├── npc-editor.mjs            # GM NPC editor
│   │   ├── trade-window.mjs          # Player trading
│   │   ├── loot-window.mjs           # Loot container
│   │   ├── storage-window.mjs        # Vault/storage
│   │   ├── hireling-window.mjs       # Hireling management
│   │   ├── stable-window.mjs         # Mount stable
│   │   ├── service-window.mjs        # Service selection
│   │   ├── property-window.mjs       # Property management
│   │   ├── gm-dashboard.mjs          # Central GM panel
│   │   ├── settings-menu.mjs         # Settings interface
│   │   ├── import-export.mjs         # Import/export dialog
│   │   ├── onboarding-wizard.mjs     # First-time setup
│   │   └── reward-choice.mjs         # Reward selection dialog
│   │
│   ├── handlers/
│   │   ├── token-handler.mjs         # Token interactions
│   │   ├── quest-handler.mjs         # Quest state management
│   │   ├── dialogue-handler.mjs      # Dialogue flow control
│   │   ├── merchant-handler.mjs      # Buy/sell logic
│   │   ├── relationship-handler.mjs  # Relationship updates
│   │   ├── faction-handler.mjs       # Faction reputation
│   │   ├── crime-handler.mjs         # Crime & bounty
│   │   ├── loot-handler.mjs          # Loot distribution
│   │   ├── reward-handler.mjs        # Reward distribution
│   │   ├── hireling-handler.mjs      # Hireling management
│   │   ├── mount-handler.mjs         # Mount management
│   │   ├── property-handler.mjs      # Property management
│   │   ├── bank-handler.mjs          # Banking operations
│   │   ├── trade-handler.mjs         # Player trading
│   │   ├── service-handler.mjs       # Service execution
│   │   ├── event-handler.mjs         # World events
│   │   └── schedule-handler.mjs      # NPC schedules
│   │
│   ├── ui/
│   │   ├── context-menus.mjs         # Right-click menus
│   │   ├── token-indicators.mjs      # Token icon overlays
│   │   ├── notifications.mjs         # Toast & banners
│   │   └── hotkeys.mjs               # Keyboard shortcuts
│   │
│   └── utils/
│       ├── currency.mjs              # Currency calculations
│       ├── dice.mjs                  # Dice roll integration
│       ├── validation.mjs            # Data validation
│       ├── migration.mjs             # Data migration
│       ├── backup.mjs                # Backup/restore
│       └── helpers.mjs               # General utilities
│
├── templates/
│   ├── quest-log.hbs
│   ├── quest-tracker.hbs
│   ├── quest-editor.hbs
│   ├── quest-card.hbs
│   ├── dialogue-window.hbs
│   ├── dialogue-editor.hbs
│   ├── dialogue-node.hbs
│   ├── shop-window.hbs
│   ├── shop-item.hbs
│   ├── bank-window.hbs
│   ├── faction-overview.hbs
│   ├── faction-editor.hbs
│   ├── faction-card.hbs
│   ├── npc-editor.hbs
│   ├── trade-window.hbs
│   ├── loot-window.hbs
│   ├── storage-window.hbs
│   ├── hireling-window.hbs
│   ├── stable-window.hbs
│   ├── service-window.hbs
│   ├── property-window.hbs
│   ├── gm-dashboard.hbs
│   ├── settings-menu.hbs
│   ├── import-export.hbs
│   ├── onboarding-wizard.hbs
│   ├── reward-choice.hbs
│   └── partials/
│       ├── objective-list.hbs
│       ├── reward-list.hbs
│       ├── condition-builder.hbs
│       ├── effect-builder.hbs
│       └── relationship-display.hbs
│
├── styles/
│   ├── module.css                    # Main styles
│   ├── themes/
│   │   ├── dark.css
│   │   ├── light.css
│   │   ├── parchment.css
│   │   └── high-contrast.css
│   ├── components/
│   │   ├── quest-log.css
│   │   ├── dialogue.css
│   │   ├── shop.css
│   │   ├── node-editor.css
│   │   └── indicators.css
│   └── variables.css                 # CSS custom properties
│
├── assets/
│   ├── icons/
│   │   ├── quest-available.svg
│   │   ├── quest-turnin.svg
│   │   ├── merchant.svg
│   │   ├── dialogue.svg
│   │   ├── faction/
│   │   └── ui/
│   ├── chests/
│   │   ├── wooden-chest.png
│   │   ├── iron-chest.png
│   │   ├── ornate-chest.png
│   │   ├── barrel.png
│   │   ├── crate.png
│   │   ├── sack.png
│   │   └── lockbox.png
│   └── audio/
│       ├── quest-accept.ogg
│       ├── quest-complete.ogg
│       ├── purchase.ogg
│       ├── dialogue-blip.ogg
│       └── notification.ogg
│
├── packs/
│   ├── sample-factions/
│   ├── sample-npcs/
│   ├── sample-quests/
│   └── templates/
│
└── lang/
    └── en.json
```

---

## 23. Data Schemas

### 23.1 Full Quest Schema

See Section 3.1

### 23.2 Full Dialogue Schema

See Section 4.1

### 23.3 Full Faction Schema

See Section 7.1

### 23.4 Full NPC Configuration Schema

```javascript
{
  // Stored in Actor flags: actor.flags["bobs-talking-npcs"]

  enabled: true,

  // Roles
  roles: {
    questGiver: true,
    questTurnIn: true,
    merchant: true,
    banker: false,
    stableMaster: false,
    innkeeper: false,
    trainer: false,
    enchanter: false,
    transporter: false,
    informant: false,
    hirelingRecruiter: false,
    fence: false,
    factionRepresentative: true
  },

  // Faction membership
  factions: ["faction-1"],
  factionRank: { "faction-1": "silver" },

  // Dialogue
  dialogueId: "dialogue-1",

  // Merchant (if role enabled)
  merchant: { /* See Section 5.1 */ },

  // Bank (if role enabled)
  bank: { /* See Section 9.1 */ },

  // Services (if roles enabled)
  services: {
    training: { /* See Section 13.1 */ },
    enchanting: { /* ... */ },
    transportation: { /* ... */ },
    information: { /* ... */ },
    inn: { /* ... */ }
  },

  // Hirelings available (if recruiter)
  hirelings: ["Actor.hireling1", "Actor.hireling2"],

  // Mounts available (if stable master)
  mounts: ["Actor.mount1"],

  // Schedule
  schedule: {
    enabled: true,
    availability: [
      { days: ["monday", "tuesday", "wednesday", "thursday", "friday"], from: 8, to: 20 },
      { days: ["saturday"], from: 10, to: 16 }
    ],
    unavailableDialogueId: "dialogue-closed"
  },

  // Location warning
  expectedScenes: ["Scene.marketplace"],
  wrongLocationDialogueId: "dialogue-wrong-place",

  // Haggling (overrides world settings)
  haggling: { /* See Section 5.1 */ },

  // Portrait options
  portrait: {
    source: "token", // token, actor, custom
    customPath: null
  },

  // Voice
  voice: {
    enabled: false,
    defaultVoicePath: null
  },

  // Indicator icon override
  indicatorIcon: null // null = auto-detect from roles
}
```

---

## 24. API Reference

### 24.1 Public API

Exposed at `game.bobsnpc`:

```javascript
// Dialogue
game.bobsnpc.startDialogue(actorUuid, options = {})
game.bobsnpc.endDialogue(actorUuid)
game.bobsnpc.getActiveDialogue(actorUuid)

// Quests
game.bobsnpc.quests.get(questId)
game.bobsnpc.quests.getAll(filter = {})
game.bobsnpc.quests.create(questData)
game.bobsnpc.quests.update(questId, updates)
game.bobsnpc.quests.delete(questId)
game.bobsnpc.quests.accept(questId, playerUuids = [])
game.bobsnpc.quests.complete(questId)
game.bobsnpc.quests.fail(questId, reason)
game.bobsnpc.quests.abandon(questId, playerUuid)
game.bobsnpc.quests.completeObjective(questId, objectiveId)
game.bobsnpc.quests.getStatus(questId)
game.bobsnpc.quests.getPlayerQuests(playerUuid, status = null)

// Factions
game.bobsnpc.factions.get(factionId)
game.bobsnpc.factions.getAll()
game.bobsnpc.factions.create(factionData)
game.bobsnpc.factions.update(factionId, updates)
game.bobsnpc.factions.delete(factionId)
game.bobsnpc.factions.modifyReputation(factionId, playerUuid, amount)
game.bobsnpc.factions.getReputation(factionId, playerUuid)
game.bobsnpc.factions.getRank(factionId, playerUuid)
game.bobsnpc.factions.setRank(factionId, playerUuid, rankId)

// Relationships
game.bobsnpc.relationships.get(npcUuid, playerUuid)
game.bobsnpc.relationships.modify(npcUuid, playerUuid, amount)
game.bobsnpc.relationships.set(npcUuid, playerUuid, value)
game.bobsnpc.relationships.getTier(npcUuid, playerUuid)

// Merchants
game.bobsnpc.shop.open(npcUuid, playerUuid = null)
game.bobsnpc.shop.close(npcUuid)
game.bobsnpc.shop.getInventory(npcUuid)
game.bobsnpc.shop.buy(npcUuid, playerUuid, itemId, quantity)
game.bobsnpc.shop.sell(npcUuid, playerUuid, itemId, quantity)
game.bobsnpc.shop.getPrice(npcUuid, playerUuid, itemId, isBuying)

// Banking
game.bobsnpc.bank.open(npcUuid, playerUuid = null)
game.bobsnpc.bank.deposit(npcUuid, playerUuid, amount)
game.bobsnpc.bank.withdraw(npcUuid, playerUuid, amount)
game.bobsnpc.bank.getBalance(npcUuid, playerUuid)
game.bobsnpc.bank.takeLoan(npcUuid, playerUuid, amount)
game.bobsnpc.bank.repayLoan(npcUuid, playerUuid, amount)

// Crime
game.bobsnpc.crime.addBounty(playerUuid, region, amount, crime)
game.bobsnpc.crime.getBounty(playerUuid, region = null)
game.bobsnpc.crime.clearBounty(playerUuid, region, method)
game.bobsnpc.crime.attemptSteal(playerUuid, npcUuid, itemId)

// Hirelings
game.bobsnpc.hirelings.hire(hirelingUuid, employerUuid, terms)
game.bobsnpc.hirelings.dismiss(hirelingUuid)
game.bobsnpc.hirelings.pay(hirelingUuid)
game.bobsnpc.hirelings.getLoyalty(hirelingUuid)
game.bobsnpc.hirelings.modifyLoyalty(hirelingUuid, amount)

// Mounts
game.bobsnpc.mounts.purchase(mountUuid, buyerUuid)
game.bobsnpc.mounts.stable(mountUuid, stableNpcUuid)
game.bobsnpc.mounts.retrieve(mountUuid)
game.bobsnpc.mounts.summon(mountUuid, sceneId, position)

// Trading
game.bobsnpc.trade.initiate(initiatorUuid, recipientUuid)
game.bobsnpc.trade.addItem(tradeId, side, itemId)
game.bobsnpc.trade.setGold(tradeId, side, amount)
game.bobsnpc.trade.confirm(tradeId, side)
game.bobsnpc.trade.cancel(tradeId)

// World State
game.bobsnpc.worldState.get(key)
game.bobsnpc.worldState.set(key, value)
game.bobsnpc.worldState.delete(key)

// Events
game.bobsnpc.events.trigger(eventId)
game.bobsnpc.events.end(eventId)
game.bobsnpc.events.getActive()

// Utilities
game.bobsnpc.ui.openQuestLog(playerUuid = null)
game.bobsnpc.ui.openFactionOverview(playerUuid = null)
game.bobsnpc.ui.openGmDashboard()
game.bobsnpc.backup.create()
game.bobsnpc.backup.restore(backupData)
game.bobsnpc.export(type, id = null) // Returns data object
game.bobsnpc.import(data) // Imports data object
```

### 24.2 Hooks Reference

See Section 21.4

---

## 25. Accessibility

### 25.1 Visual Accessibility

- **Colorblind-friendly:** Icons have distinct shapes, not just colors
- **High contrast mode:** Theme option with strong contrast
- **Font sizing:** Small, Medium, Large, Extra Large options
- **Focus indicators:** Clear keyboard focus outlines

### 25.2 Motor Accessibility

- **Keyboard navigation:** All interfaces navigable by keyboard
- **Large click targets:** Buttons and interactive elements appropriately sized
- **No time-sensitive inputs:** Dialogue choices don't timeout

### 25.3 Screen Reader Support

- **ARIA labels:** All interactive elements labeled
- **Live regions:** Dynamic content announced
- **Semantic HTML:** Proper heading structure

### 25.4 Cognitive Accessibility

- **Help tooltips:** Hover help on all fields in editors
- **Consistent layout:** Predictable UI patterns
- **Clear feedback:** Actions have visible results
- **Undo support:** Mistakes can be corrected

---

## 26. Performance

### 26.1 Lazy Loading

- Faction data loaded on demand
- Dialogue trees loaded when conversation starts
- Quest details loaded when viewed
- Shop inventory loaded when opened

### 26.2 Caching

- Relationship calculations cached
- Price calculations cached with invalidation
- Condition evaluations cached per dialogue node

### 26.3 Optimization

- Efficient flag storage (minimal data)
- Batched socket events
- Debounced UI updates
- Virtual scrolling for large lists

### 26.4 Warnings

- Alert if world has >500 NPCs
- Alert if dialogue tree has >100 nodes
- Alert if quest log has >100 active quests

---

## 27. Module Compatibility

### 27.1 Required Compatibility

- **PopOut!** - Windows can be popped out
- **Dice So Nice** - Skill check animations

### 27.2 Recommended Compatibility

- **Simple Calendar** - Time-based features
- **Token Action HUD** - Quick NPC access

### 27.3 Known Conflicts

Document any conflicts discovered during development.

---

## 28. Distribution & Community

### 28.1 Distribution Channels

- Foundry VTT official package list
- GitHub releases
- Arcana5e website (if applicable)

### 28.2 Feedback Channels

- GitHub Issues (bug reports, feature requests)
- Discord server (community support)
- Email (direct contact)
- In-app feedback button (links to GitHub)

### 28.3 Testing Plan

1. **Alpha:** Internal testing with Arcana5e D&D group
2. **Beta:** Public beta via GitHub
3. **Release:** Foundry package listing

### 28.4 Documentation

- README with quick start
- Wiki with detailed guides
- In-app tooltips
- Video tutorial links (if created)
- Onboarding wizard for first-time users

---

## Appendix A: Onboarding Wizard Steps

1. **Welcome** - Introduction to Bob's Talking NPCs
2. **Party Setup** - Configure party definition method
3. **Create First Faction** - Walk through faction creation
4. **Create First NPC** - Create a simple merchant NPC
5. **Create First Dialogue** - Simple 3-node dialogue tree
6. **Create First Quest** - Basic fetch quest
7. **Complete** - Summary and links to documentation

Wizard can be restarted from settings.

---

## Appendix B: Default Keybinds

| Key | Action |
|-----|--------|
| J | Open Quest Log |
| Shift+J | Open Faction Overview |
| Shift+T | Toggle Quest Tracker |

All keybinds customizable in player settings.

---

## Appendix C: Chat Message Templates

```html
<!-- Quest Accepted -->
<div class="btnpc-chat quest-accepted">
  <h3>Quest Accepted</h3>
  <p><strong>{playerName}</strong> accepted: <strong>{questName}</strong></p>
</div>

<!-- Quest Completed -->
<div class="btnpc-chat quest-completed">
  <h3>Quest Completed!</h3>
  <p>The party completed: <strong>{questName}</strong></p>
  <p class="rewards">Rewards: {rewardSummary}</p>
</div>

<!-- Rank Up -->
<div class="btnpc-chat rank-up">
  <h3>Rank Up!</h3>
  <p><strong>{playerName}</strong> is now <strong>{rankName}</strong> rank in the <strong>{factionName}</strong>!</p>
</div>
```

---

## Appendix D: Icon Specifications

| Icon | Size | Format | Usage |
|------|------|--------|-------|
| Quest Available | 32x32 | SVG | Token overlay |
| Quest Turn-in | 32x32 | SVG | Token overlay |
| Merchant | 32x32 | SVG | Token overlay |
| Dialogue | 32x32 | SVG | Token overlay |
| Faction Icons | 64x64 | PNG/SVG | Faction display |

---

*Document Version: 1.0*
*Last Updated: January 2026*
*Author: Claude (AI Assistant) in collaboration with Arcana5e*
