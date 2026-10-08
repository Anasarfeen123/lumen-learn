// Classroom activities beyond the four word games. Every activity teaches
// first (a short explanation and a worked example), then practises. Answer
// keys are fixed and unambiguous; explanations follow every wrong answer.
// Content is versioned so attempts can be traced to what was shown.

export type SkillId = 'reading' | 'spelling' | 'vocabulary' | 'comprehension' | 'writing';

export interface Choice {
  id: string;
  /** What the learner sees, e.g. a sentence with a gap. */
  prompt: string;
  /** Spoken version of the prompt (gaps read as "blank"), if different. */
  say?: string;
  options: string[];
  answer: string;
  hint: string;
  /** Why the answer is right, shown after the item. */
  explain: string;
  picture?: string;
  /** 1 = gentler, 2 = more demanding. */
  level: 1 | 2;
}

export interface OrderItem {
  id: string;
  words: string[];
  picture?: string;
  hint: string;
  level: 1 | 2;
}

export interface StoryQuiz {
  id: string;
  storyId: string;
  questions: Choice[];
}

export interface WritePrompt {
  id: string;
  prompt: string;
  word: string;
  picture?: string;
}

export interface ActivityInfo {
  id: string;
  title: string;
  blurb: string;
  /** Icon name (see ACTIVITY_ICONS in the Classroom). */
  icon: 'pair' | 'puzzle' | 'question' | 'sort' | 'book' | 'pencil';
  skill: SkillId;
  needsSpeech?: boolean;
  version: number;
  teach: { title: string; text: string; example: string; exampleNote: string };
}

export const ACTIVITIES: ActivityInfo[] = [
  {
    id: 'twins', title: 'Word twins', blurb: 'Ship or shop? Pick the word that fits.', icon: 'pair', skill: 'reading', version: 1,
    teach: {
      title: 'One letter changes the word',
      text: 'Some words look almost the same. Change one letter, and the meaning changes. Read the sentence, then look closely at each letter.',
      example: 'A big ship sails on the sea.',
      exampleNote: 'ship has an i. A ship is a big boat. shop has an o. A shop is where we buy things. Only ship can sail.',
    },
  },
  {
    id: 'patterns', title: 'Letter teams', blurb: 'Which letters fill the gap?', icon: 'puzzle', skill: 'spelling', version: 1,
    teach: {
      title: 'Two letters, one sound',
      text: 'Some letters work as a team and make one sound: sh as in ship, ch as in chick, ai as in rain, oa as in boat, ee as in tree. Say the word, listen for the sound, then pick the team.',
      example: 'r _ _ n  →  rain',
      exampleNote: 'rain has the long "ay" sound in the middle. The team ai makes that sound here.',
    },
  },
  {
    id: 'riddles', title: 'Riddles', blurb: 'Read the clues and guess the word.', icon: 'question', skill: 'vocabulary', version: 1,
    teach: {
      title: 'Clues point to one word',
      text: 'Each riddle gives two or three clues. Read every clue. Think of a word that fits all of them, not just one.',
      example: 'I am yellow. I shine in the sky. I keep you warm.  →  sun',
      exampleNote: 'A lemon is yellow, but it doesn’t shine in the sky. Only the sun fits every clue.',
    },
  },
  {
    id: 'order', title: 'Sentence order', blurb: 'Put the words in order to make a sentence.', icon: 'sort', skill: 'reading', version: 1,
    teach: {
      title: 'A sentence tells one idea',
      text: 'A sentence starts with a capital letter and ends with a full stop. Most sentences say who, then what they do.',
      example: 'frog / The / jump. / can  →  The frog can jump.',
      exampleNote: '"The" has a capital T, so it goes first. "jump." has the full stop, so it goes last.',
    },
  },
  {
    id: 'story', title: 'Story questions', blurb: 'Read a short story and answer questions.', icon: 'book', skill: 'comprehension', version: 1,
    teach: {
      title: 'The answer is in the story',
      text: 'Read the story first. For each question, find the part of the story that answers it. You can look back at the story any time.',
      example: 'Pip is a pup. Pip has a red ball.  What colour is the ball?  →  red',
      exampleNote: 'The story says "Pip has a red ball", so the answer is red.',
    },
  },
  {
    id: 'write', title: 'Write a sentence', blurb: 'Write your own sentence about a picture.', icon: 'pencil', skill: 'writing', version: 1,
    teach: {
      title: 'Your own sentence',
      text: 'Look at the picture and write one sentence about it. Start with a capital letter and end with a full stop. There is no wrong idea, and spelling is yours to try.',
      example: 'The frog sat on a green leaf.',
      exampleNote: 'It starts with a capital T, says something about the frog, and ends with a full stop.',
    },
  },
];

export const ACTIVITY_BY_ID = new Map(ACTIVITIES.map((a) => [a.id, a]));

// ------------------------------------------------------------------ content

export const TWINS: Choice[] = [
  { id: 't1', level: 1, prompt: 'A big ___ sails on the sea.', options: ['ship', 'shop'], answer: 'ship', hint: 'Which one can float and sail?', explain: 'ship (with an i) is a big boat. shop (with an o) is a place to buy things.', picture: 'ship' },
  { id: 't2', level: 1, prompt: 'I wear a ___ on my head.', options: ['hat', 'hot'], answer: 'hat', hint: 'Which one can you wear?', explain: 'hat (with an a) goes on your head. hot (with an o) means very warm.', picture: 'top hat' },
  { id: 't3', level: 1, prompt: 'I sleep in my ___ at night.', options: ['bed', 'bad'], answer: 'bed', hint: 'Where do you sleep?', explain: 'bed (with an e) is where you sleep. bad (with an a) means not good.', picture: 'bed' },
  { id: 't4', level: 1, prompt: 'The ___ has a long tail and says meow.', options: ['cat', 'cut'], answer: 'cat', hint: 'Which one is an animal?', explain: 'cat (with an a) is a pet. cut (with a u) is what scissors do.', picture: 'cat' },
  { id: 't5', level: 1, prompt: 'I write with a ___.', options: ['pen', 'pin'], answer: 'pen', hint: 'What do you write with?', explain: 'pen (with an e) is for writing. pin (with an i) is small and sharp.', picture: 'pen' },
  { id: 't6', level: 2, prompt: 'The ___ swims in the pond and says quack.', options: ['duck', 'dock'], answer: 'duck', hint: 'Which one is a bird?', explain: 'duck (with a u) is a bird. dock (with an o) is where boats stop.', picture: 'duck' },
  { id: 't7', level: 2, prompt: 'A ___ shines in the night sky.', options: ['star', 'stir'], answer: 'star', hint: 'What do you see in the sky at night?', explain: 'star (with an a) shines in the sky. stir (with an i) is what you do with a spoon.', picture: 'star' },
  { id: 't8', level: 2, prompt: 'Put on your ___ before your shoes.', options: ['sock', 'sack'], answer: 'sock', hint: 'What goes on your foot?', explain: 'sock (with an o) goes on your foot. sack (with an a) is a big bag.', picture: 'socks' },
  { id: 't9', level: 2, prompt: 'The ___ rings at the end of school.', options: ['bell', 'ball'], answer: 'bell', hint: 'Which one rings?', explain: 'bell (with an e) rings. ball (with an a) bounces.', picture: 'bell' },
  { id: 't10', level: 2, prompt: 'We sailed the ___ across the lake.', options: ['boat', 'boot'], answer: 'boat', hint: 'Which one floats on water?', explain: 'boat (oa) floats on water. boot (oo) goes on your foot.', picture: 'boat' },
];

export const PATTERNS: Choice[] = [
  { id: 'p1', level: 1, prompt: '_ _ ip', say: 'ship', options: ['sh', 'ch', 'th'], answer: 'sh', hint: 'Listen to the first sound: shh, like being quiet.', explain: 'ship starts with sh, the quiet "shh" sound.', picture: 'ship' },
  { id: 'p2', level: 1, prompt: 'fi _ _', say: 'fish', options: ['sh', 'ch', 'ck'], answer: 'sh', hint: 'Listen to the end: shh.', explain: 'fish ends with sh.', picture: 'fish' },
  { id: 'p3', level: 1, prompt: '_ _ ick', say: 'chick', options: ['ch', 'sh', 'th'], answer: 'ch', hint: 'It starts like "cheese" and "chair".', explain: 'chick starts with ch, like chair.', picture: 'chick' },
  { id: 'p4', level: 1, prompt: 'r _ _ n', say: 'rain', options: ['ai', 'oa', 'ee'], answer: 'ai', hint: 'The middle sound is "ay", like in train.', explain: 'rain uses ai for the "ay" sound, like train.', picture: 'rain cloud' },
  { id: 'p5', level: 1, prompt: 'b _ _ t', say: 'boat', options: ['oa', 'ai', 'ee'], answer: 'oa', hint: 'The middle sound is "oh", like in coat.', explain: 'boat uses oa for the "oh" sound, like coat.', picture: 'boat' },
  { id: 'p6', level: 2, prompt: 'tr _ _', say: 'tree', options: ['ee', 'ai', 'oa'], answer: 'ee', hint: 'The end sound is "ee", like in sheep.', explain: 'tree ends with ee, like sheep.', picture: 'tree' },
  { id: 'p7', level: 2, prompt: '_ _ ale', say: 'whale', options: ['wh', 'sh', 'ch'], answer: 'wh', hint: 'It starts like "what" and "where".', explain: 'whale starts with wh, like what and where.', picture: 'whale' },
  { id: 'p8', level: 2, prompt: '_ _ air', say: 'chair', options: ['ch', 'sh', 'th'], answer: 'ch', hint: 'It starts like "chick".', explain: 'chair starts with ch, like chick.', picture: 'chair' },
  { id: 'p9', level: 2, prompt: 'c _ _ t', say: 'coat', options: ['oa', 'ee', 'ai'], answer: 'oa', hint: 'The middle sound is "oh".', explain: 'coat uses oa for the "oh" sound.', picture: 'coat' },
  { id: 'p10', level: 2, prompt: 'tr _ _ n', say: 'train', options: ['ai', 'ee', 'oa'], answer: 'ai', hint: 'It rhymes with rain.', explain: 'train rhymes with rain, and both use ai.', picture: 'train' },
];

export const RIDDLES: Choice[] = [
  { id: 'r1', level: 1, prompt: 'I have four legs. I bark. I wag my tail. What am I?', options: ['dog', 'cat', 'fish'], answer: 'dog', hint: 'Which one barks?', explain: 'A dog barks and wags its tail. A cat meows, and a fish has no legs.', picture: 'dog' },
  { id: 'r2', level: 1, prompt: 'I am round and white. I shine at night. What am I?', options: ['moon', 'sun', 'star'], answer: 'moon', hint: 'Which one is big and round at night?', explain: 'The moon is round and shines at night. The sun shines in the day.', picture: 'moon' },
  { id: 'r3', level: 1, prompt: 'I am green. I hop. I live by a pond. What am I?', options: ['frog', 'duck', 'pig'], answer: 'frog', hint: 'Which one hops?', explain: 'A frog is green, hops and lives by a pond.', picture: 'frog' },
  { id: 'r4', level: 1, prompt: 'You sit on me. I have four legs but I am not an animal. What am I?', options: ['chair', 'bed', 'dog'], answer: 'chair', hint: 'Which one do you sit on at a table?', explain: 'A chair has four legs and you sit on it. A dog has legs too, but it is an animal.', picture: 'chair' },
  { id: 'r5', level: 1, prompt: 'I fall from clouds. I make puddles. What am I?', options: ['rain', 'sun', 'wind'], answer: 'rain', hint: 'What makes things wet?', explain: 'Rain falls from clouds and makes puddles.', picture: 'rain cloud' },
  { id: 'r6', level: 2, prompt: 'I am very big and grey. I have a long trunk. What am I?', options: ['elephant', 'giraffe', 'whale'], answer: 'elephant', hint: 'Which one has a trunk?', explain: 'An elephant is big and grey with a long trunk. A giraffe has a long neck instead.', picture: 'elephant' },
  { id: 'r7', level: 2, prompt: 'I have eight arms. I live in the sea. What am I?', options: ['octopus', 'crab', 'fish'], answer: 'octopus', hint: 'Which one has the most arms?', explain: 'An octopus has eight arms. A crab has claws, and a fish has fins.', picture: 'octopus' },
  { id: 'r8', level: 2, prompt: 'I am orange. Rabbits like to eat me. I grow under the ground. What am I?', options: ['carrot', 'apple', 'tomato'], answer: 'carrot', hint: 'Which one grows under the ground?', explain: 'A carrot is orange and grows under the ground. Apples and tomatoes grow above it.', picture: 'carrot' },
  { id: 'r9', level: 2, prompt: 'I fly up into space. I have a pointy top and fire at the bottom. What am I?', options: ['rocket', 'kite', 'robot'], answer: 'rocket', hint: 'Which one goes to space?', explain: 'A rocket flies into space with fire at the bottom. A kite stays near the ground.', picture: 'rocket' },
  { id: 'r10', level: 2, prompt: 'I have a neck so long I can eat from tall trees. What am I?', options: ['giraffe', 'lion', 'monkey'], answer: 'giraffe', hint: 'Which one has the longest neck?', explain: 'A giraffe has a very long neck, so it can reach tall trees.', picture: 'giraffe' },
];

export const ORDER: OrderItem[] = [
  { id: 'o1', level: 1, words: ['The', 'frog', 'can', 'jump.'], picture: 'frog', hint: 'Start with the word that has a capital letter.' },
  { id: 'o2', level: 1, words: ['A', 'duck', 'is', 'in', 'the', 'rain.'], picture: 'duck', hint: 'Start with "A". What is the duck doing?' },
  { id: 'o3', level: 1, words: ['I', 'like', 'my', 'red', 'hat.'], picture: 'top hat', hint: 'Start with "I". The full stop goes last.' },
  { id: 'o4', level: 1, words: ['The', 'cat', 'sat', 'on', 'the', 'bed.'], picture: 'cat', hint: 'Who sat? Start with "The cat".' },
  { id: 'o5', level: 2, words: ['My', 'friend', 'has', 'a', 'red', 'boat.'], picture: 'boat', hint: 'Start with "My friend". What does your friend have?' },
  { id: 'o6', level: 2, words: ['We', 'saw', 'a', 'big', 'elephant.'], picture: 'elephant', hint: 'Start with "We". What did we see?' },
  { id: 'o7', level: 2, words: ['The', 'moon', 'is', 'bright', 'tonight.'], picture: 'moon', hint: 'Start with "The moon". The word with the full stop goes last.' },
  { id: 'o8', level: 2, words: ['A', 'butterfly', 'sat', 'in', 'the', 'garden.'], picture: 'butterfly', hint: 'Start with "A butterfly". Where did it sit?' },
];

export const STORY_QUIZZES: StoryQuiz[] = [
  {
    id: 'q-pip', storyId: 'pip-the-pup', questions: [
      { id: 'q1', level: 1, prompt: 'What colour is Pip’s ball?', options: ['red', 'blue', 'green'], answer: 'red', hint: 'Look at the very first page.', explain: 'The story says "Pip has a red ball."' },
      { id: 'q2', level: 1, prompt: 'Where did Pip look first?', options: ['in the box', 'in the bag', 'under the bed'], answer: 'in the box', hint: 'Look at page 3.', explain: '"Pip looks in the box. No ball." Then Pip looks in the bag.' },
      { id: 'q3', level: 1, prompt: 'Where was the ball in the end?', options: ['by the tree', 'in the bag', 'on the bed'], answer: 'by the tree', hint: 'Look at the last page.', explain: 'The story says "The ball was by the tree!"' },
    ],
  },
  {
    id: 'q-frog', storyId: 'frog-and-the-rain', questions: [
      { id: 'q1', level: 1, prompt: 'Why did Frog want rain?', options: ['The pond was low', 'Frog was cold', 'Duck asked for it'], answer: 'The pond was low', hint: 'Look at what Frog says on the first page.', explain: 'Frog says "I need rain. My pond is low."' },
      { id: 'q2', level: 2, prompt: 'What came before the rain?', options: ['wind and grey clouds', 'snow', 'a rainbow'], answer: 'wind and grey clouds', hint: 'Look at page 3.', explain: '"Then the wind blew. Grey clouds rolled in." Then the rain fell.' },
      { id: 'q3', level: 2, prompt: 'How did Frog feel at the end?', options: ['happy', 'sad', 'sleepy'], answer: 'happy', hint: 'What did Frog do when the pond grew?', explain: 'Frog "hopped and sang" and said "Thank you, rain!", so Frog was happy.' },
    ],
  },
  {
    id: 'q-rabbit', storyId: 'rabbits-garden', questions: [
      { id: 'q1', level: 2, prompt: 'What did Rabbit plant?', options: ['seeds', 'trees', 'rocks'], answer: 'seeds', hint: 'Look at the first page.', explain: 'Rabbit "planted seeds in tidy rows".' },
      { id: 'q2', level: 2, prompt: 'Who helped Rabbit wait?', options: ['Mouse', 'Duck', 'Frog'], answer: 'Mouse', hint: 'Look at page 3.', explain: '"Her friend Mouse came by" and said "Let’s wait together."' },
      { id: 'q3', level: 2, prompt: 'What did Rabbit learn?', options: ['A garden is better with friends', 'Seeds grow in one day', 'Carrots are blue'], answer: 'A garden is better with friends', hint: 'Look at what Rabbit says at the end.', explain: 'Rabbit says "A garden is better with friends."' },
    ],
  },
];

export const WRITE_PROMPTS: WritePrompt[] = [
  { id: 'w1', prompt: 'Write a sentence about the frog.', word: 'frog', picture: 'frog' },
  { id: 'w2', prompt: 'Write a sentence about the moon.', word: 'moon', picture: 'moon' },
  { id: 'w3', prompt: 'Write a sentence about the dog.', word: 'dog', picture: 'dog' },
  { id: 'w4', prompt: 'Write a sentence about the rocket.', word: 'rocket', picture: 'rocket' },
  { id: 'w5', prompt: 'Write a sentence about the cake.', word: 'cake', picture: 'cake' },
];
