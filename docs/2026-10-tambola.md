# Tambola (Housie): a new party game (October 2026)

Tambola, also called Housie (and close to British 90-ball bingo), is the number-calling game played at family
gatherings, especially in India. The Mac is the caller; every player's tickets are on their own phone.

## The game, as researched

- **Tickets:** 3 rows × 9 columns, 15 numbers: 5 in every row, 1 to 3 in every column. The first column holds 1–9, the
  second 10–19, … the last 80–90; each column's numbers go down in increasing order.
- **Calling:** the numbers 1 to 90 are drawn at random and called, often with traditional calls ("Kelly's eye, number one",
  "Two little ducks, twenty-two", "Top of the house, ninety").
- **Prizes:** the usual ones are Early Five (any 5 numbers), Top / Middle / Bottom Line, Four Corners (first and last
  numbers of the top and bottom lines) and Full House (all 15). Some games add a Second Full House.
- **Claiming:** the first correct claim wins and the caller checks it. A wrong ("bogus") claim is penalised in some games.
  House rules differ on whether a claim must come before the next number is called, and on sharing a prize when two
  players complete it on the same number.

## How it plays here

| | |
|---|---|
| Players | 2–10, each on their own phone (1, 2 or 3 tickets each; a player's tickets never share a number) |
| The Mac | The caller: the ball and its call, the last few numbers, the board 1–90 with every number called, the prizes and their winners, **Pause** / **Resume** and **Next number now** |
| Phones | The tickets (tap a number to mark it), a **Claim** button per prize, the number just called, the board on request; a short buzz when the number called is on your ticket |
| Claims | Checked against the numbers called, not the marks. After a good claim the caller stops: "Any more claims?" (5 seconds), so others who completed the same prize on the same number share it |
| Winning | The Full House wins the game. The leaderboard counts wins and, in a **Prizes** column, prizes won |

**House-rule options in the lobby** (defaults first): the prizes (hover for each one's rule; Second Full House needs Full
House), tickets per player, time between numbers (3/6/10/15 s), claiming (players claim / automatic), marking (tap /
automatic), late claims (allowed while the prize is open / must claim before the next number), wrong claims (a warning /
out of that prize), calling style (traditional calls / just the number).

**Calls:** a family-friendly set of the traditional calls (about 70 numbers). Calls that are dated or unkind (e.g.
"Two fat ladies") are left out; those numbers are called by their digits ("eight and eight, eighty-eight").

If nobody claims the Full House, all 90 numbers are called, then 20 seconds of "last claims", and the game ends.

## Tests

- **Unit tests** (`test/unit/party-tambola.test.js`, 18): 5,000 random tickets all valid; a player's 3 tickets never
  share a number; the calls for every number; each prize pattern; good, wrong (warning and "out"), late (strict mode) and
  shared claims; several tickets and the Second Full House; marks; whole games played through (automatic and manual
  claims, nobody claiming, "Any more claims?"); Pause and Next; options; what each phone sees (only its own tickets) and
  the Mac. Two planted bugs (Four Corners on the wrong line, unsorted columns) were caught.
- **Browser tests:** `party-tambola-game` plays a whole game with three phones (marking and claiming by tapping, a wrong
  claim on purpose, Pause / Resume, Next, the end screens, the leaderboard's Prizes column, the lobby card);
  `party-icons` covers the new animated card; `party-tambola-modes` covers automatic claims (3 tickets each, Second Full
  House), a phone reloading mid-game (same tickets and marks), automatic marking, the prize rules on hover, and **End game**
  recording nothing.

### A bug the tests found (fixed)

In the first full browser game, two players completed the Top Line on the same number but only the first got it: after
a good claim the caller went straight to the next number, closing the window for a share. The caller now pauses for
"Any more claims?" after every good claim, like a real caller.

## Sources

- [Tambola rules overview](https://advantagebizmarketing.it.com/tambola-game-rules-how-to-play-and-winning-tips/amp/)
- [Ruby Quiz #114: Housie (ticket rules)](https://rubyquiz.com/quiz114.html)
- [Housie ticket generator write-up (DEV Community)](https://dev.to/jamesshah/housie-tambola-ticket-generator-using-python-31m1)
- [Tambola ticket generator constraints (GitHub)](https://github.com/harrysethi/Tambola-Ticket-Generator)
- [Wikipedia: List of British bingo nicknames](https://en.wikipedia.org/wiki/List_of_British_bingo_nicknames)
