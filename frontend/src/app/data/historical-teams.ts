
export interface HistoricalTeam {
  name: string;
  short: string;
  color: string;
}

const t = (
  name: string,
  short: string,
  color: string
): HistoricalTeam => ({ name, short, color });

// IPL TEAMS

const IPL_2008: HistoricalTeam[] = [
  t('Chennai Super Kings', 'CSK', '#f9cd05'),
  t('Deccan Chargers', 'DCH', '#004ba0'),
  t('Delhi Daredevils', 'DD', '#17449b'),
  t('Kings XI Punjab', 'KXIP', '#ed1b24'),
  t('Kolkata Knight Riders', 'KKR', '#5a2d82'),
  t('Mumbai Indians', 'MI', '#004ba0'),
  t('Rajasthan Royals', 'RR', '#ea1a85'),
  t('Royal Challengers Bangalore', 'RCB', '#d71920'),
];

const IPL_2011: HistoricalTeam[] = [
  ...IPL_2008,
  t('Kochi Tuskers Kerala', 'KTK', '#f26522'),
  t('Pune Warriors India', 'PWI', '#00843d'),
];

const IPL_2012 = IPL_2011.filter(team => team.short !== 'KTK');

const IPL_2013: HistoricalTeam[] = [
  ...IPL_2012.filter(team => team.short !== 'PWI'),
  t('Sunrisers Hyderabad', 'SRH', '#f26522'),
];

const IPL_2016: HistoricalTeam[] = [
  t('Delhi Daredevils', 'DD', '#17449b'),
  t('Gujarat Lions', 'GL', '#f26522'),
  t('Kings XI Punjab', 'KXIP', '#ed1b24'),
  t('Kolkata Knight Riders', 'KKR', '#5a2d82'),
  t('Mumbai Indians', 'MI', '#004ba0'),
  t('Rising Pune Supergiant', 'RPS', '#c9a227'),
  t('Royal Challengers Bangalore', 'RCB', '#d71920'),
  t('Sunrisers Hyderabad', 'SRH', '#f26522'),
];

const IPL_2018: HistoricalTeam[] = [
  t('Chennai Super Kings', 'CSK', '#f9cd05'),
  t('Delhi Daredevils', 'DD', '#17449b'),
  t('Kings XI Punjab', 'KXIP', '#ed1b24'),
  t('Kolkata Knight Riders', 'KKR', '#5a2d82'),
  t('Mumbai Indians', 'MI', '#004ba0'),
  t('Rajasthan Royals', 'RR', '#ea1a85'),
  t('Royal Challengers Bangalore', 'RCB', '#d71920'),
  t('Sunrisers Hyderabad', 'SRH', '#f26522'),
];

const IPL_2019 = IPL_2018.map(team =>
  team.short === 'DD'
    ? t('Delhi Capitals', 'DC', '#17449b')
    : team
);

const IPL_2021 = IPL_2019.map(team =>
  team.short === 'KXIP'
    ? t('Punjab Kings', 'PBKS', '#ed1b24')
    : team
);

const IPL_2022: HistoricalTeam[] = [
  ...IPL_2021,
  t('Gujarat Titans', 'GT', '#1c2c5b'),
  t('Lucknow Super Giants', 'LSG', '#00a6a6'),
];

const IPL_2024 = IPL_2022.map(team =>
  team.short === 'RCB'
    ? t('Royal Challengers Bengaluru', 'RCB', '#d71920')
    : team
);

const IPL_2025 = IPL_2024;

// IPL 2026 - 10 teams
const IPL_2026: HistoricalTeam[] = [
  t('Chennai Super Kings', 'CSK', '#f9cd05'),
  t('Delhi Capitals', 'DC', '#17449b'),
  t('Gujarat Titans', 'GT', '#1c2c5b'),
  t('Kolkata Knight Riders', 'KKR', '#5a2d82'),
  t('Lucknow Super Giants', 'LSG', '#00a6a6'),
  t('Mumbai Indians', 'MI', '#004ba0'),
  t('Punjab Kings', 'PBKS', '#ed1b24'),
  t('Rajasthan Royals', 'RR', '#ea1a85'),
  t('Royal Challengers Bengaluru', 'RCB', '#d71920'),
  t('Sunrisers Hyderabad', 'SRH', '#f26522'),
];

// PSL TEAMS

const PSL_2016: HistoricalTeam[] = [
  t('Islamabad United', 'IU', '#d71920'),
  t('Karachi Kings', 'KK', '#004ba0'),
  t('Lahore Qalandars', 'LQ', '#00843d'),
  t('Peshawar Zalmi', 'PZ', '#ffb81c'),
  t('Quetta Gladiators', 'QG', '#5a2d82'),
];

const PSL_2018: HistoricalTeam[] = [
  ...PSL_2016,
  t('Multan Sultans', 'MS', '#00a3e0'),
];

const PSL_2026: HistoricalTeam[] = [
  t('Hyderabad Kingsmen', 'HK', '#17449b'),
  t('Islamabad United', 'IU', '#d71920'),
  t('Karachi Kings', 'KK', '#004ba0'),
  t('Lahore Qalandars', 'LQ', '#00843d'),
  t('Multan Sultans', 'MS', '#00a3e0'),
  t('Peshawar Zalmi', 'PZ', '#ffb81c'),
  t('Quetta Gladiators', 'QG', '#5a2d82'),
  t('Rawalpindiz', 'RWP', '#d71920'),
];

// BBL TEAMS

const BBL: HistoricalTeam[] = [
  t('Adelaide Strikers', 'STR', '#0072ce'),
  t('Brisbane Heat', 'HEA', '#5a2d82'),
  t('Hobart Hurricanes', 'HUR', '#6c2c91'),
  t('Melbourne Renegades', 'REN', '#d71920'),
  t('Melbourne Stars', 'STA', '#00843d'),
  t('Perth Scorchers', 'SCO', '#f26522'),
  t('Sydney Sixers', 'SIX', '#e31837'),
  t('Sydney Thunder', 'THU', '#00a3e0'),
];

// SA20 TEAMS

const SA20: HistoricalTeam[] = [
  t("Durban's Super Giants", 'DSG', '#5a2d82'),
  t('Joburg Super Kings', 'JSK', '#c9a227'),
  t('MI Cape Town', 'MICT', '#004ba0'),
  t('Paarl Royals', 'PR', '#6d1d45'),
  t('Pretoria Capitals', 'PC', '#00a3e0'),
  t('Sunrisers Eastern Cape', 'SEC', '#f26522'),
];

// THE HUNDRED TEAMS

const HUNDRED_2021_M: HistoricalTeam[] = [
  t('Birmingham Phoenix', 'BPH', '#f5a623'),
  t('London Spirit', 'LSP', '#5a2d82'),
  t('Manchester Originals', 'MOR', '#00a3e0'),
  t('Northern Superchargers', 'NSC', '#c7a900'),
  t('Oval Invincibles', 'OVI', '#17243b'),
  t('Southern Brave', 'SOB', '#007f5f'),
  t('Trent Rockets', 'TR', '#d71920'),
  t('Welsh Fire', 'WF', '#d71920'),
];

const HUNDRED_2021_W: HistoricalTeam[] =
  HUNDRED_2021_M.map(team => ({
    ...team,
    name: `${team.name} Women`,
    short: `${team.short}W`,
  }));

const HUNDRED_2026_M: HistoricalTeam[] = [
  t('Birmingham Phoenix', 'BPH', '#f5a623'),
  t('London Spirit', 'LSP', '#5a2d82'),
  t('Manchester Super Giants', 'MSG', '#00a3e0'),
  t('SunRisers Leeds', 'SRL', '#c7a900'),
  t('MI London', 'MIL', '#17243b'),
  t('Southern Brave', 'SOB', '#007f5f'),
  t('Trent Rockets', 'TR', '#d71920'),
  t('Welsh Fire', 'WF', '#d71920'),
];

const HUNDRED_2026_W: HistoricalTeam[] =
  HUNDRED_2026_M.map(team => ({
    ...team,
    name: `${team.name} Women`,
    short: `${team.short}W`,
  }));

// ILT20 TEAMS

const ILT20: HistoricalTeam[] = [
  t('Abu Dhabi Knight Riders', 'ADKR', '#5a2d82'),
  t('Desert Vipers', 'DV', '#d71920'),
  t('Dubai Capitals', 'DC', '#17449b'),
  t('Gulf Giants', 'GG', '#f5a623'),
  t('MI Emirates', 'MIE', '#004ba0'),
  t('Sharjah Warriorz', 'SW', '#d71920'),
];

// MLC TEAMS

const MLC: HistoricalTeam[] = [
  t('Los Angeles Knight Riders', 'LAKR', '#5a2d82'),
  t('MI New York', 'MINY', '#004ba0'),
  t('San Francisco Unicorns', 'SFU', '#00a3e0'),
  t('Seattle Orcas', 'SEO', '#00843d'),
  t('Texas Super Kings', 'TSK', '#f5a623'),
  t('Washington Freedom', 'WAF', '#17449b'),
];

// WPL TEAMS

const WPL: HistoricalTeam[] = [
  t('Delhi Capitals Women', 'DCW', '#17449b'),
  t('Gujarat Giants Women', 'GGW', '#f5a623'),
  t('Mumbai Indians Women', 'MIW', '#004ba0'),
  t('Royal Challengers Bengaluru Women', 'RCBW', '#d71920'),
  t('UP Warriorz', 'UPW', '#e0a800'),
];

// ALL HISTORICAL TEAMS

export const HISTORICAL_TEAMS: Record<
  string,
  Record<string, HistoricalTeam[]>
> = {
  IPL: {
    '2008': IPL_2008,
    '2009': IPL_2008,
    '2010': IPL_2008,
    '2011': IPL_2011,
    '2012': IPL_2012,
    '2013': IPL_2013,
    '2014': IPL_2013,
    '2015': IPL_2013,
    '2016': IPL_2016,
    '2017': IPL_2016,
    '2018': IPL_2018,
    '2019': IPL_2019,
    '2020': IPL_2019,
    '2021': IPL_2021,
    '2022': IPL_2022,
    '2023': IPL_2022,
    '2024': IPL_2024,
    '2025': IPL_2025,
    '2026': IPL_2026,
  },

  PSL: {
    '2016': PSL_2016,
    '2017': PSL_2016,
    '2018': PSL_2018,
    '2019': PSL_2018,
    '2020': PSL_2018,
    '2021': PSL_2018,
    '2022': PSL_2018,
    '2023': PSL_2018,
    '2024': PSL_2018,
    '2025': PSL_2018,
    '2026': PSL_2026,
  },

  BBL: {
    '2011-12': BBL,
    '2012-13': BBL,
    '2013-14': BBL,
    '2014-15': BBL,
    '2015-16': BBL,
    '2016-17': BBL,
    '2017-18': BBL,
    '2018-19': BBL,
    '2019-20': BBL,
    '2020-21': BBL,
    '2021-22': BBL,
    '2022-23': BBL,
    '2023-24': BBL,
    '2024-25': BBL,
    '2025-26': BBL,
  },

  SA20: {
    '2022-23': SA20,
    '2023-24': SA20,
    '2024-25': SA20,
    '2025-26': SA20,
  },

  HUNDRED_M: {
    '2021': HUNDRED_2021_M,
    '2022': HUNDRED_2021_M,
    '2023': HUNDRED_2021_M,
    '2024': HUNDRED_2021_M,
    '2025': HUNDRED_2021_M,
    '2026': HUNDRED_2026_M,
  },

  HUNDRED_W: {
    '2021': HUNDRED_2021_W,
    '2022': HUNDRED_2021_W,
    '2023': HUNDRED_2021_W,
    '2024': HUNDRED_2021_W,
    '2025': HUNDRED_2021_W,
    '2026': HUNDRED_2026_W,
  },

  ILT20: {
    '2022-23': ILT20,
    '2023-24': ILT20,
    '2024-25': ILT20,
    '2025-26': ILT20,
  },

  MLC: {
    '2023': MLC,
    '2024': MLC,
    '2025': MLC,
    '2026': MLC,
  },

  WPL: {
    '2023': WPL,
    '2024': WPL,
    '2025': WPL,
    '2026': WPL,
  },
};
