The following is the English translation of the **FATE GRID** project guide provided in the uploaded file.

---

Whole Project Generation Prompt 

You are a senior full-stack engineer and a development agent capable of implementing UI/UX. Create the mobile-first web app **FATE GRID** as a complete, executable project from start to finish, **accurately implementing** the "Technical Specifications" below. It must operate without any missing functions and be immediately executable locally.

---

0. Project Overview 

* 
**App Name**: FATE GRID 


* 
**Format**: **Mobile Web (Responsive)**, touch-centric 


* 
**Core Concept**: When a user **places character cards on a grid**, an **algorithm automatically generates relationships (links) and emotions**, visualized via an **SVG relationship map**.


* 
**Maximum Characters**: **27** 


* 
**Key Features**: Real-time relationship line generation, zoom/pan, Reroll (regenerate relationships/emotions), Export (image + text report), session save/restore/reset (LocalStorage).



---

## 1. Technical Stack (Recommended/Fixed)

* 
**Frontend**: React + TypeScript + Vite 


* 
**Styling**: TailwindCSS 


* 
**State Management**: React state + lightweight store (e.g., Zustand) or Context (prioritize simplicity/clarity) 


* 
**Rendering**: **SVG-based** relationship lines/node rendering (Canvas is prohibited) 


* 
**Build/Execution**: Must run via `npm install` and `npm run dev` 


* 
**Testing (Minimum)**: Unit tests for core algorithms (Vitest recommended) 



---

## 2. Mandatory User Flow

1. 
**Entry**: Upon app launch, the **Protagonist (PROTAG) card is automatically placed** in the center of the grid.


2. 
**Setup**: The user enters the protagonist's **name** and selects a **personality** (from the defined list).


3. 
**Placement**: The bottom drawer displays the **Next Card**, consisting of a random `position + personality`. The user touches a grid cell (or coordinates) to place it; max 27 characters.


4. 
**Verification**: Relationship lines are generated and displayed in real-time upon placement. Provide **Zoom In/Out + Panning (movement)** to view the entire network.


5. 
**Adjustment**: The **[Reroll]** button keeps characters/positions but **regenerates only links and emotions**.


6. 
**Output**: The **[Export]** button saves the relationship map as an **image** (PNG preferred, SVG if possible) and generates a **text report** (narrating relationships).


7. 
**Exit**: Sessions are automatically saved to LocalStorage and restored on refresh. The **[Reset]** button **initializes everything** and starts a new session (redeploying the PROTAG).



---


## 3. Data Model (Precise)

### 3.1 Character Types and Enums

```ts
/** * Character Roles (Positions) 
 * Includes Korean labels for UI mapping 
 */
type Position = "PROTAG" | "SUPPORT" | "RIVAL" | "VILLAIN" | "MENTOR" | [cite_start]"EXTRA"; [cite: 7]

const PositionLabels: Record<Position, string> = {
  PROTAG: "주인공",
  SUPPORT: "조연",
  RIVAL: "라이벌",
  VILLAIN: "악당",
  MENTOR: "멘토",
  EXTRA: "엑스트라"
};

/** * Character Personalities 
 * Includes Korean labels and expanded types 
 */
type Personality = "SOCIAL" | "BRIGHT" | "INTRO" | "CYNICAL" | "MAD" | "CALM" | "AGGRESSIVE" | [cite_start]"TIMID"; [cite: 7]

const PersonalityLabels: Record<Personality, string> = {
  SOCIAL: "사교적",
  BRIGHT: "밝음",
  INTRO: "내성적",
  CYNICAL: "냉소적",
  MAD: "광기",
  CALM: "침착함",
  AGGRESSIVE: "공격적",
  TIMID: "소심함"
};

```

### 3.2 CharacterNode

```ts
interface CharacterNode {
  [cite_start]id: string; [cite: 8]
  [cite_start]name: string; [cite: 8]
  [cite_start]position: Position; [cite: 8]
  [cite_start]personality: Personality; [cite: 8]
  range: number;           [cite_start]// Use 999 for INF [cite: 8]
  [cite_start]slots: number; [cite: 8]
  [cite_start]slotsRemaining: number; [cite: 9]
  [cite_start]x: number; [cite: 8]
  [cite_start]y: number; [cite: 8]
}

```

### 3.3 Link and Emotion

```ts
type Emotion = "Love" | "Friendly" | "Hostile" | [cite_start]"Awkward"; [cite: 9]

/** * Sub-categories for specific relationship nuance 
 * e.g., Love : Unrequited (짝사랑), Friendly : Family (가족)
 */
type EmotionSubCategory = string; 

interface Link {
  [cite_start]id: string; [cite: 10]
  from: string;      [cite_start]// CharacterNode id [cite: 10]
  to: string;        [cite_start]// CharacterNode id [cite: 10]
  [cite_start]emotion: Emotion; [cite: 10]
  subCategory: EmotionSubCategory; 
  modifier?: any;    [cite_start]// For future extensibility [cite: 11]
}

```

### 3.4 Session Storage

The following data must be persisted in **LocalStorage**:

* 
`nodes`: An array of all placed `CharacterNode` objects. 


* 
`links`: An array of all generated `Link` objects. 


* 
`seed`: The random seed used for the current session's generation logic. 



---

## 4. Character Creation Rules (Precise)

* 
**Timing**: Generate a **Next Card** dynamically whenever needed.


* **Position Rules**:
* 
**PROTAG**: range = ∞, slots = 5–7 


* 
**SUPPORT**: range = 3–4, slots = 2–3 


* 
**RIVAL**: range = ∞, slots = 3–5 


* 
**MENTOR**: range = 5, slots = 2 


* 
**EXTRA**: range = 1–2, slots = 1 


* 
*Note: Infinite range (∞) is internally represented as 999.* 




* 
**Personality Rules**:


* 
**SOCIAL**: range +1, slots +2 


* 
**BRIGHT**: range +0, slots +1 


* 
**INTRO**: range -1, slots -1 


* 
**CYNICAL**: range +0, slots +0 


* 
**MAD**: range +1, slots +1 




* **Final Calculation**:
* 
`finalRange = positionRange + personalityRangeModifier` (Min 1) 


* 
`finalSlots = positionSlots + personalitySlotModifier` (Min 1) 





---

## 5. Distance Calculation (Precise)

Use **Manhattan Distance**:
`distance = |x1 - x2| + [cite_start]|y1 - y2|` 

**Range Judgment**:


`if range >= 999 -> always true; else distance <= range`.

---

## 6. Relationship Generation Algorithm (Core)

When a new card is placed, relationships are generated in two steps:

1. 
**Outgoing (New Card → Existing Cards)**: Search for targets within range, select targets based on the new card's `slots`, and generate emotions/links.


2. 
**Incoming (Existing Cards → New Card)**: Each existing character checks if the new card is within their range; if `slotsRemaining > 0`, they **probabilistically create a connection** based on weighted distance. Ensure no duplicate from-to links.


3. 
**Target Weight** : `weight = (1 / distance) * positionWeight`.


4. **Position Weight Rules**: Start with `base = 1`.
* If target is PROTAG: `base *= 1.5` 


* If attacker is RIVAL and target is PROTAG: `base *= random(3~5)` 


* If attacker is RIVAL and target is SUPPORT: `base *= 1.5` 





---

## 7. Preview Line System (Precise)

* While the user holds the Next Card, display **preview lines** for highly probable relationships at that location.


* 
**PREVIEW_MAX = 6**: If more than 6 candidates exist, select the top 6 based on weight.


* 
`previewWeight = (1 / distance) * positionWeight`.



---

## 8. First Card Connection Rule (Precise)

To prevent protagonist isolation: the moment the first card after the PROTAG is placed, a **PROTAG → First Card link must be generated** (including emotion).

---

## 9. Emotion Generator (Precise)

* 
**Types**: Love, Friendly, Hostile, Awkward.


* Must generate 1 of 4 types; biases based on position combinations are allowed, but regeneration on Reroll is required.



---

## 10. UI/UX Requirements

* 
**Layout**: Top (Title + Reroll, Export, Reset buttons), Center (**Grid Board** ), Bottom (**Drawer/Bottom Sheet** for Next Card and instructions).


* 
**Grid**: Coordinate-based placement (x,y); no duplicate coordinates allowed; disable placement once 27 characters are reached.


* 
**Zoom/Pan**: Pinch zoom (mobile) or button/wheel (desktop) on the SVG; dragging for panning; minimize animations for performance.


* 
**Visualization (SVG)**: Cards for nodes (name + position/personality); lines for edges + emotion labels.



---

## 11. Export Requirements

* 
**Image Export**: Save current view/map as PNG; provide the original SVG download as a minimum requirement.


* 
**Text Report** : Iterate through links to generate sentences (e.g., "The Protagonist trusts Sidekick A and they are friends."). Must be in **Korean** with a copy button.



---

## 12. Reroll/Reset/Save Behavior (Precise)

* 
**Reroll**: Keep nodes/coordinates; delete all links and regenerate relationships/emotions.


* 
**Reset**: Delete all characters; start a new session with PROTAG setup.


* 
**Save**: Automatically save all changes to LocalStorage and restore upon refresh.



---

## 13. Performance Policy (Precise)

* Avoid or minimize animations.


* Manage SVG element count for mobile performance.


* Limit Preview lines to a maximum of 6.



---

## 14. Implementation Details

1. Use session `seed` for reproducible randomness.


2. 
**No Duplicate Links**: Prevent multiple links between the same from-to pair.


3. 
**Slot Management**: Decrease `slotsRemaining` when creating a link (cannot go below 0).


4. Verify range/weight/selection logic with **unit tests**.


5. 
**Errors/Exceptions**: Notify user if a cell is occupied or if there are insufficient candidates for links.



---

15. Folder Structure Example 

* 
`src/engine/`: `characterGenerator.ts`, `relationshipEngine.ts`, `emotionGenerator.ts`, `distance.ts`, `previewEngine.ts`.


* 
`src/storage/`: `sessionManager.ts`.


* 
`src/types.ts`, `README.md`, and minimal test code.



---

## 16. Acceptance Criteria

* PROTAG is generated in the center at launch.


* Next Card is displayed and can be placed via touch (max 27).


* Relationship lines (Outgoing/Incoming) are generated immediately.


* Preview lines work and are limited to 6.


* Reroll changes only relationships/emotions.


* Export provides image/SVG and text report.


* LocalStorage save/restore/reset works correctly.


* Zoom/pan works on mobile.



---

## 17. Final Instructions

* Generate **complete code** satisfying these requirements.


* 
**Do not change the specs** arbitrarily.


* Prioritize "minimum implementation" for choices, but do not omit features.


* Provide the result as a **complete, executable project**.
