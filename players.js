const PLAYERS = [
  {
    name: "Cristiano Ronaldo",
    country: "Portugal",
    countryCode: "PT",
    currentClub: "Al-Nassr",
    jerseyNumber: 7,
    rarity: "diamond",
    clubs: ["Sporting", "Manchester United", "Real Madrid", "Juventus", "Al-Nassr"],
    careerTimeline: [
      { club: "Sporting", years: "2002-2003" },
      { club: "Manchester United", years: "2003-2009" },
      { club: "Real Madrid", years: "2009-2018" },
      { club: "Juventus", years: "2018-2021" },
      { club: "Manchester United", years: "2021-2022" },
      { club: "Al-Nassr", years: "2023-" }
    ],
    awards: ["Euro 2016", "Champions League x5", "Ballon d'Or x5"],
    stats: { pace: 85, shooting: 93, passing: 82, dribbling: 86, defending: 35, physical: 78 },
    funFact: "He has his own museum in Madeira, Portugal called 'Museu CR7' and sleeps in 5 short 90-minute naps a day!",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/4/44/Cristiano_Ronaldo_0876.jpg",
    fotmobUrl: "https://www.fotmob.com/players/30893/cristiano-ronaldo"
  },
  {
    name: "Lionel Messi",
    country: "Argentina",
    countryCode: "AR",
    currentClub: "Inter Miami",
    jerseyNumber: 10,
    rarity: "diamond",
    clubs: ["Barcelona", "PSG", "Inter Miami"],
    careerTimeline: [
      { club: "Barcelona", years: "2004-2021" },
      { club: "PSG", years: "2021-2023" },
      { club: "Inter Miami", years: "2023-" }
    ],
    awards: ["World Cup 2022", "Copa América x2", "Ballon d'Or x8"],
    stats: { pace: 81, shooting: 90, passing: 91, dribbling: 95, defending: 34, physical: 65 },
    funFact: "His first contract with Barcelona was signed on a paper napkin at a restaurant!",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/e/eb/Messi_2025.jpg",
    fotmobUrl: "https://www.fotmob.com/players/30981/lionel-messi"
  },
  {
    name: "Kylian Mbappé",
    country: "France",
    countryCode: "FR",
    currentClub: "Real Madrid",
    jerseyNumber: 9,
    rarity: "gold",
    clubs: ["Monaco", "PSG", "Real Madrid"],
    careerTimeline: [
      { club: "Monaco", years: "2015-2017" },
      { club: "PSG", years: "2017-2024" },
      { club: "Real Madrid", years: "2024-" }
    ],
    awards: ["World Cup 2018", "Ligue 1 x6", "Ligue 1 Golden Boot x5"],
    stats: { pace: 97, shooting: 89, passing: 80, dribbling: 92, defending: 36, physical: 78 },
    funFact: "He donated his entire 2018 World Cup bonus (about $500,000) to a children's charity!",
    imageUrl: "https://assets.goal.com/images/v3/blt5bc39fb9111ed00e/BeFunky-collage_-_2024-02-20T143853.984.jpg?auto=webp&format=pjpg&width=1920&quality=60",
    fotmobUrl: "https://www.fotmob.com/players/701154/kylian-mbappe"
  },
  {
    name: "Erling Haaland",
    country: "Norway",
    countryCode: "NO",
    currentClub: "Manchester City",
    jerseyNumber: 9,
    rarity: "gold",
    clubs: ["Molde", "RB Salzburg", "Borussia Dortmund", "Manchester City"],
    careerTimeline: [
      { club: "Molde", years: "2017-2019" },
      { club: "RB Salzburg", years: "2019-2020" },
      { club: "Borussia Dortmund", years: "2020-2022" },
      { club: "Manchester City", years: "2022-" }
    ],
    awards: ["Champions League", "Premier League x2", "Premier League Golden Boot"],
    stats: { pace: 89, shooting: 94, passing: 65, dribbling: 80, defending: 45, physical: 91 },
    funFact: "He meditates before every match and his dad Alfie also played in the Premier League for Manchester City!",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/7/71/Erling_Haaland_June_2025.jpg",
    fotmobUrl: "https://www.fotmob.com/players/737066/erling-haaland"
  },
  {
    name: "Jude Bellingham",
    country: "England",
    countryCode: "GB",
    currentClub: "Real Madrid",
    jerseyNumber: 5,
    rarity: "gold",
    clubs: ["Birmingham City", "Borussia Dortmund", "Real Madrid"],
    careerTimeline: [
      { club: "Birmingham City", years: "2019-2020" },
      { club: "Borussia Dortmund", years: "2020-2023" },
      { club: "Real Madrid", years: "2023-" }
    ],
    awards: ["Champions League", "La Liga", "Kopa Trophy"],
    stats: { pace: 82, shooting: 82, passing: 84, dribbling: 86, defending: 72, physical: 83 },
    funFact: "Birmingham City retired his #22 shirt when he was only 17 years old — the youngest player ever to get that honor!",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/8/88/Jude_Bellingham_Laureus_2024_%28cropped2%29.jpg",
    fotmobUrl: "https://www.fotmob.com/players/1077894/jude-bellingham"
  },
  {
    name: "Mohamed Salah",
    country: "Egypt",
    countryCode: "EG",
    currentClub: "Liverpool",
    jerseyNumber: 11,
    rarity: "gold",
    clubs: ["Basel", "Chelsea", "Fiorentina", "Roma", "Liverpool"],
    careerTimeline: [
      { club: "Basel", years: "2012-2014" },
      { club: "Chelsea", years: "2014-2015" },
      { club: "Fiorentina", years: "2015 (loan)" },
      { club: "Roma", years: "2015-2017" },
      { club: "Liverpool", years: "2017-" }
    ],
    awards: ["Champions League", "Premier League", "African Player of the Year x3"],
    stats: { pace: 90, shooting: 87, passing: 81, dribbling: 90, defending: 45, physical: 75 },
    funFact: "He's known as the 'Egyptian King' and crime rates in Liverpool reportedly dropped when he signed!",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/0/03/Mohamed_Salah.JPG",
    fotmobUrl: "https://www.fotmob.com/players/292462/mohamed-salah"
  },
  {
    name: "Lamine Yamal",
    country: "Spain",
    countryCode: "ES",
    currentClub: "Barcelona",
    jerseyNumber: 19,
    rarity: "gold",
    clubs: ["Barcelona"],
    careerTimeline: [
      { club: "Barcelona", years: "2023-" }
    ],
    awards: ["Euro 2024", "La Liga", "Golden Boy 2024"],
    stats: { pace: 91, shooting: 76, passing: 83, dribbling: 90, defending: 30, physical: 58 },
    funFact: "He became the youngest ever goalscorer at a European Championship at just 16 years and 362 days old!",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/d/df/Lamine_Yamal_in_2025_%28cropped2%29.jpg",
    fotmobUrl: "https://www.fotmob.com/players/1467236/lamine-yamal"
  },
  {
    name: "Neymar Jr.",
    country: "Brazil",
    countryCode: "BR",
    currentClub: "Al-Hilal",
    jerseyNumber: 10,
    rarity: "gold",
    clubs: ["Santos", "Barcelona", "PSG", "Al-Hilal"],
    careerTimeline: [
      { club: "Santos", years: "2009-2013" },
      { club: "Barcelona", years: "2013-2017" },
      { club: "PSG", years: "2017-2023" },
      { club: "Al-Hilal", years: "2023-" }
    ],
    awards: ["Champions League 2015", "Copa Libertadores", "Olympic Gold 2016"],
    stats: { pace: 86, shooting: 83, passing: 86, dribbling: 94, defending: 30, physical: 61 },
    funFact: "He was named after his father, who was also a professional footballer, and he can solve a Rubik's cube!",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/d/d0/Neymar_2018.jpg",
    fotmobUrl: "https://www.fotmob.com/players/30890/neymar"
  },
  {
    name: "Vinícius Júnior",
    country: "Brazil",
    countryCode: "BR",
    currentClub: "Real Madrid",
    jerseyNumber: 7,
    rarity: "gold",
    clubs: ["Flamengo", "Real Madrid"],
    careerTimeline: [
      { club: "Flamengo", years: "2017-2018" },
      { club: "Real Madrid", years: "2018-" }
    ],
    awards: ["Champions League x2", "La Liga x2", "The Best FIFA Men's Player"],
    stats: { pace: 95, shooting: 82, passing: 78, dribbling: 93, defending: 29, physical: 68 },
    funFact: "Real Madrid signed him when he was just 16 for €45 million before he'd even played a full professional season!",
    imageUrl: "https://i.guim.co.uk/img/media/ab52bf117d8210fa2d226175c898f5bf29011176/0_159_4795_2878/master/4795.jpg?width=620&dpr=2&s=none&crop=none",
    fotmobUrl: "https://www.fotmob.com/players/868012/vinicius-junior"
  },
  {
    name: "Harry Kane",
    country: "England",
    countryCode: "GB",
    currentClub: "Bayern Munich",
    jerseyNumber: 9,
    rarity: "gold",
    clubs: ["Tottenham Hotspur", "Bayern Munich"],
    careerTimeline: [
      { club: "Tottenham Hotspur", years: "2011-2023" },
      { club: "Bayern Munich", years: "2023-" }
    ],
    awards: ["World Cup Golden Boot 2018", "Bundesliga Golden Boot", "Premier League Golden Boot x3"],
    stats: { pace: 70, shooting: 93, passing: 85, dribbling: 82, defending: 47, physical: 83 },
    funFact: "He was released by Arsenal's youth academy as a kid and went on to become Tottenham's all-time top scorer!",
    imageUrl: "https://ichef.bbci.co.uk/ace/standard/976/cpsprodpb/8d0d/live/c1b67b10-0066-11ee-9edb-25f8156c1ac0.jpg",
    fotmobUrl: "https://www.fotmob.com/players/36249/harry-kane"
  },
  {
    name: "Pelé",
    country: "Brazil",
    countryCode: "BR",
    currentClub: "Retired",
    jerseyNumber: 10,
    rarity: "diamond",
    clubs: ["Santos", "New York Cosmos"],
    careerTimeline: [
      { club: "Santos", years: "1956-1974" },
      { club: "New York Cosmos", years: "1975-1977" }
    ],
    awards: ["World Cup 1958", "World Cup 1962", "World Cup 1970", "FIFA Player of the Century"],
    stats: { pace: 90, shooting: 96, passing: 85, dribbling: 96, defending: 38, physical: 80 },
    funFact: "He scored over 1,000 career goals and once caused a ceasefire in a civil war in Nigeria so both sides could watch him play!",
    imageUrl: "https://static.dw.com/image/61527609_1004.webp",
    fotmobUrl: "https://www.fotmob.com/players/7875/pele"
  },
  {
    name: "Ronaldinho",
    country: "Brazil",
    countryCode: "BR",
    currentClub: "Retired",
    jerseyNumber: 10,
    rarity: "diamond",
    clubs: ["Grêmio", "PSG", "Barcelona", "AC Milan"],
    careerTimeline: [
      { club: "Grêmio", years: "1998-2001" },
      { club: "PSG", years: "2001-2003" },
      { club: "Barcelona", years: "2003-2008" },
      { club: "AC Milan", years: "2008-2011" }
    ],
    awards: ["Ballon d'Or 2005", "World Cup 2002", "Champions League 2006"],
    stats: { pace: 88, shooting: 82, passing: 90, dribbling: 97, defending: 25, physical: 70 },
    funFact: "He made the entire Santiago Bernabéu (Real Madrid's stadium) give him a standing ovation — as a Barcelona player!",
    imageUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Ronaldinho_in_2019.jpg?width=800",
    fotmobUrl: "https://www.fotmob.com/players/242/ronaldinho"
  },
  {
    name: "David Beckham",
    country: "England",
    countryCode: "GB",
    currentClub: "Retired",
    jerseyNumber: 7,
    rarity: "gold",
    clubs: ["Manchester United", "Real Madrid", "LA Galaxy", "AC Milan", "PSG"],
    careerTimeline: [
      { club: "Manchester United", years: "1992-2003" },
      { club: "Real Madrid", years: "2003-2007" },
      { club: "LA Galaxy", years: "2007-2012" },
      { club: "AC Milan", years: "2009-2010 (loan)" },
      { club: "PSG", years: "2013" }
    ],
    awards: ["Champions League 1999", "La Liga 2007", "MLS Cup 2011 & 2012"],
    stats: { pace: 72, shooting: 80, passing: 94, dribbling: 80, defending: 62, physical: 75 },
    funFact: "He can bend a ball so well they made a movie about it — 'Bend It Like Beckham'!",
    imageUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/David%20Beckham%20Victoria%20Beckham%202019.jpg?width=800",
    fotmobUrl: "https://www.fotmob.com/players/3467/david-beckham"
  },
  {
    name: "Zinedine Zidane",
    country: "France",
    countryCode: "FR",
    currentClub: "Retired",
    jerseyNumber: 5,
    rarity: "diamond",
    clubs: ["Cannes", "Bordeaux", "Juventus", "Real Madrid"],
    careerTimeline: [
      { club: "Cannes", years: "1989-1992" },
      { club: "Bordeaux", years: "1992-1996" },
      { club: "Juventus", years: "1996-2001" },
      { club: "Real Madrid", years: "2001-2006" }
    ],
    awards: ["Ballon d'Or 1998", "World Cup 1998", "Champions League 2002"],
    stats: { pace: 76, shooting: 84, passing: 92, dribbling: 95, defending: 40, physical: 78 },
    funFact: "His volley goal in the 2002 Champions League final is considered one of the greatest goals ever scored!",
    imageUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Zinedine_Zidane.JPG?width=800",
    fotmobUrl: "https://www.fotmob.com/players/784/zinedine-zidane"
  },
  {
    name: "Thierry Henry",
    country: "France",
    countryCode: "FR",
    currentClub: "Retired",
    jerseyNumber: 14,
    rarity: "gold",
    clubs: ["Monaco", "Juventus", "Arsenal", "Barcelona", "New York Red Bulls"],
    careerTimeline: [
      { club: "Monaco", years: "1994-1999" },
      { club: "Juventus", years: "1999" },
      { club: "Arsenal", years: "1999-2007" },
      { club: "Barcelona", years: "2007-2010" },
      { club: "New York Red Bulls", years: "2010-2014" }
    ],
    awards: ["Premier League x2", "Champions League 2009", "World Cup 1998", "Euro 2000"],
    stats: { pace: 93, shooting: 89, passing: 80, dribbling: 90, defending: 32, physical: 76 },
    funFact: "He's Arsenal's all-time top scorer with 228 goals and has a statue outside the Emirates Stadium!",
    imageUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Thierry_Henry_portrait.jpg?width=800",
    fotmobUrl: "https://www.fotmob.com/players/3475/thierry-henry"
  },
  {
    name: "Zlatan Ibrahimović",
    country: "Sweden",
    countryCode: "SE",
    currentClub: "Retired",
    jerseyNumber: 11,
    rarity: "diamond",
    clubs: ["Malmö", "Ajax", "Juventus", "Inter Milan", "Barcelona", "AC Milan", "PSG", "Manchester United", "LA Galaxy", "AC Milan"],
    careerTimeline: [
      { club: "Malmö", years: "1999-2001" },
      { club: "Ajax", years: "2001-2004" },
      { club: "Juventus", years: "2004-2006" },
      { club: "Inter Milan", years: "2006-2009" },
      { club: "Barcelona", years: "2009-2010" },
      { club: "AC Milan", years: "2010-2012" },
      { club: "PSG", years: "2012-2016" },
      { club: "Manchester United", years: "2016-2018" },
      { club: "LA Galaxy", years: "2018-2019" },
      { club: "AC Milan", years: "2020-2023" }
    ],
    awards: ["Ligue 1 x4", "Serie A x4", "Guldbollen x12", "FIFA Puskás Award"],
    stats: { pace: 78, shooting: 90, passing: 81, dribbling: 88, defending: 30, physical: 86 },
    funFact: "He once said 'I didn't injure myself, I am Zlatan!' and has a black belt in taekwondo!",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/5/5e/Zlatan_Ibrahimovi%C4%87_Euro_2012_vs_England.JPG",
    fotmobUrl: "https://www.fotmob.com/players/36314/zlatan-ibrahimovic"
  },
  {
    name: "Diego Maradona",
    country: "Argentina",
    countryCode: "AR",
    currentClub: "Retired",
    jerseyNumber: 10,
    rarity: "diamond",
    clubs: ["Argentinos Juniors", "Boca Juniors", "Barcelona", "Napoli", "Sevilla", "Newell's Old Boys"],
    careerTimeline: [
      { club: "Argentinos Juniors", years: "1976-1981" },
      { club: "Boca Juniors", years: "1981-1982" },
      { club: "Barcelona", years: "1982-1984" },
      { club: "Napoli", years: "1984-1991" },
      { club: "Sevilla", years: "1992-1993" },
      { club: "Newell's Old Boys", years: "1993-1994" },
      { club: "Boca Juniors", years: "1995-1997" }
    ],
    awards: ["World Cup 1986", "Serie A x2", "Golden Ball 1986", "FIFA Player of the Century"],
    stats: { pace: 88, shooting: 90, passing: 88, dribbling: 97, defending: 28, physical: 72 },
    funFact: "His 'Hand of God' and 'Goal of the Century' both happened in the same World Cup match against England in 1986!",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/2/2c/Maradona-Mundial_86_con_la_copa.JPG",
    fotmobUrl: "https://www.fotmob.com/players/7863/diego-maradona"
  },
  {
    name: "Jack Jewsbury",
    country: "USA",
    countryCode: "US",
    currentClub: "Retired",
    jerseyNumber: 13,
    rarity: "gold",
    clubs: ["Kansas City Wizards", "Portland Timbers"],
    careerTimeline: [
      { club: "Kansas City Wizards", years: "2003-2010" },
      { club: "Portland Timbers", years: "2011-2015" }
    ],
    awards: ["MLS Cup 2015", "Timbers Captain", "MLS All-Star"],
    stats: { pace: 68, shooting: 70, passing: 78, dribbling: 72, defending: 76, physical: 80 },
    funFact: "He was the first-ever captain of the Portland Timbers in MLS and lifted the 2015 MLS Cup trophy for the city!",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/a/ad/Jack_Jewsbury_%2830261107612%29.jpg",
    fotmobUrl: "https://www.fotmob.com/players/288028/jack-jewsbury"
  },
  {
    name: "Diego Valeri",
    country: "Argentina",
    countryCode: "AR",
    currentClub: "Retired",
    jerseyNumber: 8,
    rarity: "gold",
    clubs: ["Lanús", "Porto Alegre", "Portland Timbers"],
    careerTimeline: [
      { club: "Lanús", years: "2003-2013" },
      { club: "Portland Timbers", years: "2013-2022" }
    ],
    awards: ["MLS Cup 2015", "MLS MVP 2017", "MLS All-Star x4", "Timbers All-Time Top Scorer"],
    stats: { pace: 72, shooting: 83, passing: 88, dribbling: 86, defending: 35, physical: 62 },
    funFact: "He scored the fastest goal in MLS Cup history at just 27 seconds and is the Timbers' all-time leading scorer with 86 goals!",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/b/b9/Diego_Valeri_Portland_Timbers_vs_Colorado_Rapids_2016-10-16_%2830261185652%29.jpg",
    fotmobUrl: "https://www.fotmob.com/players/105498/diego-valeri"
  },
  {
    name: "Darlington Nagbe",
    country: "USA",
    countryCode: "US",
    currentClub: "Columbus Crew",
    jerseyNumber: 6,
    rarity: "gold",
    clubs: ["Portland Timbers", "Atlanta United", "Columbus Crew"],
    careerTimeline: [
      { club: "Portland Timbers", years: "2011-2017" },
      { club: "Atlanta United", years: "2018-2019" },
      { club: "Columbus Crew", years: "2020-" }
    ],
    awards: ["MLS Cup 2015", "MLS Cup 2018", "MLS Cup 2020", "USMNT Cap"],
    stats: { pace: 76, shooting: 70, passing: 84, dribbling: 87, defending: 65, physical: 74 },
    funFact: "Born in Liberia, he moved to the US as a child and scored one of the greatest goals in Timbers history — a stunning volley from outside the box!",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/9/97/Nagbe_Darlington_Columbus_Crew_Meet_the_Team_2022.jpg",
    fotmobUrl: "https://www.fotmob.com/players/335498/darlington-nagbe"
  }
];

/* Country name → flag emoji helper */
const FLAG_MAP = {
  PT:"🇵🇹", AR:"🇦🇷", FR:"🇫🇷", NO:"🇳🇴", GB:"🇬🇧",
  EG:"🇪🇬", ES:"🇪🇸", BR:"🇧🇷", SE:"🇸🇪", US:"🇺🇸"
};
function getFlag(code){ return FLAG_MAP[code] || "⚽"; }
