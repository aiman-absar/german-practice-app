// Get references to DOM elements
const levelTitleElem = document.getElementById("level-title");
const questionContainer = document.getElementById("question-container");
const submitBtn = document.getElementById("submit-btn");
const mistakesListElem = document.getElementById("mistakes-list");
const thresholdSelect = document.getElementById("threshold-select");
const dictInput = document.getElementById("dict-input");
const dictSearchBtn = document.getElementById("dict-search-btn");
const dictResult = document.getElementById("dict-result");

// Global state
let nounsSorted = [];
let verbsSorted = [];
let currentLevel = 1;
let maxLevelUnlocked = 1;
let passThreshold = 0.8; // default 80%
let questions = []; // array of question objects for current level
let currentQuestionIndex = 0;
let score = 0;
let awaitingNext = false;

// Map for noun articles by gender
const articleMap = { 'm': 'der', 'f': 'die', 'n': 'das' };

// Load the frequency words data and initialize
fetch("data/freqwords_nouns_verbs_top1000_complete.json")
  .then(res => res.json())
  .then(data => {
    // Separate and sort nouns and verbs by rank
    nounsSorted = data.filter(item => item.pos === "noun")
                      .sort((a, b) => a.rank - b.rank);
    verbsSorted = data.filter(item => item.pos === "verb")
                      .sort((a, b) => a.rank - b.rank);
    startLevel(1);
  });

// Start a given level: set currentLevel, prepare questions, reset score and index
function startLevel(level) {
  currentLevel = level;
  levelTitleElem.textContent = `Level ${currentLevel}`;
  // Prepare 20 nouns and 20 verbs for this level (if available)
  const startIdx = (currentLevel - 1) * 20;
  const nounSlice = nounsSorted.slice(startIdx, startIdx + 20);
  const verbSlice = verbsSorted.slice(startIdx, startIdx + 20);
  // Combine into question list
  questions = [];
  // Create noun questions
  nounSlice.forEach(nounEntry => {
    // Decide question type: if noun likely has plural, randomly choose, else use translation
    const qType = Math.random() < 0.5 ? 'translation' : 'plural';
    questions.push({
      type: 'noun',
      word: nounEntry.word,
      gloss: nounEntry.gloss,
      qType: qType,
      answered: false
    });
  });
  // Create verb questions
  verbSlice.forEach(verbEntry => {
    questions.push({
      type: 'verb',
      word: verbEntry.word,
      gloss: verbEntry.gloss,
      answered: false
    });
  });
  // Randomize order of questions (mix nouns and verbs)
  shuffleArray(questions);
  // Reset score and index
  score = 0;
  currentQuestionIndex = 0;
  awaitingNext = false;
  submitBtn.textContent = "Check";
  submitBtn.disabled = false;
  // Show first question
  showCurrentQuestion();
}

// Display the current question
function showCurrentQuestion() {
  const q = questions[currentQuestionIndex];
  questionContainer.innerHTML = ""; // clear previous content
  submitBtn.disabled = true;  // will enable after data (if any) is loaded
  if (q.type === 'noun') {
    if (q.qType === 'translation') {
      // Noun translation question
      const english = q.gloss;
      const promptEnglish = english.match(/^[A-Z]/) ? english : "the " + english;
      const promptElem = document.createElement("p");
      promptElem.textContent = `Translate: "${promptEnglish}" to German (include article)`;
      const input = document.createElement("input");
      input.type = "text";
      input.id = "noun-answer";
      questionContainer.appendChild(promptElem);
      questionContainer.appendChild(input);
      input.focus();
      // Fetch noun data (gender) for checking
      getNounData(q.word).then(data => {
        q.gender = data.gender;
        submitBtn.disabled = false;
      });
    } else if (q.qType === 'plural') {
      // Noun singular/plural question
      getNounData(q.word).then(data => {
        const gender = data.gender;
        const article = articleMap[gender] || "die";
        const pluralForms = data.pluralForms;
        if (!pluralForms || pluralForms.length === 0) {
          // If no plural available, fallback to translation
          q.qType = 'translation';
          showCurrentQuestion();
          return;
        }
        const plural = pluralForms[0];
        const askSingular = Math.random() < 0.5;
        let promptText;
        if (askSingular) {
          promptText = `Singular of "${plural}"? (include article)`;
        } else {
          promptText = `Plural of "${article} ${q.word}"?`;
        }
        const promptElem = document.createElement("p");
        promptElem.textContent = promptText;
        const input = document.createElement("input");
        input.type = "text";
        input.id = "noun-answer";
        questionContainer.appendChild(promptElem);
        questionContainer.appendChild(input);
        input.focus();
        // Store expected answers for checking
        q.expectedSingular = `${article} ${q.word}`;
        q.expectedPlural = plural;
        q.askSingular = askSingular;
        submitBtn.disabled = false;
      });
    }
  } else if (q.type === 'verb') {
    // Verb conjugation question
    const blanksCount = Math.min(currentLevel, 6);
    getVerbData(q.word).then(data => {
      // Create conjugation table with blanks
      const forms = data.forms;
      const pronounRows = [
        ["ich", "wir"],
        ["du", "ihr"],
        ["er/sie/es", "sie/Sie"]
      ];
      const pronKeys = ["ich", "du", "er", "wir", "ihr", "sie"];
      const keysToBlank = shuffleArray(pronKeys.slice()).slice(0, blanksCount);
      q.blankKeys = keysToBlank;
      const table = document.createElement("table");
      table.className = "conj-table";
      pronounRows.forEach(row => {
        const tr = document.createElement("tr");
        row.forEach(pronoun => {
          let key = pronoun;
          if (pronoun === "er/sie/es") key = "er";
          if (pronoun === "sie/Sie") key = "sie";
          const pronCell = document.createElement("td");
          pronCell.textContent = pronoun;
          pronCell.style.fontWeight = "bold";
          tr.appendChild(pronCell);
          const formCell = document.createElement("td");
          if (keysToBlank.includes(key)) {
            const input = document.createElement("input");
            input.type = "text";
            input.className = "verb-input";
            input.dataset.pronoun = key;
            formCell.appendChild(input);
          } else {
            formCell.textContent = forms[key] || "";
            formCell.className = "filled-form";
          }
          tr.appendChild(formCell);
        });
        table.appendChild(tr);
      });
      const promptElem = document.createElement("p");
      promptElem.textContent = `Conjugate "${q.word}" (present tense):`;
      questionContainer.appendChild(promptElem);
      questionContainer.appendChild(table);
      const firstInput = table.querySelector("input");
      if (firstInput) firstInput.focus();
      // Store forms for checking
      q.forms = forms;
      submitBtn.disabled = false;
    });
  }
}

// Check the user's answer for the current question
function checkAnswer() {
  const q = questions[currentQuestionIndex];
  let correct = false;
  if (q.type === 'noun') {
    const userAnswer = (document.getElementById("noun-answer").value || "").trim();
    if (q.qType === 'translation') {
      // Expected "article + noun"
      const expectedArticle = articleMap[(q.gender || '').toLowerCase()] || "";
      const expectedFull = `${expectedArticle} ${q.word}`.toLowerCase();
      correct = userAnswer.toLowerCase() === expectedFull;
      if (!correct) {
        logMistake(q.word, "translation");
        showCorrectAnswerNoun(expectedFull);
      }
    } else if (q.qType === 'plural') {
      if (q.askSingular) {
        correct = userAnswer.toLowerCase() === (q.expectedSingular || "").toLowerCase();
        if (!correct) {
          logMistake(q.word, "plural");
          showCorrectAnswerNoun(q.expectedSingular);
        }
      } else {
        correct = userAnswer.toLowerCase() === (q.expectedPlural || "").toLowerCase();
        if (!correct) {
          logMistake(q.word, "plural");
          showCorrectAnswerNoun(q.expectedPlural);
        }
      }
    }
  } else if (q.type === 'verb') {
    correct = true;
    const blanks = document.querySelectorAll("input.verb-input");
    blanks.forEach(input => {
      const pron = input.dataset.pronoun;
      const userVal = (input.value || "").trim().toLowerCase();
      const correctVal = (q.forms[pron] || "").toLowerCase();
      if (userVal !== correctVal) {
        correct = false;
        // Mark wrong and show correct form
        input.classList.add("wrong-input");
        input.value = q.forms[pron] || "";
        input.readOnly = true;
        input.classList.add("correct-answer");
      }
    });
    if (!correct) {
      logMistake(q.word, "conjugation");
    }
  }
  if (correct) score++;
  q.answered = true;
  return correct;
}

// Submit/Next button handler
submitBtn.addEventListener("click", () => {
  if (!awaitingNext) {
    // Check answer
    const wasCorrect = checkAnswer();
    if (currentQuestionIndex === questions.length - 1) {
      // Last question -> finish level
      finishLevel();
    } else {
      if (wasCorrect) {
        // Correct: immediately go to next question
        currentQuestionIndex++;
        showCurrentQuestion();
        // Button remains "Check"
      } else {
        // Incorrect: show correct answers (already shown), then await user to proceed
        submitBtn.textContent = "Next";
        awaitingNext = true;
      }
    }
  } else {
    // Move to next question after an incorrect answer
    awaitingNext = false;
    submitBtn.textContent = "Check";
    currentQuestionIndex++;
    showCurrentQuestion();
  }
});

// Threshold dropdown change handler (resets progress)
thresholdSelect.addEventListener("change", () => {
  passThreshold = parseInt(thresholdSelect.value) / 100;
  maxLevelUnlocked = 1;
  mistakesListElem.innerHTML = "";
  startLevel(1);
});

// Dictionary search handlers
dictSearchBtn.addEventListener("click", () => {
  const verb = dictInput.value.trim().toLowerCase();
  if (!verb) return;
  showDictionaryEntry(verb);
});
dictInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    dictSearchBtn.click();
  }
});

// Display dictionary entry for a verb (conjugation + examples)
function showDictionaryEntry(verb) {
  getVerbData(verb).then(data => {
    if (!data) {
      dictResult.innerHTML = `<p>No data found for "${verb}".</p>`;
      return;
    }
    let html = "";
    if (data.conjHtml) {
      html += `<h4>Conjugation</h4>` + data.conjHtml;
    }
    if (data.examples && data.examples.length > 0) {
      html += `<h4>Example Sentences</h4><ul>`;
      data.examples.forEach(ex => {
        html += `<li>${ex.ger} — <em>${ex.eng}</em></li>`;
      });
      html += `</ul>`;
    }
    dictResult.innerHTML = html || `<p>No details available for "${verb}".</p>`;
  });
}

// Log a mistake in the visible list
function logMistake(word, type) {
  const li = document.createElement("li");
  li.textContent = `${word} – ${type}`;
  mistakesListElem.appendChild(li);
}

// Show correct answer in noun input field (after a wrong answer)
function showCorrectAnswerNoun(correctAnswer) {
  const input = document.getElementById("noun-answer");
  if (input) {
    input.classList.add("correct-answer");
    input.value = correctAnswer;
    input.readOnly = true;
  }
}

// Finish level: show results and unlock next level if applicable
function finishLevel() {
  const percent = (score / questions.length) * 100;
  const passed = percent >= passThreshold * 100;
  questionContainer.innerHTML = "";
  const resultMsg = document.createElement("p");
  resultMsg.textContent = `You scored ${score} out of ${questions.length} (${percent.toFixed(0)}%).`;
  questionContainer.appendChild(resultMsg);
  const resultMsg2 = document.createElement("p");
  if (passed) {
    resultMsg2.textContent = `Success! Level ${currentLevel + 1} is now unlocked.`;
    if (currentLevel >= maxLevelUnlocked) {
      maxLevelUnlocked = currentLevel + 1;
    }
  } else {
    resultMsg2.textContent = `You did not reach the threshold. Try again or adjust the threshold.`;
  }
  questionContainer.appendChild(resultMsg2);
  const retryBtn = document.createElement("button");
  retryBtn.textContent = "Retry Level";
  retryBtn.addEventListener("click", () => {
    startLevel(currentLevel);
    submitBtn.disabled = false;
  });
  questionContainer.appendChild(retryBtn);
  if (passed && (currentLevel * 20 < nounsSorted.length || currentLevel * 20 < verbsSorted.length)) {
    const nextBtn = document.createElement("button");
    nextBtn.textContent = `Start Level ${currentLevel + 1}`;
    nextBtn.addEventListener("click", () => {
      startLevel(currentLevel + 1);
      submitBtn.disabled = false;
    });
    questionContainer.appendChild(nextBtn);
  }
  submitBtn.disabled = true;
}

// Utility: shuffle an array in-place
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Fetch noun details (gender and plural forms) from Wiktionary API
function getNounData(word) {
  const cacheKey = "noun_" + word;
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    return Promise.resolve(JSON.parse(cached));
  }
  const url = `https://en.wiktionary.org/w/api.php?action=parse&page=${encodeURIComponent(word)}&format=json&origin=*`;
  return fetch(url)
    .then(res => res.json())
    .then(resJson => {
      const data = { gender: null, pluralForms: [] };
      if (!resJson.parse) {
        localStorage.setItem(cacheKey, JSON.stringify(data));
        return data;
      }
      const html = resJson.parse.text["*"];
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const germanHeader = doc.querySelector('span#German');
      if (!germanHeader) {
        localStorage.setItem(cacheKey, JSON.stringify(data));
        return data;
      }
      // Gather content under German section only
      let contentHtml = "";
      let node = germanHeader.closest('h2');
      for (node = node.nextElementSibling; node && node.tagName !== 'H2'; node = node.nextElementSibling) {
        contentHtml += node.outerHTML;
      }
      const tempDoc = parser.parseFromString(contentHtml, "text/html");
      const firstLi = tempDoc.querySelector("li");
      if (firstLi) {
        const genderElem = firstLi.querySelector("i");
        if (genderElem) {
          data.gender = genderElem.textContent.trim();
        }
        const text = firstLi.textContent;
        const pluralMatch = text.match(/plural\s([^,)]+)/i);
        if (pluralMatch) {
          let pluralPart = pluralMatch[1].trim();
          pluralPart = pluralPart.replace(/\(.*?\)/g, "").trim();
          if (/^(no |uncountable|not attested|none)/i.test(pluralPart)) {
            data.pluralForms = [];
          } else {
            const forms = pluralPart.split(/\s*or\s*/);
            data.pluralForms = forms.map(f => f.trim()).filter(f => f);
          }
        }
      }
      localStorage.setItem(cacheKey, JSON.stringify(data));
      return data;
    });
}

// Fetch verb details (present tense forms, full conjugation HTML, example sentences)
function getVerbData(word) {
  const cacheKey = "verb_" + word;
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    return Promise.resolve(JSON.parse(cached));
  }
  const url = `https://en.wiktionary.org/w/api.php?action=parse&page=${encodeURIComponent(word)}&format=json&origin=*`;
  return fetch(url)
    .then(res => res.json())
    .then(resJson => {
      const data = { forms: {}, conjHtml: "", examples: [] };
      if (!resJson.parse) {
        localStorage.setItem(cacheKey, JSON.stringify(data));
        return data;
      }
      const html = resJson.parse.text["*"];
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const germanHeader = doc.querySelector('span#German');
      if (!germanHeader) {
        localStorage.setItem(cacheKey, JSON.stringify(data));
        return data;
      }
      let contentHtml = "";
      let node = germanHeader.closest('h2');
      for (node = node.nextElementSibling; node && node.tagName !== 'H2'; node = node.nextElementSibling) {
        contentHtml += node.outerHTML;
      }
      const tempDoc = parser.parseFromString(contentHtml, "text/html");
      const verbHeader = Array.from(tempDoc.querySelectorAll('h3')).find(h3 => h3.textContent.trim().startsWith("Verb"));
      let verbContentElem = verbHeader ? verbHeader : tempDoc;
      // Extract conjugation section HTML
      const conjHeader = verbContentElem.querySelector('span#Conjugation');
      if (conjHeader) {
        const conjHeadingElem = conjHeader.closest('h4');
        if (conjHeadingElem) {
          let htmlAccum = "";
          let sib = conjHeadingElem;
          while (sib) {
            htmlAccum += sib.outerHTML;
            sib = sib.nextElementSibling;
            if (sib && sib.tagName === 'H4') break;
            if (sib && sib.tagName === 'H3') break;
          }
          data.conjHtml = htmlAccum;
        }
      }
      // Parse present tense forms from conjugation table
      const conjTable = verbContentElem.querySelector("table");
      if (conjTable) {
        data.forms = parsePresentTable(conjTable);
      }
      // Gather example sentences (German — English)
      const exampleNodes = verbContentElem.querySelectorAll('li, dd');
      exampleNodes.forEach(node => {
        if (node.textContent.includes("―")) {
          const parts = node.textContent.split("―");
          if (parts.length >= 2) {
            const ger = parts[0].trim();
            const eng = parts[1].trim().replace(/^–\s*/, "");
            if (ger && eng) {
              data.examples.push({ ger, eng });
            }
          }
        }
      });
      localStorage.setItem(cacheKey, JSON.stringify(data));
      return data;
    });
}

// Helper: parse present tense conjugation forms from a Wiktionary conjugation table element
function parsePresentTable(tableElem) {
  const forms = {};
  // Locate the "present" header cell
  let presentTh = null;
  const ths = tableElem.getElementsByTagName("th");
  for (let th of ths) {
    if (th.textContent.trim().toLowerCase() === "present") {
      presentTh = th;
      break;
    }
  }
  if (!presentTh) return forms;
  const presentRow = presentTh.parentElement;
  const rowSpan = parseInt(presentTh.getAttribute("rowspan")) || 1;
  const rows = [presentRow];
  let next = presentRow.nextElementSibling;
  for (let i = 1; i < rowSpan && next; i++) {
    rows.push(next);
    next = next.nextElementSibling;
  }
  rows.forEach(row => {
    let cells = Array.from(row.querySelectorAll("td"));
    if (cells.length > 4) {
      if (cells.length % 2 === 1) {
        const mid = Math.floor(cells.length / 2);
        const midText = cells[mid].textContent.trim();
        if (midText === "" || midText === "i" || midText === "ii") {
          cells.splice(mid, 1);
        }
      }
      if (cells.length > 4) {
        cells.splice(4);
      }
    }
    if (cells.length === 4) {
      const pron1 = cells[0].textContent.trim().toLowerCase();
      const form1 = cells[1].textContent.trim();
      const pron2 = cells[2].textContent.trim().toLowerCase();
      const form2 = cells[3].textContent.trim();
      forms[pron1] = form1;
      forms[pron2] = form2;
    }
  });
  return forms;
}
