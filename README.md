# Math Quest

A math practice game for 2nd and 3rd graders. Play it at **https://youngin9210.github.io/math-quest/**

## What's in it
- **4 worlds to pick from:** Space Explorers, Ocean Adventure, Pet Rescue, Magic Bakery. Each player picks her own, and can switch any time.
- **6 missions:** add & subtract facts up to 20, place value (hundreds/tens/ones), 2-digit add & subtract up to 100, multiplication & division facts up to 10×10, word problems, and a multiple choice mission.
- **Multiple choice mission:** skills the keypad can't handle: which number sentence matches a story, comparing with < > =, rounding (3rd grade), the missing sign, odd or even, estimating, and carrying/borrowing. Wrong choices are common mistakes (forgot to carry, subtracted small from big, mixed up < and >), and picking one explains that exact mistake.
- **Word problems everywhere:** 2 of every 10 questions are stories that use that mission's math, set in the player's world and using her name. The Story mission is all word problems, including money and (for 3rd grade) two-step problems. A 🔊 button reads each story out loud.
- **Spaced practice:** missed facts come back a few questions later and show up more often until they stick.
- **Hints with pictures:** dots, arrays, base-ten blocks and place-value charts. The answer is only shown after a second miss.
- **Rewards:** points, a daily streak, and a new collectible after every mission.
- **Grown-ups page:** hold the button for 3 seconds on the start screen to see accuracy, mastery, "needs practice" facts, and the most common mistakes per player.

## Playing on an iPad
Open the site in Safari, tap **Share**, then **Add to Home Screen** (on newer iPads it's under **More**), and always play from that icon. It opens full-screen like an app. Safari can erase a website's saved progress after 7 days without a visit, but home screen apps are exempt. Progress in the home screen app and in a Safari tab are kept separately.

## Privacy
There are no accounts and no server. Names and progress are saved only in the browser on the device being used (`localStorage`). Each device keeps its own progress.

## Developing
Plain HTML, CSS and JavaScript with no build step. To run it locally:

```bash
python3 -m http.server 5173
```

Then open http://localhost:5173. Worlds live in `themes.js`; game logic lives in `app.js`.
