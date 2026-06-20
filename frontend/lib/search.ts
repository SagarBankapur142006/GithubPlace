/** Client-side search preprocessing — mirrors backend for instant UX */

export const SYNONYMS: Record<string, string> = {
  doctor: "healthtech",
  medical: "healthtech",
  hospital: "healthtech",
  health: "healthtech",
  farm: "agritech",
  agriculture: "agritech",
  crop: "agritech",
  plant: "agritech",
  agri: "agritech",
  money: "fintech",
  bank: "fintech",
  finance: "fintech",
  payment: "fintech",
  school: "edtech",
  student: "edtech",
  learn: "edtech",
  education: "edtech",
  shop: "e-commerce",
  store: "e-commerce",
  buy: "e-commerce",
  retail: "e-commerce",
  crypto: "web3",
  blockchain: "web3",
  nft: "web3",
  token: "web3",
  machine: "machine learning",
  learning: "machine learning",
  llm: "artificial intelligence",
  bot: "artificial intelligence",
  intelligence: "artificial intelligence",
  phone: "mobile",
  ios: "mobile",
  android: "mobile",
  app: "mobile",
  green: "greentech",
  energy: "greentech",
  solar: "greentech",
  climate: "climatetech",
  pharma: "pharmatech",
};

export const COMMON_TYPOS: Record<string, string> = {
  helth: "healthtech",
  finacial: "fintech",
  artifical: "artificial intelligence",
  tehc: "tech",
  comerce: "e-commerce",
  blokchain: "web3",
};

export function preprocessQuery(query: string): {
  suggestedQuery: string | null;
  suggestedWords: string[];
} {
  const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 1);
  const suggestedWords: string[] = [];
  let spellCorrected = false;

  words.forEach((word) => {
    if (COMMON_TYPOS[word]) {
      spellCorrected = true;
      suggestedWords.push(COMMON_TYPOS[word]);
    } else {
      suggestedWords.push(word);
    }
  });

  return {
    suggestedQuery: spellCorrected ? suggestedWords.join(" ") : null,
    suggestedWords,
  };
}
