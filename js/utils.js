export const normalize = (v = '') => String(v).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

export const fuzzyMatch = (a, b) => {
  const x = normalize(a), y = normalize(b);
  if (!x || !y) return false;
  if (x === y) return true;
  return levenshtein(x, y) <= 1 || x.includes(y) || y.includes(x);
};

export function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

export const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export function speak(text) {
  if (!window.speechSynthesis || !text) return;
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 0.95;
  window.speechSynthesis.speak(utter);
}

export const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);
