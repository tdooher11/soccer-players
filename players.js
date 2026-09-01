/* =========================================================
   DATA LOADER — the roster lives in players.json (single source
   of truth). Both index.html and fifa.html call loadPlayers().
   ========================================================= */
async function loadPlayers(){
  const res = await fetch("players.json", { cache: "no-cache" });
  if(!res.ok) throw new Error("Could not load players.json: " + res.status);
  return res.json();
}

/* =========================================================
   COUNTRY FLAGS  (real flag images via flagcdn)
   countryCode uses ISO-2, plus special gb-eng for England
   ========================================================= */
function flagUrl(code, size){
  if(!code) return "";
  const c = code.toLowerCase();      // "PT" -> "pt", "GB-ENG" -> "gb-eng"
  return `assets/flags/${c}.png`;    // self-hosted (see assets/flags/)
}
/* Emoji fallback (used only if an image fails) */
const FLAG_EMOJI = {
  PT:"🇵🇹", AR:"🇦🇷", FR:"🇫🇷", NO:"🇳🇴", "GB-ENG":"🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  EG:"🇪🇬", ES:"🇪🇸", BR:"🇧🇷", SE:"🇸🇪", US:"🇺🇸", DE:"🇩🇪",
  MA:"🇲🇦", CO:"🇨🇴", UY:"🇺🇾", NL:"🇳🇱", HR:"🇭🇷", BE:"🇧🇪",
  CZ:"🇨🇿", PL:"🇵🇱", KR:"🇰🇷", HU:"🇭🇺",
  IT:"🇮🇹", DK:"🇩🇰", GR:"🇬🇷", RU:"🇷🇺", CA:"🇨🇦", CV:"🇨🇻"
};
function flagEmoji(code){ return FLAG_EMOJI[code] || "🏳️"; }

/* =========================================================
   CLUB CRESTS  (real club colors + short badge text)
   c1 = main color, c2 = secondary, ink = text color
   ========================================================= */
const CLUBS = {
  "Sporting CP":{c1:"#1a7a4c",c2:"#e6f4ed",ab:"SCP",ink:"#fff"},
  "Manchester United":{c1:"#DA291C",c2:"#FBE122",ab:"MUN",ink:"#fff"},
  "Real Madrid":{c1:"#f4f6fb",c2:"#00529F",ab:"RM",ink:"#1a2a55"},
  "Juventus":{c1:"#141414",c2:"#ffffff",ab:"JUV",ink:"#fff"},
  "Al-Nassr":{c1:"#F5C400",c2:"#0a4ea2",ab:"NAS",ink:"#1a2a55"},
  "Al-Hilal":{c1:"#0a4ea2",c2:"#ffffff",ab:"HIL",ink:"#fff"},
  "Al-Ittihad":{c1:"#111111",c2:"#f5c400",ab:"ITT",ink:"#f5c400"},
  "Barcelona":{c1:"#A50044",c2:"#004D98",ab:"FCB",ink:"#fff"},
  "PSG":{c1:"#0b1e50",c2:"#DA291C",ab:"PSG",ink:"#fff"},
  "Inter Miami":{c1:"#f7b5cd",c2:"#111111",ab:"MIA",ink:"#5a1730"},
  "Inter Milan":{c1:"#0a2196",c2:"#111111",ab:"INT",ink:"#fff"},
  "Santos":{c1:"#f4f6fb",c2:"#111111",ab:"SAN",ink:"#1a1a1a"},
  "New York Cosmos":{c1:"#0a9a4a",c2:"#f4f6fb",ab:"NYC",ink:"#fff"},
  "New York Red Bulls":{c1:"#ED1E36",c2:"#003a70",ab:"NYR",ink:"#fff"},
  "Monaco":{c1:"#e51b22",c2:"#f4f6fb",ab:"ASM",ink:"#fff"},
  "Molde":{c1:"#0a4ea2",c2:"#ffffff",ab:"MOL",ink:"#fff"},
  "RB Salzburg":{c1:"#d81e2c",c2:"#ffffff",ab:"RBS",ink:"#fff"},
  "RB Leipzig":{c1:"#dd0741",c2:"#001f47",ab:"RBL",ink:"#fff"},
  "Borussia Dortmund":{c1:"#FDE100",c2:"#111111",ab:"BVB",ink:"#111"},
  "Manchester City":{c1:"#6CABDD",c2:"#ffffff",ab:"MCI",ink:"#0b2b45"},
  "Leicester City":{c1:"#003090",c2:"#ffffff",ab:"LEI",ink:"#fff"},
  "Hull City":{c1:"#f18a00",c2:"#111111",ab:"HUL",ink:"#111"},
  "Monterrey":{c1:"#00295b",c2:"#ffffff",ab:"MTY",ink:"#fff"},
  "Schalke 04":{c1:"#004d9d",c2:"#ffffff",ab:"S04",ink:"#fff"},
  "Vancouver Whitecaps":{c1:"#04216a",c2:"#9dc2e5",ab:"VAN",ink:"#fff"},
  "West Bromwich Albion":{c1:"#122f67",c2:"#ffffff",ab:"WBA",ink:"#fff"},
  "Kaiserslautern":{c1:"#e30613",c2:"#ffffff",ab:"FCK",ink:"#fff"},
  "Vissel Kobe":{c1:"#9b1b30",c2:"#111111",ab:"KOB",ink:"#fff"},
  "Portland Thorns":{c1:"#d5202b",c2:"#111111",ab:"THN",ink:"#fff"},
  "Colo-Colo":{c1:"#f4f6fb",c2:"#111111",ab:"CLC",ink:"#1a1a1a"},
  "Dynamo Moscow":{c1:"#1a4ea8",c2:"#ffffff",ab:"DYN",ink:"#fff"},
  "Parma":{c1:"#ffd200",c2:"#003f87",ab:"PAR",ink:"#003f87"},
  "OL Reign":{c1:"#13284b",c2:"#6cc24a",ab:"RGN",ink:"#fff"},
  "Birmingham City":{c1:"#1a4ea8",c2:"#ffffff",ab:"BIR",ink:"#fff"},
  "Basel":{c1:"#d81e2c",c2:"#0a4ea2",ab:"BAS",ink:"#fff"},
  "Chelsea":{c1:"#034694",c2:"#ffffff",ab:"CHE",ink:"#fff"},
  "Fiorentina":{c1:"#5a2d82",c2:"#ffffff",ab:"FIO",ink:"#fff"},
  "Roma":{c1:"#8e1b2e",c2:"#f0a500",ab:"ROM",ink:"#f0a500"},
  "Grêmio":{c1:"#0d6fb8",c2:"#111111",ab:"GRE",ink:"#fff"},
  "AC Milan":{c1:"#fb090b",c2:"#111111",ab:"MIL",ink:"#fff"},
  "LA Galaxy":{c1:"#00245d",c2:"#f5c400",ab:"LAG",ink:"#f5c400"},
  "LAFC":{c1:"#111111",c2:"#c39e6d",ab:"LAF",ink:"#c39e6d"},
  "Cannes":{c1:"#d81e2c",c2:"#ffffff",ab:"CAN",ink:"#fff"},
  "Bordeaux":{c1:"#0a1a3a",c2:"#8e1b2e",ab:"BOR",ink:"#fff"},
  "Arsenal":{c1:"#EF0107",c2:"#ffffff",ab:"ARS",ink:"#fff"},
  "Malmö":{c1:"#0a63b0",c2:"#ffffff",ab:"MAL",ink:"#fff"},
  "Ajax":{c1:"#d2122e",c2:"#ffffff",ab:"AJA",ink:"#fff"},
  "Tottenham Hotspur":{c1:"#ffffff",c2:"#132257",ab:"TOT",ink:"#132257"},
  "Bayern Munich":{c1:"#dc052d",c2:"#0066b2",ab:"BAY",ink:"#fff"},
  "Bayer Leverkusen":{c1:"#e32219",c2:"#111111",ab:"LEV",ink:"#fff"},
  "Kansas City Wizards":{c1:"#003b7b",c2:"#93c020",ab:"KC",ink:"#fff"},
  "Portland Timbers":{c1:"#004812",c2:"#d69a00",ab:"POR",ink:"#d69a00"},
  "Portland Thorns":{c1:"#8a1538",c2:"#111111",ab:"THO",ink:"#fff"},
  "Lanús":{c1:"#7a1523",c2:"#ffffff",ab:"LAN",ink:"#fff"},
  "Atlanta United":{c1:"#80000a",c2:"#111111",ab:"ATL",ink:"#f0a500"},
  "Columbus Crew":{c1:"#fff200",c2:"#111111",ab:"CLB",ink:"#111"},
  "Internacional":{c1:"#e01e2c",c2:"#ffffff",ab:"INT",ink:"#fff"},
  "Benfica":{c1:"#e00020",c2:"#ffffff",ab:"BEN",ink:"#fff"},
  "Rennes":{c1:"#111111",c2:"#e30613",ab:"REN",ink:"#e30613"},
  "Deportes Tolima":{c1:"#b8860b",c2:"#8e1b2e",ab:"TOL",ink:"#fff"},
  "Aston Villa":{c1:"#670e36",c2:"#95bfe5",ab:"AVL",ink:"#95bfe5"},
  "Peñarol":{c1:"#111111",c2:"#f5c400",ab:"PEÑ",ink:"#f5c400"},
  "Feyenoord":{c1:"#e30613",c2:"#ffffff",ab:"FEY",ink:"#fff"},
  "Dinamo Zagreb":{c1:"#0a63b0",c2:"#ffffff",ab:"DZG",ink:"#fff"},
  "Lyon":{c1:"#ffffff",c2:"#d81e2c",ab:"OL",ink:"#0a1a3a"},
  "Genk":{c1:"#0a63b0",c2:"#ffffff",ab:"GNK",ink:"#fff"},
  "Werder Bremen":{c1:"#1d9053",c2:"#ffffff",ab:"BRE",ink:"#fff"},
  "Wolfsburg":{c1:"#65b32e",c2:"#111111",ab:"WOB",ink:"#fff"},
  "Napoli":{c1:"#12a0d7",c2:"#ffffff",ab:"NAP",ink:"#fff"},
  "Getafe":{c1:"#0a5eb0",c2:"#ffffff",ab:"GET",ink:"#fff"},
  "Brighton":{c1:"#0057b8",c2:"#ffffff",ab:"BHA",ink:"#fff"},
  "Fluminense":{c1:"#7a1523",c2:"#0a5f3a",ab:"FLU",ink:"#fff"},
  "Olympiacos":{c1:"#e30613",c2:"#ffffff",ab:"OLY",ink:"#fff"},
  "Strømsgodset":{c1:"#0a4ea2",c2:"#ffffff",ab:"STR",ink:"#fff"},
  "Heerenveen":{c1:"#005eb8",c2:"#e30613",ab:"HEE",ink:"#fff"},
  "Vitesse":{c1:"#141414",c2:"#f5c400",ab:"VIT",ink:"#f5c400"},
  "Real Sociedad":{c1:"#0067b1",c2:"#ffffff",ab:"RSO",ink:"#fff"},
  "Reading":{c1:"#004494",c2:"#ffffff",ab:"REA",ink:"#fff"},
  "Crystal Palace":{c1:"#1b458f",c2:"#c4122e",ab:"CRY",ink:"#fff"},
  "Turbine Potsdam":{c1:"#0a63b0",c2:"#ffffff",ab:"POT",ink:"#fff"},
  "Frankfurt":{c1:"#111111",c2:"#e1000f",ab:"SGE",ink:"#e1000f"},
  "Athletic Club":{c1:"#ee2523",c2:"#ffffff",ab:"ATH",ink:"#fff"},
  "Sparta Prague":{c1:"#822433",c2:"#f5c400",ab:"SPA",ink:"#f5c400"},
  "Sampdoria":{c1:"#0a3a82",c2:"#e30613",ab:"SAM",ink:"#fff"},
  "Las Palmas":{c1:"#fdd000",c2:"#004a99",ab:"LPA",ink:"#004a99"},
  "Braga":{c1:"#b3122a",c2:"#ffffff",ab:"BRA",ink:"#fff"},
  "Lazio":{c1:"#87d8f7",c2:"#ffffff",ab:"LAZ",ink:"#0b2b45"},
  "Wolverhampton Wanderers":{c1:"#fdb913",c2:"#111111",ab:"WOL",ink:"#111"},
  "Lille":{c1:"#e01e2c",c2:"#0a1a3a",ab:"LIL",ink:"#fff"},
  "Vitória de Guimarães":{c1:"#111111",c2:"#ffffff",ab:"VIT",ink:"#fff"},
  "Leeds United":{c1:"#ffffff",c2:"#1d428a",ab:"LEE",ink:"#1d428a"},
  "Znicz Pruszków":{c1:"#e30613",c2:"#111111",ab:"ZNI",ink:"#fff"},
  "Lech Poznań":{c1:"#0a63b0",c2:"#ffffff",ab:"LECH",ink:"#fff"},
  "Chicago Fire":{c1:"#141c2e",c2:"#e30613",ab:"CHI",ink:"#e30613"},
  "Palmeiras":{c1:"#0a5f3a",c2:"#ffffff",ab:"PAL",ink:"#fff"},
  "Fenerbahçe":{c1:"#12296b",c2:"#f5c400",ab:"FEN",ink:"#f5c400"},
  "Corinthians":{c1:"#111111",c2:"#ffffff",ab:"COR",ink:"#fff"},
  "Anzhi":{c1:"#111111",c2:"#f5c400",ab:"ANZ",ink:"#f5c400"},
  "Villarreal":{c1:"#ffe667",c2:"#005187",ab:"VIL",ink:"#005187"},
  "Atlético Madrid":{c1:"#cb3524",c2:"#0a2a5e",ab:"ATM",ink:"#fff"},
  "Atlético Mineiro":{c1:"#111111",c2:"#ffffff",ab:"CAM",ink:"#fff"},
  "Flamengo":{c1:"#b3122a",c2:"#111111",ab:"FLA",ink:"#fff"},
  "Cruzeiro":{c1:"#0a3a82",c2:"#ffffff",ab:"CRU",ink:"#fff"},
  "PSV":{c1:"#ed1c24",c2:"#ffffff",ab:"PSV",ink:"#fff"},
  "Anderlecht":{c1:"#5a2d82",c2:"#ffffff",ab:"AND",ink:"#fff"},
  "Everton":{c1:"#003399",c2:"#ffffff",ab:"EVE",ink:"#fff"},
  "Hamburger SV":{c1:"#111111",c2:"#0a63b0",ab:"HSV",ink:"#0a63b0"},
  "Celtic":{c1:"#018749",c2:"#ffffff",ab:"CEL",ink:"#fff"},
  "Southampton":{c1:"#d71920",c2:"#111111",ab:"SOU",ink:"#fff"},
  "Groningen":{c1:"#0a8a3a",c2:"#ffffff",ab:"GRO",ink:"#fff"},
  "FC Porto":{c1:"#00559e",c2:"#ffffff",ab:"POR",ink:"#fff"},
  "Nacional":{c1:"#ffffff",c2:"#0a3a82",ab:"NAC",ink:"#0a3a82"},
  "Newell's Old Boys":{c1:"#111111",c2:"#e30613",ab:"NOB",ink:"#e30613"},
  "Boca Juniors":{c1:"#0a3a82",c2:"#f5c400",ab:"BOC",ink:"#f5c400"},
  "Argentinos Juniors":{c1:"#e01e2c",c2:"#ffffff",ab:"ARG",ink:"#fff"},
  "Sevilla":{c1:"#ffffff",c2:"#d81e2c",ab:"SEV",ink:"#d81e2c"},
  "Querétaro":{c1:"#141414",c2:"#0a63b0",ab:"QRO",ink:"#fff"},
  "São Paulo":{c1:"#e30613",c2:"#111111",ab:"SAO",ink:"#fff"},
  "Orlando City":{c1:"#5a2d82",c2:"#f5c400",ab:"ORL",ink:"#f5c400"},
  "West Ham United":{c1:"#7a263a",c2:"#1bb1e7",ab:"WHU",ink:"#1bb1e7"}
};
/* ESPN team IDs → real crest at https://a.espncdn.com/i/teamlogos/soccer/500/<id>.png
   (verified against ESPN's official league team lists) */
const CLUB_ESPN = {
  "Real Madrid":86,"Barcelona":83,"Manchester United":360,"Manchester City":382,
  "Chelsea":363,"Arsenal":359,"Liverpool":364,"Tottenham Hotspur":367,
  "West Ham United":371,"Everton":368,"Aston Villa":362,"Brighton":331,
  "Crystal Palace":384,"Wolverhampton Wanderers":380,"Southampton":376,
  "Leeds United":357,"Birmingham City":392,"Leicester City":375,"Hull City":306,
  "Monterrey":216,"Schalke 04":133,"Vancouver Whitecaps":9727,"West Bromwich Albion":358,
  "Villarreal":102,"AC Milan":103,"Roma":104,"Atlético Madrid":1068,
  "Fiorentina":109,"Inter Milan":110,"Juventus":111,"Lazio":112,"Napoli":114,
  "RB Leipzig":11420,"Borussia Dortmund":124,"Frankfurt":125,"Hamburger SV":127,
  "Bayer Leverkusen":131,"Bayern Munich":132,"Werder Bremen":137,"Wolfsburg":138,
  "Sevilla":243,"Getafe":2922,"Real Sociedad":89,"Athletic Club":93,
  "PSG":160,"Lille":166,"Lyon":167,"Monaco":174,"Rennes":169,
  "Ajax":139,"Feyenoord":142,"Groningen":145,"Heerenveen":146,"PSV":148,
  "Benfica":1929,"Sporting CP":2250,"Braga":2994,"FC Porto":437,"Vitória de Guimarães":5309,
  "Orlando City":12011,"Chicago Fire":182,"Columbus Crew":183,"Atlanta United":18418,
  "LA Galaxy":187,"LAFC":18966,"Inter Miami":20232,"Portland Timbers":9723,
  "Newell's Old Boys":14,"Cruzeiro":2022,"Palmeiras":2029,"Santos":225,
  "Fluminense":3445,"Corinthians":874,"Flamengo":819,"São Paulo":2026,
  "Grêmio":6273,"Internacional":1936,"Atlético Mineiro":7632,
  "Al-Ittihad":2276,"Al-Nassr":817,"Al-Hilal":929,"Celtic":256,"Malmö":2720,
  "Molde":2715,"RB Salzburg":2790,"Olympiacos":435,"Fenerbahçe":436,"Basel":989,
  "Argentinos Juniors":3,"Boca Juniors":5,"Anderlecht":441,"Genk":938,
  "Deportes Tolima":5489,"Nacional":2684,
  "Marseille":176,"Nottingham Forest":393,"FCSB":484,"Ajax":139,
  "D.C. United":193,"Houston Dynamo":6077,"San Jose Earthquakes":191,
  "Real Salt Lake":4771,"Colorado Rapids":184,"Sporting Kansas City":186,
  "Seattle Sounders":9726,"Toronto FC":7318,"New York City FC":17606
};
function clubLogo(name){
  const id = CLUB_ESPN[name];
  return id ? `https://a.espncdn.com/i/teamlogos/soccer/500/${id}.png` : "";
}

/* Deterministic color for any club not in the map (so nothing ever breaks) */
function clubData(name){
  if(CLUBS[name]) return CLUBS[name];
  let h = 0;
  for(let i=0;i<name.length;i++){ h = (h*31 + name.charCodeAt(i)) & 0xffffff; }
  const hue = h % 360;
  const words = name.split(/\s+/);
  const ab = (words.length>1 ? words.map(w=>w[0]).join("") : name.slice(0,3)).toUpperCase().slice(0,3);
  return { c1:`hsl(${hue} 55% 42%)`, c2:`hsl(${(hue+40)%360} 55% 55%)`, ab, ink:"#fff" };
}
