/* =========================================================
   Which club each player is on in each game edition.
   e18 = FIFA 18 (2017-18)   e24 = EA FC 24 (2023-24)
   e26 = EA FC 26 (2025-26)
   Values: a club name, "LEGEND" (retired -> Icons/Legends group),
           or null (not in that game yet — too young / not pro).
   These follow the real club each player was at that season.
   ========================================================= */
const FC_TEAMS = {
  "Cristiano Ronaldo":   { e18:"Real Madrid",        e24:"Al-Nassr",           e26:"Al-Nassr" },
  "Lionel Messi":        { e18:"Barcelona",          e24:"Inter Miami",        e26:"Inter Miami" },
  "Kylian Mbappé":       { e18:"PSG",                e24:"PSG",                e26:"Real Madrid" },
  "Erling Haaland":      { e18:null,                 e24:"Manchester City",    e26:"Manchester City" },
  "Jude Bellingham":     { e18:null,                 e24:"Real Madrid",        e26:"Real Madrid" },
  "Mohamed Salah":       { e18:"Liverpool",          e24:"Liverpool",          e26:"Liverpool" },
  "Lamine Yamal":        { e18:null,                 e24:"Barcelona",          e26:"Barcelona" },
  "Neymar":              { e18:"PSG",                e24:"Al-Hilal",           e26:"Santos" },
  "Vinícius Júnior":     { e18:"Flamengo",           e24:"Real Madrid",        e26:"Real Madrid" },
  "Harry Kane":          { e18:"Tottenham Hotspur",  e24:"Bayern Munich",      e26:"Bayern Munich" },
  "Pelé":                { e18:"LEGEND",             e24:"LEGEND",             e26:"LEGEND" },
  "Ronaldinho":          { e18:"LEGEND",             e24:"LEGEND",             e26:"LEGEND" },
  "David Beckham":       { e18:"LEGEND",             e24:"LEGEND",             e26:"LEGEND" },
  "Zinedine Zidane":     { e18:"LEGEND",             e24:"LEGEND",             e26:"LEGEND" },
  "Thierry Henry":       { e18:"LEGEND",             e24:"LEGEND",             e26:"LEGEND" },
  "Zlatan Ibrahimović":  { e18:"Manchester United",  e24:"LEGEND",             e26:"LEGEND" },
  "Diego Maradona":      { e18:"LEGEND",             e24:"LEGEND",             e26:"LEGEND" },
  "Cole Palmer":         { e18:null,                 e24:"Chelsea",            e26:"Chelsea" },
  "Ousmane Dembélé":     { e18:"Barcelona",          e24:"PSG",                e26:"PSG" },
  "Raphinha":            { e18:null,                 e24:"Barcelona",          e26:"Barcelona" },
  "Bukayo Saka":         { e18:null,                 e24:"Arsenal",            e26:"Arsenal" },
  "Florian Wirtz":       { e18:null,                 e24:"Bayer Leverkusen",   e26:"Liverpool" },
  "Jack Jewsbury":       { e18:"LEGEND",             e24:"LEGEND",             e26:"LEGEND" },
  "Diego Valeri":        { e18:"Portland Timbers",   e24:"LEGEND",             e26:"LEGEND" },
  "Darlington Nagbe":    { e18:"Portland Timbers",   e24:"Columbus Crew",      e26:"Columbus Crew" },
  "Achraf Hakimi":       { e18:"Real Madrid",        e24:"PSG",                e26:"PSG" },
  "Alisson Becker":      { e18:"Roma",               e24:"Liverpool",          e26:"Liverpool" },
  "David De Gea":        { e18:"Manchester United",  e24:null,                 e26:"Fiorentina" },
  "Harry Maguire":       { e18:"Leicester City",     e24:"Manchester United",  e26:"Manchester United" },
  "Paolo Maldini":       { e18:"LEGEND",             e24:"LEGEND",             e26:"LEGEND" },
  "Sergio Ramos":        { e18:"Real Madrid",        e24:"Sevilla",            e26:"Monterrey" },
  "Manuel Neuer":        { e18:"Bayern Munich",      e24:"Bayern Munich",      e26:"Bayern Munich" },
  "Gabriel Jesus":       { e18:"Manchester City",    e24:"Arsenal",            e26:"Arsenal" },
  "Alphonso Davies":     { e18:"Vancouver Whitecaps",e24:"Bayern Munich",      e26:"Bayern Munich" },
  "Iker Casillas":       { e18:"FC Porto",           e24:"LEGEND",             e26:"LEGEND" },
  "Clive Charles":       { e18:"LEGEND",             e24:"LEGEND",             e26:"LEGEND" },
  "Bernardo Silva":      { e18:"Manchester City",    e24:"Manchester City",    e26:"Manchester City" },
  "Bruno Fernandes":     { e18:"Sporting CP",        e24:"Manchester United",  e26:"Manchester United" },
  "Christian Pulisic":   { e18:"Borussia Dortmund",  e24:"AC Milan",           e26:"AC Milan" },
  "Dani Carvajal":       { e18:"Real Madrid",        e24:"Real Madrid",        e26:"Real Madrid" },
  "Declan Rice":         { e18:"West Ham United",    e24:"Arsenal",            e26:"Arsenal" },
  "Désiré Doué":         { e18:null,                 e24:"Rennes",             e26:"PSG" },
  "Diego Chará":         { e18:"Portland Timbers",   e24:"Portland Timbers",   e26:"Portland Timbers" },
  "Emiliano Martínez":   { e18:"Arsenal",            e24:"Aston Villa",        e26:"Aston Villa" },
  "Federico Valverde":   { e18:"Real Madrid",        e24:"Real Madrid",        e26:"Real Madrid" },
  "Jamal Musiala":       { e18:null,                 e24:"Bayern Munich",      e26:"Bayern Munich" },
  "João Félix":          { e18:null,                 e24:"Barcelona",          e26:"Al-Nassr" },
  "João Neves":          { e18:null,                 e24:"Benfica",            e26:"PSG" },
  "Johan Cruyff":        { e18:"LEGEND",             e24:"LEGEND",             e26:"LEGEND" },
  "Joshua Kimmich":      { e18:"Bayern Munich",      e24:"Bayern Munich",      e26:"Bayern Munich" },
  "Kaká":                { e18:"Orlando City",       e24:"LEGEND",             e26:"LEGEND" },
  "Karim Benzema":       { e18:"Real Madrid",        e24:"Al-Ittihad",         e26:"Al-Ittihad" },
  "Kevin De Bruyne":     { e18:"Manchester City",    e24:"Manchester City",    e26:"Napoli" },
  "Luka Modrić":         { e18:"Real Madrid",        e24:"Real Madrid",        e26:"AC Milan" },
  "Luis Suárez":         { e18:"Barcelona",          e24:"Grêmio",             e26:"Inter Miami" },
  "Marc Cucurella":      { e18:null,                 e24:"Chelsea",            e26:"Chelsea" },
  "Marcelo":             { e18:"Real Madrid",        e24:"Fluminense",         e26:"LEGEND" },
  "Martin Ødegaard":     { e18:"Real Madrid",        e24:"Arsenal",            e26:"Arsenal" },
  "Michael Olise":       { e18:null,                 e24:"Crystal Palace",     e26:"Bayern Munich" },
  "Nadine Angerer":      { e18:"LEGEND",             e24:"LEGEND",             e26:"LEGEND" },
  "Nico Williams":       { e18:null,                 e24:"Athletic Club",      e26:"Athletic Club" },
  "Nuno Mendes":         { e18:null,                 e24:"PSG",                e26:"PSG" },
  "Patrik Schick":       { e18:"Roma",               e24:"Bayer Leverkusen",   e26:"Bayer Leverkusen" },
  "Pau Cubarsí":         { e18:null,                 e24:"Barcelona",          e26:"Barcelona" },
  "Pedri":               { e18:null,                 e24:"Barcelona",          e26:"Barcelona" },
  "Pedro Neto":          { e18:null,                 e24:"Wolverhampton Wanderers", e26:"Chelsea" },
  "Phil Foden":          { e18:"Manchester City",    e24:"Manchester City",    e26:"Manchester City" },
  "Rafael Leão":         { e18:null,                 e24:"AC Milan",           e26:"AC Milan" },
  "Robert Lewandowski":  { e18:"Bayern Munich",      e24:"Barcelona",          e26:"Barcelona" },
  "Roberto Carlos":      { e18:"LEGEND",             e24:"LEGEND",             e26:"LEGEND" },
  "Rodri":               { e18:"Villarreal",         e24:"Manchester City",    e26:"Manchester City" },
  "Ronaldo Nazário (R9)":{ e18:"LEGEND",             e24:"LEGEND",             e26:"LEGEND" },
  "Romelu Lukaku":       { e18:"Manchester United",  e24:"Roma",               e26:"Napoli" },
  "Son Heung-min":       { e18:"Tottenham Hotspur",  e24:"Tottenham Hotspur",  e26:"LAFC" },
  "Thibaut Courtois":    { e18:"Chelsea",            e24:"Real Madrid",        e26:"Real Madrid" },
  "Virgil van Dijk":     { e18:"Southampton",        e24:"Liverpool",          e26:"Liverpool" },
  "Vitinha":             { e18:null,                 e24:"PSG",                e26:"PSG" },
  "Casemiro":            { e18:"Real Madrid",        e24:"Manchester United",  e26:"Manchester United" },
  "Eusébio":             { e18:"LEGEND",             e24:"LEGEND",             e26:"LEGEND" },
  "Franz Beckenbauer":   { e18:"LEGEND",             e24:"LEGEND",             e26:"LEGEND" },
  "Ferenc Puskás":       { e18:"LEGEND",             e24:"LEGEND",             e26:"LEGEND" },
  "Luís Figo":           { e18:"LEGEND",             e24:"LEGEND",             e26:"LEGEND" },
  "Antonio Rüdiger":     { e18:"Chelsea",            e24:"Real Madrid",        e26:"Real Madrid" },
  "Petr Čech":           { e18:"Arsenal",            e24:"LEGEND",             e26:"LEGEND" },
  "Cafu":                { e18:"LEGEND",             e24:"LEGEND",             e26:"LEGEND" },
  "Pepe":                { e18:"Beşiktaş",           e24:"FC Porto",           e26:"LEGEND" },
  "Alejandro Garnacho":  { e18:null,                 e24:"Manchester United",  e26:"Chelsea" }
};

/* =========================================================
   SPECIAL TEAMS (retired legends + Classic XI squads)
   Rosters are researched from the actual games — see notes:
   - FC 26 has ten "Classic XI" kick-off squads (club + league
     all-time XIs) that mix Icons, Heroes AND current players.
   - FC 24 had a single "Soccer Aid World XI" kick-off team.
   - FIFA 18 legends were FUT Icons (verified against the FIFA 18 list).
   A player can appear on several teams (e.g. Zidane) — that's real.
   "logo" -> use that club's crest; "icon" -> an emoji emblem.
   ========================================================= */
const SPECIAL_TEAMS = {
  e18: [
    { name:"Icons (FUT Legends)", icon:"👑",
      players:["Pelé","Diego Maradona","Ronaldinho","Thierry Henry","Ronaldo Nazário (R9)","Roberto Carlos"] },
    { name:"Not in this game", icon:"🚫",
      players:["Zinedine Zidane","David Beckham","Johan Cruyff","Eusébio","Franz Beckenbauer","Ferenc Puskás","Luís Figo","Cafu","Paolo Maldini","Clive Charles","Jack Jewsbury","Nadine Angerer"] }
  ],
  e24: [
    { name:"Soccer Aid World XI", icon:"🌍",
      players:["Pelé","Ronaldinho","David Beckham","Zinedine Zidane","Roberto Carlos","Luís Figo"] },
    { name:"Icons (FUT Legends)", icon:"👑",
      players:["Diego Maradona","Thierry Henry","Zlatan Ibrahimović","Johan Cruyff","Kaká","Ronaldo Nazário (R9)","Eusébio","Franz Beckenbauer","Ferenc Puskás","Petr Čech","Cafu","Paolo Maldini","Iker Casillas"] },
    { name:"Not in this game", icon:"🚫",
      players:["Jack Jewsbury","Diego Valeri","Clive Charles","Nadine Angerer"] }
  ],
  e26: [
    { name:"Bayern Munich · Classic XI",  logo:"Bayern Munich",
      players:["Franz Beckenbauer","Jamal Musiala","Michael Olise"] },
    { name:"Chelsea · Classic XI",        logo:"Chelsea",
      players:["Petr Čech","Cole Palmer"] },
    { name:"Juventus · Classic XI",       logo:"Juventus",
      players:["Zinedine Zidane"] },
    { name:"Liverpool · Classic XI",      logo:"Liverpool",
      players:["Alisson Becker","Virgil van Dijk","Mohamed Salah"] },
    { name:"Real Madrid · Classic XI",    logo:"Real Madrid",
      players:["Iker Casillas","Roberto Carlos","Zinedine Zidane","Dani Carvajal","Jude Bellingham","Kylian Mbappé"] },
    { name:"Bundesliga · Classic XI",     icon:"🇩🇪",
      players:["Franz Beckenbauer"] },
    { name:"La Liga · Classic XI",        icon:"🇪🇸",
      players:["Luís Figo","Johan Cruyff","Zinedine Zidane"] },
    { name:"Ligue 1 · Classic XI",        icon:"🇫🇷",
      players:["Petr Čech","Zlatan Ibrahimović","Ronaldinho","Thierry Henry"] },
    { name:"Premier League · Classic XI", icon:"🏴󠁧󠁢󠁥󠁮󠁧󠁿",
      players:["Thierry Henry"] },
    { name:"Serie A · Classic XI",        icon:"🇮🇹",
      players:["Cafu","Paolo Maldini","Zinedine Zidane","Ronaldo Nazário (R9)","Diego Maradona"] },
    { name:"Icons (FUT Legends)",         icon:"👑",
      players:["Pelé","David Beckham","Kaká","Eusébio","Ferenc Puskás","Marcelo"] },
    { name:"Not in this game",            icon:"🚫",
      players:["Pepe","Jack Jewsbury","Diego Valeri","Clive Charles","Nadine Angerer"] }
  ]
};
