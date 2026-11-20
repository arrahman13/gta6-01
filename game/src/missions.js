// The Port Solenne story, as data. Rafi Solano drifts home with one bag and
// one debt; Marisol Vega, who runs the Leonida Mart and half the favours in
// town, collects. Six missions, each a short list of steps the simulation
// walks one at a time:
//   goto        reach the marker (a step may ask for a named car, or quietly
//               raise the alarm when it completes)
//   collect     touch every point in `points`
//   checkpoints pass the gates in order before the clock empties
//   escape      reach the marker, then keep your head down until the heat
//               cools below the step's star ceiling
//   shootout    put down the rivals waiting at the marker, then step onto it
// Phone dialogue opens and closes every mission; side activities reuse the
// same phone and banner plumbing, and their lines live at the bottom.

export const CAST = {
  rafi: { name: 'Rafi', color: '#ffd94d' },
  marisol: { name: 'Marisol', color: '#ff8ad4' },
  pepe: { name: 'Pepe', color: '#52ffa8' },
  vera: { name: 'Vera', color: '#39e6ff' },
  ghost: { name: '???', color: '#f2f2f2' },
};

export const MISSIONS = [
  {
    id: 'mart-opening',
    title: 'Mart Opening',
    giver: 'marisol',
    reward: 250,
    intro: [
      ['marisol', 'Rafi Solano, as I live and breathe. A decade gone and you still owe me a sandwich.'],
      ['rafi', 'Add it to the tab, Tía. Word is the Mart could use a driver.'],
      ['marisol', 'The Mart could use a small miracle. Take the coupe, fetch my crates from the Old Market, and get back before the ice gives up.'],
    ],
    outro: [
      ['marisol', 'Crates cold, driving warm. You still treat the road like it owes you rent.'],
      ['rafi', 'The road and me, we have an understanding.'],
    ],
    steps: [
      { type: 'goto', label: 'Get to the Old Market stalls', x: 430, y: 300, radius: 60 },
      { type: 'goto', label: 'Load the crates and return to Leonida Mart', x: 1300, y: 760, radius: 64, carry: 'crates of cafecito' },
    ],
  },
  {
    id: 'receipt-trouble',
    title: 'Receipt for Trouble',
    giver: 'marisol',
    reward: 300,
    intro: [
      ['marisol', 'Three regulars. Three tabs unpaid since the storm. Their receipts are pinned up where each one drinks, dances and hides.'],
      ['rafi', 'You are sending me after paper?'],
      ['marisol', 'I am sending you after promises. The paper is only the evidence.'],
    ],
    outro: [
      ['marisol', 'Every last promise, collected. You have a gift, sobrino.'],
      ['rafi', 'For chasing paper around a hurricane town?'],
      ['marisol', 'For finishing what you start.'],
    ],
    steps: [
      {
        type: 'collect', label: 'Collect the 3 unpaid receipts', radius: 44,
        points: [
          { x: 760, y: 560, label: 'receipt at Cafe Brisa' },
          { x: 1780, y: 1600, label: 'receipt at the Arcade' },
          { x: 2280, y: 2050, label: 'receipt at the beach bar' },
        ],
      },
      { type: 'goto', label: 'Bring the receipts back to Marisol', x: 1300, y: 760, radius: 64 },
    ],
  },
  {
    id: 'neon-repo',
    title: 'Neon Repo',
    giver: 'pepe',
    reward: 450,
    intro: [
      ['pepe', 'Rafi! Pepe, down at the marina. There is a Brisa GT sleeping in my lot that belongs to somebody else\u2019s debt.'],
      ['rafi', 'And you would like it to belong to yours.'],
      ['pepe', 'I would like it inside Marisol\u2019s garage before its owner wakes from his nap. Fair warning: the alarm has opinions.'],
    ],
    outro: [
      ['pepe', 'Listen to her purr! Half the paint, all of the glory.'],
      ['rafi', 'The paint can walk home. I did the driving.'],
    ],
    steps: [
      { type: 'goto', label: 'Reach the marina lot', x: 2760, y: 1180, radius: 70 },
      { type: 'goto', label: 'Steal the Brisa GT and deliver it to the garage on Neon Mile', x: 1780, y: 1400, radius: 70, needsCarModel: 'Brisa GT', alarmStars: 2 },
    ],
  },
  {
    id: 'parade-pileup',
    title: 'Parade Day Pileup',
    giver: 'vera',
    reward: 500,
    intro: [
      ['vera', 'Vera, Radio Solenne. The parade needs a scout car out front — somebody quick, shameless, and insured by pure optimism.'],
      ['rafi', 'That is the kindest description I have ever been given.'],
      ['vera', 'Thread every gate before the band finishes tuning. The whole town is watching, darling.'],
    ],
    outro: [
      ['vera', 'And the crowd goes mild! Gorgeous driving, scout.'],
      ['rafi', 'Mild is fine by me. Mild pays exactly the same.'],
    ],
    steps: [
      {
        type: 'checkpoints', label: 'Run the parade gates in order', time: 150,
        points: [
          { x: 720, y: 240 }, { x: 1680, y: 660 }, { x: 2640, y: 1080 },
          { x: 2160, y: 1500 }, { x: 1200, y: 1920 }, { x: 420, y: 2280 },
        ],
      },
    ],
  },
  {
    id: 'ghost-machine',
    title: 'The Ghost in the Machine',
    giver: 'ghost',
    reward: 600,
    intro: [
      ['ghost', 'psst. over here. yes, the little ghost on the arcade cabinet. no, nobody else can hear me.'],
      ['rafi', 'Wonderful. The town has finally broken me.'],
      ['ghost', 'the storm blew my five star-buddies clean out of the machine. fetch them home and i shall make it worth your while.'],
    ],
    outro: [
      ['ghost', 'all five home! you are a good human. spend it on something ridiculous.'],
      ['rafi', 'Talking to you was the ridiculous part.'],
    ],
    steps: [
      {
        type: 'collect', label: 'Find the 5 lost star-buddies', radius: 46, ghostHunt: true,
        points: [
          { x: 1440, y: 1240, label: 'star-buddy in the park' },
          { x: 3230, y: 2380, label: 'star-buddy at the pier' },
          { x: 820, y: 760, label: 'star-buddy over Palmetto Heights' },
          { x: 330, y: 1180, label: 'star-buddy at the Old Market' },
          { x: 2700, y: 2050, label: 'star-buddy by the marina dunes' },
        ],
      },
      { type: 'goto', label: 'Return to the Solenne Arcade', x: 1780, y: 1620, radius: 64 },
    ],
  },
  {
    id: 'sunset-ledger',
    title: 'The Sunset Ledger',
    giver: 'marisol',
    reward: 1000,
    intro: [
      ['marisol', 'One last job, sobrino. The Velvet Crew has decided it wants my ledger — every favour this town owes, bound in one book.'],
      ['rafi', 'And books burn so very nicely. Where is it sleeping?'],
      ['marisol', 'The old hotel safe. Take it back, shake off the heat, and carry it to the lighthouse. Then you and I are square.'],
    ],
    outro: [
      ['marisol', 'The ledger sleeps with the lighthouse keeper now. Nobody gets to buy this town.'],
      ['rafi', 'Not even me? I was prepared to offer two whole sandwiches.'],
      ['marisol', 'For you, sobrino, the town is family. And family eats free.'],
    ],
    steps: [
      { type: 'shootout', label: 'Take the ledger from the Hotel Palmera', x: 2300, y: 700, radius: 60, rivals: 3 },
      { type: 'escape', label: 'Lose the heat and reach Lighthouse Point', x: 3120, y: 2260, radius: 80, stars: 2 },
    ],
  },
];

// One-liners for the free-roam systems, keyed by the event that fires them.
export const SIDE_TEXT = {
  taxiStart: 'Passenger aboard. The meter is running — gently, mind you, this is Solenne.',
  taxiDone: 'Fare paid, plus a little extra for the sunset.',
  raceStart: 'Pier race: six gates, one clock, zero excuses.',
  raceDone: 'The pier crowd applauds. Somebody throws a paper crown.',
  shopLine: 'Leonida Mart receipt — snacks $20 · ammo $40 · advice free, and worth every cent.',
  busted: 'BUSTED — the officers of Port Solenne thank you for your cooperation.',
  wasted: 'WASTED — you wake up at the clinic. The bill is one stern look.',
  storyDone: 'STORY COMPLETE — Port Solenne is yours. Fares, races and ghosts remain.',
};
