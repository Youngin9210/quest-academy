# Quest Academy

A learning game for 2nd and 3rd graders covering math, reading, writing, science, social studies and typing. Play it at **https://youngin9210.github.io/quest-academy/**

## What's in it
- **4 worlds to pick from:** Space Explorers, Ocean Adventure, Pet Rescue, Magic Bakery. Each player picks her own world and can switch any time.
- **One player, every subject:** points, the daily streak and collectibles grow from every subject.
- **Math:** add & subtract facts up to 20, place value, 2-digit add & subtract, times & divide facts, word problems, and a multiple choice mission. Wrong choices are common mistakes (forgot to carry, mixed up < and >) and explain that mistake.
- **Reading:** word sounds, word power (prefixes, suffixes, synonyms), story passages and nonfiction passages with comprehension questions.
- **Writing:** spelling (hear a real person say the word, slow it down, then type it), fix-it sentences, sentence building, grammar, and a journal with daily prompts.
- **Typing:** home row, top row, bottom row and sentence lessons with a color-coded finger guide, plus a themed falling-words game with combos, levels and a high score. Best with a real keyboard.
- **Science:** matter, plants, animals, weather, forces & magnets, Earth. Each mission starts with short fact cards.
- **Social Studies:** maps, community, money, government, symbols & holidays, then & now.
- **Read-aloud:** a 🔊 button reads stories, passages, questions and fact cards out loud.
- **Spaced practice:** missed questions come back a few questions later and show up more often until they stick. Hints help without giving away the answer; the answer shows only after a second miss.
- **Grown-ups page:** hold the button for 3 seconds on the start screen to see accuracy and mastery per mission, "needs practice" items, common math mistakes, and journal entries.

## Playing on an iPad
Open the site in Safari, tap **Share**, then **Add to Home Screen** (on newer iPads it's under **More**), and always play from that icon. It opens full-screen like an app. Safari can erase a website's saved progress after 7 days without a visit, but home screen apps are exempt. Progress in the home screen app and in a Safari tab are kept separately.

## Credits
Spelling Bee word recordings are by volunteers on Wikimedia Commons and keep their original open licenses. See [audio/CREDITS.md](audio/CREDITS.md).

## Privacy
There are no accounts and no server. Names, progress and journal entries are saved only in the browser on the device being used (`localStorage`). Each device keeps its own progress.

## Developing
Plain HTML, CSS and JavaScript with no build step. To run it locally:

```bash
python3 -m http.server 5173
```

Then open http://localhost:5173.

- `app.js`: game engine, screens, math generators
- `themes.js`: the four worlds (words, colors, collectibles)
- `subjects/*.js`: question banks for reading, writing, science and social studies. Each mission has `questions` (types `mc`, `spell`, `order`) or `passages`, and optional `learn` fact cards. `{name}` and `{buddy}` are replaced with the player's name and their world's sidekick.
