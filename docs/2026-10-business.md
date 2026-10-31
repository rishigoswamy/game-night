# Business: rules for Game Night (October 2026) · Beta

Business (`public/games/party/business.js`) is a property-trading game for 2–8 players. Its rules follow the
official Monopoly rules; the name, the board names, the card wording and the look are our own. The repository is
public, and Monopoly's name, street names and card text are Hasbro's. The unit tests (`test/unit/party-business.test.js`)
check the rules below.

**Beta:** new and still being play-tested. The money scales and the balance of the house rules may change after real
game nights.

## Boards

Twelve boards, chosen in the lobby. All play the same; each has its own names, money, colours, centre picture, tokens, card
wording and narrator lines.

**The centre pictures.** Each board shows a painted picture of the city (`public/games/party/art/boards/<board>.jpg`), cut
from the centre of a full board render, with its own logo plate and card piles.

| Board | Mood | Money | Dearest street |
|---|---|---|---|
| New York | rich, high-rise | $ | $4M (Fifth Avenue) |
| Mumbai | autos, local trains, catchy phrases | ₹ (lakh / crore) | ₹16 Cr (Altamount Road) |
| Paris | lifestyle and fashion | € | €2.6M (Avenue de l'Opéra) |
| Rio | beach life | R$ | R$3.9M (Leblon) |
| Zurich | snowy mountains and lakes | CHF | CHF 4.5M (Goldküste) |
| Tokyo | sci-fi | ¥ | ¥380M (Ginza) |
| Dublin | an old kingdom | € | €1.7M (Shrewsbury Road) |
| Santorini | white villages, blue domes, the Aegean | € | €1.8M (Oia) |
| Cairo | pyramids, camels, oases | E£ | E£7.5M (Zamalek) |
| Tromsø | the northern lights, fjords, snow | NOK | NOK 10.5M (Strandkanten) |
| Hong Kong | neon, skyscrapers, the harbour | HK$ | HK$90M (The Peak) |
| Prague | castles, bridges, autumn colours | Kč | Kč 40M (Pařížská) |

**Money.** The game keeps the standard amounts (60…400 for streets, 1,500 to start, 200 at GO). Each board multiplies
every amount by one factor and shows it in local style. The factor makes the dearest street cost roughly a prime 150 m²
flat there, from 2025 prices per m² (Knight Frank, Henley & Partners, Global Property Guide, FipeZap, local portals). The
factor is the same for every amount (salary, rents, houses, taxes, cards, bid buttons), so the game plays the same on
every board.

The real city boards rank real places by value, but never put a slum or favela at the cheap end. London and Paris street
lists that appear in Hasbro's editions are avoided, which is why Paris uses neighbourhoods and landmarks. Santorini uses real
Greek islands and towns.

## The open table: showing the boards

In the lobby, **Open the table: show the boards** puts the chosen board on the whole Mac screen, with the join QR code
and the players who have joined. The host flips through the twelve boards (◀ ▶, or a tap on a board's name) while players
join. On their phones, players see the board being shown and can vote 👍 for any boards they like, once per board (a
second tap takes the vote back). The votes are only advice: the Mac shows the count on each board, and the host picks.
**Start on …** starts the game on the board showing; **Close** goes back to the lobby.

## The gavel

When an auction opens, the Mac shows a full-screen gavel striking its block three times ("AUCTION", with the property),
and "SOLD!" with one strike when it sells, each with a synthesized wooden knock. This follows Roulette's full-screen 0 / 00
moment. The knock plays with the Moderator voice on; with reduced motion the gavel doesn't swing.

## Lobby options

| Option | Choices (default first) |
|---|---|
| Board | the ten above (New York first) |
| Game length | Classic: the last one standing wins · Short game: ends at the first bankruptcy, the richest wins |
| A property nobody buys | Goes to auction (official) · Stays with the bank |
| Speed die | Off · On |
| Free Parking | Nothing (official) · Jackpot: taxes and fines go to the middle |
| Landing on GO | The usual salary · Double salary |
| Time per turn | Off · 60 / 90 / 120 / 180 s |

## The rules

- **Start:** everyone gets 1,500 and rolls for turn order: the highest starts, and on a tie whoever rolled that number
  first. Play then goes in seat order. GO pays 200 when you pass it or land on it.
- **A turn:** roll two dice and move. Doubles roll again; a third double in a row sends you to jail. Then you can build,
  sell, mortgage and trade, and end the turn.
- **Buying:** buy a free property at its price. If you don't, it goes to auction (or stays with the bank, with auctions
  off). In an auction everyone bids from their phone in steps of 10 / 50 / 100; it closes 10 seconds after the last bid,
  or as soon as everyone else has passed.
- **Rent** is paid automatically:
  - a street: its rent, doubled when the owner has the whole colour set unbuilt; houses and hotels raise it;
  - stations: 25 / 50 / 100 / 200 for one to four owned;
  - utilities: 4 × the dice with one, 10 × with both;
  - a mortgaged property charges nothing.
- **Building:** only with the whole colour set and nothing in it mortgaged, built evenly. A hotel comes after 4 houses
  (3 in the short game). The bank has 32 houses and 12 hotels; when they run out you wait. Buildings sell back at half
  price, evenly.
- **Mortgages:** half the price, only with no buildings in the colour set; paying off costs the mortgage + 10%.
  Receiving a mortgaged property (a trade, a bankruptcy) costs the 10% interest at once.
- **Jail:** you go there from Go to Jail, a card or three doubles, without the GO salary. To get out, pay 50 before
  rolling, use a Get Out of Jail Free card, or roll doubles (move, no extra roll). After the third failed turn, pay 50
  and move (one turn in the short game). In jail you still collect rent, build and trade.
- **Cards:** 16 Fortune and 16 Treasury, with the standard effects in the board's words:
  - move to GO or a named space;
  - the nearest station (pay double rent) or the nearest utility (pay 10 × a fresh roll);
  - go back 3, or go to jail;
  - pay or collect, repairs per house and hotel, pay each player or collect from each;
  - Get Out of Jail Free, which you keep until you use or trade it.
- **Trading:** only with the player whose turn it is: money, properties (with no buildings in their colour set) and Get
  Out of Jail Free cards. The other player accepts or declines.
- **Debt:** if you owe more than you have, sell buildings, mortgage or trade (on your turn) to raise it, then pay, or
  declare bankruptcy.
  - To a player: they get your money, properties (paying the 10% on mortgaged ones) and cards.
  - To the bank: your buildings go back, your properties go back to the bank and up for auction (with auctions on).
- **Leaving mid-game** counts as bankruptcy to the bank. A leaver isn't recorded on the leaderboard.
- **Winning:**
  - Classic: the last player left.
  - Short game: everyone starts with two free properties, and at the first bankruptcy the richest player still in wins.
    Richest means net worth: cash, plus property prices (half if mortgaged), plus buildings at cost.
  - The leaderboard counts wins, with net worth in standard units as the points.
- **Speed die** (option, from Hasbro's Mega Edition): a third die once you've passed GO.
  - 1–3 adds to the move.
  - The **bus** lets you move by one die or both.
  - **Fast forward** (our name for "Mr. Monopoly"): after you move, go on to the next property nobody owns, or the next
    one where you pay rent if all are owned.
  - Triples move you to any space.
- **Time per turn** (option): when time runs out the game rolls, declines a purchase (auction), and ends the turn. A
  debt gets 60 seconds of its own (then buildings are sold and properties mortgaged automatically, or bankruptcy).

## Not built yet

- Counter-offers in trades (as in Catan): offers are accepted or declined.
- Auctions for the last houses or hotels when several players want them; it's first come, first served.
- Building and mortgaging on other players' turns (allowed on your own turn, or to pay a debt).

## Sources

- [Wikibooks: Monopoly / Official Rules](https://en.wikibooks.org/wiki/Monopoly/Official_Rules)
- [Hasbro instruction sheet C1009](https://consumercare.hasbro.com/api/download/C1009_en-us)
- [Monopoly 1961 "Rules for a Short Game"](https://profjoecain.net/monopoly-1961-rules-short-game)
- [Monopoly: The Mega Edition (the speed die)](https://en.wikipedia.org/wiki/Monopoly:_The_Mega_Edition)
- [ABA: board games and intellectual property](https://www.americanbar.org/groups/intellectual_property_law/publications/landslide/2014-15/march-april/not-playing-around-board-games-intellectual-property-law/)
- Prices per m², 2025: [Knight Frank Wealth Report](https://cxotoday.com/press-release/us-1-million-can-buy-370-sq-m-in-bengaluru-208-sq-m-in-delhi-and-99-sq-m-in-mumbai-knight-franks-the-wealth-report-2025/),
  [Global Property Guide](https://www.globalpropertyguide.com/square-meter-prices), [neho.ch (Zurich)](https://neho.ch/en/price-m2-goldkueste),
  [FipeZap via InfoMoney (Rio)](https://www.infomoney.com.br/?p=3163659), [Aqarmap (Cairo)](https://aqarmap.com.eg/en/advice/owing-property-in-zamalek/),
  [Squareyards (Mumbai)](https://www.squareyards.com/property-rates/malabar-hill-mumbai), [Efficity (Paris)](https://www.efficity.com/prix-immobilier-m2/v_paris_75008/)
