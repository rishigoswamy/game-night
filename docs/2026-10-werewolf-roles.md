# Werewolf: more roles, sorted by difficulty (October 2026)

One Night Werewolf now has 22 roles instead of 11, grouped as **Beginner**, **Intermediate** and **Advanced**, and the
Troublemaker can choose not to swap. This note records the research behind it and what was left out.

## What the official games say

*One Night Ultimate Werewolf* (Bezier Games) has 16 cards and 11 roles. The rulebook suggests a **first game** with
Werewolves, Seer, Robber, Troublemaker and Villagers, adding roles as players learn them. It keeps the **Doppelgänger**
for experienced players, because it changes into any other role. *Daybreak*, the first expansion, adds 11 more roles that
mostly move, protect or reveal cards.

**Bezier doesn't label roles Beginner, Intermediate or Advanced.** The levels in the game are ours, built from that advice:

| Level | Roles | Why |
|---|---|---|
| Beginner (always in) | Werewolf, Villager, Seer, Robber, Troublemaker | The official first game |
| Intermediate | Minion, Mason, Drunk, Insomniac, Hunter, Tanner; Mystic Wolf, Dream Wolf, Apprentice Seer, Revealer, Bodyguard | The rest of the base game, plus Daybreak roles that are a small twist on a role you already know |
| Advanced | Doppelgänger, Sentinel, Alpha Wolf, Paranormal Investigator, Witch, Village Idiot | They change roles, move many cards or block other roles, so the night is hard to reason about |

Night order follows the official wake order: Sentinel, Doppelgänger, Werewolves, Alpha Wolf, Mystic Wolf, Minion,
Masons, Seer, Apprentice Seer, Paranormal Investigator, Robber, Witch, Troublemaker, Village Idiot, Drunk, Insomniac,
Revealer.

## How some of the trickier rules work here

- **Optional actions:** the Seer, Robber, Troublemaker and most new roles can choose to do nothing. The Drunk, the
  Doppelgänger and the Alpha Wolf must act (if time runs out, the game acts for them at random). A Witch who looked at a
  center card must swap it (if time runs out, she takes it herself).
- **Doppelgänger:** looks at a player's card and becomes that role. A copied Seer, Robber, Troublemaker, Drunk, Witch and
  so on acts at once, in the Doppelgänger's turn. A copied Werewolf, Minion, Mason, Insomniac or Revealer wakes again with
  that role. It joins the copied role's team. The night gets twice as long for this step.
- **Special werewolves** (Mystic, Dream, Alpha) take the place of the plain Werewolf cards, so the werewolf count doesn't grow.
  The Alpha Wolf adds a fourth Werewolf card to the center, which it must hand to a non-werewolf.
- **Sentinel's shield:** a shielded card can't be looked at or moved by anyone that night (the phones mark it 🗿).
- **Paranormal Investigator:** looks at up to two cards and stops at a werewolf or Tanner, joining that side.
- **Revealer:** a card turned face up is shown on the Mac and every phone during the day; a werewolf or Tanner stays hidden.
- **Bodyguard:** the player the Bodyguard votes for can't die; the most votes among everyone else decide.
- With too many extras for the table, the most advanced are left out first.

## Full rules on hover

In the role picker every role, including the five Beginner roles that are always in, shows a card with its full rules
when you hover over it (or tab to it with the keyboard). The card lists the role's level and team, when it wakes
(relative to the Beginner roles, which are called in every game, e.g. "after the Robber, before the Troublemaker"),
what it does, how it wins, and how it interacts with other roles (shields, timeouts, the Doppelgänger). The rules
live in `DETAIL` in `games/party/werewolf.js`. A unit test checks that every "after X" / "before Y" a card states
is true in the real night order.

## Night order for the roles picked

The real order depends on which roles are in the game (not on who is dealt what: a role whose card is in the center is
still called, so the pauses give nothing away). The lobby shows the exact order for the roles ticked and the players
present, which roles don't wake, and which ticked roles don't fit (too many for the number of players). During the
game the Mac shows the same order with the role now awake highlighted. Both come from the same function as the night
itself (`nightSteps`), so they can't disagree. The hover card is generic: any party game option can give its choices full rules the same way.

## Left out, and why

| Role or game | Why not (yet) |
|---|---|
| **Curator** (Daybreak) | Its artifact tokens include behaviour rules ("Mask of Muting: you can't speak") that only work face to face. |
| ***One Night Ultimate Vampire*** | A different engine: Marks instead of cards, plus a dusk phase. It would be a separate game. |
| ***One Night Ultimate Alien*** | Built around random instructions from the official app each night. |
| ***Super Villains*** | A lighter re-theme of the base roles; nothing new to the rules. |
| **Bonus packs** (Aura Seer, Apprentice Tanner, Thing, …) | Possible later. Most are small variations of roles already in. |

Interesting ones to consider next: **Aura Seer** (sees who moved or viewed a card), **Apprentice Tanner** (wins if the
Tanner dies) and **Thing** (taps a neighbour on the shoulder; needs a phone vibration).

## Sources

- [Bezier Games: One Night Ultimate Werewolf](https://beziergames.com/products/one-night-ultimate-werewolf)
- [Wikipedia: Ultimate Werewolf](https://en.wikipedia.org/wiki/Ultimate_Werewolf)
- [UltraBoardGames: roles](https://www.ultraboardgames.com/one-night-ultimate-werewolf/roles.php)
- [RulesPal: Daybreak rulebook](https://rulespal.com/one-night-ultimate-werewolf-daybreak/rulebook)
- [One Night wiki: Wake Order](https://one-night.fandom.com/wiki/Wake_Order)
- [Dice Tower: Daybreak](https://dicetower.com/board-game/163166)
- [GeekDad review](https://geekdad.com/2014/03/one-night-ultimate-werewolf/)
- [Theology of Games: Daybreak](https://theologyofgames.com/blog/2014/10/1/daybreak-one-night-ultimate-werewolf-is-expanding)
- [Nerdist: favourite role sets](https://nerdist.com/article/our-favorite-rolesets-for-one-night-werewolf/)

## Tests

- **Unit tests** (`test/unit/party-werewolf.test.js`, 26 new): role levels and descriptions; the official night order;
  a whole night played through (only roles in the game are called, then day, vote and the end); what happens when time
  runs out (the Doppelgänger copies at random, the Drunk and the Alpha Wolf act, a Witch who looked takes the card);
  which actions are optional; every new role, including the Doppelgänger copying the Seer, a Werewolf, the Drunk, the
  Tanner and the Dream Wolf, two shields, the Paranormal Investigator becoming a Werewolf or a Tanner; the reveal
  (Bodyguard, Alpha Wolf's 4th card); the phones (level shown, Don't-swap buttons, shielded players greyed out);
  2,000 random role choices all giving a valid deck. `npm test`: 131 pass.
- **New browser tests:** `party-werewolf-roles` (the grouped role picker, and on real phones the Troublemaker not swapping,
  the Sentinel's shield, the Doppelgänger copying the Seer, the Revealer's face-up card on the Mac and the phones) and
  `party-icons` (each icon animates only when hovered, and not at all with reduced motion).
- **Hover cards and night order:** a unit test checks every role has full rules and that each "after/before" it states
  is true (a planted mistake was caught); others check the order for given roles, the lobby text and the Mac's highlight; `party-werewolf-roles` checks the card appears on hover and keyboard focus, stays on screen, and hides.
- **Full browser suite:** 26 of 26 pass.

### Bugs the tests found (fixed)

- A Doppelgänger that copied the Sentinel replaced the Sentinel's shield instead of adding a second one.
- The final reveal didn't list the Alpha Wolf's 4th center card.
- A Paranormal Investigator who stopped after one look was told "You did nothing tonight."
- A Doppelgänger acting as its copied role had a misleading heading on its phone; it now says e.g. "Doppelgänger (as Seer)".
