// Global state variables
let nouns = [];       // full list of nouns (will be fetched from data)
let verbs = [];       // full list of verbs (will be fetched from data)
let nounsRemaining = [];
let verbsRemaining = [];
let currentLevel = 1;
let threshold = 80;   // default accuracy threshold (percent)
let currentQuestions = [];   // array of question objects for the current level
let currentQuestionIndex = 0;
let totalAnswers = 0;        // number of answers attempted in current level
let correctAnswers = 0;      // number of correct answers in current level

// Cached DOM elements for convenience
const levelIndicator = document.getElementById('level-indicator');
const thresholdSelect = document.getElementById('thresholdSelect');
const scoreDisplay = document.getElementById('score-display');
const questionContainer = document.getElementById('question-container');
const feedbackEl = document.getElementById('feedback');
const checkBtn = document.getElementById('check-btn');
const nextBtn = document.getElementById('next-btn');
const dictInput = document.getElementById('dict-input');
const dictSearchBtn = document.getElementById('dict-search');
const dictResults = document.getElementById('dict-results');

// Utility: Update score display text
function updateScoreDisplay() {
  let percent = totalAnswers ? Math.round((correctAnswers / totalAnswers) * 100) : 0;
  scoreDisplay.textContent = `Score: ${correctAnswers}/${totalAnswers} (${percent}%)`;
}

// Utility: Enable or disable the Check/Next buttons appropriately
function setButtonStates({ checkEnabled = false, nextEnabled = false }) {
  checkBtn.disabled = !checkEnabled;
  nextBtn.disabled = !nextEnabled;
}

// Prepare a new level with random selection of words
function startLevel(level) {
  currentLevel = level;
  levelIndicator.textContent = `Level: ${currentLevel}`;
  feedbackEl.textContent = '';
  feedbackEl.className = ''; // remove any feedback color classes
  // Reset score counters for the new level
  totalAnswers = 0;
  correctAnswers = 0;
  updateScoreDisplay();
  // Build question list for this level
  currentQuestions = [];
  currentQuestionIndex = 0;
  // Determine how many nouns/verbs to take
  const numNouns = (nounsRemaining.length >= 20) ? 20 : nounsRemaining.length;
  const numVerbs = (verbsRemaining.length >= 20) ? 20 : verbsRemaining.length;
  // Randomly pick nouns and verbs for this level
  const selectedNouns = [];
  const selectedVerbs = [];
  // Simple shuffle and slice approach for selection
  if (numNouns > 0) {
    // Shuffle remaining nouns (using Fisher-Yates shuffle)
    let shuffledN = nounsRemaining.slice();
    for (let i = shuffledN.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledN[i], shuffledN[j]] = [shuffledN[j], shuffledN[i]];
    }
    selectedNouns.push(...shuffledN.slice(0, numNouns));
  }
  if (numVerbs > 0) {
    let shuffledV = verbsRemaining.slice();
    for (let i = shuffledV.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledV[i], shuffledV[j]] = [shuffledV[j], shuffledV[i]];
    }
    selectedVerbs.push(...shuffledV.slice(0, numVerbs));
  }
  // Create question objects and mix them
  for (let noun of selectedNouns) {
    currentQuestions.push({
      type: 'noun',
      english: noun.meaning,
      german: noun.noun,
      article: noun.article
    });
  }
  for (let verb of selectedVerbs) {
    currentQuestions.push({
      type: 'verb',
      infinitive: verb.infinitive,
      meaning: verb.meaning,
      conjugation: verb.conjugation
    });
  }
  // Shuffle the questions so nouns and verbs are intermingled
  // (If one category is fewer, they will be interspersed as much as possible)
  for (let i = currentQuestions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [currentQuestions[i], currentQuestions[j]] = [currentQuestions[j], currentQuestions[i]];
  }
  // If there are questions, show the first one
  if (currentQuestions.length > 0) {
    showQuestion(0);
  } else {
    // No questions (means no words left in either pool)
    questionContainer.innerHTML = "<p>Congratulations! You've completed all the words available.</p>";
    setButtonStates({ checkEnabled: false, nextEnabled: false });
  }
}

// Render a question by index
function showQuestion(index) {
  currentQuestionIndex = index;
  const q = currentQuestions[index];
  feedbackEl.textContent = '';       // clear previous feedback
  feedbackEl.className = '';
  setButtonStates({ checkEnabled: true, nextEnabled: false });  // allow checking, disable next until answered

  // Build HTML content for the question
  if (q.type === 'noun') {
    // Noun prompt and inputs
    questionContainer.innerHTML = `
      <p>Translate to German (with article): <strong>${q.english}</strong></p>
      <div>
        <label>Article: <input type="text" id="noun-article-input" maxlength="3" /></label>
        <label>Noun: <input type="text" id="noun-noun-input" /></label>
      </div>
    `;
  } else if (q.type === 'verb') {
    // Verb conjugation table with blanks
    // Determine number of blanks based on level (max 6)
    const blanksToFill = Math.min(currentLevel, 6);
    // Choose which pronoun forms to blank out (randomly select blanksToFill indices out of 6)
    const pronouns = ["ich", "du", "er/sie/es", "wir", "ihr", "sie/Sie"];
    const blankIndices = new Set();
    // Randomly pick indices for blanks
    while (blankIndices.size < blanksToFill) {
      let randIdx = Math.floor(Math.random() * pronouns.length);
      blankIndices.add(randIdx);
    }
    // Build table rows
    let tableRows = "";
    pronouns.forEach((pronoun, idx) => {
      const correctForm = q.conjugation[pronoun];  // expected answer from data
      if (blankIndices.has(idx)) {
        // blank this form
        tableRows += `
          <tr>
            <td>${pronoun}</td>
            <td><input type="text" data-pronoun="${pronoun}" class="verb-input" /></td>
          </tr>
        `;
      } else {
        // show the form as a hint (not blanked)
        tableRows += `
          <tr>
            <td>${pronoun}</td>
            <td>${correctForm}</td>
          </tr>
        `;
      }
    });
    questionContainer.innerHTML = `
      <p>Conjugate <strong>${q.infinitive}</strong> (meaning "${q.meaning}") – fill in the missing forms:</p>
      <table>${tableRows}</table>
    `;
  }
}

// Check the current question's answer
function checkAnswer() {
  const q = currentQuestions[currentQuestionIndex];
  let questionCorrect = true;
  if (q.type === 'noun') {
    // Get user input values
    const artInput = document.getElementById('noun-article-input').value.trim();
    const nounInput = document.getElementById('noun-noun-input').value.trim();
    const userAnswer = artInput.toLowerCase() + " " + nounInput.toLowerCase();
    const correctAnswer = q.article.toLowerCase() + " " + q.german.toLowerCase();
    totalAnswers += 1;
    if (userAnswer === correctAnswer) {
      correctAnswers += 1;
      feedbackEl.textContent = `Correct! "${q.english}" is ${q.article} ${q.german}.`;
      feedbackEl.className = 'correct';
    } else {
      questionCorrect = false;
      feedbackEl.textContent = `Incorrect. The correct answer is ${q.article} ${q.german}.`;
      feedbackEl.className = 'incorrect';
    }
    // Disable inputs after check
    document.getElementById('noun-article-input').disabled = true;
    document.getElementById('noun-noun-input').disabled = true;
  } else if (q.type === 'verb') {
    // Check each blank input in the conjugation table
    const inputs = questionContainer.querySelectorAll('input.verb-input');
    inputs.forEach(input => {
      const pronounKey = input.getAttribute('data-pronoun');
      const correctForm = q.conjugation[pronounKey];
      const userVal = input.value.trim();
      totalAnswers += 1;
      if (userVal.toLowerCase() === correctForm.toLowerCase()) {
        // Correct answer for this blank
        correctAnswers += 1;
        input.classList.add('correct-cell');
        input.disabled = true;
      } else {
        // Incorrect – mark and show correct form
        questionCorrect = false;
        input.classList.add('incorrect-cell');
        input.value = correctForm;   // replace with correct answer
        input.disabled = true;
      }
    });
    if (questionCorrect) {
      feedbackEl.textContent = "Correct!";
      feedbackEl.className = 'correct';
    } else {
      feedbackEl.textContent = "Some answers were incorrect. Correct forms have been shown above.";
      feedbackEl.className = 'incorrect';
    }
  }
  // Update score display after checking
  updateScoreDisplay();
  // Prepare buttons for next step
  setButtonStates({ checkEnabled: false, nextEnabled: true });
  if (currentQuestionIndex === currentQuestions.length - 1) {
    // If this was the last question of the level, change Next to "Finish Level"
    nextBtn.textContent = "Finish Level";
  } else {
    nextBtn.textContent = "Next Question";
  }
}

// Handle moving to next question or finishing level
function nextStep() {
  // If there are more questions, show the next one
  if (currentQuestionIndex < currentQuestions.length - 1) {
    showQuestion(currentQuestionIndex + 1);
  } else {
    // Last question was just answered, finish the level
    finalizeLevel();
  }
}

// Finalize level: check threshold and proceed or prompt retry
function finalizeLevel() {
  // Calculate final percentage for the level
  const accuracy = (totalAnswers === 0) ? 0 : (correctAnswers / totalAnswers) * 100;
  // Determine if passed or failed
  const thresholdPct = threshold;
  questionContainer.innerHTML = ""; // clear question area
  if (accuracy >= thresholdPct) {
    // Passed the level
    feedbackEl.className = 'correct';
    feedbackEl.textContent = `Level ${currentLevel} passed! You scored ${Math.round(accuracy)}%, which meets the ${thresholdPct}% threshold.`;
    // Remove the used words from the pool
    // We identify them by comparing with currentQuestions lists
    let usedNouns = currentQuestions.filter(q => q.type === 'noun');
    let usedVerbs = currentQuestions.filter(q => q.type === 'verb');
    // Remove these from nounsRemaining and verbsRemaining
    nounsRemaining = nounsRemaining.filter(noun => 
      !usedNouns.find(u => u.german === noun.noun && u.article === noun.article)
    );
    verbsRemaining = verbsRemaining.filter(verb => 
      !usedVerbs.find(u => u.infinitive === verb.infinitive)
    );
    currentLevel += 1;
    if (nounsRemaining.length === 0 && verbsRemaining.length === 0) {
      // All words exhausted
      feedbackEl.textContent += " 🎉 All levels complete! You have practiced all available words.";
      setButtonStates({ checkEnabled: false, nextEnabled: false });
    } else {
      // Provide a button to continue to next level
      nextBtn.textContent = `Start Level ${currentLevel}`;
      setButtonStates({ checkEnabled: false, nextEnabled: true });
      // The next button now will trigger starting the next level
    }
  } else {
    // Failed to meet threshold
    feedbackEl.className = 'incorrect';
    feedbackEl.textContent = `Level ${currentLevel} not passed. You scored ${Math.round(accuracy)}%, below the ${thresholdPct}% threshold.`;
    // Offer retry for same level
    nextBtn.textContent = `Retry Level ${currentLevel}`;
    setButtonStates({ checkEnabled: false, nextEnabled: true });
    // (The nextStep function will handle retry by restarting the level with same words)
  }
}

// Event: Threshold dropdown change
thresholdSelect.addEventListener('change', () => {
  const newVal = parseInt(thresholdSelect.value);
  if (newVal !== threshold) {
    threshold = newVal;
    // Reset session
    nounsRemaining = nouns.slice();  // reset pools to full list
    verbsRemaining = verbs.slice();
    startLevel(1);
  }
});

// Event: Check Answer button
checkBtn.addEventListener('click', () => {
  checkAnswer();
});

// Event: Next/Finish button
nextBtn.addEventListener('click', () => {
  // If level finished and passed, nextBtn starts next level
  if (currentQuestionIndex === currentQuestions.length - 1 && correctAnswers/totalAnswers * 100 >= threshold) {
    // Proceed to next level
    startLevel(currentLevel);
  } else if (currentQuestionIndex === currentQuestions.length - 1 && correctAnswers/totalAnswers * 100 < threshold) {
    // Retry same level (do not remove words)
    // We simply restart the level with the same remaining pools (so same words again)
    startLevel(currentLevel);
  } else {
    // Otherwise, just go to next question
    nextStep();
  }
});

// Allow pressing Enter to trigger check on noun inputs or last blank in verb table
questionContainer.addEventListener('keypress', (e) => {
  if (e.key === 'Enter' && !checkBtn.disabled) {
    e.preventDefault();
    checkAnswer();
  }
});

// Verbdictionary: Search button click
dictSearchBtn.addEventListener('click', () => {
  const verb = dictInput.value.trim();
  if (!verb) return;
  dictResults.innerHTML = `<p>Searching for "${verb}"...</p>`;
  // Fetch Wiktionary page HTML for the verb (German Wiktionary)
  const url = `https://de.wiktionary.org/api/rest_v1/page/html/${encodeURIComponent(verb)}?redirect=true&origin=*`;
  fetch(url)
    .then(response => {
      if (!response.ok) throw new Error("Page not found");
      return response.text();
    })
    .then(htmlText => {
      // Parse the HTML text
      let parser = new DOMParser();
      let doc = parser.parseFromString(htmlText, 'text/html');
      // Extract present tense conjugation (from the quick conjugation box)
      let conjTableHTML = "";
      try {
        // Look for the first table in the content that has "Präsens" in it
        const tables = doc.querySelectorAll('table');
        for (let table of tables) {
          if (table.innerText.includes('Präsens') && table.innerText.includes('ich')) {
            conjTableHTML = table.outerHTML;
            break;
          }
        }
      } catch (err) {
        conjTableHTML = "";
      }
      // If the quick conjugation table is incomplete (often only singular), we will add plural forms manually
      if (conjTableHTML) {
        // If needed, ensure wir/ihr/sie forms are present
        if (!conjTableHTML.includes('wir')) {
          // The table likely only has ich/du/er. We will append rows for wir, ihr, sie.
          const infin = verb;  // infinitive
          // Determine plural forms (basic rule, covers most verbs)
          let stem = infin;
          if (infin.endsWith('en')) {
            stem = infin.slice(0, -2);
          } else if (infin.endsWith('n')) {
            stem = infin.slice(0, -1);
          }
          let wirForm, ihrForm, sieForm;
          if (verb === 'sein') {
            // special case for "sein"
            wirForm = 'sind';
            ihrForm = 'seid';
            sieForm = 'sind';
          } else {
            wirForm = infin;
            // If stem ends in d or t, add 'et', otherwise just 't'
            if (stem.match(/(d|t)$/)) {
              ihrForm = stem + 'et';
            } else {
              ihrForm = stem + 't';
            }
            sieForm = infin;
          }
          // Append rows to the table HTML
          const insertionIndex = conjTableHTML.lastIndexOf("</table>");
          if (insertionIndex !== -1) {
            const extraRows = `
              <tr><td>wir</td><td>${wirForm}</td></tr>
              <tr><td>ihr</td><td>${ihrForm}</td></tr>
              <tr><td>sie/Sie</td><td>${sieForm}</td></tr>
            `;
            conjTableHTML = conjTableHTML.slice(0, insertionIndex) + extraRows + conjTableHTML.slice(insertionIndex);
          }
        }
      }
      // Extract example sentences (look for "Beispiele" section)
      let examplesHTML = "";
      try {
        const textContent = doc.body.innerText;
        const exIndex = textContent.indexOf('Beispiele:');
        if (exIndex !== -1) {
          const exLines = textContent.substring(exIndex).split('\n');
          const exampleLines = [];
          for (let line of exLines.slice(1)) {  // skip the "Beispiele:" line
            let trimmed = line.trim();
            if (trimmed.startsWith('[')) {
              // Remove the [number] marker and any trailing explanation
              let sentence = trimmed.replace(/^\[\d+\]\s*/, '');
              exampleLines.push(sentence);
              if (exampleLines.length >= 2) break;
            }
          }
          if (exampleLines.length > 0) {
            examplesHTML = "<ul>";
            exampleLines.forEach(ex => {
              examplesHTML += `<li>${ex}</li>`;
            });
            examplesHTML += "</ul>";
          }
        }
      } catch (err) {
        examplesHTML = "";
      }
      // Build result output
      dictResults.innerHTML = "";
      if (conjTableHTML) {
        dictResults.innerHTML += "<h3>Präsens Conjugation:</h3>" + conjTableHTML;
      }
      if (examplesHTML) {
        dictResults.innerHTML += "<h3>Example Usage:</h3>" + examplesHTML;
      }
      if (!conjTableHTML && !examplesHTML) {
        dictResults.innerHTML = `<p>No data found for "${verb}".</p>`;
      }
    })
    .catch(err => {
      dictResults.innerHTML = `<p>Error: ${err.message}</p>`;
    });
});

// Initial data load from JSON files
function loadData() {
  // Fetch nouns and verbs JSON in parallel
  Promise.all([
    fetch('data/nouns.json').then(res => res.json()),
    fetch('data/verbs.json').then(res => res.json())
  ]).then(([nounsData, verbsData]) => {
    nouns = nounsData;
    verbs = verbsData;
    // Initialize remaining pools
    nounsRemaining = nouns.slice();
    verbsRemaining = verbs.slice();
    // Start the first level
    startLevel(1);
  }).catch(err => {
    console.error("Failed to load JSON data:", err);
    questionContainer.innerHTML = "<p>Error loading word data. Please try refreshing the page.</p>";
  });
}

// Start the app
loadData();
