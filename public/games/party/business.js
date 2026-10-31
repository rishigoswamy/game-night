// Business (Beta): a Monopoly-style property game with twelve themed boards. The rules follow the official Monopoly rules
// (docs/2026-10-business.md); the names, card wording and look are our own. Money is kept in the standard units
// (60…400 for streets) and shown × the board's factor in its local money, so every board plays the same.
window.PARTY_GAME = (() => {
  /* ---------- The standard board ---------- */
  const GROUP = { brown: '#8b4f2a', lightblue: '#8fd3f5', pink: '#d93a96', orange: '#f7941d', red: '#e5262d', yellow: '#f2d21b', green: '#1fa65a', darkblue: '#1f5fae' };
  const S = (group, price, house, rents) => ({ type: 'street', group, price, house, rents });   // rents: none, 1–4 houses, hotel
  const SPACES = [
    { type: 'go' }, S('brown', 60, 50, [2, 10, 30, 90, 160, 250]), { type: 'treasury' }, S('brown', 60, 50, [4, 20, 60, 180, 320, 450]), { type: 'tax', amount: 200, name: 'Income Tax' },
    { type: 'station', price: 200 }, S('lightblue', 100, 50, [6, 30, 90, 270, 400, 550]), { type: 'fortune' }, S('lightblue', 100, 50, [6, 30, 90, 270, 400, 550]), S('lightblue', 120, 50, [8, 40, 100, 300, 450, 600]),
    { type: 'jail' }, S('pink', 140, 100, [10, 50, 150, 450, 625, 750]), { type: 'utility', price: 150 }, S('pink', 140, 100, [10, 50, 150, 450, 625, 750]), S('pink', 160, 100, [12, 60, 180, 500, 700, 900]),
    { type: 'station', price: 200 }, S('orange', 180, 100, [14, 70, 200, 550, 750, 950]), { type: 'treasury' }, S('orange', 180, 100, [14, 70, 200, 550, 750, 950]), S('orange', 200, 100, [16, 80, 220, 600, 800, 1000]),
    { type: 'parking' }, S('red', 220, 150, [18, 90, 250, 700, 875, 1050]), { type: 'fortune' }, S('red', 220, 150, [18, 90, 250, 700, 875, 1050]), S('red', 240, 150, [20, 100, 300, 750, 925, 1100]),
    { type: 'station', price: 200 }, S('yellow', 260, 150, [22, 110, 330, 800, 975, 1150]), S('yellow', 260, 150, [22, 110, 330, 800, 975, 1150]), { type: 'utility', price: 150 }, S('yellow', 280, 150, [24, 120, 360, 850, 1025, 1200]),
    { type: 'gotojail' }, S('green', 300, 200, [26, 130, 390, 900, 1100, 1275]), S('green', 300, 200, [26, 130, 390, 900, 1100, 1275]), { type: 'treasury' }, S('green', 320, 200, [28, 150, 450, 1000, 1200, 1400]),
    { type: 'station', price: 200 }, { type: 'fortune' }, S('darkblue', 350, 200, [35, 175, 500, 1100, 1300, 1500]), { type: 'tax', amount: 100, name: 'Luxury Tax' }, S('darkblue', 400, 200, [50, 200, 600, 1400, 1700, 2000]),
  ];
  const idx = type => SPACES.map((s, i) => (s.type === type ? i : -1)).filter(i => i >= 0);
  const STREETS = idx('street'), STATIONS = idx('station'), UTILITIES = idx('utility');
  const OWNABLE = SPACES.map((s, i) => (s.price ? i : -1)).filter(i => i >= 0);
  const GROUPS = {}; STREETS.forEach(i => { (GROUPS[SPACES[i].group] = GROUPS[SPACES[i].group] || []).push(i); });
  const START = 1500, SALARY = 200, JAIL_FINE = 50, JAIL = 10, HOUSES = 32, HOTELS = 12;

  // The two decks: the standard effects; the wording comes from each board (key → text, {S} the space, {A}/{B} amounts)
  const FORTUNE = [
    { k: 'go', do: 'move', to: 0 }, { k: 'adv24', do: 'move', to: 24 }, { k: 'adv11', do: 'move', to: 11 }, { k: 'util', do: 'nearest', kind: 'utility' },
    { k: 'rail', do: 'nearest', kind: 'station' }, { k: 'rail', do: 'nearest', kind: 'station' }, { k: 'div', do: 'collect', a: 50 }, { k: 'jailfree', do: 'jailfree' },
    { k: 'back3', do: 'back', n: 3 }, { k: 'jail', do: 'jail' }, { k: 'repairs', do: 'repairs', a: 25, b: 100 }, { k: 'fine', do: 'pay', a: 15 },
    { k: 'adv5', do: 'move', to: 5 }, { k: 'adv39', do: 'move', to: 39 }, { k: 'payeach', do: 'payeach', a: 50 }, { k: 'collect', do: 'collect', a: 150 },
  ];
  const TREASURY = [
    { k: 'go', do: 'move', to: 0 }, { k: 'error', do: 'collect', a: 200 }, { k: 'doctor', do: 'pay', a: 50 }, { k: 'stock', do: 'collect', a: 50 },
    { k: 'jailfree', do: 'jailfree' }, { k: 'jail', do: 'jail' }, { k: 'holiday', do: 'collect', a: 100 }, { k: 'refund', do: 'collect', a: 20 },
    { k: 'birthday', do: 'collecteach', a: 10 }, { k: 'life', do: 'collect', a: 100 }, { k: 'hospital', do: 'pay', a: 100 }, { k: 'school', do: 'pay', a: 50 },
    { k: 'consult', do: 'collect', a: 25 }, { k: 'repairs', do: 'repairs', a: 40, b: 115 }, { k: 'beauty', do: 'collect', a: 10 }, { k: 'inherit', do: 'collect', a: 100 },
  ];
  const DECK = { fortune: FORTUNE, treasury: TREASURY };
  const SPEED = [1, 2, 3, 'bus', 'ff', 'ff'];                      // the speed die: three numbers, the bus, two fast-forwards

  /* ---------- The twelve boards ---------- */
  // money: sym and style (west: 1.2M / 650k; yen: ¥380M; india: ₹16 Cr / ₹25 L). factor: × the standard
  // amounts, so the dearest street (400) is about a prime flat there (2025 prices, local money)
  const WORDS = (keys, list) => Object.fromEntries(keys.map((k, n) => [k, list[n]]));
  const FK = ['go', 'adv24', 'adv11', 'util', 'rail', 'div', 'jailfree', 'back3', 'jail', 'repairs', 'fine', 'adv5', 'adv39', 'payeach', 'collect'];
  const TK = ['go', 'error', 'doctor', 'stock', 'jailfree', 'jail', 'holiday', 'refund', 'birthday', 'life', 'hospital', 'school', 'consult', 'repairs', 'beauty', 'inherit'];
  const SAY = ['intro', 'go', 'buy', 'rent', 'jail', 'auction', 'bankrupt', 'win'];
  const BOARDS = {
    newyork: {
      name: 'New York', mood: 'rich, high-rise', sym: '$', style: 'west', factor: 10000,
      colors: { bg: '#0d1124', frame: '#c9a227', cell: '#fffaf0', title: '#e9c46a' },
      streets: ['Coney Island', 'Flushing', 'Astoria', 'Harlem', 'Williamsburg', 'Chinatown', 'Little Italy', 'East Village', 'Greenwich Village', 'SoHo', 'Tribeca', 'Times Square', 'Broadway', 'Wall Street', 'Chelsea', 'Brooklyn Heights', 'Upper West Side', 'Madison Avenue', 'Upper East Side', 'Central Park West', 'Park Avenue', 'Fifth Avenue'],
      stations: ['Grand Central', 'Penn Station', 'Fulton Center', 'Port Authority'], utilities: ['Power House', 'Water Board'],
      tokens: ['🚕', '🏙️', '💼', '🚘', '💎', '🎩', '🌭', '🗽'],
      f: WORDS(FK, ['Express elevator down to GO: collect your salary.', 'Hail a cab to {S}.', 'Take the subway to {S}.', 'Power cut! Go to the nearest utility; if it is owned, pay 10 × a fresh roll.', 'Rush hour: head to the nearest station; if it is owned, pay double rent.', 'Your startup pays a dividend: collect {A}.', 'A good lawyer: get out of jail free. Keep this card.', 'Missed your stop: go back 3 spaces.', 'Insider-trading probe: go to jail.', 'Elevator inspections: pay {A} per house and {B} per hotel.', 'Jaywalking ticket: pay {A}.', 'Catch a train at {S}.', 'Penthouse viewing on {S}.', 'You host the gala: pay each player {A}.', 'Your bonus clears: collect {A}.']),
      t: WORDS(TK, ['Ticker-tape parade to GO: collect your salary.', 'Bank error in your favour: collect {A}.', 'Private clinic bill: pay {A}.', 'Your shares jump on Wall Street: collect {A}.', 'Bail bond: get out of jail free. Keep this card.', 'Caught in a sting: go to jail.', 'Holiday bonus: collect {A}.', 'Tax refund: collect {A}.', 'Rooftop birthday party: collect {A} from every player.', 'Insurance pays out: collect {A}.', 'Emergency-room visit: pay {A}.', 'Prep-school fees: pay {A}.', 'Consulting fee: collect {A}.', 'Building-code fines: pay {A} per house and {B} per hotel.', 'Your dog wins best in show: collect {A}.', 'An aunt in the Hamptons leaves you {A}.']),
      say: WORDS(SAY, ['Welcome to New York, where the money never sleeps.', '{p} passes GO. Payday!', '{p} buys {S}.', '{p} pays {A} rent to {o}.', '{p} is going to jail.', '{S} goes to auction!', '{p} is bankrupt.', '{p} owns New York!']),
    },
    mumbai: {
      name: 'Mumbai', mood: 'autos, local trains and catchy phrases', sym: '₹', style: 'india', factor: 400000,
      colors: { bg: '#2a1033', frame: '#ff9933', cell: '#fff8ec', title: '#ffcf70' },
      streets: ['Kurla', 'Sion', 'Ghatkopar', 'Andheri East', 'Borivali', 'Dadar', 'Matunga', 'Chembur', 'Powai', 'Goregaon', 'Santacruz', 'Lower Parel', 'Worli', 'Bandra', 'Colaba', 'Marine Drive', 'Churchgate', 'Nariman Point', 'Breach Candy', 'Pali Hill', 'Malabar Hill', 'Altamount Road'],
      stations: ['Mumbai Central', 'Dadar Station', 'Bandra Terminus', 'CST'], utilities: ['Power House', 'Water Board'],
      tokens: ['🛺', '🚆', '🍱', '🏏', '☕', '🚕', '🛵', '🎬'],
      f: WORDS(FK, ['Fast local to GO: collect your salary.', 'Catch an auto to {S}. Meter down, please!', 'Double-decker bus to {S}.', 'Load-shedding! Go to the nearest utility; if it is owned, pay 10 × a fresh roll.', 'Peak-hour rush: go to the nearest station; if it is owned, pay double rent.', 'Your share-market tip pays off: collect {A}.', 'Jugaad! Get out of jail free. Keep this card.', 'Missed the fast train: go back 3 spaces.', 'Caught travelling without a ticket: go to jail.', 'Monsoon leaks everywhere: pay {A} per house and {B} per hotel.', 'Auto-wallah refuses the meter: pay {A}.', 'Board the local at {S}.', 'House-hunting on {S}.', 'Vada pav for everyone: pay each player {A}.', 'Your film is a superhit: collect {A}.']),
      t: WORDS(TK, ['The dabbawala delivers you to GO: collect your salary.', 'Bank error in your favour: collect {A}.', 'Doctor\'s visit after too much street food: pay {A}.', 'IPO allotment! Collect {A}.', 'Your lucky charm works: get out of jail free. Keep this card.', 'Caught in a raid: go to jail.', 'Diwali bonus: collect {A}.', 'Income-tax refund: collect {A}.', 'It\'s your birthday: collect {A} from every player (and cut the cake!).', 'Your insurance policy matures: collect {A}.', 'Hospital bill: pay {A}.', 'Tuition-class fees: pay {A}.', 'Wedding-planner fee: collect {A}.', 'Housing-society repair fund: pay {A} per house and {B} per hotel.', 'You win the society rangoli contest: collect {A}.', 'Ancestral property sold: collect {A}.']),
      say: WORDS(SAY, ['Welcome to Mumbai, the city of dreams! Chalo, let\'s do business.', '{p} crosses GO. Salary aa gayi!', '{p} buys {S}. Badhai ho!', '{p} pays {A} to {o}.', '{p} goes to jail. Arre!', '{S} is up for auction! Bolo, bolo!', '{p} is bankrupt.', '{p} is the king of Mumbai!']),
    },
    paris: {
      name: 'Paris', mood: 'lifestyle and fashion', sym: '€', style: 'west', factor: 6500,
      colors: { bg: '#f3e6ea', frame: '#b5838d', cell: '#fffdfb', title: '#6d597a' },
      streets: ['Barbès', 'Ménilmontant', 'Belleville Park', 'Bastille', 'Oberkampf', 'Montmartre', 'Canal Saint-Martin', 'Le Marais', 'Quartier Latin', 'Montparnasse', 'Saint-Germain', 'Opéra', 'Rue de Rivoli', 'Place de la Concorde', 'Île Saint-Louis', 'Place des Vosges', 'Trocadéro', 'Avenue Montaigne', 'Place Vendôme', 'Parc Monceau', 'Île de la Cité', 'Avenue de l\'Opéra'],
      stations: ['Gare de l\'Est', 'Austerlitz', 'Bercy', 'Gare du Nord'], utilities: ['Power House', 'Water Board'],
      tokens: ['👜', '👠', '🥖', '🧴', '🛵', '📷', '🐩', '🗼'],
      f: WORDS(FK, ['Vespa ride to GO: collect your salary.', 'Shopping spree at {S}.', 'Stroll to {S} for a café crème.', 'A hair-dryer blows the fuses! Go to the nearest utility; if it is owned, pay 10 × a fresh roll.', 'Weekend getaway: go to the nearest station; if it is owned, pay double rent.', 'Your fashion label pays a dividend: collect {A}.', 'A charming smile: get out of jail free. Keep this card.', 'Forgot your sunglasses: go back 3 spaces.', 'Caught copying a designer: go to jail.', 'Façade restoration: pay {A} per house and {B} per hotel.', 'Parked on the pavement: pay {A}.', 'Take a train from {S}.', 'Private showing at {S}.', 'Champagne for the whole table: pay each player {A}.', 'Your collection sells out: collect {A}.']),
      t: WORDS(TK, ['A runway walk straight to GO: collect your salary.', 'Bank error in your favour: collect {A}.', 'Pharmacy visit: pay {A}.', 'Luxury shares rise: collect {A}.', 'A famous friend vouches for you: get out of jail free. Keep this card.', 'Climbed the tower without a ticket: go to jail.', 'Summer in the south: collect {A}.', 'Tax refund: collect {A}.', 'Birthday soirée: collect {A} from every player.', 'Insurance pays out: collect {A}.', 'Hospital bill: pay {A}.', 'Art-school fees: pay {A}.', 'Styling consultation: collect {A}.', 'The roofs leak after the storm: pay {A} per house and {B} per hotel.', 'Second place in a beauty contest: collect {A}.', 'A château in the family: collect {A}.']),
      say: WORDS(SAY, ['Bienvenue à Paris! Style, coffee and business.', '{p} passes GO. C\'est payday!', '{p} buys {S}. Très chic.', '{p} pays {A} to {o}.', '{p} goes to jail. Oh là là.', '{S} goes to auction!', '{p} is bankrupt.', '{p} conquers Paris!']),
    },
    rio: {
      name: 'Rio', mood: 'beach life', sym: 'R$', style: 'west', factor: 9750,
      colors: { bg: '#0b6e8c', frame: '#f9c74f', cell: '#fffcf2', title: '#fff3b0' },
      streets: ['Madureira', 'Méier', 'Tijuca', 'Vila Isabel', 'Maracanã', 'Lapa', 'Santa Teresa', 'Glória', 'Flamengo', 'Botafogo', 'Urca', 'Copacabana', 'Leme', 'Gávea', 'Jardim Botânico', 'Lagoa', 'São Conrado', 'Barra da Tijuca', 'Joá', 'Ipanema', 'Alto Leblon', 'Leblon'],
      stations: ['Central do Brasil', 'Carioca', 'Cinelândia', 'Leopoldina'], utilities: ['Power House', 'Water Board'],
      tokens: ['🏄', '⛱️', '⚽', '🩴', '🥥', '🦜', '🕶️', '🥁'],
      f: WORDS(FK, ['Surf a wave to GO: collect your salary.', 'Beach day at {S}.', 'Samba night in {S}.', 'Blackout during the match! Go to the nearest utility; if it is owned, pay 10 × a fresh roll.', 'Take the train: go to the nearest station; if it is owned, pay double rent.', 'Your beach kiosk pays a dividend: collect {A}.', 'Carnival amnesty: get out of jail free. Keep this card.', 'Lost your flip-flops: go back 3 spaces.', 'Too much samba in the street: go to jail.', 'Salty sea air rusts everything: pay {A} per house and {B} per hotel.', 'Littering on the beach: pay {A}.', 'Catch a train at {S}.', 'Sunset party in {S}.', 'Coconut water for everyone: pay each player {A}.', 'You win the beach-volleyball tournament: collect {A}.']),
      t: WORDS(TK, ['A Carnival parade to GO: collect your salary.', 'Bank error in your favour: collect {A}.', 'Sunburn clinic: pay {A}.', 'Your shares rise: collect {A}.', 'A friend in the samba school: get out of jail free. Keep this card.', 'Surfing in a no-swim zone: go to jail.', 'Holiday bonus: collect {A}.', 'Tax refund: collect {A}.', 'A churrasco for your birthday: collect {A} from every player.', 'Insurance pays out: collect {A}.', 'Hospital bill: pay {A}.', 'Surf-school fees: pay {A}.', 'Tour-guide tips: collect {A}.', 'Storm damage: pay {A} per house and {B} per hotel.', 'Best costume at Carnival: collect {A}.', 'Grandma leaves you {A}.']),
      say: WORDS(SAY, ['Bem-vindos ao Rio! Sun, sea and business.', '{p} passes GO. Payday!', '{p} buys {S}. Que beleza!', '{p} pays {A} to {o}.', '{p} goes to jail.', '{S} goes to auction!', '{p} is bankrupt.', '{p} rules Rio!']),
    },
    zurich: {
      name: 'Zurich', mood: 'snowy mountains and lakes', sym: 'CHF', style: 'west', factor: 11250,
      colors: { bg: '#dcecf6', frame: '#d7263d', cell: '#ffffff', title: '#1d3557' },
      streets: ['Altstetten', 'Schwamendingen', 'Oerlikon', 'Wiedikon', 'Wipkingen', 'Langstrasse', 'Höngg', 'Kreis 5', 'Niederdorf', 'Seefeld', 'Enge', 'Paradeplatz', 'Bahnhofstrasse', 'Lindenhof', 'Uetliberg', 'Zürichberg', 'Rüschlikon', 'Küsnacht', 'Kilchberg', 'Zollikon', 'Dolder', 'Goldküste'],
      stations: ['Hauptbahnhof', 'Stadelhofen', 'Hardbrücke', 'Tiefenbrunnen'], utilities: ['Power House', 'Water Board'],
      tokens: ['🚡', '⛷️', '⌚', '🔔', '🛷', '⛵', '🍫', '🚂'],
      f: WORDS(FK, ['Ski down to GO: collect your salary.', 'Shopping on {S}.', 'Tram to {S}.', 'Frozen pipes! Go to the nearest utility; if it is owned, pay 10 × a fresh roll.', 'Catch the train (on time, of course): go to the nearest station; if it is owned, pay double rent.', 'Your savings account pays interest: collect {A}.', 'Swiss neutrality: get out of jail free. Keep this card.', 'An avalanche closes the pass: go back 3 spaces.', 'Yodelling after 10 pm: go to jail.', 'Snow load on the roofs: pay {A} per house and {B} per hotel.', 'Recycling on the wrong day: pay {A}.', 'Take a train from {S}.', 'Lake-view apartment at {S}.', 'Fondue for everyone: pay each player {A}.', 'Your watch collection gains value: collect {A}.']),
      t: WORDS(TK, ['A cable car to GO: collect your salary.', 'A bank error in your favour (rare in Zurich): collect {A}.', 'Ski injury: pay {A}.', 'Chocolate shares rise: collect {A}.', 'Mountain rescue: get out of jail free. Keep this card.', 'Caught skiing off-piste: go to jail.', 'Holiday bonus: collect {A}.', 'Tax refund: collect {A}.', 'A raclette birthday: collect {A} from every player.', 'Insurance pays out: collect {A}.', 'Hospital bill: pay {A}.', 'Boarding-school fees: pay {A}.', 'Banking-advice fee: collect {A}.', 'Chalet renovations: pay {A} per house and {B} per hotel.', 'A prize at the cow parade: collect {A}.', 'An inheritance from the mountains: collect {A}.']),
      say: WORDS(SAY, ['Grüezi! Welcome to Zurich: lakes, mountains and very serious money.', '{p} passes GO. Payday, right on time.', '{p} buys {S}.', '{p} pays {A} to {o}.', '{p} goes to jail.', '{S} goes to auction!', '{p} is bankrupt.', '{p} is the banker of Zurich!']),
    },
    tokyo: {
      name: 'Tokyo', mood: 'sci-fi', sym: '¥', style: 'yen', factor: 950000,
      colors: { bg: '#07021a', frame: '#00f0ff', cell: '#f4f1ff', title: '#ff4fd8' },
      streets: ['Kita-Senju', 'Nippori', 'Ueno', 'Asakusa', 'Akihabara', 'Ikebukuro', 'Nakano', 'Koenji', 'Shimokitazawa', 'Ebisu', 'Meguro', 'Shinjuku', 'Shibuya', 'Harajuku', 'Roppongi', 'Odaiba', 'Marunouchi', 'Omotesando', 'Aoyama', 'Daikanyama', 'Den-en-chōfu', 'Ginza'],
      stations: ['Yamanote Line', 'Chuo Line', 'Ginza Line', 'Marunouchi Line'], utilities: ['Power House', 'Water Board'],
      tokens: ['🤖', '🚄', '🛸', '🦾', '🐱', '🛰️', '🍜', '🎮'],
      f: WORDS(FK, ['Maglev to GO: collect your salary.', 'Hover car to {S}.', 'Teleport to {S}.', 'Grid overload! Go to the nearest utility; if it is owned, pay 10 × a fresh roll.', 'Bullet train: go to the nearest line; if it is owned, pay double rent.', 'Your robot startup pays a dividend: collect {A}.', 'Hack the security grid: get out of jail free. Keep this card.', 'Time glitch: go back 3 spaces.', 'Unlicensed drone flight: go to jail.', 'Firmware updates for every building: pay {A} per house and {B} per hotel.', 'Jaywalking under the holograms: pay {A}.', 'Board the {S}.', 'Sky-penthouse tour in {S}.', 'Ramen for the whole squad: pay each player {A}.', 'Your robot wins the arcade cup: collect {A}.']),
      t: WORDS(TK, ['A mecha escorts you to GO: collect your salary.', 'An AI bank error in your favour: collect {A}.', 'Cyber-clinic check-up: pay {A}.', 'Your tech shares soar: collect {A}.', 'Your android lawyer wins: get out of jail free. Keep this card.', 'Caught racing hover cars: go to jail.', 'Cherry-blossom bonus: collect {A}.', 'Tax refund: collect {A}.', 'A karaoke birthday: collect {A} from every player.', 'Insurance pays out: collect {A}.', 'Robot-surgery bill: pay {A}.', 'Coding-academy fees: pay {A}.', 'Game-design consulting: collect {A}.', 'Neon-sign repairs: pay {A} per house and {B} per hotel.', 'Best cosplay at the expo: collect {A}.', 'An inheritance in data-coins: collect {A}.']),
      say: WORDS(SAY, ['Welcome to Neo Tokyo, year 2099. Plug in and do business.', '{p} passes GO. Credits downloaded!', '{p} acquires {S}.', '{p} pays {A} to {o}.', '{p} is detained.', '{S} goes to auction!', '{p} is bankrupt.', '{p} controls Tokyo!']),
    },
    dublin: {
      name: 'Dublin', mood: 'an old kingdom', sym: '€', style: 'west', factor: 4250,
      colors: { bg: '#123524', frame: '#c5a253', cell: '#fbf7ea', title: '#1b4332' },
      streets: ['Phibsborough', 'Drumcondra', 'Stoneybatter', 'Smithfield', 'Rathmines', 'Portobello', 'Ranelagh', 'Clontarf', 'Temple Bar', 'Docklands', 'Sandymount', 'Grafton Street', 'St Stephen\'s Green', 'Merrion Square', 'Howth', 'Malahide', 'Dalkey', 'Ballsbridge', 'Donnybrook', 'Foxrock', 'Killiney Hill', 'Shrewsbury Road'],
      stations: ['Heuston', 'Connolly', 'Pearse', 'Tara Street'], utilities: ['Power House', 'Water Board'],
      tokens: ['👑', '🏰', '🛡️', '☘️', '⚔️', '🏮', '⛵', '🐉'],
      f: WORDS(FK, ['Ride to the castle gate at GO: collect your salary.', 'A royal procession to {S}.', 'Ride out to {S}.', 'The torches go out! Go to the nearest utility; if it is owned, pay 10 × a fresh roll.', 'Board the royal train: go to the nearest station; if it is owned, pay double rent.', 'The royal treasury pays you {A}.', 'Pardoned by the queen: get out of jail free. Keep this card.', 'Fog rolls in from the bay: go back 3 spaces.', 'Caught poaching in the royal forest: go to jail.', 'The castle walls need mending: pay {A} per house and {B} per hotel.', 'Toll at the bridge: pay {A}.', 'Take a train from {S}.', 'An audience with the king at {S}.', 'A feast for the court: pay each player {A}.', 'You find a crock of gold: collect {A}.']),
      t: WORDS(TK, ['Crowned at GO: collect your salary.', 'The royal scribe errs in your favour: collect {A}.', 'The royal physician: pay {A}.', 'Your trade guild prospers: collect {A}.', 'A friend at court: get out of jail free. Keep this card.', 'You insulted the bard: go to jail.', 'Midsummer festival: collect {A}.', 'A tax refund from the crown: collect {A}.', 'Your birthday banquet: collect {A} from every player.', 'Insurance pays out: collect {A}.', 'The healer\'s fee: pay {A}.', 'Squire-training fees: pay {A}.', 'You advise the king: collect {A}.', 'A storm damages the towers: pay {A} per house and {B} per hotel.', 'Second at the harp contest: collect {A}.', 'A distant lord leaves you {A}.']),
      say: WORDS(SAY, ['Welcome to the Kingdom of Dublin! Céad míle fáilte.', '{p} passes GO. The crown pays!', '{p} claims {S}.', '{p} pays {A} to {o}.', '{p} is thrown in the dungeon.', '{S} goes to auction!', '{p} is bankrupt.', '{p} is crowned ruler of Dublin!']),
    },
    santorini: {
      name: 'Santorini', mood: 'white villages, blue domes and the Aegean', sym: '€', style: 'west', factor: 4500,
      colors: { bg: '#0d4c8c', frame: '#e9d8a6', cell: '#fbf8ef', title: '#f4e4b0' },
      streets: ['Thessaly Farms', 'Peloponnese Hills', 'Megara', 'Argos', 'Thebes', 'Chalcis', 'Eretria', 'Corinth', 'Sparta', 'Olympia', 'Delphi', 'Crete', 'Rhodes', 'Paros', 'Naxos', 'Piraeus', 'Athens', 'Cape Sounion', 'Acropolis View', 'Mykonos', 'Fira', 'Oia'],
      stations: ['Aegean Sea Route', 'Ionian Sea Route', 'Cretan Sea Route', 'Cycladic Sea Route'], utilities: ['Power House', 'Water Board'],
      tokens: ['⛵', '🫏', '🏛️', '🐙', '🫒', '🍷', '🌅', '🐚'],
      f: WORDS(FK, ['A sunset cruise back to GO: collect your salary.', 'Sail to {S}.', 'A day trip to {S}.', 'A heatwave blackout! Go to the nearest utility; if it is owned, pay 10 × a fresh roll.', 'Catch the ferry: go to the nearest sea route; if it is owned, pay double rent.', 'Your taverna pays a dividend: collect {A}.', 'A friendly fisherman sails you out: get out of jail free. Keep this card.', 'Your donkey refuses the steps: go back 3 spaces.', 'Cliff diving where it is forbidden: go to jail.', 'Whitewash every house before summer: pay {A} per house and {B} per hotel.', 'Fined for blocking the caldera path: pay {A}.', 'Take the ferry on the {S}.', 'A wedding with a caldera view at {S}.', 'Ouzo for the whole terrace: pay each player {A}.', 'Your wine wins a medal: collect {A}.']),
      t: WORDS(TK, ['The first boat of summer at GO: collect your salary.', 'Bank error in your favour: collect {A}.', 'Sunburn clinic: pay {A}.', 'Your olive oil sells abroad: collect {A}.', 'A cousin in the harbour police: get out of jail free. Keep this card.', 'Caught selling fake antiquities: go to jail.', 'Tourist-season bonus: collect {A}.', 'Tax refund: collect {A}.', 'A name-day feast: collect {A} from every player.', 'Insurance pays out: collect {A}.', 'Hospital bill: pay {A}.', 'Sailing-school fees: pay {A}.', 'Tour-guide tips: collect {A}.', 'Winter storms on the cliffs: pay {A} per house and {B} per hotel.', 'Best photo of the Oia sunset: collect {A}.', 'A shipping-owner uncle leaves you {A}.']),
      say: WORDS(SAY, ['Kalimera! Welcome to Santorini, where every sunset is for sale.', '{p} passes GO. Opa, payday!', '{p} buys {S}.', '{p} pays {A} to {o}.', '{p} goes to jail.', '{S} goes to auction on the harbour!', '{p} is bankrupt.', '{p} owns the whole caldera!']),
    },
    cairo: {
      name: 'Cairo', mood: 'pyramids, camels and oases', sym: 'E£', style: 'west', factor: 18750,
      colors: { bg: '#e9c46a', frame: '#7f4f24', cell: '#fffaf0', title: '#5a3714' },
      streets: ['Old Cairo', 'Bulaq', 'Sayeda Zeinab', 'Khan el-Khalili', 'Al-Azhar', 'Downtown', 'Abdeen', 'Garden City', 'Heliopolis', 'Nasr City', 'Maadi', 'Tahrir Square', 'Dokki', 'The Corniche', 'Pyramids Road', 'Giza Plateau', 'Fayoum Oasis', 'Sheikh Zayed', 'New Cairo', 'October City', 'Gezira Island', 'Zamalek'],
      stations: ['Ramses Station', 'Sadat', 'Attaba', 'Giza Station'], utilities: ['Power House', 'Water Board'],
      tokens: ['🐫', '🔺', '🪲', '⛵', '🐈', '🏮', '🦁', '🌴'],
      f: WORDS(FK, ['A camel ride to GO: collect your salary.', 'Felucca to {S}.', 'Taxi to {S}.', 'A sandstorm cuts the power! Go to the nearest utility; if it is owned, pay 10 × a fresh roll.', 'Take the train: go to the nearest station; if it is owned, pay double rent.', 'Your spice shop pays a dividend: collect {A}.', 'The sphinx accepts your answer: get out of jail free. Keep this card.', 'Lost in the bazaar: go back 3 spaces.', 'Climbing a pyramid without permission: go to jail.', 'Sand in everything: pay {A} per house and {B} per hotel.', 'Camel parking fine: pay {A}.', 'Take a train from {S}.', 'A Nile-view tour at {S}.', 'Mint tea for everyone: pay each player {A}.', 'You find a lost treasure: collect {A}.']),
      t: WORDS(TK, ['The pharaoh\'s blessing at GO: collect your salary.', 'Bank error in your favour: collect {A}.', 'Pharmacy visit: pay {A}.', 'Your cotton sells abroad: collect {A}.', 'An ancient amulet: get out of jail free. Keep this card.', 'Caught selling fake papyrus: go to jail.', 'Holiday bonus: collect {A}.', 'Tax refund: collect {A}.', 'Your birthday on the Nile: collect {A} from every player.', 'Insurance pays out: collect {A}.', 'Hospital bill: pay {A}.', 'Archaeology-school fees: pay {A}.', 'Tour-guide fee: collect {A}.', 'Flood repairs along the Nile: pay {A} per house and {B} per hotel.', 'Best tent at the oasis festival: collect {A}.', 'A great-aunt leaves you {A}.']),
      say: WORDS(SAY, ['Ahlan wa sahlan! Welcome to Cairo, land of the pharaohs.', '{p} passes GO. Payday!', '{p} buys {S}.', '{p} pays {A} to {o}.', '{p} goes to jail.', '{S} goes to auction in the bazaar!', '{p} is bankrupt.', '{p} is the new pharaoh of Cairo!']),
    },
    tromso: {
      name: 'Tromsø', mood: 'the northern lights, fjords and snow', sym: 'NOK', style: 'west', factor: 26250,
      colors: { bg: '#0b1d3a', frame: '#7fd8c8', cell: '#f8fbff', title: '#c6f4ea' },
      streets: ['Ramfjord', 'Svanefjord', 'Skjervøy', 'Hillesøy', 'Grøtavær', 'Kvaløya', 'Erfjord', 'Tromsdalen', 'Reindeer Valley', 'Hamna', 'Ishavskysten', 'Senja', 'Sommarøy', 'Lyngen Alps', 'Storsteinen', 'Fjellheisen', 'Polaria', 'Arctic Cathedral', 'Tromsø Bridge', 'Telegrafbukta', 'Storgata', 'Strandkanten'],
      stations: ['Tromsø Airport', 'Hurtigruten Quay', 'Nordlys Route', 'Arctic Coast Route'], utilities: ['Power House', 'Water Board'],
      tokens: ['🦌', '🐋', '❄️', '🛷', '🎿', '🐺', '🌌', '🧣'],
      f: WORDS(FK, ['A dog sled races you to GO: collect your salary.', 'Snowmobile to {S}.', 'A northern-lights tour to {S}.', 'The polar night trips the power! Go to the nearest utility; if it is owned, pay 10 × a fresh roll.', 'Catch the boat: go to the nearest route; if it is owned, pay double rent.', 'Your fish farm pays a dividend: collect {A}.', 'A reindeer herder vouches for you: get out of jail free. Keep this card.', 'A blizzard on the bridge: go back 3 spaces.', 'Chasing the aurora through a closed road: go to jail.', 'Snow on every roof: pay {A} per house and {B} per hotel.', 'Studded-tyre fine: pay {A}.', 'Sail from {S}.', 'A whale-watching trip to {S}.', 'Hot drinks for the whole cabin: pay each player {A}.', 'You win the midnight-sun marathon: collect {A}.']),
      t: WORDS(TK, ['The sun returns at GO: collect your salary.', 'Bank error in your favour: collect {A}.', 'Frostbite clinic: pay {A}.', 'Your salmon shares rise: collect {A}.', 'A friend on the coastguard: get out of jail free. Keep this card.', 'Fishing without a licence: go to jail.', 'Midnight-sun festival bonus: collect {A}.', 'Tax refund: collect {A}.', 'A birthday in the sauna: collect {A} from every player.', 'Insurance pays out: collect {A}.', 'Hospital bill: pay {A}.', 'Ski-school fees: pay {A}.', 'Aurora-guide tips: collect {A}.', 'Ice damage after the winter: pay {A} per house and {B} per hotel.', 'Best ice sculpture at the festival: collect {A}.', 'A whaling-captain great-uncle leaves you {A}.']),
      say: WORDS(SAY, ['Velkommen to Tromsø, under the northern lights.', '{p} passes GO. Payday in the Arctic!', '{p} buys {S}.', '{p} pays {A} to {o}.', '{p} goes to jail.', '{S} goes to auction!', '{p} is bankrupt.', '{p} rules the Arctic!']),
    },
    hongkong: {
      name: 'Hong Kong', mood: 'neon, skyscrapers and the harbour', sym: 'HK$', style: 'west', factor: 225000,
      colors: { bg: '#120a2a', frame: '#e63946', cell: '#fffaf2', title: '#ffd166' },
      streets: ['Tung Chung', 'Lohas Park', 'Tai Po', 'Tsuen Wan', 'Sha Tin', 'Kwun Tong', 'Kowloon Bay', 'North Point', 'Mong Kok', 'Sheung Wan', 'Wan Chai', 'Causeway Bay', 'Tsim Sha Tsui', 'West Kowloon', 'South Horizons', 'Happy Valley', 'Admiralty', 'Central', 'Stanley', 'Victoria Harbour', 'Repulse Bay', 'The Peak'],
      stations: ['Hung Hom', 'Kai Tak', 'Airport Express', 'Star Ferry'], utilities: ['Power House', 'Water Board'],
      tokens: ['🐉', '🏮', '🥟', '⛴️', '🚋', '🧧', '🌃', '🐼'],
      f: WORDS(FK, ['The Star Ferry carries you to GO: collect your salary.', 'Take the tram to {S}.', 'Dim sum in {S}.', 'A typhoon cuts the power! Go to the nearest utility; if it is owned, pay 10 × a fresh roll.', 'Rush hour: go to the nearest station; if it is owned, pay double rent.', 'Your shares jump on the exchange: collect {A}.', 'A good lawyer in Central: get out of jail free. Keep this card.', 'Lost in a night market: go back 3 spaces.', 'Jaywalking on Nathan Road: go to jail.', 'Typhoon shutters for every flat: pay {A} per house and {B} per hotel.', 'Parking fine in Mong Kok: pay {A}.', 'Take a train from {S}.', 'A rooftop party at {S}.', 'Milk tea for everyone: pay each player {A}.', 'You win at the races in Happy Valley: collect {A}.']),
      t: WORDS(TK, ['Lunar New Year at GO: collect your salary.', 'Bank error in your favour: collect {A}.', 'Doctor\'s bill: pay {A}.', 'Your property shares rise: collect {A}.', 'A friend in the police: get out of jail free. Keep this card.', 'Selling fake watches: go to jail.', 'Lai see from the boss: collect {A}.', 'Tax refund: collect {A}.', 'A birthday banquet: collect {A} from every player.', 'Insurance pays out: collect {A}.', 'Hospital bill: pay {A}.', 'Tutoring-centre fees: pay {A}.', 'Feng-shui consulting fee: collect {A}.', 'Typhoon repairs: pay {A} per house and {B} per hotel.', 'Second place in the dragon-boat race: collect {A}.', 'A great-aunt in Macau leaves you {A}.']),
      say: WORDS(SAY, ['Welcome to Hong Kong, where the skyline never sleeps.', '{p} passes GO. Payday!', '{p} buys {S}.', '{p} pays {A} to {o}.', '{p} goes to jail.', '{S} goes to auction!', '{p} is bankrupt.', '{p} owns Hong Kong!']),
    },
    prague: {
      name: 'Prague', mood: 'castles, bridges and autumn colours', sym: 'Kč', style: 'west', factor: 100000,
      colors: { bg: '#3b1d10', frame: '#c9a227', cell: '#fffaf0', title: '#f2c14e' },
      streets: ['Nusle', 'Žižkov', 'Holešovice', 'Břevnov', 'Smíchov', 'Anděl', 'Karlín', 'Letná', 'Strahov', 'Pohořelec', 'Vyšehrad', 'Vinohrady', 'Petřín', 'Loreta', 'Nové Město', 'Václavské náměstí', 'Dvořákovo nábřeží', 'Klementinum', 'Staré Město', 'Hradčany', 'Malá Strana', 'Pařížská'],
      stations: ['Hlavní nádraží', 'Masarykovo nádraží', 'Náměstí Republiky', 'Florenc'], utilities: ['Power House', 'Water Board'],
      tokens: ['🍺', '🏰', '🎻', '🥨', '🚋', '🕰️', '🌉', '👑'],
      f: WORDS(FK, ['The astronomical clock strikes GO: collect your salary.', 'Take the tram to {S}.', 'A stroll over the bridge to {S}.', 'A storm over the river cuts the power! Go to the nearest utility; if it is owned, pay 10 × a fresh roll.', 'Catch the train: go to the nearest station; if it is owned, pay double rent.', 'Your brewery pays a dividend: collect {A}.', 'The castle guard looks away: get out of jail free. Keep this card.', 'Lost in the Old Town lanes: go back 3 spaces.', 'Climbing a statue on the bridge: go to jail.', 'New tiles for every roof: pay {A} per house and {B} per hotel.', 'Tram ticket inspector: pay {A}.', 'Take a train from {S}.', 'A concert at {S}.', 'A round of beer for everyone: pay each player {A}.', 'You win the marionette contest: collect {A}.']),
      t: WORDS(TK, ['The castle bells ring at GO: collect your salary.', 'Bank error in your favour: collect {A}.', 'Doctor\'s bill: pay {A}.', 'Your glassworks shares rise: collect {A}.', 'A friend at the town hall: get out of jail free. Keep this card.', 'Caught skipping a pub bill: go to jail.', 'Christmas-market bonus: collect {A}.', 'Tax refund: collect {A}.', 'A name-day party: collect {A} from every player.', 'Insurance pays out: collect {A}.', 'Hospital bill: pay {A}.', 'Music-school fees: pay {A}.', 'Tour-guide tips: collect {A}.', 'The river floods the cellars: pay {A} per house and {B} per hotel.', 'Second place at the dumpling contest: collect {A}.', 'A great-uncle in Brno leaves you {A}.']),
      say: WORDS(SAY, ['Vítejte! Welcome to Prague, the city of a hundred spires.', '{p} passes GO. Payday!', '{p} buys {S}.', '{p} pays {A} to {o}.', '{p} goes to jail.', '{S} goes to auction!', '{p} is bankrupt.', '{p} is crowned king of Prague!']),
    },
  };
  const BOARD_KEYS = Object.keys(BOARDS);

  /* ---------- Names and money ---------- */
  const bd = st => BOARDS[st.board] || BOARDS.newyork;
  function spaceName(b, i) {
    const s = SPACES[i];
    if (s.type === 'street') return b.streets[STREETS.indexOf(i)];
    if (s.type === 'station') return b.stations[STATIONS.indexOf(i)];
    if (s.type === 'utility') return b.utilities[UTILITIES.indexOf(i)];
    return { go: 'GO', treasury: 'Treasury', fortune: 'Fortune', tax: s.name, jail: 'Jail', parking: 'Free Parking', gotojail: 'Go to Jail' }[s.type];
  }
  // An amount in standard units, shown in the board's money: $650k · CHF 4.5M · Kč 40M · ¥380M · ₹16 Cr · ₹25 L
  function money(b, std) {
    const v = Math.round(std * b.factor), a = Math.abs(v);
    const sig = x => String(+(x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toFixed(2)));
    let n;
    if (b.style === 'india') n = a >= 1e7 ? `${sig(a / 1e7)} Cr` : a >= 1e5 ? `${sig(a / 1e5)} L` : a.toLocaleString('en-IN');
    else n = a >= 1e9 ? `${sig(a / 1e9)}B` : a >= 1e6 ? `${sig(a / 1e6)}M` : a >= 1e3 ? `${sig(a / 1e3)}k` : String(a);
    return `${v < 0 ? '−' : ''}${b.sym}${/\p{L}$/u.test(b.sym) ? ' ' : ''}${n}`;
  }
  const fill = (t, o) => String(t).replace(/\{(\w)\}/g, (m, k) => (o[k] != null ? o[k] : m));

  /* ---------- Rules helpers ---------- */
  const HOTEL = 5;                                               // a street's level: 0 · 1–4 houses (1–3 in the short game) · 5 a hotel
  const out = (st, p) => !!(st && st.out && st.out[p]);
  const live = ctx => ctx.players.map((_, p) => p).filter(p => !out(ctx.state, p));
  const owner = (st, i) => (st.own[i] ? st.own[i].p : null);
  const maxHouses = st => (st.short ? 3 : 4);
  const props = (st, p) => OWNABLE.filter(i => owner(st, i) === p);
  const fullSet = (st, i, p = owner(st, i)) => p != null && GROUPS[SPACES[i].group].every(j => owner(st, j) === p);
  function rent(st, i, roll) {
    const s = SPACES[i], o = st.own[i];
    if (!o || o.mort) return 0;
    if (s.type === 'street') return o.h ? s.rents[o.h === HOTEL ? 5 : o.h] : s.rents[0] * (fullSet(st, i) ? 2 : 1);
    const mine = list => list.filter(j => owner(st, j) === o.p).length;
    if (s.type === 'station') return 25 * 2 ** (mine(STATIONS) - 1);
    return roll * (mine(UTILITIES) === 2 ? 10 : 4);
  }
  const level = (st, j) => st.own[j].h;
  // Build only with the whole colour set, nothing in it mortgaged, evenly (never more than one ahead), while the bank has buildings
  function canBuild(st, p, i) {
    const s = SPACES[i], o = st.own[i];
    if (!s || s.type !== 'street' || !o || o.p !== p || o.mort || o.h === HOTEL) return false;
    const g = GROUPS[s.group];
    if (!fullSet(st, i, p) || g.some(j => st.own[j].mort)) return false;
    if (o.h > Math.min(...g.map(j => level(st, j))) || st.cash[p] < s.house) return false;
    return o.h < maxHouses(st) ? st.houses > 0 : st.hotels > 0;
  }
  // Sell evenly too: from the street with the most
  const canSell = (st, p, i) => SPACES[i].type === 'street' && !!st.own[i] && st.own[i].p === p && st.own[i].h > 0
    && st.own[i].h >= Math.max(...GROUPS[SPACES[i].group].map(j => level(st, j)));
  const groupBuilt = (st, i) => SPACES[i].type === 'street' && GROUPS[SPACES[i].group].some(j => st.own[j] && st.own[j].h);
  const canMortgage = (st, p, i) => !!st.own[i] && st.own[i].p === p && !st.own[i].mort && !groupBuilt(st, i);
  const unmortgageCost = i => Math.ceil(SPACES[i].price / 2 * 11 / 10);   // whole-number maths (× 1.1 isn't exact)
  const interest = i => Math.ceil(SPACES[i].price / 20);
  const canUnmortgage = (st, p, i) => !!st.own[i] && st.own[i].p === p && st.own[i].mort && st.cash[p] >= unmortgageCost(i);
  const buildingValue = (st, i) => { const o = st.own[i]; return o && o.h ? SPACES[i].house * (o.h === HOTEL ? maxHouses(st) + 1 : o.h) : 0; };
  // Net worth (the short game's winner, and the leaderboard's points): cash, properties at their price (half if mortgaged), buildings at cost
  const netWorth = (st, p) => st.cash[p] + props(st, p).reduce((a, i) => a + (st.own[i].mort ? SPACES[i].price / 2 : SPACES[i].price) + buildingValue(st, i), 0);
  // Trading a property needs its colour set free of buildings (sell them first)
  const tradable = (st, p, i) => owner(st, i) === p && !groupBuilt(st, i);

  /* ---------- Money moving (and the record of it, for the glows) ---------- */
  function flow(st, from, to, n) {
    if (!n) return;
    st.flowId = (st.flowId || 0) + 1;
    st.flows.push({ id: st.flowId, from, to, n });
    if (st.flows.length > 24) st.flows.shift();
  }
  // from / to: a player, 'bank' or 'pot' (Free Parking)
  function transfer(ctx, from, to, n) {
    const st = ctx.state;
    if (!n) return;
    if (typeof from === 'number') st.cash[from] -= n; else if (from === 'pot') st.pot -= n;
    if (typeof to === 'number') st.cash[to] += n; else if (to === 'pot') st.pot += n;
    flow(st, from, to, n);
  }
  // p pays now if the cash is there; otherwise it becomes a debt to settle (raise money, or go bankrupt).
  // to: a player, 'bank', or 'fine' (taxes and fines: the bank, or the Free Parking pot with the jackpot rule)
  function charge(ctx, p, to, n, why) {
    const st = ctx.state;
    if (to === 'fine') to = st.jackpot ? 'pot' : 'bank';
    if (n <= 0) return true;
    if (st.cash[p] >= n) { transfer(ctx, p, to, n); return true; }
    st.debts.push({ p, to, n, why });
    return false;
  }

  /* ---------- Turn timer (option), as in Catan: one clock at a time; a stale clock does nothing ---------- */
  function arm(ctx, secs, label, onTimeout) {
    const st = ctx.state, gen = st.clockGen = (st.clockGen || 0) + 1;
    st.clockOn = true;
    ctx.countdown(secs, label).then(skipped => { if (!skipped && ctx.alive && st.clockGen === gen) { st.clockOn = false; onTimeout(); ctx.update(); } }, () => {});
  }
  function stopClock(ctx) { const st = ctx.state; if (st.clockOn) { st.clockOn = false; st.clockGen++; ctx.skip(); } }
  function armTurn(ctx, secs) {
    const st = ctx.state;
    if (!st.turnTime) return;
    const left = secs ?? st.turnTime;
    st.turnEnds = Date.now() + left * 1000;
    arm(ctx, left, 'Turn', () => {
      ctx.log(`⏱️ Time's up for ${ctx.players[st.turn].name}.`);
      ctx.say(`Time's up, ${ctx.players[st.turn].name}!`);
      autoFinish(ctx);
    });
  }
  const pauseTurn = st => { if (st.turnTime && st.turnEnds) st.turnLeft = Math.max(5, Math.ceil((st.turnEnds - Date.now()) / 1000)); };
  const resumeTurn = ctx => { if (ctx.state.turnTime) armTurn(ctx, ctx.state.turnLeft || ctx.state.turnTime); else stopClock(ctx); };
  // Time ran out: finish the turn with the moves a careful player would make, then pass it on
  function autoFinish(ctx) {
    const st = ctx.state, p = st.turn, key = st.turnNo;
    for (let guard = 0; guard < 40 && ctx.alive && st.turnNo === key; guard++) {
      if (st.step === 'jail') api.act(ctx, p, { act: 'jailroll' });
      else if (st.step === 'roll') api.act(ctx, p, { act: 'roll' });
      else if (st.step === 'bus') api.act(ctx, p, { act: 'bus', use: 'sum' });
      else if (st.step === 'triples') api.act(ctx, p, { act: 'goto', to: OWNABLE.find(i => !st.own[i]) ?? 0 });
      else if (st.step === 'buy') api.act(ctx, p, { act: 'decline' });
      else if (st.step === 'main') { st.trades = []; ctx.log(`⏱️ ${ctx.players[p].name}'s turn ended.`); endTurn(ctx); }
      else return;                                              // an auction or a debt has its own clock
    }
  }

  /* ---------- Turn order: everyone rolls (as in Catan) ---------- */
  function startOrder(ctx) {
    const st = ctx.state;
    st.step = 'order';
    st.order = { queue: ctx.shuffle(ctx.players.map((_, i) => i)), at: 0, rolls: [] };
    ctx.log('🎲 Everyone rolls for turn order: the highest roll starts.');
    callRoller(ctx);
  }
  function callRoller(ctx) {
    const st = ctx.state, p = st.order.queue[st.order.at];
    st.turn = p;
    ctx.say(`${ctx.players[p].name}, roll for turn order.`);
    if (st.turnTime) arm(ctx, 15, 'Roll for order', () => api.act(ctx, p, { act: 'orderRoll' }));
  }
  const firstPlayer = rolls => rolls.reduce((best, r) => (r.t > best.t ? r : best)).p;
  const seatOrder = (st, n) => [...Array(n)].map((_, k) => (st.first == null ? k : (st.first + k) % n));
  function finishOrder(ctx) {
    const st = ctx.state, o = st.order;
    st.first = firstPlayer(o.rolls);
    const top = o.rolls.filter(r => r.t === o.rolls.find(x => x.p === st.first).t);
    if (top.length > 1) ctx.log(`${top.map(r => ctx.players[r.p].name).join(' and ')} tied on ${top[0].t}; ${ctx.players[st.first].name} rolled it first.`);
    const names = seatOrder(st, ctx.players.length).filter(q => !out(st, q)).map(q => ctx.players[q].name);
    ctx.log(`🧭 Turn order: ${names.join(' → ')}.`);
    ctx.say(`${names[0]} goes first.`, 'point');
    st.turn = st.first;
    startTurn(ctx);
  }

  /* ---------- A turn ---------- */
  const nextLive = (ctx, from) => { const n = ctx.players.length; let q = from; for (let k = 0; k < n; k++) { q = (q + 1) % n; if (!out(ctx.state, q)) return q; } return from; };
  function startTurn(ctx) {
    const st = ctx.state, p = st.turn;
    st.step = st.jail[p] >= 0 ? 'jail' : 'roll';
    st.dice = null; st.speed = null; st.again = false; st.pendingFF = false; st.doublesRun = 0; st.trades = []; st.card = null; st.utilRoll = null;
    st.turnNo++;
    ctx.say(st.step === 'jail' ? `${ctx.players[p].name}, you're in jail: pay, use a card, or roll for doubles.` : `${ctx.players[p].name}, your turn. Roll the dice!`);
    armTurn(ctx);
  }
  function endTurn(ctx) {
    const st = ctx.state;
    if (!ctx.alive) return;
    st.turn = nextLive(ctx, st.turn);
    startTurn(ctx);
  }
  function passGo(ctx, p) {
    const st = ctx.state;
    transfer(ctx, 'bank', p, SALARY);
    st.passedGo[p] = true;
    ctx.log(`💰 ${ctx.players[p].name} passes GO: +${money(bd(st), SALARY)}.`);
    ctx.say(fill(bd(st).say.go, { p: ctx.players[p].name }));
  }
  function moveBy(ctx, p, n) {
    const st = ctx.state, from = st.pos[p];
    st.moved = n;
    if (from + n >= 40) passGo(ctx, p);
    st.pos[p] = (from + n) % 40;
    land(ctx, p);
  }
  function moveTo(ctx, p, to, opt) {
    const st = ctx.state, from = st.pos[p];
    if (to < from) passGo(ctx, p);
    st.pos[p] = to;
    land(ctx, p, opt);
  }
  function goJail(ctx, p, why) {
    const st = ctx.state;
    st.pos[p] = JAIL; st.jail[p] = 0; st.doublesRun = 0;
    if (p === st.turn) { st.again = false; st.pendingFF = false; }
    ctx.log(`🚔 ${ctx.players[p].name} goes to jail${why ? ` (${why})` : ''}.`);
    ctx.say(fill(bd(st).say.jail, { p: ctx.players[p].name }), 'shake');
    if (p === st.turn) st.step = 'main';
  }
  function doRoll(ctx, p) {
    const st = ctx.state, d = [1 + ctx.rand(6), 1 + ctx.rand(6)];
    const sp = st.speedDie && st.passedGo[p] ? SPEED[ctx.rand(6)] : null;
    st.dice = d; st.speed = sp; st.lastRoll = { p, d, sp }; st.utilRoll = null;
    st.again = d[0] === d[1]; st.pendingFF = sp === 'ff';
    const spTxt = sp == null ? '' : typeof sp === 'number' ? ` + ${sp}` : sp === 'bus' ? ' + 🚌' : ' + ⏩';
    ctx.log(`🎲 ${ctx.players[p].name} rolled ${d[0]} + ${d[1]}${spTxt}${st.again ? ' (doubles)' : ''}.`);
    ctx.say(`${ctx.players[p].name} rolls ${d[0]} and ${d[1]}.`);
    if (st.again && ++st.doublesRun === 3) return goJail(ctx, p, 'three doubles in a row');
    if (typeof sp === 'number' && d[0] === d[1] && d[1] === sp) { st.step = 'triples'; st.again = false; ctx.say('Triples! Move to any space.'); return; }
    if (sp === 'bus') { st.step = 'bus'; return; }
    moveBy(ctx, p, d[0] + d[1] + (typeof sp === 'number' ? sp : 0));
  }
  // The speed die's fast-forward: on to the next property nobody owns; if all are owned, to the next one where you pay rent
  function fastForward(ctx, p) {
    const st = ctx.state, here = st.pos[p], ahead = k => OWNABLE.map(i => ({ i, d: (i - here + 40) % 40 })).filter(x => x.d > 0 && k(x.i)).sort((a, b) => a.d - b.d)[0];
    const target = ahead(i => !st.own[i]) || ahead(i => st.own[i].p !== p && !st.own[i].mort);
    ctx.log(`⏩ Fast forward${target ? ` to ${spaceName(bd(st), target.i)}` : ': nowhere to go'}.`);
    if (!target) return afterLanding(ctx);
    moveTo(ctx, p, target.i);
  }
  // Where the token lands
  function land(ctx, p, opt = {}) {
    const st = ctx.state, i = st.pos[p], s = SPACES[i], b = bd(st), name = ctx.players[p].name;
    switch (s.type) {
      case 'go': if (st.doubleGo) { transfer(ctx, 'bank', p, SALARY); ctx.log(`💰 ${name} lands on GO: double salary!`); } break;
      case 'tax': ctx.log(`🧾 ${name} pays ${s.name}: ${money(b, s.amount)}.`); charge(ctx, p, 'fine', s.amount, s.name); return settle(ctx, { k: 'land' });
      case 'fortune': case 'treasury': return drawCard(ctx, p, s.type);
      case 'gotojail': goJail(ctx, p); return afterLanding(ctx);
      case 'parking': if (st.jackpot && st.pot) { ctx.log(`🅿️ ${name} takes the Free Parking jackpot: ${money(b, st.pot)}!`); ctx.say(`Jackpot! ${name} takes ${money(b, st.pot)}.`, 'pay'); transfer(ctx, 'pot', p, st.pot); } break;
      case 'street': case 'station': case 'utility': {
        const o = st.own[i];
        if (!o) { st.step = 'buy'; ctx.say(`${name}, buy ${spaceName(b, i)} for ${money(b, s.price)}?`); return; }
        if (o.p === p || o.mort) break;
        let n;
        if (opt.mult === 'util10') { const d = [1 + ctx.rand(6), 1 + ctx.rand(6)]; st.utilRoll = d; n = 10 * (d[0] + d[1]); }
        else n = rent(st, i, st.moved || 7) * (opt.mult || 1);
        const line = fill(b.say.rent, { p: name, A: money(b, n), o: ctx.players[o.p].name });
        ctx.log(`🏠 ${line}`); ctx.say(line, 'pay');
        charge(ctx, p, o.p, n, `rent for ${spaceName(b, i)}`);
        return settle(ctx, { k: 'land' });
      }
    }
    afterLanding(ctx);
  }
  // After the landing is dealt with: a fast-forward to do, doubles to roll again, or the rest of the turn
  function afterLanding(ctx) {
    const st = ctx.state, p = st.turn;
    if (!ctx.alive) return;
    if (out(st, p)) return endTurn(ctx);
    if (st.step === 'buy' || st.step === 'auction' || st.step === 'debt') return;
    if (st.pendingFF && st.jail[p] < 0) { st.pendingFF = false; return fastForward(ctx, p); }
    if (st.again && st.jail[p] < 0) { st.step = 'roll'; st.again = false; ctx.say(`Doubles! ${ctx.players[p].name}, roll again.`); return; }
    st.step = 'main';
  }
  const settle = (ctx, after) => (ctx.state.debts.length ? startDebts(ctx, after) : resumeAfter(ctx, after));
  function resumeAfter(ctx, after) {
    const st = ctx.state;
    if (!ctx.alive) return;
    if (st.auctionQueue.length && !st.auction) return startAuction(ctx, st.auctionQueue.shift(), after);
    if (after.k === 'jailmove') return moveBy(ctx, st.turn, after.n);
    if (st.step === 'debt' || st.step === 'auction') st.step = after.step || 'main';
    if (after.k === 'land') return afterLanding(ctx);
    if (out(st, st.turn)) endTurn(ctx);
  }

  /* ---------- Cards ---------- */
  function drawCard(ctx, p, deck) {
    const st = ctx.state, b = bd(st), num = st.decks[deck].shift(), c = DECK[deck][num], name = ctx.players[p].name;
    const text = fill((deck === 'fortune' ? b.f : b.t)[c.k], { S: c.to != null ? spaceName(b, c.to) : '', A: money(b, c.a || 0), B: money(b, c.b || 0) });
    st.card = { deck, k: c.k, text, p, id: st.cardNo = (st.cardNo || 0) + 1 };
    if (c.do === 'jailfree') st.jailFree[p].push({ deck, num }); else st.decks[deck].push(num);   // a kept card leaves the deck until used
    ctx.log(`🃏 ${name} (${deck === 'fortune' ? 'Fortune' : 'Treasury'}): ${text}`);
    ctx.say(text);
    const others = live(ctx).filter(q => q !== p);
    switch (c.do) {
      case 'move': return moveTo(ctx, p, c.to);
      case 'nearest': {
        const list = c.kind === 'station' ? STATIONS : UTILITIES, here = st.pos[p];
        const to = list.map(j => ({ j, d: (j - here + 40) % 40 })).sort((x, y) => x.d - y.d)[0].j;
        return moveTo(ctx, p, to, { mult: c.kind === 'station' ? 2 : 'util10' });
      }
      case 'collect': transfer(ctx, 'bank', p, c.a); return afterLanding(ctx);
      case 'pay': charge(ctx, p, 'fine', c.a, 'a card'); return settle(ctx, { k: 'land' });
      case 'jailfree': return afterLanding(ctx);
      case 'back': st.pos[p] = (st.pos[p] + 40 - c.n) % 40; return land(ctx, p);
      case 'jail': goJail(ctx, p); return afterLanding(ctx);
      case 'repairs': {
        let n = 0;
        props(st, p).forEach(i => { const h = st.own[i].h; n += h === HOTEL ? c.b : h * c.a; });
        if (n) charge(ctx, p, 'fine', n, 'repairs');
        return settle(ctx, { k: 'land' });
      }
      case 'payeach': {
        const total = c.a * others.length;
        if (st.cash[p] >= total) others.forEach(q => transfer(ctx, p, q, c.a));
        else st.debts.push({ p, to: 'each', each: c.a, list: others, n: total, why: 'a card' });
        return settle(ctx, { k: 'land' });
      }
      case 'collecteach': others.forEach(q => charge(ctx, q, p, c.a, 'a card')); return settle(ctx, { k: 'land' });
    }
    return afterLanding(ctx);
  }

  /* ---------- Auctions: everyone bids; it closes 10 s after the last bid (or when all the others pass) ---------- */
  const BIDS = [10, 50, 100];
  function startAuction(ctx, i, after) {
    const st = ctx.state, b = bd(st);
    pauseTurn(st);
    st.auction = { i, bid: 0, by: null, passed: [], after, back: st.step === 'auction' ? 'main' : st.step };
    st.step = 'auction';
    st.fx = { id: (st.fx ? st.fx.id : 0) + 1, kind: 'auction', title: 'AUCTION', sub: spaceName(b, i), color: SPACES[i].group ? GROUP[SPACES[i].group] : '#c9a227' };
    const line = fill(b.say.auction, { S: spaceName(b, i) });
    ctx.log(`🔨 ${line}`); ctx.say(line, 'point');
    arm(ctx, 15, 'Auction', () => closeAuction(ctx));
  }
  function closeAuction(ctx) {
    const st = ctx.state, a = st.auction, b = bd(st);
    if (!a) return;
    stopClock(ctx);
    if (a.by != null && st.cash[a.by] >= a.bid && !out(st, a.by)) {
      transfer(ctx, a.by, 'bank', a.bid);
      st.own[a.i] = { p: a.by, h: 0, mort: false };
      ctx.log(`🔨 ${ctx.players[a.by].name} wins ${spaceName(b, a.i)} for ${money(b, a.bid)}.`);
      st.fx = { id: (st.fx ? st.fx.id : 0) + 1, kind: 'sold', title: 'SOLD!', sub: `${spaceName(b, a.i)} to ${ctx.players[a.by].name} for ${money(b, a.bid)}`, color: SPACES[a.i].group ? GROUP[SPACES[a.i].group] : '#c9a227' };
      ctx.say(`Sold to ${ctx.players[a.by].name} for ${money(b, a.bid)}!`, 'pay');
    } else ctx.log(`🔨 Nobody bought ${spaceName(b, a.i)}: it stays with the bank.`);
    st.auction = null; st.step = a.back === 'buy' ? 'main' : a.back;
    if (st.auctionQueue.length) return startAuction(ctx, st.auctionQueue.shift(), a.after);
    resumeTurn(ctx);
    resumeAfter(ctx, a.after);
  }

  /* ---------- Debts: raise the money (sell, mortgage, trade) and pay, or go bankrupt ---------- */
  function startDebts(ctx, after) {
    const st = ctx.state;
    st.after = after;
    if (st.step !== 'debt') { st.debtBack = st.step === 'buy' ? 'main' : st.step; pauseTurn(st); }
    st.step = 'debt';
    nextDebt(ctx);
  }
  function nextDebt(ctx) {
    const st = ctx.state, b = bd(st);
    while (st.debts.length && out(st, st.debts[0].p)) st.debts.shift();
    if (!st.debts.length) { st.step = st.debtBack || 'main'; resumeTurn(ctx); return resumeAfter(ctx, st.after || { k: 'land' }); }
    const d = st.debts[0];
    ctx.say(`${ctx.players[d.p].name}, you owe ${money(b, d.n)}. Sell, mortgage or trade to raise it, or declare bankruptcy.`, 'shake');
    if (st.turnTime) arm(ctx, 60, 'Raise money', () => autoSettle(ctx));
  }
  // The debt clock ran out: sell buildings and mortgage until the debt is covered; bankrupt if it can't be
  function autoSettle(ctx) {
    const st = ctx.state, d = st.debts[0];
    if (!d) return;
    for (let guard = 0; guard < 80 && st.cash[d.p] < d.n; guard++) {
      const sell = props(st, d.p).filter(i => canSell(st, d.p, i)).sort((x, y) => SPACES[y].house - SPACES[x].house)[0];
      if (sell != null) { api.act(ctx, d.p, { act: 'sell', at: sell }); continue; }
      const mort = props(st, d.p).filter(i => canMortgage(st, d.p, i)).sort((x, y) => SPACES[x].price - SPACES[y].price)[0];
      if (mort != null) { api.act(ctx, d.p, { act: 'mortgage', at: mort }); continue; }
      break;
    }
    api.act(ctx, d.p, { act: st.cash[d.p] >= d.n ? 'paydebt' : 'bankrupt' });
  }
  function payDebt(ctx, d) {
    if (d.to === 'each') d.list.filter(q => !out(ctx.state, q)).forEach(q => transfer(ctx, d.p, q, d.each));
    else transfer(ctx, d.p, out(ctx.state, d.to) ? 'bank' : d.to, d.n);
  }

  /* ---------- Bankruptcy ---------- */
  function bankrupt(ctx, p, to) {
    const st = ctx.state, b = bd(st), name = ctx.players[p].name;
    // the buildings go back to the bank first, at half price
    props(st, p).forEach(i => {
      const o = st.own[i];
      if (!o.h) return;
      st.cash[p] += buildingValue(st, i) / 2;
      if (o.h === HOTEL) st.hotels++; else st.houses += o.h;
      o.h = 0;
    });
    const creditor = typeof to === 'number' && !out(st, to) ? to : null, cash = Math.max(0, st.cash[p]);
    if (creditor != null) {                                       // to a player: they get everything (paying the 10% on mortgaged properties they can)
      if (cash) transfer(ctx, p, creditor, cash);
      props(st, p).forEach(i => { st.own[i].p = creditor; if (st.own[i].mort && st.cash[creditor] >= interest(i)) transfer(ctx, creditor, 'bank', interest(i)); });
      st.jailFree[creditor].push(...st.jailFree[p]);
      ctx.log(`💥 ${name} is bankrupt: everything goes to ${ctx.players[creditor].name}.`);
    } else {                                                      // to the bank: properties back to the bank (auctioned, with auctions on)
      if (cash) transfer(ctx, p, 'bank', cash);
      const freed = props(st, p);
      freed.forEach(i => delete st.own[i]);
      st.jailFree[p].forEach(c => st.decks[c.deck].push(c.num));
      if (st.auctions) st.auctionQueue.push(...freed);
      ctx.log(`💥 ${name} is bankrupt: their properties go back to the bank${st.auctions && freed.length ? ' and up for auction' : ''}.`);
    }
    st.cash[p] = 0; st.jailFree[p] = []; st.out[p] = true; st.jail[p] = -1;
    st.trades = st.trades.filter(t => t.from !== p && t.to !== p);
    st.debts = st.debts.filter(x => x.p !== p).map(x => (x.to === p ? { ...x, to: 'bank' } : x));
    ctx.say(fill(b.say.bankrupt, { p: name }), 'shake');
    if (st.short) return finishRichest(ctx);                      // the short game ends at the first bankruptcy
    const left = live(ctx);
    if (left.length < 2) return finish(ctx, left[0]);
  }

  /* ---------- The end ---------- */
  const results = (ctx, winner) => ctx.players.map((pl, i) => ({ name: pl.name, won: i === winner, points: out(ctx.state, i) ? 0 : netWorth(ctx.state, i),
    ...(ctx.state.left && ctx.state.left[i] ? { left: true } : out(ctx.state, i) ? { note: 'bankrupt' } : {}) }));
  function finish(ctx, winner) {
    const st = ctx.state, b = bd(st);
    stopClock(ctx);
    const line = fill(b.say.win, { p: ctx.players[winner].name });
    ctx.log(`🏆 ${line}`); ctx.say(line, 'wave');
    const rows = live(ctx).sort((x, y) => netWorth(st, y) - netWorth(st, x)).map(q => `${PartyKit.esc(ctx.players[q].name)} ${money(b, netWorth(st, q))}`).join(' · ');
    ctx.end(results(ctx, winner), `<div class="note" style="text-align:center">Net worth: ${rows}</div>`);
  }
  // The richest player still in (net worth; then cash; then seat order)
  function finishRichest(ctx) {
    const st = ctx.state, left = live(ctx);
    const best = left.sort((x, y) => netWorth(st, y) - netWorth(st, x) || st.cash[y] - st.cash[x] || x - y)[0];
    ctx.log('⏹️ The short game ends at the first bankruptcy: the richest player wins.');
    finish(ctx, best);
  }

  /* ---------- Trading (only with the player whose turn it is, as in Catan) ---------- */
  const TRADE_STEPS = ['roll', 'main', 'jail'];
  const parseIds = s => [...new Set(String(s || '').split(',').filter(x => x !== '').map(Number))].filter(i => OWNABLE.includes(i));
  function tradeProblem(ctx, t) {
    const st = ctx.state, b = bd(st), side = (p, x, who) => {
      if (st.cash[p] < x.cash) return `${who} doesn't have ${money(b, x.cash)}.`;
      if (st.jailFree[p].length < x.jf) return `${who} doesn't have that Get Out of Jail Free card.`;
      const bad = x.props.find(i => !tradable(st, p, i));
      if (bad != null) return owner(st, bad) === p ? `Sell the buildings in ${spaceName(b, bad)}'s colour set first.` : `${who} doesn't own ${spaceName(b, bad)}.`;
      return null;
    };
    return side(t.from, t.give, ctx.players[t.from].name) || side(t.to, t.want, ctx.players[t.to].name);
  }
  function doTrade(ctx, t) {
    const st = ctx.state, b = bd(st), A = ctx.players[t.from].name, B = ctx.players[t.to].name;
    const err = tradeProblem(ctx, t);
    if (err) return err;
    const fees = (p, list) => list.filter(i => st.own[i].mort).reduce((a, i) => a + interest(i), 0);
    const feeA = fees(t.from, t.want.props), feeB = fees(t.to, t.give.props);       // mortgaged properties received: pay the 10% now
    if (st.cash[t.from] - t.give.cash + t.want.cash < feeA) return `${A} can't pay the mortgage interest on what they'd receive.`;
    if (st.cash[t.to] - t.want.cash + t.give.cash < feeB) return `${B} can't pay the mortgage interest on what they'd receive.`;
    transfer(ctx, t.from, t.to, t.give.cash); transfer(ctx, t.to, t.from, t.want.cash);
    t.give.props.forEach(i => { st.own[i].p = t.to; }); t.want.props.forEach(i => { st.own[i].p = t.from; });
    for (let k = 0; k < t.give.jf; k++) st.jailFree[t.to].push(st.jailFree[t.from].pop());
    for (let k = 0; k < t.want.jf; k++) st.jailFree[t.from].push(st.jailFree[t.to].pop());
    if (feeA) transfer(ctx, t.from, 'bank', feeA);
    if (feeB) transfer(ctx, t.to, 'bank', feeB);
    const what = x => [x.cash ? money(b, x.cash) : '', ...x.props.map(i => spaceName(b, i)), x.jf ? 'a Get Out of Jail Free card' : ''].filter(Boolean).join(', ') || 'nothing';
    ctx.log(`🤝 ${A} traded ${what(t.give)} to ${B} for ${what(t.want)}.`);
    ctx.say(`${A} and ${B} make a deal.`, 'pay');
    st.trades = st.trades.filter(x => x.id !== t.id);
    return null;
  }

  /* ---------- Drawing the board (the Mac, and smaller on the phones) ---------- */
  const U = 60;                                                  // 13 × 13 units: corners 2 × 2, the other spaces 1 × 2
  function cellRect(i) {
    if (i === 0) return { x: 11, y: 11, w: 2, h: 2, side: 'corner' };
    if (i < 10) return { x: 11 - i, y: 11, w: 1, h: 2, side: 'bottom' };
    if (i === 10) return { x: 0, y: 11, w: 2, h: 2, side: 'corner' };
    if (i < 20) return { x: 0, y: 11 - (i - 10), w: 2, h: 1, side: 'left' };
    if (i === 20) return { x: 0, y: 0, w: 2, h: 2, side: 'corner' };
    if (i < 30) return { x: 2 + (i - 21), y: 0, w: 1, h: 2, side: 'top' };
    if (i === 30) return { x: 11, y: 0, w: 2, h: 2, side: 'corner' };
    return { x: 11, y: 2 + (i - 31), w: 2, h: 1, side: 'right' };
  }
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // Words onto lines of at most n characters (a long word gets its own line)
  const wrap = (text, n) => String(text).split(' ').reduce((lines, w) => { const l = lines.at(-1); if (l && (l + ' ' + w).length <= n) lines[lines.length - 1] = l + ' ' + w; else lines.push(w); return lines; }, []);

  /* ---------- Drawing helpers: colours, shapes and the board's furniture ---------- */
  // A colour made lighter (f > 0) or darker (f < 0)
  const shade = (hex, f) => { const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f)); return `#${c.map(v => v.toString(16).padStart(2, '0')).join('')}`; };
  // Each board's ink: icons, the logo plate and the frame's dark edge
  const INK = { newyork: '#1d2a5c', mumbai: '#7a1e48', paris: '#6d4c7d', rio: '#0b6e8c', zurich: '#b71c2c', tokyo: '#5b0fd6', dublin: '#1b5e3a', santorini: '#0d4c8c', cairo: '#7f4f24', tromso: '#0b3a5c', hongkong: '#a4161a', prague: '#6b2d12' };
  const NAME_FONT = '"Avenir Next Condensed", "Arial Narrow", "Roboto Condensed", system-ui, sans-serif';
  const lin = (id, stops, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('')}</linearGradient>`;
  // Icons, drawn (not emoji), centred on (x, y), about s across, in the board's ink
  const ICONS = {
    train: (x, y, s, ink) => `<g transform="translate(${x - s / 2} ${y - s / 2}) scale(${s / 40})"><rect x="8" y="4" width="24" height="26" rx="6" fill="${ink}"/><rect x="11" y="8" width="18" height="9" rx="2" fill="#dff3ff"/><circle cx="14" cy="23" r="2.4" fill="#ffe08a"/><circle cx="26" cy="23" r="2.4" fill="#ffe08a"/><path d="M10 30 l-4 7 M30 30 l4 7" stroke="${ink}" stroke-width="3" stroke-linecap="round"/></g>`,
    bullet: (x, y, s, ink) => `<g transform="translate(${x - s / 2} ${y - s / 2}) scale(${s / 40})"><path d="M4 26 Q4 12 20 10 L36 10 L36 30 L8 30 Q4 30 4 26 Z" fill="#f4f1ff" stroke="${ink}" stroke-width="2.5"/><path d="M10 14 Q14 12 20 12 L22 20 L8 20 Z" fill="${ink}"/><rect x="4" y="27" width="32" height="3" fill="${ink}"/></g>`,
    ship: (x, y, s, ink) => `<g transform="translate(${x - s / 2} ${y - s / 2}) scale(${s / 40})"><path d="M20 4 L20 26 L6 26 Z" fill="#f8f3e3" stroke="${ink}" stroke-width="2"/><path d="M22 8 L22 26 L33 26 Z" fill="#e9d8a6" stroke="${ink}" stroke-width="2"/><path d="M4 28 L36 28 L30 36 L10 36 Z" fill="${ink}"/></g>`,
    bolt: (x, y, s) => `<g transform="translate(${x - s / 2} ${y - s / 2}) scale(${s / 40})"><circle cx="20" cy="20" r="18" fill="#fff4c2" stroke="#e0a800" stroke-width="2"/><path d="M23 5 L11 22 L19 22 L16 35 L29 17 L21 17 Z" fill="#f5b700" stroke="#8a6200" stroke-width="1.6" stroke-linejoin="round"/></g>`,
    drop: (x, y, s) => `<g transform="translate(${x - s / 2} ${y - s / 2}) scale(${s / 40})"><circle cx="20" cy="20" r="18" fill="#dff3ff" stroke="#3a9ad9" stroke-width="2"/><path d="M20 6 C26 15 30 20 30 25 A10 10 0 0 1 10 25 C10 20 14 15 20 6 Z" fill="#2b8ad8" stroke="#145a91" stroke-width="1.6"/><path d="M15 25 a5 5 0 0 0 5 5" stroke="#bfe6ff" stroke-width="2" fill="none"/></g>`,
    flame: (x, y, s) => `<g transform="translate(${x - s / 2} ${y - s / 2}) scale(${s / 40})"><circle cx="20" cy="20" r="18" fill="#ffe8d6" stroke="#e76f51" stroke-width="2"/><path d="M20 5 C27 13 30 19 28 26 A8.5 8.5 0 0 1 12 26 C10 20 15 17 16 11 C18 15 19 16 20 5 Z" fill="#f4511e"/><path d="M20 16 C24 21 25 24 23.5 28 A4 4 0 0 1 16.5 28 C15.5 25 18 22 20 16 Z" fill="#ffca28"/></g>`,
    fortune: (x, y, s, ink) => `<g transform="translate(${x - s / 2} ${y - s / 2}) scale(${s / 40}) rotate(-8 20 20)"><rect x="8" y="3" width="24" height="34" rx="4" fill="#ffb347" stroke="${ink}" stroke-width="2.2"/><text x="20" y="29" font-size="24" font-weight="900" text-anchor="middle" fill="${ink}" font-family="Georgia, serif">?</text></g>`,
    treasury: (x, y, s, ink) => `<g transform="translate(${x - s / 2} ${y - s / 2}) scale(${s / 40})"><path d="M5 16 Q5 7 20 7 Q35 7 35 16 Z" fill="#b5651d" stroke="#5c3310" stroke-width="2"/><rect x="5" y="16" width="30" height="18" rx="2" fill="#c97b2a" stroke="#5c3310" stroke-width="2"/><rect x="5" y="15" width="30" height="4" fill="#e9c46a"/><rect x="17" y="17" width="6" height="8" rx="1.5" fill="#e9c46a" stroke="#5c3310" stroke-width="1.2"/><circle cx="12" cy="12" r="2" fill="#ffe08a"/></g>`,
    receipt: (x, y, s, ink) => `<g transform="translate(${x - s / 2} ${y - s / 2}) scale(${s / 40})"><path d="M9 3 H31 V35 L27 32 L23 35 L19 32 L15 35 L11 32 L9 35 Z" fill="#fff" stroke="${ink}" stroke-width="2"/><path d="M13 10 H27 M13 15 H27 M13 20 H22" stroke="${ink}" stroke-width="2" stroke-linecap="round"/><text x="25" y="29" font-size="9" font-weight="900" text-anchor="middle" fill="#c0392b">%</text></g>`,
    diamond: (x, y, s, ink) => `<g transform="translate(${x - s / 2} ${y - s / 2}) scale(${s / 40})"><path d="M8 14 L14 6 H26 L32 14 L20 34 Z" fill="#bde8ff" stroke="${ink}" stroke-width="2" stroke-linejoin="round"/><path d="M8 14 H32 M14 6 L18 14 L20 34 L22 14 L26 6" fill="none" stroke="${ink}" stroke-width="1.3"/></g>`,
  };
  const iconFor = (key, sp, i) => (sp.type === 'station' ? (key === 'santorini' || key === 'tromso' ? 'ship' : key === 'tokyo' ? 'bullet' : 'train') : sp.type === 'utility' ? (UTILITIES.indexOf(i) ? 'drop' : 'bolt')
    : sp.type === 'fortune' ? 'fortune' : sp.type === 'treasury' ? 'treasury' : sp.type === 'tax' ? (sp.amount === 100 ? 'diamond' : 'receipt') : null);
  // The four corners, illustrated
  function corner(type, x, y, w, ink, b) {
    const cx = x + w / 2, cy = y + w / 2;
    const label = (t, ty, size = 0.2, col = '#1b1b1b') => `<text x="${cx}" y="${ty}" font-size="${U * size}" font-weight="900" text-anchor="middle" fill="${col}" font-family="${NAME_FONT}" letter-spacing="1">${t}</text>`;
    if (type === 'go') return `<path d="M${x + w * 0.82} ${cy + w * 0.08} H${x + w * 0.3} l10 -12 M${x + w * 0.3} ${cy + w * 0.08} l10 12" stroke="#d62828" stroke-width="9" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
      + `<text x="${cx}" y="${y + w * 0.42}" font-size="${U * 0.78}" font-weight="900" text-anchor="middle" fill="#d62828" font-family="Georgia, serif" stroke="#7a1010" stroke-width="1.5">GO</text>`
      + label(`COLLECT ${esc(money(b, SALARY))}`, y + w * 0.84, 0.15, '#333') + label('AS YOU PASS', y + w * 0.93, 0.12, '#666');
    if (type === 'jail') {
      // "In jail" in the inner square; "just visiting" along the outer edges
      const jx = x + w * 0.34, jw = w * 0.66;
      let s = `<rect x="${x}" y="${y}" width="${w}" height="${w}" fill="#ffd8a8"/><rect x="${jx}" y="${y}" width="${jw}" height="${jw}" fill="#f77f00" stroke="${ink}" stroke-width="2"/>`;
      s += `<rect x="${jx + jw * 0.18}" y="${y + jw * 0.2}" width="${jw * 0.64}" height="${jw * 0.6}" rx="4" fill="#fff3e0" stroke="#5c3310" stroke-width="2"/>`;
      for (let k = 0; k < 5; k++) s += `<rect x="${jx + jw * (0.24 + k * 0.12)}" y="${y + jw * 0.2}" width="${jw * 0.04}" height="${jw * 0.6}" fill="#3d3d3d"/>`;
      s += `<text x="${jx + jw / 2}" y="${y + jw * 0.97}" font-size="${U * 0.15}" font-weight="900" text-anchor="middle" fill="#fff" font-family="${NAME_FONT}" letter-spacing="1">IN JAIL</text>`;
      s += `<text x="${x + w * 0.17}" y="${y + w * 0.5}" font-size="${U * 0.13}" font-weight="900" text-anchor="middle" fill="#5c3310" font-family="${NAME_FONT}" transform="rotate(90 ${x + w * 0.17} ${y + w * 0.5})" letter-spacing="1">JUST</text>`;
      return s + `<text x="${x + w * 0.62}" y="${y + w * 0.86}" font-size="${U * 0.13}" font-weight="900" text-anchor="middle" fill="#5c3310" font-family="${NAME_FONT}" letter-spacing="1">VISITING</text>`;
    }
    if (type === 'parking') return `<g transform="translate(${cx - 34} ${cy - 30})"><path d="M6 34 Q8 20 20 18 L28 8 H50 L60 18 Q68 20 68 34 Z" fill="#d62828" stroke="#5a0b0b" stroke-width="2.5"/><path d="M30 11 H48 L55 18 H25 Z" fill="#bde8ff" stroke="#5a0b0b" stroke-width="1.5"/><circle cx="20" cy="36" r="7" fill="#222" stroke="#999" stroke-width="2"/><circle cx="54" cy="36" r="7" fill="#222" stroke="#999" stroke-width="2"/></g>`
      + label('FREE', y + w * 0.2, 0.22, '#d62828') + label('PARKING', y + w * 0.86, 0.2, '#d62828');
    return `<g transform="translate(${cx - 26} ${cy - 30})"><path d="M26 2 L48 10 V28 Q48 46 26 56 Q4 46 4 28 V10 Z" fill="#1d3557" stroke="#e9c46a" stroke-width="3"/><path d="M26 14 l4 9 10 1 -8 6 3 10 -9 -6 -9 6 3 -10 -8 -6 10 -1 Z" fill="#e9c46a"/></g>`
      + label('GO TO', y + w * 0.16, 0.2, '#1d3557') + label('JAIL', y + w * 0.9, 0.24, '#1d3557');
  }
  // A small house or a hotel, drawn on the colour band
  const house = (x, y, s) => `<path d="M${x} ${y + s * 0.45} L${x + s / 2} ${y} L${x + s} ${y + s * 0.45} V${y + s} H${x} Z" fill="#2a9d4b" stroke="#fff" stroke-width="1.4"/>`;
  const hotel = (x, y, s) => `<g><rect x="${x}" y="${y + s * 0.15}" width="${s * 1.6}" height="${s * 0.85}" rx="2" fill="#d62828" stroke="#fff" stroke-width="1.4"/><path d="M${x - 2} ${y + s * 0.2} L${x + s * 0.8} ${y - s * 0.15} L${x + s * 1.6 + 2} ${y + s * 0.2}" fill="#9d0208" stroke="#fff" stroke-width="1.2"/></g>`;

  /* ---------- Each board's centre picture, in the 9 × 9 middle ---------- */
  // A painted picture of the city (games/party/art/boards/<board>.jpg) with its own logo plate and card piles
  const scene = (key, x, y, w, h) => `<image href="games/party/art/boards/${key}.jpg" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice"/>`;

  /* ---------- The board: frame, spaces, corners, owners, buildings, mortgages and tokens. v: { board, own, pos, out, colors, turn, pot } ---------- */
  function boardSVG(v, opt = {}) {
    const key = BOARDS[v.board] ? v.board : 'newyork', b = BOARDS[key], C = b.colors, ink = INK[key];
    let s = `<defs>${lin('bzFrame', [[0, shade(C.frame, 0.25)], [0.5, C.frame], [1, shade(C.frame, -0.35)]], 1, 1)}${lin('bzPaper', [[0, '#ffffff'], [1, shade(C.cell, -0.04)]])}${lin('bzGloss', [[0, '#fff', 0.55], [0.5, '#fff', 0.08], [1, '#000', 0.12]])}
      <filter id="bzShadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.45"/></filter>
      <pattern id="bzHatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="3" height="7" fill="#7a0000" opacity="0.18"/></pattern></defs>`;
    // the frame: a bevelled rim around the whole board
    const M = 16;                                                  // the rim around the spaces
    s += `<rect x="${-M}" y="${-M}" width="${13 * U + 2 * M}" height="${13 * U + 2 * M}" rx="18" fill="url(#bzFrame)"/><rect x="${-M + 5}" y="${-M + 5}" width="${13 * U + 2 * M - 10}" height="${13 * U + 2 * M - 10}" rx="14" fill="none" stroke="#fff" stroke-opacity="0.35" stroke-width="1.5"/><rect x="-3" y="-3" width="${13 * U + 6}" height="${13 * U + 6}" rx="4" fill="${shade(C.frame, -0.55)}"/>`;
    // the centre: the city's picture, edged like the spaces
    s += scene(key, 2 * U, 2 * U, 9 * U, 9 * U) + `<rect x="${2 * U}" y="${2 * U}" width="${9 * U}" height="${9 * U}" fill="none" stroke="${shade(C.frame, -0.45)}" stroke-width="1.2"/>`;
    SPACES.forEach((sp, i) => {
      const c = cellRect(i), x = c.x * U, y = c.y * U, w = c.w * U, h = c.h * U, o = v.own[i];
      s += `<g data-space="${i}"${opt.pick && opt.pick.includes(i) ? ` class="bz-pick" data-act="goto" data-to="${i}"` : ''}><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#bzPaper)" stroke="${shade(C.frame, -0.45)}" stroke-width="1.2"/>`;
      if (c.side === 'corner') { s += corner(sp.type, x, y, w, ink, b); if (sp.type === 'parking' && v.pot) s += `<text x="${x + w / 2}" y="${y + w * 0.66}" font-size="${U * 0.2}" font-weight="900" text-anchor="middle" fill="#1f7a3a" font-family="${NAME_FONT}">${esc(money(b, v.pot))}</text>`; s += '</g>'; return; }
      // the colour band on the inner side, glossy, where the buildings go
      const band = U * 0.4, bandR = { bottom: [x, y, w, band], top: [x, y + h - band, w, band], left: [x + w - band, y, band, h], right: [x, y, band, h] }[c.side];
      if (sp.type === 'street') s += `<rect x="${bandR[0]}" y="${bandR[1]}" width="${bandR[2]}" height="${bandR[3]}" fill="${GROUP[sp.group]}"/><rect x="${bandR[0]}" y="${bandR[1]}" width="${bandR[2]}" height="${bandR[3]}" fill="url(#bzGloss)"/><rect x="${bandR[0]}" y="${bandR[1]}" width="${bandR[2]}" height="${bandR[3]}" fill="none" stroke="${shade(GROUP[sp.group], -0.45)}" stroke-width="1"/>`;
      const tx = c.side === 'right' ? x + band : x, ty = c.side === 'bottom' ? y + band : y, tw = c.side === 'left' || c.side === 'right' ? w - band : w, th = c.side === 'bottom' || c.side === 'top' ? h - band : h;
      const narrow = tw < U * 1.2, icon = iconFor(key, sp, i), name = spaceName(b, i).toUpperCase(), lines = wrap(name, narrow ? 9 : 13).slice(0, 3);
      const side = !narrow && icon, ax = side ? tx + U * 0.42 : tx, aw = side ? tw - U * 0.42 : tw, cxm = ax + aw / 2;
      const base = narrow ? U * 0.15 : U * 0.165, fit = l => Math.min(base, (aw - 6) / (0.56 * Math.max(4, l.length)));
      let ly = ty + (narrow ? base * 1.4 : th / 2 - (lines.length - 1) * base * 0.55 - base * 0.3);
      // a name the font would draw wider than the cell is squeezed to fit (fonts differ between the Mac and phones)
      lines.forEach(l => { const fs = fit(l), squeeze = l.length * fs * 0.7 > aw - 6 ? ` textLength="${(aw - 6).toFixed(1)}" lengthAdjust="spacingAndGlyphs"` : ''; s += `<text x="${cxm.toFixed(1)}" y="${ly.toFixed(1)}" font-size="${fs.toFixed(1)}" font-weight="800" text-anchor="middle" fill="#1b1b1b" font-family="${NAME_FONT}" letter-spacing="0.4"${squeeze}>${esc(l)}</text>`; ly += base * 1.1; });
      if (icon) s += side ? ICONS[icon](tx + U * 0.24, ty + th / 2, U * 0.36, ink) : ICONS[icon](tx + tw / 2, ty + th * 0.6, U * 0.44, ink);
      const price = sp.price || sp.amount;
      if (price) {
        const label = money(b, price), pw = Math.min(aw - 6, label.length * U * 0.085 + 10), py = ty + th - base * 1.45;
        s += `<rect x="${(cxm - pw / 2).toFixed(1)}" y="${py.toFixed(1)}" width="${pw.toFixed(1)}" height="${(base * 1.05).toFixed(1)}" rx="${(base * 0.5).toFixed(1)}" fill="${shade(ink, 0.85)}" stroke="${shade(ink, 0.5)}" stroke-width="0.8"/>`
          + `<text x="${cxm.toFixed(1)}" y="${(py + base * 0.8).toFixed(1)}" font-size="${(base * 0.82).toFixed(1)}" font-weight="800" text-anchor="middle" fill="${ink}" font-family="${NAME_FONT}">${esc(label)}</text>`;
      }
      if (o) {
        // the owner's colour along the outer edge, with a little flag; houses and hotels on the band; a stamp when mortgaged
        const edge = 6, er = { bottom: [x, y + h - edge, w, edge], top: [x, y, w, edge], left: [x, y, edge, h], right: [x + w - edge, y, edge, h] }[c.side];
        s += `<rect x="${er[0]}" y="${er[1]}" width="${er[2]}" height="${er[3]}" fill="${v.colors[o.p] || '#888'}"/>`;
        const hs = U * 0.2, vert = c.side === 'left' || c.side === 'right';
        if (o.h === HOTEL) s += hotel(bandR[0] + bandR[2] / 2 - hs * 0.8, bandR[1] + bandR[3] / 2 - hs / 2, hs);
        else for (let k = 0; k < o.h; k++) s += house(vert ? bandR[0] + bandR[2] / 2 - hs / 2 : bandR[0] + 3 + k * (hs + 2), vert ? bandR[1] + 3 + k * (hs + 2) : bandR[1] + bandR[3] / 2 - hs / 2, hs);
        if (o.mort) s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#bzHatch)"/><g transform="rotate(-32 ${x + w / 2} ${y + h / 2})"><rect x="${x + w / 2 - U * 0.6}" y="${y + h / 2 - U * 0.13}" width="${U * 1.2}" height="${U * 0.26}" rx="4" fill="#fff" fill-opacity="0.75" stroke="#b00020" stroke-width="2"/><text x="${x + w / 2}" y="${y + h / 2 + U * 0.065}" font-size="${U * 0.16}" font-weight="900" text-anchor="middle" fill="#b00020" font-family="${NAME_FONT}" letter-spacing="1">MORTGAGED</text></g>`;
      }
      s += '</g>';
    });
    // tokens: glossy discs in the players' colours with their board's piece; the player on turn has a pulsing ring
    const at = {};
    (v.pos || []).forEach((p, q) => { if (!(v.out || [])[q]) (at[p] = at[p] || []).push(q); });
    Object.entries(at).forEach(([i, list]) => {
      const c = cellRect(+i), x = c.x * U, y = c.y * U, w = c.w * U, h = c.h * U, cols = list.length > 4 ? 3 : 2, size = Math.min(w, h) * (list.length > 2 ? 0.36 : 0.46);
      // tokens stand where the space's picture is, below the name (top and bottom rows), or on the colour band (the
      // sides), so the name stays readable; on a corner they stand in the middle
      const band = U * 0.4, ax = c.side === 'left' ? x + w - band / 2 : c.side === 'right' ? x + band / 2 : x + w / 2;
      const ay = c.side === 'bottom' ? y + band + (h - band) * 0.6 : c.side === 'top' ? y + (h - band) * 0.6 : y + h / 2;
      list.forEach((q, k) => {
        const tx = ax + ((k % cols) - (Math.min(list.length, cols) - 1) / 2) * size * 1.05, ty = ay + (Math.floor(k / cols) - (Math.ceil(list.length / cols) - 1) / 2) * size * 1.05, col = v.colors[q] || '#888';
        s += `<g class="bz-token${v.turn === q ? ' now' : ''}" data-p="${q}" filter="url(#bzShadow)">${v.turn === q ? `<circle class="bz-ring" cx="${tx.toFixed(1)}" cy="${ty.toFixed(1)}" r="${(size / 2 + 4).toFixed(1)}" fill="none" stroke="#fff" stroke-width="3"/>` : ''}<circle cx="${tx.toFixed(1)}" cy="${ty.toFixed(1)}" r="${(size / 2).toFixed(1)}" fill="${col}" stroke="#fff" stroke-width="2.5"/><circle cx="${(tx - size * 0.12).toFixed(1)}" cy="${(ty - size * 0.14).toFixed(1)}" r="${(size * 0.2).toFixed(1)}" fill="#fff" opacity="0.35"/><text x="${tx.toFixed(1)}" y="${(ty + size * 0.19).toFixed(1)}" font-size="${(size * 0.56).toFixed(1)}" text-anchor="middle">${b.tokens[q % 8]}</text></g>`;
      });
    });
    // every drawing gets its own ids: a page can hold several boards (a hidden lobby preview and the game), and a
    // gradient referenced by id is taken from the first element with that id, which may be hidden
    const uid = opt.uid || 'x';
    s = s.replace(/(id="|url\(#)(bz[\w-]*)/g, `$1$2-${uid}`);
    return `<svg class="bz-board" viewBox="${-M} ${-M} ${13 * U + 2 * M} ${13 * U + 2 * M}" role="img" aria-label="${esc(b.name)} board">${s}</svg>`;
  }

  /* ---------- The open table: showing the boards in the lobby, and the players' votes ---------- */
  // lobby state: { open, votes: { board: [devices] } }. A phone votes for as many boards as it likes, once each (a second
  // tap takes the vote back); the votes only guide the host, who picks the board.
  const votesFor = (state, k) => ((state.votes || {})[k] || []).length;
  function lobbyAct(state, m, apiL) {
    const cur = BOARDS[apiL.opts.board] ? apiL.opts.board : BOARD_KEYS[0], at = BOARD_KEYS.indexOf(cur);
    if (m.host) {
      if (m.lobby === 'open') state.open = true;
      if (m.lobby === 'close') state.open = false;
      if (m.lobby === 'prev') apiL.setOpt('board', BOARD_KEYS[(at + BOARD_KEYS.length - 1) % BOARD_KEYS.length]);
      if (m.lobby === 'next') apiL.setOpt('board', BOARD_KEYS[(at + 1) % BOARD_KEYS.length]);
      if (m.lobby === 'pick' && BOARDS[m.board]) apiL.setOpt('board', m.board);
      return;
    }
    if (m.lobby === 'vote' && BOARDS[m.board] && m.device) {
      state.votes = state.votes || {};
      const list = state.votes[m.board] = state.votes[m.board] || [];
      const k = list.indexOf(m.device);
      if (k >= 0) list.splice(k, 1); else list.push(m.device);
    }
  }
  const lobbyView = (state, opts, device) => ({ board: BOARDS[opts.board] ? opts.board : BOARD_KEYS[0], open: !!state.open,
    votes: Object.fromEntries(BOARD_KEYS.map(k => [k, votesFor(state, k)])), mine: BOARD_KEYS.filter(k => ((state.votes || {})[k] || []).includes(device)) });
  const preview = (key, uid) => boardSVG({ board: key, own: {}, pos: [], out: [], colors: [] }, { uid });
  function lobbyHTML(n, opts, state = {}, L = {}) {
    const key = BOARDS[opts.board] ? opts.board : BOARD_KEYS[0], b = BOARDS[key], e = L.esc || esc;
    const strip = BOARD_KEYS.map(k => `<button type="button" class="bz-strip-b${k === key ? ' on' : ''}" data-lobby="pick" data-board="${k}"><b>${e(BOARDS[k].name)}</b><span>${votesFor(state, k) ? `👍 ${votesFor(state, k)}` : '&nbsp;'}</span></button>`).join('');
    const facts = `<div class="bz-facts"><b>${e(b.name)}</b> · ${e(b.mood)}<br>Start with ${money(b, START)} · dearest street ${money(b, 400)} (${e(b.streets[21])})</div>`;
    const card = `<div class="bz-lobby"><div class="bz-lobby-prev">${preview(key, 'l')}</div><div>${facts}<button type="button" class="btn primary" data-lobby="open">🖥️ Open the table: show the boards</button>
      <p class="muted">Show the boards on this screen while players join; they vote for their favourites on their phones (👍). You pick the board.</p></div></div>`;
    if (!state.open) return card;
    const players = (L.players || []).map(p => `<span style="--pc:${p.color}">${e(p.name)}</span>`).join('') || '<span class="muted">Nobody yet</span>';
    return card + `<div class="bz-show" role="dialog" aria-label="The boards"><div class="bz-show-board">${preview(key, 's')}</div>
      <div class="bz-show-side"><div class="bz-show-head"><button type="button" class="btn" data-lobby="prev" aria-label="Previous board">◀</button><div><h2>${e(b.name)}</h2><span>${e(b.mood)}</span></div><button type="button" class="btn" data-lobby="next" aria-label="Next board">▶</button></div>
        <div class="bz-facts">Start with ${money(b, START)} · dearest street ${money(b, 400)} (${e(b.streets[21])})</div><div class="bz-strip">${strip}</div>
        <div class="bz-show-join">${L.qr ? `<img src="${e(L.qr)}" alt="QR code: scan to join">` : ''}<div><b>📱 Scan to join, then vote 👍</b><code>${e(L.joinUrl || '')}</code><div class="bz-show-players">${players}</div></div></div>
        <div class="bz-show-go"><button type="button" class="btn primary" data-lobby-start ${L.canStart ? '' : 'disabled'}>Start on ${e(b.name)}</button><button type="button" class="btn" data-lobby="close">Close</button>
          ${L.canStart ? '' : `<span class="muted">Needs ${L.min || 2}–${L.max || 8} players.</span>`}</div></div></div>`;
  }
  function lobbyPhoneHTML(v, local, Hh) {
    const e = (Hh && Hh.esc) || esc;
    return `<div class="bz-vote"><div class="sec-title">Business · the host is showing ${e(BOARDS[v.board].name)}</div><div class="bz-vote-board">${preview(v.board, 'v')}</div>
      <div class="sec-title">Vote for the boards you like (tap again to take it back)</div>
      <div class="bz-vote-list">${BOARD_KEYS.map(k => `<button type="button" class="${v.mine.includes(k) ? 'on' : ''}${k === v.board ? ' now' : ''}" data-lobby="vote" data-board="${k}"><span>${e(BOARDS[k].name)}</span><small>${e(BOARDS[k].mood)}</small><b>👍 ${v.votes[k] || 0}</b></button>`).join('')}</div></div>`;
  }

  /* ---------- The gavel: a full-screen moment when an auction opens, and when it sells (like Roulette's 0 / 00) ---------- */
  // A wooden gavel strike, synthesized (no sound files): a low thump and a short bright crack
  function knock(ac, t, loud = 1) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(190, t); o.frequency.exponentialRampToValueAtTime(55, t + 0.14);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.9 * loud, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g).connect(ac.destination); o.start(t); o.stop(t + 0.25);
    const len = Math.floor(ac.sampleRate * 0.06), buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    for (let k = 0; k < len; k++) d[k] = (Math.random() * 2 - 1) * (1 - k / len);
    const nz = ac.createBufferSource(), bp = ac.createBiquadFilter(), ng = ac.createGain();
    nz.buffer = buf; bp.type = 'bandpass'; bp.frequency.value = 1700; bp.Q.value = 2.5; ng.gain.value = 0.7 * loud;
    nz.connect(bp).connect(ng).connect(ac.destination); nz.start(t);
  }
  const HITS = { auction: [0.4, 0.9, 1.4], sold: [0.44] };            // seconds: when the gavel strikes (80% into each swing)
  function gavelFx(f, FX) {
    if (typeof document === 'undefined') return;
    const calm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const el = document.createElement('div');
    el.className = `bz-gavel-fx ${f.kind}${calm ? ' calm' : ''}`;
    el.setAttribute('aria-hidden', 'true');
    el.style.setProperty('--gc', f.color || '#c9a227');
    el.innerHTML = `<div class="rays"></div>${HITS[f.kind].map((h, k) => `<div class="wave" style="animation-delay:${h}s"></div>`).join('')}
      <svg class="gavel" viewBox="0 0 200 200"><g class="head"><rect x="62" y="40" width="96" height="44" rx="10" fill="#8b5a2b" stroke="#3b2414" stroke-width="5"/><rect x="62" y="40" width="16" height="44" rx="5" fill="#c9a227"/><rect x="142" y="40" width="16" height="44" rx="5" fill="#c9a227"/><rect x="104" y="80" width="12" height="96" rx="6" fill="#a0682f" stroke="#3b2414" stroke-width="4"/></g></svg>
      <div class="block"></div><div class="title">${esc(f.title)}</div><div class="sub">${esc(f.sub)}</div>`;
    document.body.appendChild(el);
    const dur = f.kind === 'auction' ? 2600 : 2400;
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 600); }, dur);
    if (FX && FX.voiceOn && FX.voiceOn()) {
      const ac = FX.audio && FX.audio();
      if (ac) { const t0 = ac.currentTime + 0.02; HITS[f.kind].forEach((h, k) => knock(ac, t0 + h, f.kind === 'sold' ? 1.2 : 0.8 + k * 0.1)); }
    }
  }

  /* ---------- Bits shared by the Mac and the phones ---------- */
  const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  const die = n => `<span class="bz-die" role="img" aria-label="${n}">${[0, 1, 2, 3, 4, 5, 6, 7, 8].map(k => `<i${PIPS[n].includes(k) ? ' class="on"' : ''}></i>`).join('')}</span>`;
  const speedFace = sp => (sp == null ? '' : typeof sp === 'number' ? `<span class="bz-die speed">${[0, 1, 2, 3, 4, 5, 6, 7, 8].map(k => `<i${PIPS[sp].includes(k) ? ' class="on"' : ''}></i>`).join('')}</span>` : `<span class="bz-die speed face">${sp === 'bus' ? '🚌' : '⏩'}</span>`);
  const diceHTML = (d, sp, cls = '') => (d ? `<span class="bz-dice ${cls}">${die(d[0])}${die(d[1])}${speedFace(sp)}<b>${d[0] + d[1] + (typeof sp === 'number' ? sp : 0)}</b></span>` : '');
  const stepText = { order: 'is rolling for turn order', roll: 'is about to roll', jail: 'is in jail', buy: 'is deciding whether to buy', auction: '— auction!', main: 'is building and trading', bus: 'is choosing the bus move', triples: 'rolled triples: picks any space', debt: '— settling a debt' };
  // The glows: money that just came (green) or went (red), from the record of flows
  const GLOW_MS = 2200;
  function collectGlows(fx, flows, keyOf, now) {
    flows.filter(f => f.id > fx.seen).forEach(f => [[f.to, f.n], [f.from, -f.n]].forEach(([who, n]) => {
      const key = keyOf(who); if (key == null) return;
      const g = fx.glow[key];
      fx.glow[key] = g && now - g.t < 400 ? { t: g.t, n: g.n + n } : { t: now, n };
    }));
    fx.seen = Math.max(fx.seen, ...flows.map(f => f.id));
  }
  const glowOn = (g, now) => g && now - g.t < GLOW_MS;

  const api = {
    _test: { SPACES, STREETS, STATIONS, UTILITIES, OWNABLE, GROUPS, FORTUNE, TREASURY, BOARDS, BOARD_KEYS, FK, TK, SAY, money, spaceName, rent, canBuild, canSell, canMortgage, canUnmortgage, netWorth, fullSet, firstPlayer, seatOrder, boardSVG, unmortgageCost, interest, HOTEL, drawCard, START, SALARY },   // internals, for the unit tests only (test/unit)
    id: 'business', name: 'Business', min: 2, max: 8, wide: true, macRole: 'the board and the bank', pointsLabel: null,   // the end screen shows net worth in the board's money; the leaderboard keeps standard units
    blurb: 'Beta. Buy streets, build houses and hotels, collect rent and bankrupt your friends, on one of twelve themed city boards. The board is on the Mac; your money and deeds are on your phone. 2–8 players.',
    options: [
      { key: 'board', label: 'Board', def: 'newyork', choices: BOARD_KEYS.map(k => [k, `${BOARDS[k].name} · ${BOARDS[k].mood}`]) },
      { key: 'length', label: 'Game length', def: 'classic', choices: [['classic', 'Classic: the last one standing wins'], ['short', 'Short game: ends at the first bankruptcy, richest wins']] },
      { key: 'auctions', label: 'A property nobody buys', def: 'on', choices: [['on', 'Goes to auction (official)'], ['off', 'Stays with the bank']] },
      { key: 'speed', label: 'Speed die', def: 'off', choices: [['off', 'Off'], ['on', 'On: a third die once you have passed GO (faster games)']] },
      { key: 'jackpot', label: 'Free Parking', def: 'off', choices: [['off', 'Nothing happens (official)'], ['on', 'Jackpot: taxes and fines go to the middle']] },
      { key: 'doublego', label: 'Landing on GO', def: 'off', choices: [['off', 'The usual salary'], ['on', 'Double salary']] },
      { key: 'turnTime', label: 'Time per turn', def: 0, choices: [[0, 'Off'], [60, '60 seconds'], [90, '90 seconds'], [120, '2 minutes'], [180, '3 minutes']] },
    ],
    rules: [
      '<b>Beta:</b> a new game, still being tested. The rules are the classic property-trading rules; the board names, money and stories are our own.',
      '<b>Start:</b> everyone gets the starting money and rolls for turn order (highest starts; on a tie, whoever rolled that number first). Passing GO pays a salary.',
      '<b>Your turn:</b> roll and move. Land on a property nobody owns: buy it, or it goes to auction (everyone bids; it closes 10 seconds after the last bid). Land on someone else\'s: pay rent, automatically. Doubles roll again; three doubles in a row send you to jail.',
      '<b>Rent:</b> a street\'s rent doubles when one player owns its whole colour set; houses and hotels raise it a lot. Stations charge more the more of them the owner has; utilities charge 4 × the dice (10 × with both).',
      '<b>Building:</b> with a whole colour set (nothing in it mortgaged), build houses evenly, then a hotel after 4 houses (3 in the short game). The bank has 32 houses and 12 hotels. Buildings sell back at half price, evenly.',
      '<b>Mortgages:</b> mortgage a property (with no buildings in its colour set) for half its price; it charges no rent until you pay the mortgage back plus 10%. Receiving a mortgaged property in a trade or a bankruptcy costs the 10% interest straight away.',
      '<b>Jail:</b> pay the fine, use a Get Out of Jail Free card, or roll for doubles (up to three turns, then you pay and move; one turn in the short game). In jail you still collect rent, build and trade.',
      '<b>Fortune and Treasury cards:</b> move, pay, collect, repairs per house and hotel, or a Get Out of Jail Free card you can keep or trade.',
      '<b>Trading:</b> with the player whose turn it is: money, properties (with no buildings in their colour set) and Get Out of Jail Free cards.',
      '<b>Debt:</b> if you owe more than you have, sell buildings, mortgage or trade to raise it, then pay; or declare bankruptcy. Bankrupt to a player: they get everything you have. Bankrupt to the bank: your properties go back to the bank (and up for auction).',
      '<b>Winning:</b> classic, the last player left. Short game: everyone starts with two free properties, and at the first bankruptcy the richest player (cash + properties + buildings) wins. Leaving mid-game counts as bankruptcy to the bank.',
      '<b>Options:</b> the speed die (a third die once you have passed GO: a number adds to the move, the bus lets you use one die, fast-forward then takes you to the next unowned property; triples move you anywhere); the Free Parking jackpot; double salary for landing on GO; time per turn.',
    ],
    async start(ctx) {
      const n = ctx.players.length, o = ctx.opts, board = BOARDS[o.board] ? o.board : 'newyork';
      ctx.state = {
        board, pos: Array(n).fill(0), cash: Array(n).fill(START), own: {}, jail: Array(n).fill(-1), jailFree: ctx.players.map(() => []),
        decks: { fortune: ctx.shuffle([...Array(16).keys()]), treasury: ctx.shuffle([...Array(16).keys()]) },
        turn: 0, first: null, step: 'order', order: null, dice: null, speed: null, lastRoll: null, again: false, pendingFF: false, doublesRun: 0, moved: 0,
        passedGo: Array(n).fill(false), houses: HOUSES, hotels: HOTELS, pot: 0, auction: null, auctionQueue: [], debts: [], after: null, debtBack: null,
        trades: [], tradeId: 0, card: null, utilRoll: null, out: Array(n).fill(false), left: Array(n).fill(false), turnNo: 0,
        short: o.length === 'short', auctions: o.auctions !== 'off', speedDie: o.speed === 'on', jackpot: o.jackpot === 'on', doubleGo: o.doublego === 'on',
        turnTime: +o.turnTime || 0, flows: [], flowId: 0, gid: ctx.rand(1e9),
      };
      const st = ctx.state, b = bd(st);
      if (st.short) {                                              // the short game: two free properties each
        const deeds = ctx.shuffle([...OWNABLE]);
        ctx.players.forEach((_, p) => deeds.splice(0, 2).forEach(i => { st.own[i] = { p, h: 0, mort: false }; }));
        ctx.log('📜 Short game: everyone starts with two free properties.');
      }
      ctx.log(`🏙️ ${b.name}: everyone starts with ${money(b, START)}.`);
      startOrder(ctx);
      ctx.update();
      await ctx.say(`${b.say.intro} ${ctx.players[st.turn].name}, roll for turn order.`, 'welcome');
    },
    act(ctx, i, m) {
      const st = ctx.state, b = bd(st), me = ctx.players[i].name, mine = st.turn === i;
      if (out(st, i)) return 'You are out of this game.';
      // auctions: anyone still in the game bids or passes
      if (m.act === 'bid') {
        const a = st.auction, add = +m.add;
        if (st.step !== 'auction' || !a) return 'There is no auction now.';
        if (!BIDS.includes(add)) return;
        if (a.by === i) return 'You have the top bid.';
        const amount = a.bid + add;
        if (st.cash[i] < amount) return `You only have ${money(b, st.cash[i])}.`;
        a.bid = amount; a.by = i; a.passed = a.passed.filter(q => q !== i);
        ctx.log(`🔨 ${me} bids ${money(b, amount)}.`);
        arm(ctx, 10, 'Auction', () => closeAuction(ctx));
        return;
      }
      if (m.act === 'apass') {
        const a = st.auction;
        if (st.step !== 'auction' || !a || a.by === i || a.passed.includes(i)) return;
        a.passed.push(i);
        if (!live(ctx).some(q => q !== a.by && !a.passed.includes(q))) closeAuction(ctx);
        return;
      }
      // trades: offered on a turn, by the active player to anyone, or by anyone to the active player
      if (m.act === 'offer') {
        if (!TRADE_STEPS.includes(st.step)) return 'Trades happen on a turn, before or after the roll.';
        const to = mine ? +m.to : st.turn;
        if (to === i || !ctx.players[to] || out(st, to)) return 'Pick who to trade with.';
        if (ctx.online && !ctx.online(to)) return `${ctx.players[to].name} is offline right now.`;
        const side = (c, p, j) => ({ cash: Math.max(0, Math.floor(+c || 0)), props: parseIds(p), jf: Math.min(1, Math.max(0, Math.floor(+j || 0))) });
        const t = { id: st.tradeId = (st.tradeId || 0) + 1, from: i, to, give: side(m.gc, m.gp, m.gj), want: side(m.wc, m.wp, m.wj) };
        const empty = x => !x.cash && !x.props.length && !x.jf;
        if (empty(t.give) || empty(t.want)) return 'Put something on both sides of the trade.';
        const err = tradeProblem(ctx, t);
        if (err) return err;
        st.trades = st.trades.filter(x => x.from !== i);
        st.trades.push(t);
        ctx.log(`📣 ${me} offers ${ctx.players[to].name} a trade.`);
        ctx.say(`${me} offers ${ctx.players[to].name} a deal.`);
        return;
      }
      if (m.act === 'treply') {
        const t = st.trades.find(x => x.id === +m.id);
        if (!t || t.to !== i) return 'That trade is no longer open.';
        if (m.r === 'decline') { st.trades = st.trades.filter(x => x !== t); ctx.log(`✖ ${me} turns down ${ctx.players[t.from].name}'s trade.`); return; }
        return doTrade(ctx, t) || undefined;
      }
      if (m.act === 'twithdraw') { st.trades = st.trades.filter(x => x.from !== i); return; }
      // your properties: on your own turn (before or after rolling), or while you owe money
      const debt = st.step === 'debt' ? st.debts[0] : null, debtor = !!debt && debt.p === i;
      if (['build', 'sell', 'mortgage', 'unmortgage'].includes(m.act)) {
        if (!debtor && !(mine && TRADE_STEPS.includes(st.step))) return 'You can manage your properties on your turn, or to pay a debt.';
        const at = +m.at, s = SPACES[at], o = st.own[at];
        if (m.act === 'build') {
          if (!canBuild(st, i, at)) return 'You can\'t build there now.';
          transfer(ctx, i, 'bank', s.house);
          if (o.h < maxHouses(st)) { o.h++; st.houses--; } else { o.h = HOTEL; st.hotels--; st.houses += maxHouses(st); }
          ctx.log(`🏗️ ${me} builds ${o.h === HOTEL ? 'a hotel' : 'a house'} on ${spaceName(b, at)}.`);
        } else if (m.act === 'sell') {
          if (!canSell(st, i, at)) return 'Sell evenly: start with the street that has the most.';
          if (o.h === HOTEL) { const back = Math.min(maxHouses(st), st.houses); st.hotels++; st.houses -= back; o.h = back; transfer(ctx, 'bank', i, s.house / 2 * (1 + maxHouses(st) - back)); }
          else { o.h--; st.houses++; transfer(ctx, 'bank', i, s.house / 2); }
          ctx.log(`🔻 ${me} sells a building on ${spaceName(b, at)}.`);
        } else if (m.act === 'mortgage') {
          if (!canMortgage(st, i, at)) return 'You can\'t mortgage that (sell the buildings in its colour set first).';
          o.mort = true; transfer(ctx, 'bank', i, s.price / 2);
          ctx.log(`🏦 ${me} mortgages ${spaceName(b, at)} for ${money(b, s.price / 2)}.`);
        } else {
          if (!canUnmortgage(st, i, at)) return `You need ${money(b, unmortgageCost(at))} to pay off the mortgage.`;
          transfer(ctx, i, 'bank', unmortgageCost(at)); o.mort = false;
          ctx.log(`🏦 ${me} pays off the mortgage on ${spaceName(b, at)}.`);
        }
        return;
      }
      if (m.act === 'paydebt') {
        if (!debtor) return;
        if (st.cash[i] < debt.n) return `You need ${money(b, debt.n)}: raise ${money(b, debt.n - st.cash[i])} more.`;
        payDebt(ctx, debt); st.debts.shift();
        ctx.log(`✅ ${me} pays ${money(b, debt.n)}.`);
        return nextDebt(ctx);
      }
      if (m.act === 'bankrupt') {
        if (!debtor) return;
        const d = st.debts.shift();
        bankrupt(ctx, i, typeof d.to === 'number' ? d.to : 'bank');
        if (ctx.alive) nextDebt(ctx);
        return;
      }
      if (m.act === 'orderRoll') {
        if (st.step !== 'order' || !mine) return st.step === 'order' ? "It's not your turn to roll." : undefined;
        const d = [1 + ctx.rand(6), 1 + ctx.rand(6)], o = st.order;
        o.rolls.push({ p: i, d, t: d[0] + d[1] });
        st.lastRoll = { p: i, d, sp: null };
        ctx.log(`🎲 ${me} rolled ${d[0] + d[1]} (${d[0]} + ${d[1]}) for turn order.`);
        ctx.say(`${me} rolls ${d[0]} and ${d[1]}: ${d[0] + d[1]}.`);
        if (++o.at < o.queue.length) callRoller(ctx); else finishOrder(ctx);
        return;
      }
      if (!mine) return "It's not your turn.";
      switch (m.act) {
        case 'roll':
          if (st.step !== 'roll') return st.step === 'jail' ? 'You are in jail: pay, use a card, or roll for doubles.' : 'Not now.';
          return doRoll(ctx, i);
        case 'jailpay':
          if (st.step !== 'jail') return;
          if (st.cash[i] < JAIL_FINE) return `You need ${money(b, JAIL_FINE)}.`;
          charge(ctx, i, 'fine', JAIL_FINE); st.jail[i] = -1; st.step = 'roll';
          ctx.log(`🔓 ${me} pays ${money(b, JAIL_FINE)} and leaves jail.`);
          return;
        case 'jailcard': {
          if (st.step !== 'jail' || !st.jailFree[i].length) return;
          const c = st.jailFree[i].shift();
          st.decks[c.deck].push(c.num); st.jail[i] = -1; st.step = 'roll';
          ctx.log(`🔓 ${me} uses a Get Out of Jail Free card.`);
          return;
        }
        case 'jailroll': {
          if (st.step !== 'jail') return;
          const d = [1 + ctx.rand(6), 1 + ctx.rand(6)];
          st.dice = d; st.speed = null; st.lastRoll = { p: i, d, sp: null }; st.again = false; st.pendingFF = false;
          ctx.log(`🎲 ${me} rolls ${d[0]} + ${d[1]} in jail.`);
          if (d[0] === d[1]) { st.jail[i] = -1; ctx.log(`🔓 Doubles: ${me} is out!`); ctx.say(`Doubles! ${me} is out of jail.`); return moveBy(ctx, i, d[0] + d[1]); }
          if (++st.jail[i] >= (st.short ? 1 : 3)) {
            st.jail[i] = -1;
            ctx.log(`🔓 ${me} pays the fine and leaves jail.`);
            charge(ctx, i, 'fine', JAIL_FINE, 'the jail fine');
            return settle(ctx, { k: 'jailmove', n: d[0] + d[1] });
          }
          ctx.log(`🔒 No doubles: ${me} stays in jail.`);
          st.step = 'main';
          return;
        }
        case 'bus': {
          if (st.step !== 'bus') return;
          const d = st.dice;
          return moveBy(ctx, i, m.use === 'a' ? d[0] : m.use === 'b' ? d[1] : d[0] + d[1]);
        }
        case 'goto': {
          const to = +m.to;
          if (st.step !== 'triples') return;
          if (!(to >= 0 && to < 40)) return 'Pick a space.';
          return moveTo(ctx, i, to);
        }
        case 'buy': {
          if (st.step !== 'buy') return;
          const at = st.pos[i], s = SPACES[at];
          if (st.cash[i] < s.price) return `You need ${money(b, s.price)}.`;
          transfer(ctx, i, 'bank', s.price);
          st.own[at] = { p: i, h: 0, mort: false };
          const line = fill(b.say.buy, { p: me, S: spaceName(b, at) });
          ctx.log(`🏷️ ${line}`); ctx.say(line, 'pay');
          st.step = 'moved';
          return afterLanding(ctx);
        }
        case 'decline': {
          if (st.step !== 'buy') return;
          const at = st.pos[i];
          st.step = 'moved';
          if (st.auctions) return startAuction(ctx, at, { k: 'land' });
          ctx.log(`🙅 ${me} leaves ${spaceName(b, at)} with the bank.`);
          return afterLanding(ctx);
        }
        case 'end':
          if (st.step !== 'main') return st.step === 'roll' ? 'Roll the dice first.' : 'Finish what you are doing first.';
          return endTurn(ctx);
      }
    },
    // A player leaves mid-game: bankrupt to the bank (the game goes on, or ends if only one is left)
    playerLeft(ctx, k) {
      const st = ctx.state;
      if (!st || out(st, k)) return;
      st.left[k] = true;
      ctx.log(`👋 ${ctx.players[k].name} left the game.`);
      if (st.step === 'order') {
        const o = st.order;
        st.out[k] = true;
        o.rolls = o.rolls.filter(r => r.p !== k); o.queue = o.queue.filter(q => q !== k); o.at = o.rolls.length;
        if (live(ctx).length < 2) return finish(ctx, live(ctx)[0]);
        if (o.at >= o.queue.length) finishOrder(ctx); else if (st.turn === k) callRoller(ctx);
        return;
      }
      if (st.auction && st.auction.by === k) { st.auction.by = null; st.auction.bid = 0; }
      const wasTurn = st.turn === k, wasDebtor = st.step === 'debt' && st.debts[0] && st.debts[0].p === k;
      st.debts = st.debts.filter(d => d.p !== k);
      bankrupt(ctx, k, 'bank');
      if (!ctx.alive) return;
      if (wasDebtor) return nextDebt(ctx);
      if (st.step === 'auction') return;                            // the auction (or the queue of them) carries on
      if (st.auctionQueue.length) return startAuction(ctx, st.auctionQueue.shift(), { k: wasTurn ? 'turn' : 'none' });
      if (wasTurn) endTurn(ctx);
    },
    lobbyHTML, lobbyAct, lobbyView, lobbyPhoneHTML,
    status(ctx) {
      const st = ctx.state, b = bd(st);
      return st.step === 'order' ? `${b.name} · rolling for turn order` : `${b.name} · ${ctx.players[st.turn].name}'s turn`;
    },
    view(ctx, i) {
      const st = ctx.state, b = bd(st), mine = st.turn === i, debt = st.step === 'debt' ? st.debts[0] : null;
      const canManage = !out(st, i) && ((mine && TRADE_STEPS.includes(st.step)) || (!!debt && debt.p === i));
      const list = f => (canManage ? props(st, i).filter(x => f(st, i, x)) : []);
      return {
        board: st.board, step: st.step, me: i, mine, turn: st.turn, turnName: ctx.players[st.turn].name, out: st.out, left: st.left,
        title: st.step === 'order' ? 'Roll for turn order' : out(st, i) ? 'Watching' : mine ? 'Your turn!' : `${ctx.players[st.turn].name}'s turn`,
        pos: st.pos, own: st.own, cash: st.cash, jail: st.jail, jf: st.jailFree.map(l => l.length), pot: st.pot, houses: st.houses, hotels: st.hotels,
        dice: st.dice, speed: st.speed, lastRoll: st.lastRoll && { ...st.lastRoll, name: ctx.players[st.lastRoll.p].name }, utilRoll: st.utilRoll,
        card: st.card, colors: ctx.players.map(p => p.color),
        auction: st.auction && { i: st.auction.i, bid: st.auction.bid, by: st.auction.by, byName: st.auction.by != null ? ctx.players[st.auction.by].name : null, passed: st.auction.passed.includes(i) },
        debt: debt && { p: debt.p, name: ctx.players[debt.p].name, n: debt.n, to: typeof debt.to === 'number' ? ctx.players[debt.to].name : debt.to === 'each' ? 'every player' : 'the bank', mine: debt.p === i },
        buy: st.step === 'buy' && mine ? { i: st.pos[i], price: SPACES[st.pos[i]].price } : null,
        manage: { on: canManage, build: list(canBuild), sell: list(canSell), mortgage: list(canMortgage), unmortgage: list(canUnmortgage) },
        canTrade: !out(st, i) && TRADE_STEPS.includes(st.step) && (mine || !out(st, st.turn)),
        tradable: ctx.players.map((_, q) => props(st, q).filter(x => tradable(st, q, x))),
        trades: st.trades.filter(t => t.from === i || t.to === i).map(t => ({ ...t, fromName: ctx.players[t.from].name, toName: ctx.players[t.to].name, sent: t.from === i })),
        ordered: st.first != null, rolls: st.order ? st.order.rolls.map(r => ({ name: ctx.players[r.p].name, d: r.d, t: r.t })) : [],
        players: seatOrder(st, ctx.players.length).map(q => ({ i: q, name: ctx.players[q].name, color: ctx.players[q].color, cash: st.cash[q], worth: netWorth(st, q), n: props(st, q).length,
          out: out(st, q), left: !!st.left[q], jail: st.jail[q] >= 0, online: ctx.online ? ctx.online(q) : true })),
        opts: { short: st.short, auctions: st.auctions, speedDie: st.speedDie, jackpot: st.jackpot, doubleGo: st.doubleGo },
        flows: st.flows.slice(-12), gid: st.gid,
      };
    },
    hostHTML(ctx, H) {
      const st = ctx.state, b = bd(st), colors = ctx.players.map(p => p.color), now = Date.now();
      const fx = ctx.bzFx = ctx.bzFx || { seen: 0, flown: 0, glow: {} };
      collectGlows(fx, st.flows, w => (typeof w === 'number' ? w : null), now);
      const p = st.turn, who = H.esc(ctx.players[p].name);
      const head = st.step === 'order'
        ? `<div class="bz-turn"><b>Roll for turn order</b> ${who} to roll ${st.lastRoll ? diceHTML(st.lastRoll.d, null, 'big') : ''}</div>`
        : `<div class="bz-turn" style="--pc:${colors[p]}"><span class="bz-tok">${b.tokens[p % 8]}</span><b>${who}</b> ${stepText[st.step] || ''}${st.dice ? diceHTML(st.dice, st.speed, 'big') : ''}</div>`;
      const card = st.card ? `<div class="bz-card ${st.card.deck}"><small>${st.card.deck === 'fortune' ? '❓ Fortune' : '💰 Treasury'}</small>${H.esc(st.card.text)}${st.utilRoll ? `<div class="note">Rolled for the utility: ${diceHTML(st.utilRoll)}</div>` : ''}</div>` : '';
      const a = st.auction;
      const auction = a ? `<div class="bz-auction"><small>🔨 Auction</small><div class="bz-deed-name" style="--gc:${SPACES[a.i].group ? GROUP[SPACES[a.i].group] : '#555'}">${H.esc(spaceName(b, a.i))} <span>list price ${money(b, SPACES[a.i].price)}</span></div>
        <div class="bz-bid">${a.by != null ? `<b>${money(b, a.bid)}</b> · ${H.esc(ctx.players[a.by].name)}` : 'No bids yet: bid on your phone'}</div></div>` : '';
      const d = st.step === 'debt' && st.debts[0];
      const debt = d ? `<div class="bz-debt">⚠️ <b>${H.esc(ctx.players[d.p].name)}</b> owes ${money(b, d.n)} ${typeof d.to === 'number' ? `to ${H.esc(ctx.players[d.to].name)}` : d.to === 'each' ? 'to every player' : 'to the bank'}: raising money…</div>` : '';
      const glowRow = q => (glowOn(fx.glow[q], now) ? ` bz-glow${fx.glow[q].n > 0 ? ' up' : ' down'}" style="--pc:${colors[q]};animation-delay:-${now - fx.glow[q].t}ms` : `" style="--pc:${colors[q]}`);
      const delta = q => (glowOn(fx.glow[q], now) && fx.glow[q].n ? `<span class="bz-delta ${fx.glow[q].n > 0 ? 'up' : 'down'}" style="animation-delay:-${now - fx.glow[q].t}ms">${fx.glow[q].n > 0 ? '+' : '−'}${money(b, Math.abs(fx.glow[q].n))}</span>` : '');
      const chips = q => props(st, q).map(i => `<i class="bz-chip${st.own[i].mort ? ' mort' : ''}" style="--gc:${SPACES[i].group ? GROUP[SPACES[i].group] : '#666'}" title="${H.esc(spaceName(b, i))}">${st.own[i].h === HOTEL ? 'H' : st.own[i].h || ''}</i>`).join('');
      const rows = seatOrder(st, ctx.players.length).map((q, k) => out(st, q)
        ? `<tr data-p="${q}" class="gone"><td>${st.first != null ? `<span class="ord">${k + 1}</span>` : ''}${b.tokens[q % 8]} ${H.esc(ctx.players[q].name)} <small>${st.left[q] ? 'left' : 'bankrupt'}</small></td><td></td></tr>`
        : `<tr data-p="${q}" class="${q === st.turn && st.step !== 'order' ? 'now' : ''}${glowRow(q)}"><td>${st.first != null ? `<span class="ord">${k + 1}</span>` : ''}<span class="bz-tok" style="--pc:${colors[q]}">${b.tokens[q % 8]}</span>${H.esc(ctx.players[q].name)}${st.jail[q] >= 0 ? ' 🔒' : ''}${st.jailFree[q].length ? ' 🎫' : ''}${delta(q)}<div class="bz-chips">${chips(q)}</div></td>
            <td class="bz-cash">${money(b, st.cash[q])}<small>worth ${money(b, netWorth(st, q))}</small></td></tr>`).join('');
      const trades = st.trades.map(t => `<div class="bz-offer">📣 <b>${H.esc(ctx.players[t.from].name)}</b> → ${H.esc(ctx.players[t.to].name)}: a trade on the table</div>`).join('');
      const rolls = st.order && st.order.rolls.length && st.step === 'order' ? `<div class="bz-rolls">${st.order.rolls.map(r => `<span style="--pc:${colors[r.p]}">${H.esc(ctx.players[r.p].name)} ${diceHTML(r.d)}</span>`).join('')}</div>` : '';
      return `<div class="bz-wrap"><div class="bz-main">${boardSVG({ board: st.board, own: st.own, pos: st.pos, out: st.out, colors, pot: st.pot, turn: st.step === 'order' ? null : st.turn }, { uid: 'h' })}</div>
        <div class="bz-side">${head}${rolls}${auction}${debt}${card}${trades}
          <div class="sec-title">${st.first != null ? 'Turn order · ' : ''}Players</div><table class="bz-players"><tbody>${rows}</tbody></table>
          <div class="bz-bank"><span>🏦 Bank</span><span>🏠 ${st.houses} houses · 🏨 ${st.hotels} hotels left</span>${st.jackpot ? `<span class="bz-pot">🅿️ Jackpot ${money(b, st.pot)}</span>` : ''}</div>
          <div class="note">${st.short ? 'Short game: ends at the first bankruptcy.' : 'Classic: the last one standing wins.'}${st.auctions ? ' Auctions on.' : ''}${st.speedDie ? ' Speed die.' : ''}${st.doubleGo ? ' Double salary on GO.' : ''} <span class="bz-beta">Beta</span></div>
        </div></div>`;
    },
    // After each Mac render: coins fly between the players' rows and the bank
    hostAfter(el, ctx, FX) {
      const st = ctx.state, fx = ctx.bzFx;
      if (!st || !fx) return;
      if (st.fx && st.fx.id > (fx.gavel || 0)) { fx.gavel = st.fx.id; gavelFx(st.fx, FX); }
      const fresh = st.flows.filter(f => f.id > fx.flown);
      if (!fresh.length) return;
      fx.flown = Math.max(...fresh.map(f => f.id));
      if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const at = w => el.querySelector(typeof w === 'number' ? `.bz-players tr[data-p="${w}"]` : w === 'pot' ? '.bz-pot' : '.bz-bank');
      fresh.slice(-8).forEach((f, k) => {
        const a = at(f.from), c = at(f.to);
        if (!a || !c) return;
        const ra = a.getBoundingClientRect(), rc = c.getBoundingClientRect(), x0 = ra.left + Math.min(ra.width / 2, 80), y0 = ra.top + ra.height / 2, x1 = rc.left + Math.min(rc.width / 2, 80), y1 = rc.top + rc.height / 2;
        const coin = document.createElement('div');
        coin.className = 'bz-coin'; coin.textContent = '🪙';
        coin.style.left = x0 + 'px'; coin.style.top = y0 + 'px';
        document.body.appendChild(coin);
        const to = `translate(calc(-50% + ${x1 - x0}px), calc(-50% + ${y1 - y0}px))`;
        coin.animate([{ transform: 'translate(-50%, -50%) scale(.5)', opacity: 0 }, { transform: 'translate(-50%, -50%) scale(1.2)', opacity: 1, offset: 0.15 }, { transform: `${to} scale(.9)`, opacity: 1, offset: 0.85 }, { transform: `${to} scale(.6)`, opacity: 0 }],
          { duration: 1000, delay: k * 120, easing: 'ease-in-out', fill: 'both' }).onfinish = () => coin.remove();
      });
    },
    phoneNotify: (bf, v) => !!v && ((v.mine && (!bf || !bf.mine || (bf.step !== v.step && ['roll', 'jail', 'buy', 'order', 'bus', 'triples'].includes(v.step))))
      || (v.auction && !(bf && bf.auction)) || (v.debt && v.debt.mine && !(bf && bf.debt && bf.debt.mine)) || (v.trades.some(t => !t.sent) && !(bf && bf.trades.some(t => !t.sent)))),
    phoneLocal(d, v, local) {
      const toggle = (list, x) => { local[list] = local[list] || []; local[list] = local[list].includes(x) ? local[list].filter(y => y !== x) : [...local[list], x]; };
      if (d.local === 'tab') local.tab = d.tab;
      if (d.local === 'tp') { local.tp = +d.p; local.wp = []; local.wj = 0; }
      if (d.local === 'cash') local[d.list] = Math.max(0, (local[d.list] || 0) + +d.n);
      if (d.local === 'prop') toggle(d.list, +d.at);
      if (d.local === 'jf') local[d.list] = local[d.list] ? 0 : 1;
      if (d.local === 'bk') local.bk = !local.bk;
    },
    phoneAct(m, v, local) { if (m.act === 'offer') Object.assign(local, { gc: 0, wc: 0, gp: [], wp: [], gj: 0, wj: 0 }); if (m.act === 'bankrupt') local.bk = false; },
    phoneHTML(v, local, H) {
      const b = BOARDS[v.board] || BOARDS.newyork, me = v.me, now = Date.now(), fm = n => money(b, n);
      if (!local.fx || local.fx.gid !== v.gid) local.fx = { gid: v.gid, seen: Math.max(0, ...(v.flows || []).map(f => f.id)), glow: {} };
      collectGlows(local.fx, v.flows || [], w => (w === me ? 'me' : null), now);
      const g = local.fx.glow.me, glow = glowOn(g, now) ? ` bz-glow${g.n > 0 ? ' up' : ' down'}" style="animation-delay:-${now - g.t}ms"` : '"';
      const nameOf = i => H.esc(spaceName(b, i)), gc = i => (SPACES[i].group ? GROUP[SPACES[i].group] : '#666');
      const pick = v.step === 'triples' && v.mine ? [...Array(40).keys()] : null;
      const board = `<div class="bz-phone-board">${boardSVG({ board: v.board, own: v.own, pos: v.pos, out: v.out, colors: v.colors, pot: v.pot, turn: v.step === 'order' ? null : v.turn }, { pick, uid: 'p' })}</div>`;
      const meBar = `<div class="bz-me"><span class="bz-tok" style="--pc:${v.colors[me]}">${b.tokens[me % 8]}</span><span class="bz-money${glow}>${fm(v.cash[me])}</span>${v.jail[me] >= 0 ? '<span>🔒 in jail</span>' : ''}${v.jf[me] ? '<span>🎫 jail-free card</span>' : ''}<span class="bz-pos">📍 ${nameOf(v.pos[me])}</span>${v.dice ? diceHTML(v.dice, v.speed) : ''}</div>`;
      const card = v.card ? `<div class="bz-card ${v.card.deck}"><small>${v.card.deck === 'fortune' ? '❓ Fortune' : '💰 Treasury'} · ${H.esc(v.players.find(p => p.i === v.card.p)?.name || '')}</small>${H.esc(v.card.text)}</div>` : '';
      let act = '';
      if (v.out[me]) act = '<div class="note" style="text-align:center">You are out of this game: watch the board.</div>';
      else if (v.auction) {
        const a = v.auction, top = a.by === me;
        act = `<div class="bz-auction"><small>🔨 Auction</small><div class="bz-deed-name" style="--gc:${gc(a.i)}">${nameOf(a.i)} <span>list price ${fm(SPACES[a.i].price)}</span></div>
          <div class="bz-bid">${a.by != null ? `Top bid <b>${fm(a.bid)}</b> · ${top ? 'you!' : H.esc(a.byName)}` : 'No bids yet'}</div>
          <div class="choice">${BIDS.map(n => `<button type="button" data-act="bid" data-add="${n}" ${!top && v.cash[me] >= a.bid + n ? '' : 'disabled'}>+${fm(n)}</button>`).join('')}</div>
          ${top ? '<div class="note">You have the top bid.</div>' : a.passed ? '<div class="note">You passed.</div>' : '<button class="go" type="button" data-act="apass" style="background:#334155;color:#fff">Pass</button>'}</div>`;
      } else if (v.debt && v.debt.mine) {
        const d = v.debt, enough = v.cash[me] >= d.n;
        act = `<div class="bz-debt">You owe <b>${fm(d.n)}</b> to ${H.esc(d.to)}. You have ${fm(v.cash[me])}.${enough ? '' : ` Raise ${fm(d.n - v.cash[me])} more: sell buildings or mortgage below${v.mine ? ', or trade' : ''}.`}</div>
          <button class="go" type="button" data-act="paydebt" ${enough ? '' : 'disabled'}>Pay ${fm(d.n)}</button>
          ${local.bk ? '<div class="choice"><button type="button" class="red" data-act="bankrupt">Yes, declare bankruptcy</button><button type="button" data-local="bk">Cancel</button></div>' : '<button class="go red" type="button" data-local="bk">Declare bankruptcy…</button>'}`;
      } else if (v.debt) act = `<div class="note" style="text-align:center">${H.esc(v.debt.name)} owes ${fm(v.debt.n)} and is raising money…</div>`;
      else if (v.step === 'order') act = v.mine ? '<button class="go" type="button" data-act="orderRoll">🎲 Roll for turn order</button>' : `<div class="note" style="text-align:center">${H.esc(v.turnName)} is rolling for turn order…</div>`;
      else if (v.mine) {
        if (v.step === 'roll') act = '<button class="go" type="button" data-act="roll">🎲 Roll the dice</button>';
        else if (v.step === 'jail') act = `<div class="bz-alert">🔒 You're in jail.</div><div class="choice"><button type="button" data-act="jailpay" ${v.cash[me] >= JAIL_FINE ? '' : 'disabled'}>Pay ${fm(JAIL_FINE)}</button>${v.jf[me] ? '<button type="button" data-act="jailcard">🎫 Use card</button>' : ''}<button type="button" data-act="jailroll">🎲 Roll for doubles</button></div>`;
        else if (v.step === 'buy') act = `<div class="bz-buy" style="--gc:${gc(v.buy.i)}"><div class="bz-deed-name">${nameOf(v.buy.i)}</div>${SPACES[v.buy.i].rents ? `<div class="note">Rent ${fm(SPACES[v.buy.i].rents[0])} · with houses up to ${fm(SPACES[v.buy.i].rents[5])}</div>` : ''}</div>
            <button class="go" type="button" data-act="buy" ${v.cash[me] >= v.buy.price ? '' : 'disabled'}>Buy for ${fm(v.buy.price)}</button>
            <button class="go" type="button" data-act="decline" style="background:#334155;color:#fff">${v.opts.auctions ? 'Auction it' : 'Leave it'}</button>`;
        else if (v.step === 'bus') act = `<div class="bz-alert">🚌 The bus: move by one die or both.</div><div class="choice"><button type="button" data-act="bus" data-use="a">${v.dice[0]}</button><button type="button" data-act="bus" data-use="b">${v.dice[1]}</button><button type="button" data-act="bus" data-use="sum">${v.dice[0] + v.dice[1]}</button></div>`;
        else if (v.step === 'triples') act = '<div class="bz-alert">Triples! Tap any space on the board to move there.</div>';
        else if (v.step === 'main') act = '<button class="go red" type="button" data-act="end">End turn</button>';
      } else act = `<div class="note" style="text-align:center">${H.esc(v.turnName)} is playing…</div>`;
      // trades on the table for me
      const what = (x, p) => [x.cash ? fm(x.cash) : '', ...x.props.map(nameOf), x.jf ? '🎫 jail-free card' : ''].filter(Boolean).join(', ');
      const trades = (v.trades || []).map(t => t.sent
        ? `<div class="bz-offer">📣 You offer ${H.esc(t.toName)} ${what(t.give)} for ${what(t.want)} <button class="mini" type="button" data-act="twithdraw">withdraw</button></div>`
        : `<div class="bz-offer">📣 <b>${H.esc(t.fromName)}</b> offers you ${what(t.give)} for your ${what(t.want)}<div class="choice"><button type="button" data-act="treply" data-id="${t.id}" data-r="accept">✅ Accept</button><button type="button" data-act="treply" data-id="${t.id}" data-r="decline">✖ No thanks</button></div></div>`).join('');
      // my deeds: build, sell, mortgage
      const M = v.manage, my = OWNABLE.filter(i => v.own[i] && v.own[i].p === me);
      const deeds = my.length ? my.map(i => {
        const o = v.own[i], btn = (a, label, ok) => (ok ? `<button type="button" class="mini" data-act="${a}" data-at="${i}">${label}</button>` : '');
        const lvl = o.h === HOTEL ? '🏨' : '🏠'.repeat(o.h);
        return `<div class="bz-deed${o.mort ? ' mort' : ''}" style="--gc:${gc(i)}"><span class="nm">${nameOf(i)} ${lvl}${o.mort ? ' <small>mortgaged</small>' : ''}</span><span class="acts">${btn('build', `+🏠 ${fm(SPACES[i].house || 0)}`, M.build.includes(i))}${btn('sell', '−🏠', M.sell.includes(i))}${btn('mortgage', `Mortgage +${fm(SPACES[i].price / 2)}`, M.mortgage.includes(i))}${btn('unmortgage', `Pay off ${fm(unmortgageCost(i))}`, M.unmortgage.includes(i))}</span></div>`;
      }).join('') : '<div class="note">No properties yet.</div>';
      // the trade builder
      let tradeBox = '';
      if (v.canTrade && !v.debt) {
        const others = v.players.filter(p => p.i !== me && !p.out), partner = v.mine ? (others.some(p => p.i === local.tp) ? local.tp : others[0]?.i) : v.turn;
        const sel = l => local[l] || [], stepper = (list, label, max) => `<div class="bz-step"><span>${label}: <b>${fm(local[list] || 0)}</b></span>${[-100, -10, 10, 100].map(n => `<button type="button" class="mini" data-local="cash" data-list="${list}" data-n="${n}" ${(local[list] || 0) + n < 0 || (local[list] || 0) + n > max ? 'disabled' : ''}>${n > 0 ? '+' : '−'}${fm(Math.abs(n))}</button>`).join('')}</div>`;
        const chipsFor = (p, list) => (v.tradable[p] || []).map(i => `<button type="button" class="bz-pchip${sel(list).includes(i) ? ' on' : ''}" style="--gc:${gc(i)}" data-local="prop" data-list="${list}" data-at="${i}">${nameOf(i)}</button>`).join('') || '<span class="note">nothing to trade</span>';
        if (partner != null) {
          const gp = sel('gp').filter(i => (v.tradable[me] || []).includes(i)), wp = sel('wp').filter(i => (v.tradable[partner] || []).includes(i));
          const ok = (local.gc || gp.length || local.gj) && (local.wc || wp.length || local.wj);
          tradeBox = `${v.mine ? `<div class="sec-title">Trade with</div><div class="bz-to">${others.map(p => `<button type="button" class="${p.i === partner ? 'on' : ''}" data-local="tp" data-p="${p.i}" style="--pc:${p.color}" ${p.online ? '' : 'disabled'}>${H.esc(p.name)}</button>`).join('')}</div>` : `<div class="sec-title">Ask ${H.esc(v.turnName)} for a trade</div>`}
            <div class="bz-tside"><b>You give</b>${stepper('gc', 'Money', v.cash[me])}<div class="bz-pchips">${chipsFor(me, 'gp')}</div>${v.jf[me] ? `<button type="button" class="bz-pchip${local.gj ? ' on' : ''}" data-local="jf" data-list="gj">🎫 jail-free card</button>` : ''}</div>
            <div class="bz-tside"><b>You get</b>${stepper('wc', 'Money', v.cash[partner])}<div class="bz-pchips">${chipsFor(partner, 'wp')}</div>${v.jf[partner] ? `<button type="button" class="bz-pchip${local.wj ? ' on' : ''}" data-local="jf" data-list="wj">🎫 their jail-free card</button>` : ''}</div>
            <button class="go" type="button" data-act="offer" data-to="${partner}" data-gc="${local.gc || 0}" data-wc="${local.wc || 0}" data-gp="${gp.join(',')}" data-wp="${wp.join(',')}" data-gj="${local.gj || 0}" data-wj="${local.wj || 0}" ${ok ? '' : 'disabled'}>📣 Offer the trade</button>`;
        }
      }
      const tab = local.tab || 'deeds';
      const tabs = (M.on || tradeBox) ? `<div class="bz-tabs"><button type="button" data-local="tab" data-tab="deeds" class="${tab === 'deeds' ? 'on' : ''}">🏠 My properties</button>${tradeBox ? `<button type="button" data-local="tab" data-tab="trade" class="${tab === 'trade' ? 'on' : ''}">🤝 Trade</button>` : ''}</div>${tab === 'trade' && tradeBox ? tradeBox : `<div class="bz-deeds">${deeds}</div>`}` : `<div class="sec-title">My properties</div><div class="bz-deeds">${deeds}</div>`;
      const players = `<div class="sec-title">${v.ordered ? 'Turn order' : 'Players'}</div><div class="pills">${v.players.map((p, k) => `<span class="p${p.out ? ' gone' : ''}" style="box-shadow:inset 3px 0 0 ${p.color}">${v.ordered ? `<span class="ord">${k + 1}</span>` : ''}${b.tokens[p.i % 8]} ${H.esc(p.name)} ${p.out ? (p.left ? 'left' : 'bankrupt') : fm(p.cash)}${p.jail ? ' 🔒' : ''}</span>`).join('')}</div>`;
      return board + meBar + card + act + trades + tabs + players;
    },
    css: `
      .bz-wrap { display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 18px; align-items: start; }
      @media (max-width: 1100px) { .bz-wrap { grid-template-columns: 1fr; } }
      .bz-board { width: 100%; height: auto; display: block; border-radius: 10px; box-shadow: 0 10px 30px rgba(0,0,0,.4); }
      .bz-main .bz-board { max-height: 84vh; }
      .bz-turn { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 10px; background: rgba(0,0,0,.3); border-left: 5px solid var(--pc, #888); }
      .bz-tok { display: inline-grid; place-items: center; width: 28px; height: 28px; border-radius: 50%; background: var(--pc, #888); border: 2px solid #fff; font-size: 1rem; margin-right: 6px; vertical-align: middle; }
      .bz-dice { margin-left: auto; display: inline-flex; align-items: center; gap: 4px; }
      .bz-dice b { font-size: 1.1rem; margin-left: 4px; }
      .bz-die { display: inline-grid; grid-template: repeat(3, 1fr) / repeat(3, 1fr); gap: 1px; width: 24px; height: 24px; padding: 3px; box-sizing: border-box; border-radius: 6px; background: #fffdf5; box-shadow: inset 0 -2px 0 #d6cfbf, 0 2px 4px rgba(0,0,0,.4); vertical-align: middle; }
      .bz-die i { border-radius: 50%; } .bz-die i.on { background: #1b1b1b; }
      .bz-die.speed { background: #ffd23f; } .bz-die.face { display: inline-grid; place-items: center; grid-template: none; font-size: .9rem; }
      .bz-dice.big .bz-die { width: 36px; height: 36px; padding: 5px; gap: 2px; border-radius: 8px; } .bz-dice.big b { font-size: 1.5rem; }
      .bz-card { margin: 10px 0; padding: 10px 12px; border-radius: 10px; background: #fff8e1; color: #2b2b2b; font-weight: 700; box-shadow: 0 4px 12px rgba(0,0,0,.3); }
      .bz-card.fortune { background: #ffe8d6; } .bz-card.treasury { background: #e0f2e9; }
      .bz-card small { display: block; font-size: .72rem; letter-spacing: .06em; text-transform: uppercase; opacity: .7; margin-bottom: 4px; }
      .bz-auction, .bz-debt, .bz-buy { margin: 10px 0; padding: 10px 12px; border-radius: 10px; background: rgba(212,175,55,.18); border: 1px solid rgba(212,175,55,.6); }
      .bz-debt { background: rgba(192,38,45,.2); border-color: rgba(255,180,183,.6); }
      .bz-auction small { font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }
      .bz-deed-name { font-weight: 900; font-size: 1.1rem; border-left: 8px solid var(--gc, #666); padding-left: 8px; margin: 4px 0; }
      .bz-deed-name span { font-weight: 600; font-size: .8rem; opacity: .75; }
      .bz-buy .bz-deed-name { border-left-color: var(--gc); }
      .bz-bid { font-size: 1.05rem; } .bz-bid b { color: var(--gold, #d4af37); font-size: 1.3rem; }
      .bz-players { width: 100%; border-collapse: collapse; font-size: .9rem; }
      .bz-players td { padding: 6px 4px; border-bottom: 1px solid rgba(255,255,255,.1); vertical-align: top; }
      .bz-players tr.now td { background: rgba(255,255,255,.07); } .bz-players tr.gone td { opacity: .45; }
      .bz-players .bz-cash { text-align: right; font-weight: 900; color: var(--gold, #d4af37); white-space: nowrap; } .bz-players .bz-cash small { display: block; font-weight: 600; color: var(--muted, #b9c4bc); font-size: .72rem; }
      .bz-chips { display: flex; flex-wrap: wrap; gap: 2px; margin-top: 4px; }
      .bz-chip { display: inline-grid; place-items: center; width: 14px; height: 14px; border-radius: 3px; background: var(--gc); font-style: normal; font-size: .55rem; font-weight: 900; color: #fff; text-shadow: 0 0 2px #000; }
      .bz-chip.mort { opacity: .35; }
      .bz-players tr.bz-glow td { animation: bzRow ${GLOW_MS}ms ease-out both; animation-delay: inherit; }
      @keyframes bzRow { 0%, 100% { background: transparent; } 12%, 55% { background: rgba(255,255,255,.18); } }
      .bz-delta { margin-left: 8px; font-size: .82rem; font-weight: 900; animation: bzBadge ${GLOW_MS}ms ease-out both; } .bz-delta.up { color: #4ade80; } .bz-delta.down { color: #f87171; }
      @keyframes bzBadge { 0% { opacity: 0; transform: translateY(5px); } 10%, 75% { opacity: 1; transform: none; } 100% { opacity: 0; } }
      .bz-bank { display: flex; flex-wrap: wrap; gap: 10px; margin: 10px 0; padding: 8px 10px; border-radius: 10px; background: rgba(0,0,0,.25); font-size: .85rem; }
      .bz-pot { color: #4ade80; font-weight: 800; }
      .bz-beta { display: inline-block; padding: 1px 8px; border-radius: 99px; background: #7c3aed; color: #fff; font-weight: 800; font-size: .72rem; }
      .bz-rolls { display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0; } .bz-rolls span { padding: 4px 10px; border-radius: 99px; background: rgba(0,0,0,.3); border-left: 4px solid var(--pc); }
      .bz-offer { margin: 8px 0; padding: 8px 10px; border-radius: 10px; background: rgba(212,175,55,.15); border: 1px solid rgba(212,175,55,.5); font-size: .9rem; }
      .bz-coin { position: fixed; z-index: 60; font-size: 1.6rem; pointer-events: none; filter: drop-shadow(0 4px 6px rgba(0,0,0,.4)); }
      @media (prefers-reduced-motion: reduce) { .bz-coin { display: none; } }
      .ord { display: inline-grid; place-items: center; width: 20px; height: 20px; margin-right: 6px; border-radius: 50%; background: var(--gold, #d4af37); color: #1d1500; font-size: .75rem; font-weight: 900; vertical-align: middle; }
      .bz-phone-board { margin: 0 -8px 8px; }
      .bz-token .bz-ring { animation: bzRing 1.2s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
      @keyframes bzRing { 0%, 100% { opacity: .95; transform: scale(1); } 50% { opacity: .2; transform: scale(1.25); } }
      @media (prefers-reduced-motion: reduce) { .bz-token .bz-ring { animation: none; } }
      .bz-pick { cursor: pointer; } .bz-pick rect:first-child { animation: bzPick 1s ease-in-out infinite alternate; }
      @keyframes bzPick { from { opacity: 1; } to { opacity: .55; } }
      .bz-me { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin: 6px 2px; font-weight: 700; }
      .bz-money { font-size: 1.5rem; font-weight: 900; color: var(--gold, #d4af37); padding: 2px 8px; border-radius: 8px; }
      .bz-money.bz-glow.up { animation: bzUp ${GLOW_MS}ms ease-out both; } .bz-money.bz-glow.down { animation: bzDown ${GLOW_MS}ms ease-out both; }
      @keyframes bzUp { 0%, 100% { box-shadow: none; } 12%, 60% { box-shadow: 0 0 0 3px #4ade80, 0 0 18px #4ade80; } }
      @keyframes bzDown { 0%, 100% { box-shadow: none; } 12%, 60% { box-shadow: 0 0 0 3px #f87171, 0 0 18px #f87171; } }
      .bz-pos { font-size: .85rem; opacity: .85; }
      .bz-alert { margin: 10px 0; padding: 10px 12px; border-radius: 10px; background: rgba(212,175,55,.2); font-weight: 800; text-align: center; }
      .bz-tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin: 12px 0 8px; }
      .bz-tabs button, .bz-to button { padding: 10px; border-radius: 10px; border: 2px solid rgba(255,255,255,.25); background: rgba(0,0,0,.3); color: inherit; font: inherit; font-weight: 800; }
      .bz-tabs button.on, .bz-to button.on { border-color: var(--gold, #d4af37); background: rgba(212,175,55,.22); }
      .bz-to { display: flex; flex-wrap: wrap; gap: 6px; } .bz-to button { box-shadow: inset 4px 0 0 var(--pc); padding: 8px 12px; } .bz-to button:disabled { opacity: .45; }
      .bz-deeds { display: grid; gap: 6px; }
      .bz-deed { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px; padding: 8px 10px; border-radius: 10px; background: rgba(0,0,0,.25); border-left: 8px solid var(--gc); }
      .bz-deed.mort { opacity: .7; } .bz-deed .nm { font-weight: 800; } .bz-deed .acts { display: flex; flex-wrap: wrap; gap: 4px; }
      .bz-deed .mini, .bz-step .mini { padding: 6px 9px; font-size: .8rem; }
      .bz-tside { margin: 10px 0; padding: 8px 10px; border-radius: 10px; background: rgba(0,0,0,.22); }
      .bz-step { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; margin: 6px 0; } .bz-step > span { margin-right: auto; }
      .bz-pchips { display: flex; flex-wrap: wrap; gap: 5px; margin: 6px 0; }
      .bz-pchip { padding: 6px 10px; border-radius: 99px; border: 2px solid rgba(255,255,255,.25); background: rgba(0,0,0,.3); color: inherit; font: inherit; font-size: .82rem; font-weight: 700; box-shadow: inset 6px 0 0 var(--gc, #666); }
      .bz-pchip.on { border-color: var(--gold, #d4af37); background: rgba(212,175,55,.3); }
      .pills .p.gone { opacity: .45; text-decoration: line-through; }
      .mini { padding: 2px 8px; border-radius: 6px; border: 1px solid rgba(255,255,255,.4); background: rgba(0,0,0,.3); color: inherit; font: inherit; font-size: .75rem; }
      .mini:disabled { opacity: .35; }
      .bz-lobby { display: grid; grid-template-columns: 180px 1fr; gap: 14px; align-items: center; margin: 10px 0; }
      .bz-lobby-prev .bz-board, .bz-vote-board .bz-board { box-shadow: 0 6px 16px rgba(0,0,0,.4); }
      .bz-facts { margin-bottom: 10px; line-height: 1.5; }
      .bz-show { position: fixed; inset: 0; z-index: 40; display: grid; grid-template-columns: minmax(0, 1fr) 420px; gap: 24px; padding: 24px; background: radial-gradient(circle at 35% 40%, #12402a, #04140c 75%); }
      .bz-show-board { display: grid; place-items: center; min-height: 0; } .bz-show-board .bz-board { max-height: calc(100vh - 48px); width: auto; max-width: 100%; }
      .bz-show-side { display: flex; flex-direction: column; gap: 14px; overflow: auto; }
      .bz-show-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; text-align: center; }
      .bz-show-head h2 { margin: 0; font-family: Georgia, serif; color: var(--gold, #d4af37); font-size: 2rem; } .bz-show-head span { color: var(--muted, #b9c4bc); }
      .bz-show-head .btn { font-size: 1.4rem; padding: 10px 18px; }
      .bz-strip { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
      .bz-strip-b { display: flex; justify-content: space-between; gap: 6px; padding: 8px 10px; border-radius: 10px; border: 2px solid rgba(255,255,255,.2); background: rgba(0,0,0,.3); color: inherit; font: inherit; cursor: pointer; }
      .bz-strip-b.on { border-color: var(--gold, #d4af37); background: rgba(212,175,55,.25); } .bz-strip-b span { color: #4ade80; font-weight: 800; }
      .bz-show-join { display: flex; gap: 14px; align-items: center; padding: 12px; border-radius: 12px; background: rgba(0,0,0,.3); }
      .bz-show-join img { width: 120px; height: 120px; background: #fff; border-radius: 8px; padding: 5px; } .bz-show-join code { display: block; margin: 6px 0; }
      .bz-show-players { display: flex; flex-wrap: wrap; gap: 6px; } .bz-show-players span { padding: 3px 10px; border-radius: 99px; background: rgba(0,0,0,.35); border-left: 4px solid var(--pc, #888); }
      .bz-show-go { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; } .bz-show-go .primary { font-size: 1.15rem; padding: 12px 22px; }
      .bz-vote-board { margin: 6px 0 10px; }
      .bz-vote-list { display: grid; gap: 6px; }
      .bz-vote-list button { display: grid; grid-template-columns: 1fr auto; text-align: left; gap: 0 8px; padding: 10px 12px; border-radius: 10px; border: 2px solid rgba(255,255,255,.2); background: rgba(0,0,0,.3); color: inherit; font: inherit; }
      .bz-vote-list button span { font-weight: 800; } .bz-vote-list button small { grid-column: 1; opacity: .75; } .bz-vote-list button b { grid-row: 1 / 3; grid-column: 2; align-self: center; }
      .bz-vote-list button.on { border-color: #4ade80; background: rgba(74,222,128,.18); } .bz-vote-list button.now { box-shadow: inset 5px 0 0 var(--gold, #d4af37); }
      .bz-gavel-fx { position: fixed; inset: 0; z-index: 46; pointer-events: none; display: grid; place-items: center; overflow: hidden; background: radial-gradient(circle at center, rgba(120,72,24,.65), rgba(20,10,4,.92) 64%); animation: bzFxIn .3s ease both; }
      .bz-gavel-fx.out { animation: bzFxOut .6s ease both; }
      .bz-gavel-fx .rays { position: absolute; width: 220vmax; height: 220vmax; border-radius: 50%; background: repeating-conic-gradient(rgba(212,175,55,.22) 0 7deg, transparent 7deg 18deg); animation: bzRays 24s linear infinite; }
      .bz-gavel-fx .gavel { position: absolute; width: min(44vmin, 420px); top: 14vh; left: 50%; margin-left: max(-12vmin, -110px); transform-origin: 85% 90%; animation: bzPound .5s cubic-bezier(.5,0,.75,0) .0s 3 both; filter: drop-shadow(0 12px 18px rgba(0,0,0,.6)); }
      .bz-gavel-fx.sold .gavel { animation: bzPound .55s cubic-bezier(.5,0,.75,0) .0s 1 both; }
      .bz-gavel-fx .block { position: absolute; top: calc(14vh + min(36vmin, 340px)); width: min(36vmin, 340px); height: min(7vmin, 66px); border-radius: 10px; background: linear-gradient(#a0682f, #5c3a1c); border: 4px solid #3b2414; box-shadow: 0 10px 20px rgba(0,0,0,.5); }
      .bz-gavel-fx .wave { position: absolute; top: calc(14vh + min(36vmin, 340px)); width: 12vmin; height: 12vmin; margin-top: -6vmin; border-radius: 50%; border: 6px solid var(--gold, #d4af37); opacity: 0; animation: bzWave .7s ease-out both; }
      .bz-gavel-fx .title { position: absolute; bottom: 20vh; font-family: Georgia, serif; font-weight: 900; font-size: min(16vw, 15vh); color: #ffe8a3; -webkit-text-stroke: max(2px, .4vmin) #7a4b12; text-shadow: 0 0 30px rgba(212,175,55,.9), 0 8px 0 rgba(0,0,0,.4); letter-spacing: .06em; animation: bzPop .9s cubic-bezier(.2,1.4,.4,1) .4s both; }
      .bz-gavel-fx .sub { position: absolute; bottom: 12vh; padding: 6px 18px; border-radius: 99px; background: rgba(0,0,0,.45); border-left: 10px solid var(--gc); color: #fff; font-weight: 800; font-size: clamp(1rem, 3vw, 2rem); animation: bzPop .8s ease .7s both; }
      .bz-gavel-fx.calm .gavel, .bz-gavel-fx.calm .wave, .bz-gavel-fx.calm .rays { animation: none; }
      @keyframes bzFxIn { from { opacity: 0; } to { opacity: 1; } } @keyframes bzFxOut { to { opacity: 0; } }
      @keyframes bzRays { to { transform: rotate(360deg); } }
      @keyframes bzPound { 0% { transform: rotate(-42deg); } 80% { transform: rotate(8deg); } 90% { transform: rotate(4deg); } 100% { transform: rotate(-42deg); } }
      @keyframes bzWave { 0% { opacity: .9; transform: scale(.3); } 100% { opacity: 0; transform: scale(3.2); } }
      @keyframes bzPop { 0% { opacity: 0; transform: scale(.4); } 100% { opacity: 1; transform: none; } }`,
  };
  return api;
})();
