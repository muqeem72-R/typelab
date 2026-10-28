/* TypeLab practice sentences: short original sentences written for this project.
   Plain ASCII only, so every character can be shown on the virtual keyboard. */
(function (root) {
  "use strict";

  const sentences = [
    "The quick brown fox jumps over the lazy dog.",
    "Good typing is a habit built one calm minute at a time.",
    "Keep your eyes on the screen and let your fingers find the keys.",
    "Accuracy first, speed second: the speed always follows.",
    "A small step every day is better than a big leap once a month.",
    "Rest your fingers on the home row and keep your wrists relaxed.",
    "Slow is smooth, and smooth soon becomes fast.",
    "Mistakes are only information about which key needs more practice.",
    "The train left the station at seven and arrived just before noon.",
    "She poured a cup of tea and watched the rain run down the window.",
    "We walked along the river until the sun went down behind the hills.",
    "Please send the report by Friday, and call me if anything is unclear.",
    "Where did you put the blue notebook that was on my desk?",
    "It was a quiet town, and everyone knew the baker by name.",
    "The old clock in the hall struck twelve, and the house fell silent.",
    "Learning to type well saves hours of time over the years.",
    "A clean desk, a good chair and a steady rhythm make typing easier.",
    "Birds sang in the garden while the kettle began to boil.",
    "He opened the box, looked inside, and smiled at what he found.",
    "How many words can you type in one minute without a single mistake?",
    "The library opens at nine, and the first visitors are always students.",
    "Fresh bread, ripe fruit and warm milk were laid out on the table.",
    "Mountains look small from far away but grow huge as you climb.",
    "Every expert was once a beginner who refused to give up.",
    "Typing is a skill, and skills grow with patient and regular practice.",
    "The market was full of colour, noise and the smell of fresh spices.",
    "Do not look at your hands; trust the keys and trust your fingers.",
    "On a clear night you can see thousands of stars from the roof.",
    "Our team finished the project early, so we had time to test it twice.",
    "The little boat rocked gently as the tide came in.",
    "Take a deep breath, sit up straight, and begin again.",
    "Honest feedback is a gift, even when it is hard to hear.",
    "The teacher wrote three questions on the board and asked us to think.",
    "A good sentence is simple, clear and exactly as long as it needs to be.",
    "They planted a tree on the hill, and years later it gave shade to many.",
    "Is it better to type fast and fix errors, or to type slowly and get it right?",
    "The bus was late, so we shared a taxi and talked the whole way.",
    "Summer evenings are long, warm and full of the sound of children playing.",
    "Back up your work often; a lost file costs more than a spare copy.",
    "Her favourite book was about a lighthouse keeper who loved the sea.",
    "Rhythm matters: even keystrokes beat fast bursts followed by long pauses.",
    "The recipe needs two eggs, a cup of flour, some sugar and a pinch of salt.",
    "He did not know the answer, but he knew exactly where to look.",
    "When the lights went out, we lit a candle and told stories.",
    "Practice a little every day, and in a month you will not believe your speed.",
    "The river was wide and slow, and the water shone like glass.",
    "Their journey took them across deserts, over mountains and through green valleys.",
    "Quiet focus beats long hours of tired, distracted typing.",
    "The doctor said to drink water, rest well and walk every morning.",
    "Nothing replaces plain, steady repetition when you learn a new skill.",
  ];

  const api = { sentences };
  if (typeof module === "object" && module.exports) module.exports = api;
  else ((root.TL = root.TL || {}).data = root.TL.data || {}).sentences = api;
})(typeof window !== "undefined" ? window : globalThis);
