// Full version of Quiz.jsx with error log of incorrect answers

import React, { useEffect, useState } from 'react';
import verbs from './data/verbs_enriched_complete.json';
import nouns from './data/nouns_enriched_complete.json';

const pronouns = ["ich", "du", "er/sie/es", "wir", "ihr", "sie/Sie"];
const QUESTIONS_PER_LEVEL = 20;
const THRESHOLD_OPTIONS = [0.6, 0.7, 0.8, 0.9, 1.0];

function DictionaryLookup() {
  const [term, setTerm] = useState('');

  const openWiktionaryPage = () => {
    if (!term.trim()) return;
    const url = `https://de.wiktionary.org/wiki/${encodeURIComponent(term.trim())}`;
    window.open(url, '_blank');
  };

  return (
    <div style={{ marginTop: '2rem' }}>
      <h3>🔍 Wiktionary Lookup</h3>
      <input
        type="text"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="Type a German word..."
      />
      <button onClick={openWiktionaryPage} style={{ marginLeft: '0.5rem' }}>
        Open Wiktionary Entry
      </button>
    </div>
  );
}

export default function Quiz() {
  const [question, setQuestion] = useState(null);
  const [missingPronoun, setMissingPronoun] = useState(null);
  const [userInput, setUserInput] = useState({});
  const [feedback, setFeedback] = useState(null);
  const [answered, setAnswered] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [questionCount, setQuestionCount] = useState(0);
  const [level, setLevel] = useState(1);
  const [threshold, setThreshold] = useState(0.8);
  const [errorLog, setErrorLog] = useState([]);
  const [allQuestions, setAllQuestions] = useState([]);
  const [unusedQuestions, setUnusedQuestions] = useState([]);


  const generateNewQuestion = (fromList = unusedQuestions) => {
  if (fromList.length === 0) {
    setQuestion(null);
    return;
  }

  const [nextQuestion, ...rest] = fromList;
  setUnusedQuestions(rest);

  if (nextQuestion.type === 'verb') {
    const pronounToHide = pronouns[Math.floor(Math.random() * pronouns.length)];
    setMissingPronoun(pronounToHide);
  }

  setQuestion(nextQuestion);
  setUserInput({});
  setFeedback(null);
  setAnswered(false);
};


  useEffect(() => {
  const combined = [
    ...verbs.map(v => ({ type: 'verb', data: v })),
    ...nouns.map(n => ({ type: 'noun', data: n }))
  ];
  const shuffled = combined
    .map(value => ({ value, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ value }) => value);

  setAllQuestions(shuffled);
  setUnusedQuestions(shuffled);
  generateNewQuestion(shuffled);
}, []);


  const handleThresholdChange = (e) => {
  const newThreshold = parseFloat(e.target.value);
  const reshuffled = allQuestions
    .map(value => ({ value, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ value }) => value);

  setThreshold(newThreshold);
  setLevel(1);
  setCorrectCount(0);
  setQuestionCount(0);
  setErrorLog([]);
  setUnusedQuestions(reshuffled);
  generateNewQuestion(reshuffled);
};


  const handleSubmit = (e) => {
    e.preventDefault();
    setAnswered(true);
    setQuestionCount(prev => prev + 1);

    let correct = false;

    if (question.type === 'verb') {
      const expected = question.data.present_tense[missingPronoun];
      const userAns = userInput.answer?.trim().toLowerCase();
      correct = userAns === expected.toLowerCase();
      setFeedback(correct);

      if (!correct) {
        setErrorLog(prev => [
          ...prev,
          {
            type: 'verb',
            infinitive: question.data.infinitive,
            english: question.data.english_meaning,
            pronoun: missingPronoun,
            correct: expected,
            user: userInput.answer
          }
        ]);
      }
    } else {
      const { definite_article, noun_singular, plural_forms } = question.data;
      const articleCorrect = userInput.article?.trim().toLowerCase() === definite_article.toLowerCase();
      const nounCorrect = userInput.noun?.trim().toLowerCase() === noun_singular.toLowerCase();
      const hasPlural = plural_forms && plural_forms.length > 0;
      const pluralCorrect = !hasPlural || plural_forms.map(p => p.toLowerCase()).includes(userInput.plural?.trim().toLowerCase());

      correct = articleCorrect && nounCorrect && pluralCorrect;
      setFeedback({ articleCorrect, nounCorrect, pluralCorrect, hasPlural });

      if (!correct) {
        setErrorLog(prev => [
          ...prev,
          {
            type: 'noun',
            english: question.data.english_meaning,
            correct: `${definite_article} ${noun_singular}${hasPlural ? ', Plural: ' + plural_forms.join(', ') : ''}`,
            user: `${userInput.article || ''} ${userInput.noun || ''}${hasPlural ? ', Plural: ' + (userInput.plural || '') : ''}`
          }
        ]);
      }
    }

    if (correct) setCorrectCount(prev => prev + 1);

    if (questionCount + 1 === QUESTIONS_PER_LEVEL || unusedQuestions.length === 0) {
      const successRate = (correctCount + (correct ? 1 : 0)) / (questionCount + 1);
      if (successRate >= threshold) {
    if (unusedQuestions.length === 0) {
      alert(`🎉 Final level complete! You've mastered all questions.`);
    } else {
      alert(`🎉 Level ${level} complete! Moving to level ${level + 1}.`);
    }
    setLevel(prev => prev + 1);
  } else {
    alert(`❌ You scored ${Math.round(successRate * 100)}%. Try Level ${level} again.`);
  }
    setCorrectCount(0);
    setQuestionCount(0);
    setErrorLog([]);
    generateNewQuestion();
    }

    else {
  // Normal question progression
  generateNewQuestion();
}

  };

  if (!question) return <p>🎓 You've completed all available questions! Great job!</p>;


  return (
    <div style={{ display: 'flex' }}>
      <div style={{ flex: 2 }}>
        <h1>Level {level} — {questionCount} / {QUESTIONS_PER_LEVEL}</h1>
        <p>✅ {correctCount} / {questionCount} correct</p>

        <label>Success Threshold:
          <select value={threshold} onChange={handleThresholdChange}>
            {THRESHOLD_OPTIONS.map(opt => (
              <option key={opt} value={opt}>{Math.round(opt * 100)}%</option>
            ))}
          </select>
        </label>

        {question.type === 'verb' ? (
          <div>
            <h2>Verb: {question.data.infinitive}</h2>
            <p>Meaning: {question.data.english_meaning}</p>

            <form onSubmit={handleSubmit}>
              <table border="1">
                <tbody>
                  {pronouns.map((pronoun) => (
                    <tr key={pronoun}>
                      <td>{pronoun}</td>
                      <td>
                        {pronoun === missingPronoun ? (
                          <input
                            type="text"
                            value={userInput.answer || ''}
                            onChange={(e) => setUserInput({ answer: e.target.value })}
                            placeholder="?"
                            disabled={answered}
                          />
                        ) : (
                          question.data.present_tense[pronoun]
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <br />
              {!answered && <button type="submit">Check Answer</button>}
            </form>

            {feedback !== null && answered && (
              <>
                <p>
                  {feedback
                    ? '✅ Correct!'
                    : `❌ Incorrect. Correct answer: "${question.data.present_tense[missingPronoun]}"`}
                </p>
                <button onClick={generateNewQuestion}>Next Question</button>
              </>
            )}
          </div>
        ) : (
          <div>
            <h2>Translate this noun to German</h2>
            <p>English: {question.data.english_meaning}</p>

            <form onSubmit={handleSubmit}>
              <label>Article:
                <input
                  type="text"
                  value={userInput.article || ''}
                  onChange={(e) => setUserInput({ ...userInput, article: e.target.value })}
                  disabled={answered}
                />
              </label>
              <br />
              <label>German noun:
                <input
                  type="text"
                  value={userInput.noun || ''}
                  onChange={(e) => setUserInput({ ...userInput, noun: e.target.value })}
                  disabled={answered}
                />
              </label>
              <br />
              {question.data.plural_forms && question.data.plural_forms.length > 0 && (
                <>
                  <label>Plural form:
                    <input
                      type="text"
                      value={userInput.plural || ''}
                      onChange={(e) => setUserInput({ ...userInput, plural: e.target.value })}
                      disabled={answered}
                    />
                  </label>
                  <br />
                </>
              )}
              <br />
              {!answered && <button type="submit">Check Answer</button>}
            </form>

            {feedback && answered && (
              <>
                <p>{feedback.articleCorrect ? '✅' : '❌'} Article</p>
                <p>{feedback.nounCorrect ? '✅' : '❌'} Noun</p>
                {feedback.hasPlural && (
                  <p>{feedback.pluralCorrect ? '✅' : '❌'} Plural</p>
                )}
                {!feedback.articleCorrect || !feedback.nounCorrect || (feedback.hasPlural && !feedback.pluralCorrect) ? (
                  <p>
                    Correct: {question.data.definite_article} {question.data.noun_singular}
                    {feedback.hasPlural && `, Plural: ${question.data.plural_forms.join(', ')}`}
                  </p>
                ) : (
                  <p>🎉 Fully correct!</p>
                )}
                <button onClick={generateNewQuestion}>Next Question</button>
              </>
            )}
          </div>
        )}

        <hr style={{ margin: '3rem 0' }} />
        <DictionaryLookup />
      </div>

      <div style={{ flex: 1, marginLeft: '2rem' }}>
        <h3>🛑 Incorrect Answers This Level</h3>
        {errorLog.length === 0 ? <p>No errors yet.</p> : (
          <ul>
            {errorLog.map((entry, idx) => (
              <li key={idx}>
                {entry.type === 'verb' ? (
                  <>
                    <strong>{entry.infinitive}</strong> ({entry.english}) — {entry.pronoun}<br />
                    ❌ {entry.user} → ✅ {entry.correct}
                  </>
                ) : (
                  <>
                    <strong>{entry.english}</strong><br />
                    ❌ {entry.user}<br />
                    ✅ {entry.correct}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
