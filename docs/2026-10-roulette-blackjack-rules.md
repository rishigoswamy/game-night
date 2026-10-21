# Roulette and Blackjack rules moved into their own modules (October 2026)

Roulette and Blackjack were the first two tables and were built as complete pages: their rules lived inside
`js/pages/roulette.js` (1,816 lines) and `js/pages/blackjack.js` (1,485 lines), mixed with drawing, animation, voice and
the phone link. Blackjack's `settle()`, for example, decided each hand's result in the same function that flew the chips and
spoke the dealer's lines. Those rules could only be tested by playing whole games in a browser.

The four newer tables already kept their rules in small modules (`games/casino/*.js`). This change does the same for
Roulette and Blackjack. **Nothing about how the games play or look changes.**

## What moved

| New file | Rules it holds | Used by |
|---|---|---|
| `games/casino/roulette-rules.js` (`RouletteRules`) | Wheel order, colours, every bet (label, payout, winning pockets), `settle(bets, pocket, players)` | `roulette.js` |
| `games/casino/blackjack-rules.js` (`BlackjackRules`) | Shoe, card values, hand totals (soft aces), what counts as blackjack, when Double / Split are allowed, split Aces, the dealer's blackjack check and drawing (stands on all 17s), each hand's result and payout (3:2 blackjack), chips returned | `blackjack.js` |

The pages keep everything on screen and the order of play: dealing animations, the dealer's voice, sweeping and paying
chips, timers, the phone link. Where they used to compute a rule inline they now call the module, e.g.
`Object.assign(h, BlackjackRules.result(h, S.dealer.cards))` in Blackjack's `settle()`.

The rule code moved without rewriting. The only difference is that functions which read the page's state directly
(`S.players[S.turn.p].bal`, `S.hands[...]`) now take those values as arguments.

## How it was verified

1. **Old vs new, side by side:** the old functions, taken from the previous commit, and the new modules were run on the
   same random inputs. They were identical on 200,000 random Blackjack cases (totals, labels, blackjack, Double, Split,
   dealer blackjack, results, payouts), on a full 6-deck shoe for the same random numbers, on all 50 Roulette bets × 38
   pockets, and on 50,000 random Roulette settlements.
2. **New unit tests** (`test/unit/roulette-blackjack.test.js`, 15 tests, part of `npm test`): wheel layout and colours,
   every bet's coverage and payout, 0/00 losing outside bets, equal house edge on all bets, settlement examples, the
   phones' wheel matching the table's; Blackjack values, soft/hard totals, blackjack, Double/Split conditions, dealer peek
   and soft-17, every result incl. 3:2 on a $5 bet and dealer blackjack vs a three-card 21, chips returned, the shoe.
3. **Planted bugs:** the dealer hitting soft 17, blackjack paying 1:1, and Red winning on 0 were each caught by the new
   tests (then reverted).
4. **End-to-end:** the full browser suite was run on the previous commit and on this change: see below.

| Run | Result |
|---|---|
| Previous commit (before this change) | 23 of 24 pass. `starter` failed: a bug in that test (see below). |
| This change | 22 of 24 on the first run: `starter` (same test bug), and `party-werewolf-game`, which failed only because the Mac went to sleep mid-test ("network suspended"); the game itself finished correctly. Rerun with the Mac awake: it passes. |
| After fixing the `starter` test | `starter` passes. |

Every Roulette and Blackjack browser test passed both before and after.

**The `starter` test bug (fixed here):** it waited for an already-open lobby tab to reload when the game restarted. By design a tab
that was connected before only hides its "isn't running" bar and reconnects; only pages opened from the offline copy reload.
It had passed once by timing luck. It now checks that the bar goes away.

