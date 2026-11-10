// Writing / Language content for 4th and 5th graders (Common Core ELA Language, grades 4-5).
// Adds missions and journal prompts to the existing Writing subject (see writing.js).
window.SUBJECTS.writing.missions.push(
  {
    id: 'write45-spell', name: 'Spelling Bee', icon: '🐝', desc: 'Tricky words for big spellers', grades: [4, 5],
    questions: [
      // Grade 4
      { id: 'write45-spell-01', type: 'spell', word: 'library', sentence: 'We borrowed three books from the library.', grades: [4] },
      { id: 'write45-spell-02', type: 'spell', word: 'calendar', sentence: 'Mark the field trip on the calendar.', grades: [4] },
      { id: 'write45-spell-03', type: 'spell', word: 'temperature', sentence: 'The temperature dropped after sunset.', grades: [4] },
      { id: 'write45-spell-04', type: 'spell', word: 'knowledge', sentence: 'Reading every day adds to your knowledge.', grades: [4] },
      { id: 'write45-spell-05', type: 'spell', word: 'island', sentence: 'Sea turtles lay their eggs on the island.', grades: [4] },
      { id: 'write45-spell-06', type: 'spell', word: 'ocean', sentence: 'Whales swim across the whole ocean.', grades: [4] },
      { id: 'write45-spell-07', type: 'spell', word: 'muscle', sentence: 'Your heart is a very strong muscle.', grades: [4] },
      { id: 'write45-spell-08', type: 'spell', word: 'whistle', sentence: 'The coach blew her whistle to start the game.', grades: [4] },
      { id: 'write45-spell-09', type: 'spell', word: 'straight', sentence: 'Draw a straight line with your ruler.', grades: [4] },
      { id: 'write45-spell-10', type: 'spell', word: 'weight', sentence: 'The scale shows the weight of the pumpkin.', grades: [4] },
      { id: 'write45-spell-11', type: 'spell', word: 'neighbor', sentence: 'Our neighbor waters the garden every morning.', grades: [4] },
      { id: 'write45-spell-12', type: 'spell', word: 'surprise', sentence: 'The class planned a surprise for the librarian.', grades: [4] },
      { id: 'write45-spell-13', type: 'spell', word: 'receive', sentence: 'Did you receive my postcard?', grades: [4] },
      { id: 'write45-spell-14', type: 'spell', word: 'tomorrow', sentence: 'The science fair is tomorrow.', grades: [4] },
      { id: 'write45-spell-15', type: 'spell', word: 'machine', sentence: 'This machine sorts coins by size.', grades: [4] },
      { id: 'write45-spell-16', type: 'spell', word: 'science', sentence: 'In science class we grew bean plants.', grades: [4] },
      { id: 'write45-spell-17', type: 'spell', word: 'measure', sentence: 'Use a cup to measure the flour.', grades: [4] },
      { id: 'write45-spell-18', type: 'spell', word: 'adventure', sentence: 'The camping trip was a real adventure.', grades: [4] },
      { id: 'write45-spell-19', type: 'spell', word: 'discover', sentence: 'Scientists hope to discover new kinds of fish.', grades: [4] },
      { id: 'write45-spell-20', type: 'spell', word: 'celebrate', sentence: 'We will celebrate the end of the school year with a picnic.', grades: [4] },
      // Grade 5
      { id: 'write45-spell-21', type: 'spell', word: 'necessary', sentence: 'Is it necessary to bring a jacket?', grades: [5] },
      { id: 'write45-spell-22', type: 'spell', word: 'government', sentence: 'The government builds roads and bridges.', grades: [5] },
      { id: 'write45-spell-23', type: 'spell', word: 'environment', sentence: 'Recycling helps protect the environment.', grades: [5] },
      { id: 'write45-spell-24', type: 'spell', word: 'restaurant', sentence: 'The new restaurant serves homemade noodles.', grades: [5] },
      { id: 'write45-spell-25', type: 'spell', word: 'guarantee', sentence: 'I cannot guarantee that it will be sunny.', grades: [5] },
      { id: 'write45-spell-26', type: 'spell', word: 'definitely', sentence: 'I will definitely finish my project on time.', grades: [5] },
      { id: 'write45-spell-27', type: 'spell', word: 'beginning', sentence: 'The beginning of the story was exciting.', grades: [5] },
      { id: 'write45-spell-28', type: 'spell', word: 'embarrass', sentence: 'A small mistake should not embarrass you.', grades: [5] },
      { id: 'write45-spell-29', type: 'spell', word: 'especially', sentence: 'I like fruit, especially mangoes.', grades: [5] },
      { id: 'write45-spell-30', type: 'spell', word: 'experience', sentence: 'Visiting the planetarium was an amazing experience.', grades: [5] },
      { id: 'write45-spell-31', type: 'spell', word: 'recommend', sentence: 'Can you recommend a good mystery book?', grades: [5] },
      { id: 'write45-spell-32', type: 'spell', word: 'rhythm', sentence: 'Clap your hands to the rhythm of the song.', grades: [5] },
      { id: 'write45-spell-33', type: 'spell', word: 'scissors', sentence: 'Please pass me the scissors.', grades: [5] },
      { id: 'write45-spell-34', type: 'spell', word: 'equipment', sentence: 'Put the gym equipment back in the closet.', grades: [5] },
      { id: 'write45-spell-35', type: 'spell', word: 'dictionary', sentence: 'Look up the word in the dictionary.', grades: [5] },
      { id: 'write45-spell-36', type: 'spell', word: 'opposite', sentence: 'Hot is the opposite of cold.', grades: [5] },
      { id: 'write45-spell-37', type: 'spell', word: 'community', sentence: 'Our community planted trees along the river.', grades: [5] },
      { id: 'write45-spell-38', type: 'spell', word: 'delicious', sentence: 'The vegetable soup was delicious.', grades: [5] },
      { id: 'write45-spell-39', type: 'spell', word: 'enormous', sentence: 'An enormous whale swam past the boat.', grades: [5] },
      { id: 'write45-spell-40', type: 'spell', word: 'curious', sentence: 'The curious kitten sniffed the box.', grades: [5] },
    ],
  },
  {
    id: 'write45-fix', name: 'Edit It', icon: '✂️', desc: 'Commas, quotes, tricky words', grades: [4, 5],
    questions: [
      // Commas in compound sentences
      { id: 'write45-fix-01', type: 'mc', q: 'Which sentence uses a comma correctly?', choices: ['I wanted to play outside but it was raining.', 'I wanted, to play outside but it was raining.', 'I wanted to play outside, but it was raining.'], answer: 2, hint: 'Find the two complete thoughts. Where does the joining word go?', explain: 'In a compound sentence, put a comma before the joining word (but) that connects two complete thoughts.', grades: [4, 5], emoji: '🌧️' },
      { id: 'write45-fix-02', type: 'mc', q: 'Which sentence uses a comma correctly?', choices: ['Maya likes soccer, and her brother likes chess.', 'Maya likes soccer and, her brother likes chess.', 'Maya, likes soccer and her brother likes chess.'], answer: 0, hint: 'The comma goes between the two complete thoughts.', explain: 'The comma comes right before "and" because "and" joins two complete sentences.', grades: [4, 5], emoji: '⚽' },
      // Introductory words and phrases
      { id: 'write45-fix-03', type: 'mc', q: 'Which sentence is punctuated correctly?', choices: ['Yes I finished my homework.', 'Yes, I finished my homework.', 'Yes I, finished my homework.'], answer: 1, hint: 'Some words at the start of a sentence need a little pause after them.', explain: 'Put a comma after an introductory word like yes, no or well.', grades: [4, 5] },
      { id: 'write45-fix-04', type: 'mc', q: 'Which sentence is punctuated correctly?', choices: ['After, lunch we went to the library.', 'After lunch we, went to the library.', 'After lunch, we went to the library.'], answer: 2, hint: 'Read it aloud. Where do you naturally pause?', explain: 'A comma goes after an introductory phrase like "After lunch."', grades: [4, 5], emoji: '📚' },
      { id: 'write45-fix-05', type: 'mc', q: 'Which sentence is punctuated correctly?', choices: ['Well, I think we should try again.', 'Well I think, we should try again.', 'Well I think we should, try again.'], answer: 0, hint: 'Which word is just there to start the sentence?', explain: 'Use a comma to set off an introductory word like well.', grades: [5] },
      // Direct address and tag questions
      { id: 'write45-fix-06', type: 'mc', q: 'Which sentence is punctuated correctly?', choices: ['Leo can you help me carry this?', 'Leo, can you help me carry this?', 'Leo can you, help me carry this?'], answer: 1, hint: 'The speaker is talking right to Leo.', explain: 'When you speak directly to someone by name, set the name off with a comma.', grades: [4, 5] },
      { id: 'write45-fix-07', type: 'mc', q: 'Which sentence is punctuated correctly?', choices: ['Thank you Ms. Patel.', 'Thank, you Ms. Patel.', 'Thank you, Ms. Patel.'], answer: 2, hint: 'Who is being spoken to? Set that part apart.', explain: 'A comma separates the name of the person being spoken to from the rest of the sentence.', grades: [4, 5] },
      { id: 'write45-fix-08', type: 'mc', q: 'Which sentence is punctuated correctly?', choices: ['It is a nice day, isn\'t it?', 'It is a nice day isn\'t it?', 'It is a nice, day isn\'t it?'], answer: 0, hint: 'The little question at the end needs to be set apart.', explain: 'Use a comma before a tag question like "isn\'t it?"', grades: [5], emoji: '☀️' },
      // Addresses and dates
      { id: 'write45-fix-09', type: 'mc', q: 'Which sentence is punctuated correctly?', choices: ['We moved to Austin Texas last year.', 'We moved to Austin, Texas, last year.', 'We moved, to Austin Texas last year.'], answer: 1, hint: 'Think about where commas go in the name of a place.', explain: 'Put a comma between a city and its state, and after the state in the middle of a sentence.', grades: [4, 5], emoji: '🗺️' },
      { id: 'write45-fix-10', type: 'mc', q: 'Which address line is written correctly?', choices: ['Portland Oregon 97201', 'Portland, Oregon 97201', 'Portland Oregon, 97201'], answer: 1, hint: 'Look at what comes between the city and the state.', explain: 'In an address, a comma goes between the city and the state.', grades: [4], emoji: '✉️' },
      { id: 'write45-fix-11', type: 'mc', q: 'Which sentence is punctuated correctly?', choices: ['On July 4 2025 we watched a parade.', 'On July, 4 2025 we watched a parade.', 'On July 4, 2025, we watched a parade.'], answer: 2, hint: 'A date has a day and a year that need to be separated.', explain: 'Put a comma between the day and the year, and after the year in the middle of a sentence.', grades: [4, 5], emoji: '🎉' },
      // Quotation marks and dialogue
      { id: 'write45-fix-12', type: 'mc', q: 'Which sentence is punctuated correctly?', choices: ['"Let\'s go to the park," said Ana.', '"Let\'s go to the park" said Ana.', '"Let\'s go to the park." said Ana.'], answer: 0, hint: 'The sentence keeps going after the quote. What mark goes inside the closing quotation mark?', explain: 'When the speaker tag comes after the quote, end the quote with a comma inside the quotation marks.', grades: [4, 5], emoji: '💬' },
      { id: 'write45-fix-13', type: 'mc', q: 'Which sentence is punctuated correctly?', choices: ['Omar asked "Where is my pencil?"', 'Omar asked, "Where is my pencil?"', 'Omar asked, "Where is my pencil"?'], answer: 1, hint: 'Check two spots: before the opening quotation mark, and the question mark.', explain: 'Put a comma before the quote, and keep the question mark inside the quotation marks.', grades: [4, 5], emoji: '✏️' },
      { id: 'write45-fix-14', type: 'mc', q: 'Which sentence is punctuated correctly?', choices: ['"I love this song"! shouted Kenji.', '"I love this song!", shouted Kenji.', '"I love this song!" shouted Kenji.'], answer: 2, hint: 'The exclamation point belongs to the words Kenji said.', explain: 'The exclamation point goes inside the quotation marks, and no extra comma is needed.', grades: [4, 5], emoji: '🎵' },
      { id: 'write45-fix-15', type: 'mc', q: 'Which sentence is written correctly?', choices: ['Grandpa said, "we can bake bread today."', 'Grandpa said, "We can bake bread today."', 'Grandpa said, "We can bake bread today".'], answer: 1, hint: 'Look at the first word inside the quotation marks and the very end.', explain: 'A quote starts with a capital letter, and the period goes inside the quotation marks.', grades: [4, 5], emoji: '🍞' },
      { id: 'write45-fix-16', type: 'mc', q: 'Where do the quotation marks go? Coach said, Great job, team!', choices: ['"Coach said, Great job, team!"', 'Coach said, "Great job, team!"', 'Coach "said, Great job, team!"'], answer: 1, hint: 'Quotation marks go only around the exact words someone spoke.', explain: 'Only the words Coach actually said go inside the quotation marks.', grades: [4], emoji: '🏅' },
      // Capitalization
      { id: 'write45-fix-17', type: 'mc', q: 'Which book title is capitalized correctly?', choices: ['The secret of the lost island', 'The Secret of the Lost Island', 'the Secret Of The Lost Island'], answer: 1, hint: 'In titles, the first word and the important words get capitals. Small words in the middle do not.', explain: 'Capitalize the first word and important words. Short words like "of" and "the" stay lowercase in the middle.', grades: [4, 5], emoji: '📕' },
      { id: 'write45-fix-18', type: 'mc', q: 'Which song title is capitalized correctly?', choices: ['Dancing in the Rain', 'Dancing In The Rain', 'dancing in the rain'], answer: 0, hint: 'Small words in the middle of a title usually stay lowercase.', explain: 'Capitalize the first word and the important words. "in" and "the" stay lowercase in the middle.', grades: [5], emoji: '🎶' },
      { id: 'write45-fix-19', type: 'mc', q: 'Which sentence is capitalized correctly?', choices: ['We visited the grand canyon in arizona.', 'We visited The Grand Canyon in arizona.', 'We visited the Grand Canyon in Arizona.'], answer: 2, hint: 'Names of special places and states are proper nouns.', explain: 'Grand Canyon and Arizona are names of specific places, so they are capitalized.', grades: [4, 5], emoji: '🏜️' },
      { id: 'write45-fix-20', type: 'mc', q: 'Which sentence is capitalized correctly?', choices: ['My cousin lives near Lake Michigan.', 'My Cousin lives near lake Michigan.', 'my cousin lives near Lake michigan.'], answer: 0, hint: 'Is "cousin" a name? Is the lake\'s name a proper noun?', explain: 'Lake Michigan is a specific place, so both words are capitalized. "cousin" is a common noun.', grades: [4] },
      { id: 'write45-fix-21', type: 'mc', q: 'Which sentence is capitalized correctly?', choices: ['Our play is on friday, march 3.', 'Our play is on Friday, March 3.', 'Our Play is on Friday, march 3.'], answer: 1, hint: 'Days of the week and months are proper nouns.', explain: 'Always capitalize the names of days and months.', grades: [4], emoji: '🎭' },
      // its / it's
      { id: 'write45-fix-22', type: 'mc', q: 'Pick the word: "The cat licked ___ paw."', choices: ['its', 'it\'s'], answer: 0, hint: 'Try saying "it is" in the blank. Does it make sense?', explain: '"Its" shows something belongs to it. "It\'s" means "it is."', grades: [4, 5], emoji: '🐈' },
      { id: 'write45-fix-23', type: 'mc', q: 'Pick the word: "___ going to be sunny today."', choices: ['Its', 'It\'s'], answer: 1, hint: 'Try saying "it is" in the blank. Does it make sense?', explain: '"It\'s" is short for "it is": It is going to be sunny today.', grades: [4, 5], emoji: '🌞' },
      // their / there / they're
      { id: 'write45-fix-24', type: 'mc', q: 'Pick the word: "The twins said ___ coming to the party."', choices: ['their', 'there', 'they\'re'], answer: 2, hint: 'Try "they are" in the blank.', explain: '"They\'re" means "they are": They are coming to the party.', grades: [4, 5], emoji: '🎈' },
      { id: 'write45-fix-25', type: 'mc', q: 'Pick the word: "Put the boxes over ___."', choices: ['their', 'there', 'they\'re'], answer: 1, hint: 'The blank tells a place.', explain: '"There" tells where. It has "here" hiding inside it.', grades: [4, 5], emoji: '📦' },
      { id: 'write45-fix-26', type: 'mc', q: 'Pick the word: "The students cleaned ___ desks."', choices: ['their', 'there', 'they\'re'], answer: 0, hint: 'Whose desks are they?', explain: '"Their" shows that something belongs to a group of people.', grades: [4, 5], emoji: '🧽' },
      // your / you're
      { id: 'write45-fix-27', type: 'mc', q: 'Pick the word: "___ a great reader, {name}!"', choices: ['Your', 'You\'re'], answer: 1, hint: 'Try "you are" in the blank.', explain: '"You\'re" means "you are": You are a great reader!', grades: [4, 5], emoji: '📖' },
      { id: 'write45-fix-28', type: 'mc', q: 'Pick the word: "Don\'t forget ___ lunchbox."', choices: ['your', 'you\'re'], answer: 0, hint: 'Try "you are" in the blank. Does it make sense?', explain: '"Your" shows that something belongs to you.', grades: [4, 5], emoji: '🍱' },
      // to / too / two
      { id: 'write45-fix-29', type: 'mc', q: 'Pick the word: "We planted ___ trees in the garden."', choices: ['to', 'too', 'two'], answer: 2, hint: 'The blank tells how many.', explain: '"Two" is the number 2.', grades: [4], emoji: '🌳' },
      { id: 'write45-fix-30', type: 'mc', q: 'Pick the word: "This soup is ___ hot to eat."', choices: ['to', 'too', 'two'], answer: 1, hint: 'The blank means "more than it should be."', explain: '"Too" means "very" or "also." The soup is very hot.', grades: [4], emoji: '🍲' },
      { id: 'write45-fix-31', type: 'mc', q: 'Pick the word: "We walked ___ the bakery."', choices: ['to', 'too', 'two'], answer: 0, hint: 'The blank shows where we were going.', explain: '"To" shows direction: we walked toward the bakery.', grades: [4], emoji: '🥐' },
      // who's / whose
      { id: 'write45-fix-32', type: 'mc', q: 'Pick the word: "___ jacket is this?"', choices: ['Who\'s', 'Whose'], answer: 1, hint: 'Try "who is" in the blank. Does it make sense?', explain: '"Whose" asks who something belongs to.', grades: [4, 5], emoji: '🧥' },
      { id: 'write45-fix-33', type: 'mc', q: 'Pick the word: "___ ready for recess?"', choices: ['Who\'s', 'Whose'], answer: 0, hint: 'Try "who is" in the blank.', explain: '"Who\'s" is short for "who is": Who is ready for recess?', grades: [4, 5], emoji: '🛝' },
      // Run-ons and fragments
      { id: 'write45-fix-34', type: 'mc', q: 'Which one is a run-on sentence?', choices: ['The sun came out, so we went swimming.', 'The sun came out we went swimming.', 'When the sun came out, we went swimming.'], answer: 1, hint: 'Look for two complete thoughts squished together with nothing joining them.', explain: '"The sun came out we went swimming" joins two sentences with no punctuation or joining word.', grades: [4, 5], emoji: '🏊' },
      { id: 'write45-fix-35', type: 'mc', q: 'How can you fix this run-on? "My dog barks at the mail carrier she wants to say hello."', choices: ['My dog barks at the mail carrier, she wants to say hello.', 'My dog barks at the mail carrier she wants. To say hello.', 'My dog barks at the mail carrier. She wants to say hello.'], answer: 2, hint: 'A comma alone is not strong enough to join two complete sentences.', explain: 'Splitting it into two sentences fixes the run-on. A comma alone would still be a run-on.', grades: [4, 5], emoji: '🐕' },
      { id: 'write45-fix-36', type: 'mc', q: 'Which one is a fragment (not a complete sentence)?', choices: ['Because the bus was late.', 'The bus was late.', 'We waited because the bus was late.'], answer: 0, hint: 'Which one leaves you waiting to hear the rest of the thought?', explain: '"Because the bus was late" does not finish the thought. What happened because the bus was late?', grades: [4, 5], emoji: '🚌' },
      { id: 'write45-fix-37', type: 'mc', q: 'Which choice fixes the fragment "Running along the beach."?', choices: ['Running along the beach quickly.', 'Jada was running along the beach.', 'Running, along the beach.'], answer: 1, hint: 'A sentence needs someone or something doing the action.', explain: 'Adding a subject (Jada) and a helping verb (was) makes a complete sentence.', grades: [4, 5], emoji: '🏖️' },
    ],
  },
  {
    id: 'write45-grammar', name: 'Grammar Lab', icon: '🧪', desc: 'Verbs, clauses and connectors', grades: [4, 5],
    questions: [
      // Relative pronouns
      { id: 'write45-gram-01', type: 'mc', q: 'Pick the word: "The girl ___ won the race is in my class."', choices: ['which', 'who', 'whose'], answer: 1, hint: 'The blank is talking about a person.', explain: 'Use "who" for people: the girl who won the race.', grades: [4], emoji: '🏃' },
      { id: 'write45-gram-02', type: 'mc', q: 'Pick the word: "This is the dog ___ tail is curly."', choices: ['who', 'which', 'whose'], answer: 2, hint: 'The tail belongs to the dog.', explain: '"Whose" shows that something belongs to someone: the dog whose tail is curly.', grades: [4], emoji: '🐶' },
      { id: 'write45-gram-03', type: 'mc', q: 'Pick the word: "I finished the book ___ you gave me."', choices: ['that', 'who', 'whose'], answer: 0, hint: 'A book is a thing, not a person.', explain: 'Use "that" (or "which") for things: the book that you gave me.', grades: [4], emoji: '📗' },
      { id: 'write45-gram-04', type: 'mc', q: 'Pick the word: "Our town has a museum, ___ is open on Saturdays."', choices: ['who', 'which', 'whose'], answer: 1, hint: 'A museum is a thing. Look at the comma before the blank.', explain: 'Use "which" for a thing, especially after a comma: a museum, which is open on Saturdays.', grades: [4, 5], emoji: '🏛️' },
      { id: 'write45-gram-05', type: 'mc', q: 'Pick the word: "To ___ should I give this note?"', choices: ['who', 'whom', 'whose'], answer: 1, hint: 'The word comes right after "to." Would you say "to he" or "to him"?', explain: 'Use "whom" after a preposition like "to." It works like "him" or "her."', grades: [4, 5], emoji: '📝' },
      // Relative adverbs
      { id: 'write45-gram-06', type: 'mc', q: 'Pick the word: "That is the park ___ we had our picnic."', choices: ['when', 'where', 'why'], answer: 1, hint: 'The blank is about a place.', explain: '"Where" is used for places: the park where we had our picnic.', grades: [4], emoji: '🧺' },
      { id: 'write45-gram-07', type: 'mc', q: 'Pick the word: "I remember the day ___ it snowed in April."', choices: ['where', 'why', 'when'], answer: 2, hint: 'The blank is about a time.', explain: '"When" is used for times: the day when it snowed.', grades: [4], emoji: '❄️' },
      { id: 'write45-gram-08', type: 'mc', q: 'Pick the word: "Nobody knows the reason ___ the cat hid under the bed."', choices: ['why', 'where', 'when'], answer: 0, hint: 'Look at the word just before the blank: reason.', explain: '"Why" goes with reasons: the reason why the cat hid.', grades: [4], emoji: '🐈' },
      // Progressive tenses
      { id: 'write45-gram-09', type: 'mc', q: 'Which sentence is in the present progressive tense (happening right now)?', choices: ['Lena reads a book.', 'Lena read a book.', 'Lena is reading a book.'], answer: 2, hint: 'Progressive verbs use a helping verb plus an -ing word.', explain: '"Is reading" uses is + -ing, which shows it is happening now.', grades: [4], emoji: '📖' },
      { id: 'write45-gram-10', type: 'mc', q: 'Pick the verb: "We ___ dinner when the phone rang."', choices: ['are eating', 'were eating', 'will be eating'], answer: 1, hint: 'The phone rang in the past. What was going on at that moment?', explain: '"Were eating" is past progressive. It shows an action that was going on in the past.', grades: [4], emoji: '🍽️' },
      { id: 'write45-gram-11', type: 'mc', q: 'Which sentence uses the future progressive tense?', choices: ['I was swimming at noon yesterday.', 'I will be swimming at noon tomorrow.', 'I am swimming right now.'], answer: 1, hint: 'Look for an action that will be going on later.', explain: '"Will be swimming" is future progressive: will be + -ing.', grades: [4], emoji: '🏊' },
      // Modal auxiliaries
      { id: 'write45-gram-12', type: 'mc', q: 'Which word shows that something is allowed? "You ___ use a pencil or a pen."', choices: ['must', 'should', 'may'], answer: 2, hint: 'Which word gives permission instead of a rule or advice?', explain: '"May" gives permission. "Must" is a rule, and "should" is advice.', grades: [4], emoji: '🖊️' },
      { id: 'write45-gram-13', type: 'mc', q: 'Which word shows that something is required? "Everyone ___ wear a helmet on the bike trail."', choices: ['might', 'must', 'could'], answer: 1, hint: 'Which word means there is no choice?', explain: '"Must" shows a rule that has to be followed.', grades: [4], emoji: '🚲' },
      { id: 'write45-gram-14', type: 'mc', q: 'Which sentence shows that something is possible, but not certain?', choices: ['It will rain today.', 'It might rain today.', 'It must rain today.'], answer: 1, hint: 'Which one sounds like a maybe?', explain: '"Might" shows that something could happen, but we are not sure.', grades: [4], emoji: '🌦️' },
      { id: 'write45-gram-15', type: 'mc', q: 'Which word gives advice? "You ___ drink water after you run."', choices: ['should', 'might', 'may'], answer: 0, hint: 'Which word sounds like a helpful suggestion?', explain: '"Should" is used to give advice.', grades: [4], emoji: '💧' },
      // Prepositional phrases
      { id: 'write45-gram-16', type: 'mc', q: 'Which words are the prepositional phrase? "The kitten slept under the porch."', choices: ['The kitten', 'slept under', 'under the porch'], answer: 2, hint: 'A prepositional phrase starts with a position word and ends with a noun.', explain: '"Under the porch" starts with the preposition "under" and ends with the noun "porch."', grades: [4], emoji: '🐱' },
      { id: 'write45-gram-17', type: 'mc', q: 'Which word is the preposition? "We hiked across the bridge."', choices: ['hiked', 'across', 'bridge'], answer: 1, hint: 'A preposition shows where something is or which way it goes.', explain: '"Across" is the preposition. It shows where we hiked.', grades: [4], emoji: '🌉' },
      { id: 'write45-gram-18', type: 'mc', q: 'Which sentence has a prepositional phrase?', choices: ['Sam laughed loudly.', 'Ana is very tall.', 'The bird sang in the morning.'], answer: 2, hint: 'Look for a small word that tells where or when, followed by a noun.', explain: '"In the morning" is a prepositional phrase that tells when.', grades: [4], emoji: '🐦' },
      // Order of adjectives
      { id: 'write45-gram-19', type: 'mc', q: 'Which one sounds right?', choices: ['a red big ball', 'a big red ball', 'a ball big red'], answer: 1, hint: 'Say each one out loud. Size and color usually come in a certain order.', explain: 'Size comes before color: a big red ball.', grades: [4], emoji: '🔴' },
      { id: 'write45-gram-20', type: 'mc', q: 'Which one sounds right?', choices: ['a wooden small old box', 'an old wooden small box', 'a small old wooden box'], answer: 2, hint: 'Say each one out loud. A word about what something is made of usually sits right next to the noun.', explain: 'The order is size, then age, then material: a small old wooden box.', grades: [4, 5], emoji: '📦' },
      { id: 'write45-gram-21', type: 'mc', q: 'Which one sounds right?', choices: ['two cute little puppies', 'little two cute puppies', 'cute two little puppies'], answer: 0, hint: 'Numbers usually come first. Then think about opinion and size.', explain: 'The order is number, opinion, then size: two cute little puppies.', grades: [4], emoji: '🐶' },
      { id: 'write45-gram-22', type: 'mc', q: 'Which one sounds right?', choices: ['a blue round beautiful plate', 'a beautiful round blue plate', 'a round beautiful blue plate'], answer: 1, hint: 'An opinion word usually comes before words about shape and color.', explain: 'The order is opinion, shape, then color: a beautiful round blue plate.', grades: [4, 5], emoji: '🍽️' },
      // Perfect tenses (grade 5)
      { id: 'write45-gram-23', type: 'mc', q: 'Which sentence uses the present perfect tense?', choices: ['I had finished my homework.', 'I have finished my homework.', 'I will have finished my homework.'], answer: 1, hint: 'Present perfect uses a present-tense helping verb plus a past participle.', explain: '"Have finished" is present perfect: have/has + past participle.', grades: [5], emoji: '✅' },
      { id: 'write45-gram-24', type: 'mc', q: 'Which sentence uses the past perfect tense?', choices: ['By the time we arrive, the movie will have started.', 'The movie has started.', 'By the time we arrived, the movie had started.'], answer: 2, hint: 'Past perfect shows something that happened before another past event.', explain: '"Had started" is past perfect. The movie started before we arrived.', grades: [5], emoji: '🎬' },
      { id: 'write45-gram-25', type: 'mc', q: 'Which sentence uses the future perfect tense?', choices: ['By June, Mateo had read ten books.', 'By June, Mateo will have read ten books.', 'Mateo has read ten books.'], answer: 1, hint: 'Future perfect tells what will be done by a certain time later on.', explain: '"Will have read" is future perfect: will have + past participle.', grades: [5], emoji: '📚' },
      { id: 'write45-gram-26', type: 'mc', q: 'Pick the verb: "Zara ___ in this town since she was five."', choices: ['lives', 'has lived', 'will live'], answer: 1, hint: 'The word "since" tells about something that started in the past and is still true.', explain: '"Has lived" (present perfect) shows something that started in the past and continues now.', grades: [5], emoji: '🏡' },
      // Inappropriate tense shifts (grade 5)
      { id: 'write45-gram-27', type: 'mc', q: 'Which sentence keeps the verb tense the same?', choices: ['Ben opened the door and walks inside.', 'Ben opens the door and walked inside.', 'Ben opened the door and walked inside.'], answer: 2, hint: 'Check that both actions happen in the same time.', explain: 'Both verbs (opened, walked) are in the past tense, so the tense does not shift.', grades: [5], emoji: '🚪' },
      { id: 'write45-gram-28', type: 'mc', q: 'Fix the tense shift: "Yesterday we go to the beach and built a sandcastle."', choices: ['Yesterday we went to the beach and built a sandcastle.', 'Yesterday we go to the beach and build a sandcastle.', 'Yesterday we going to the beach and built a sandcastle.'], answer: 0, hint: 'The word "Yesterday" tells you when it all happened.', explain: 'Yesterday is in the past, so both verbs should be past tense: went and built.', grades: [5], emoji: '🏰' },
      { id: 'write45-gram-29', type: 'mc', q: 'Which sentence has a tense shift that should be fixed?', choices: ['Every morning, Kai feeds the fish and waters the plants.', 'Every morning, Kai feeds the fish and watered the plants.', 'Last night, Kai fed the fish and watered the plants.'], answer: 1, hint: 'Look for a sentence where one verb is now and the other is in the past.', explain: '"Feeds" is present and "watered" is past. Both should match.', grades: [5], emoji: '🐠' },
      // Correlative conjunctions (grade 5)
      { id: 'write45-gram-30', type: 'mc', q: 'Pick the word: "You can have either soup ___ salad."', choices: ['nor', 'or', 'and'], answer: 1, hint: 'Some joining words come in pairs. Which word is the partner of "either"?', explain: '"Either" goes with "or": either soup or salad.', grades: [5], emoji: '🥗' },
      { id: 'write45-gram-31', type: 'mc', q: 'Pick the word: "Neither Rosa ___ Theo likes olives."', choices: ['or', 'but', 'nor'], answer: 2, hint: 'Which word is the partner of "neither"?', explain: '"Neither" goes with "nor": neither Rosa nor Theo.', grades: [5], emoji: '🫒' },
      { id: 'write45-gram-32', type: 'mc', q: 'Which pair completes it? "___ the teacher ___ the students enjoyed the play."', choices: ['Both / and', 'Neither / or', 'Either / and'], answer: 0, hint: 'Each correct pair has partners that always go together.', explain: '"Both" goes with "and": Both the teacher and the students enjoyed the play.', grades: [5], emoji: '🎭' },
      { id: 'write45-gram-33', type: 'mc', q: 'Pick the word: "Not only did we win the game, ___ we also had fun."', choices: ['and', 'or', 'but'], answer: 2, hint: '"Not only" has a partner that comes before "also."', explain: '"Not only" goes with "but also": not only did we win, but we also had fun.', grades: [5], emoji: '🏆' },
      // Interjections (grade 5)
      { id: 'write45-gram-34', type: 'mc', q: 'Which word is the interjection? "Wow, that rocket is fast!"', choices: ['rocket', 'Wow', 'fast'], answer: 1, hint: 'An interjection is a word that shows a quick burst of feeling.', explain: '"Wow" is an interjection. It shows surprise.', grades: [5], emoji: '🚀' },
      { id: 'write45-gram-35', type: 'mc', q: 'Which sentence uses an interjection?', choices: ['I dropped my crayons.', 'My crayons fell down.', 'Oops! I dropped my crayons.'], answer: 2, hint: 'Look for a word that shows a sudden feeling.', explain: '"Oops" is an interjection that shows a little surprise.', grades: [5], emoji: '🖍️' },
      // Conjunctions
      { id: 'write45-gram-36', type: 'mc', q: 'Pick the conjunction: "I was hungry, ___ I ate an apple."', choices: ['but', 'so', 'or'], answer: 1, hint: 'The second part happens as a result of the first part.', explain: '"So" shows a result: I was hungry, so I ate an apple.', grades: [4, 5], emoji: '🍎' },
      { id: 'write45-gram-37', type: 'mc', q: 'Pick the conjunction: "We stayed inside ___ it was raining."', choices: ['because', 'unless', 'or'], answer: 0, hint: 'The second part gives a reason.', explain: '"Because" tells why we stayed inside.', grades: [4, 5], emoji: '🌧️' },
      { id: 'write45-gram-38', type: 'mc', q: 'Pick the conjunction: "___ it was cold, we played outside."', choices: ['Because', 'Although', 'So'], answer: 1, hint: 'Playing outside in the cold is a bit surprising. Which word shows that contrast?', explain: '"Although" shows something happened even though you might not expect it.', grades: [5], emoji: '🧤' },
    ],
  },
  {
    id: 'write45-build', name: 'Sentence Builder', icon: '🧱', desc: 'Build longer sentences', grades: [4, 5],
    questions: [
      { id: 'write45-build-01', type: 'order', words: ['It', 'started', 'to', 'rain,', 'so', 'we', 'went', 'inside.'], grades: [4], emoji: '🌧️' },
      { id: 'write45-build-02', type: 'order', words: ['When', 'the', 'bell', 'rang,', 'the', 'students', 'lined', 'up.'], grades: [4], emoji: '🔔' },
      { id: 'write45-build-03', type: 'order', words: ['Have', 'you', 'finished', 'reading', 'the', 'new', 'chapter?'], grades: [4], emoji: '📖' },
      { id: 'write45-build-04', type: 'order', words: ['The', 'boy', 'whose', 'kite', 'got', 'stuck', 'asked', 'for', 'help.'], grades: [4, 5], emoji: '🪁' },
      { id: 'write45-build-05', type: 'order', words: ['We', 'packed', 'sandwiches', 'because', 'the', 'trip', 'would', 'be', 'long.'], grades: [4], emoji: '🥪' },
      { id: 'write45-build-06', type: 'order', words: ['Although', 'it', 'was', 'late,', 'Nadia', 'kept', 'reading', 'her', 'book.'], grades: [5], emoji: '🌙' },
      { id: 'write45-build-07', type: 'order', words: ['Where', 'should', 'we', 'put', 'the', 'new', 'fish', 'tank?'], grades: [4], emoji: '🐠' },
      { id: 'write45-build-08', type: 'order', words: ['Why', 'did', 'the', 'ducks', 'fly', 'south', 'for', 'the', 'winter?'], grades: [4], emoji: '🦆' },
      { id: 'write45-build-09', type: 'order', words: ['Our', 'class', 'planted', 'a', 'garden,', 'and', 'the', 'tomatoes', 'grew', 'quickly.'], grades: [4, 5], emoji: '🍅' },
      { id: 'write45-build-10', type: 'order', words: ['Diego', 'wanted', 'to', 'swim,', 'but', 'the', 'pool', 'was', 'closed.'], grades: [4], emoji: '🏊' },
      { id: 'write45-build-11', type: 'order', words: ['If', 'it', 'snows', 'tonight,', 'we', 'will', 'build', 'a', 'snowman.'], grades: [4], emoji: '⛄' },
      { id: 'write45-build-12', type: 'order', words: ['The', 'museum', 'was', 'crowded,', 'so', 'we', 'came', 'back', 'later.'], grades: [4, 5], emoji: '🏛️' },
      { id: 'write45-build-13', type: 'order', words: ['After', 'the', 'rain', 'stopped,', 'we', 'jumped', 'in', 'puddles.'], grades: [4], emoji: '💦' },
      { id: 'write45-build-14', type: 'order', words: ['Please', 'close', 'the', 'window', 'before', 'you', 'leave', 'the', 'room.'], grades: [4], emoji: '🪟' },
      { id: 'write45-build-15', type: 'order', words: ['Hummingbirds', 'can', 'flap', 'their', 'wings', 'very', 'quickly.'], grades: [4], emoji: '🐦' },
      { id: 'write45-build-16', type: 'order', words: ['How', 'many', 'planets', 'are', 'in', 'our', 'solar', 'system?'], grades: [4], emoji: '🪐' },
      { id: 'write45-build-17', type: 'order', words: ['Volcanoes', 'form', 'when', 'melted', 'rock', 'rises', 'to', 'the', 'surface.'], grades: [5], emoji: '🌋' },
      { id: 'write45-build-18', type: 'order', words: ['Our', 'neighbor', 'taught', 'us', 'how', 'to', 'knit', 'scarves.'], grades: [4], emoji: '🧶' },
      { id: 'write45-build-19', type: 'order', words: ['Which', 'trail', 'leads', 'to', 'the', 'top', 'of', 'the', 'mountain?'], grades: [4, 5], emoji: '⛰️' },
      { id: 'write45-build-20', type: 'order', words: ['Kofi', 'practiced', 'the', 'piano', 'because', 'he', 'had', 'a', 'recital.'], grades: [5], emoji: '🎹' },
      { id: 'write45-build-21', type: 'order', words: ['Astronauts', 'sleep', 'in', 'sleeping', 'bags', 'attached', 'to', 'the', 'wall.'], grades: [5], emoji: '🚀' },
      { id: 'write45-build-22', type: 'order', words: ['Since', 'the', 'bridge', 'was', 'closed,', 'we', 'took', 'a', 'different', 'road.'], grades: [5], emoji: '🌉' },
      { id: 'write45-build-23', type: 'order', words: ['Is', 'this', 'the', 'bus', 'that', 'goes', 'to', 'the', 'library?'], grades: [4, 5], emoji: '🚌' },
      { id: 'write45-build-24', type: 'order', words: ['Bees', 'carry', 'pollen', 'from', 'one', 'flower', 'to', 'another.'], grades: [4, 5], emoji: '🐝' },
    ],
  }
);

window.SUBJECTS.writing.journalPrompts45 = [
  // Opinion with reasons
  'Should every school have a class garden? Give at least three reasons.',
  'Which is better for a long trip: a train or a plane? Explain your reasons.',
  'Is it better to read a book first or watch the movie first? Support your opinion.',
  'What is the most useful invention ever made? Give reasons and examples.',
  'Should kids your age have homework every night? Explain why or why not.',
  'Which animal would make the best class pet? Give three reasons.',
  'Is it more fun to play a team sport or a solo activity? Explain your thinking.',
  // Persuasive
  'Write a letter to your principal persuading them to add a new club at school. What club, and why?',
  'Convince a friend to try a food they have never eaten before.',
  'Persuade your town to build something new for kids. What is it, and why is it needed?',
  'Write an ad that convinces people to visit a place you love.',
  'Persuade your class to start a recycling or kindness challenge. How would it work?',
  'Should recess be longer? Write a speech that would persuade your teacher.',
  // Narrative / imaginative
  'You wake up and discover you can talk to animals. Write about your first day.',
  'Write a story about a map that leads to an unexpected treasure.',
  'Imagine you are the first kid to visit a city on the ocean floor. Describe your adventure.',
  'A tiny robot shows up in your backpack. Write the story of what happens next.',
  'Write a story where {buddy} goes on a mission to the moon.',
  'Imagine you can step inside any painting. Which one, and what happens there?',
  'Write a story from the point of view of a library book being checked out.',
  'You invented a machine that makes any weather you want. Tell what happens when you test it.',
  'Write a story about two friends who solve a mystery in their neighborhood.',
  // Informative / explain how
  'Explain how to take care of a pet so someone who has never had one could do it.',
  'Explain how to make a paper airplane that flies far. Use clear steps.',
  'Teach a younger student how to play your favorite game. Use order words like first, next and finally.',
  'Choose an animal you know a lot about. Explain where it lives, what it eats and one surprising fact.',
  'Explain how to plan a fun day at the park, from packing to cleaning up.',
  'Explain how a seed grows into a plant. What does it need along the way?',
  'Describe how to be a good teammate. Give examples.',
  // Reflective (positive)
  'What is something you can do now that you could not do last year? How did you learn it?',
  'Describe a time a friend or classmate did something kind. How did it make you feel?',
  'What is a goal you have for this year? What steps will you take to reach it?',
  'Write about something that makes you proud of yourself.',
  'What is a skill you would like to teach others? Why does it matter to you?',
  'Think of a time you kept trying even when something was hard. What did you learn?',
];
