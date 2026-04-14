import { apiPost } from '../apiClient';

// ============================================================
// screeningService.js — Customer Screening (OpenSanctions placeholder)
// ============================================================

// Static dataset of ~20 known AML-relevant names for local matching
const SANCTIONS_LIST = [
  // Client Request Real Cases
  { name: 'Narendra Modi', country: 'India', pep_category: 'Prime Minister', sources: ['PEP Database'] },
  { name: 'Donald Trump', country: 'USA', pep_category: 'Former President', sources: ['PEP Database', 'Adverse Media'] },
  { name: 'Amitabh Bachchan', country: 'India', pep_category: null, sources: ['Adverse Media (Panama Papers)'] },
  
  // Existing Data
  { name: 'Mohammed Al-Rashid', country: 'Nigeria', pep_category: 'Government Official', sources: ['OFAC', 'UN Sanctions', 'PEP Database'] },
  { name: 'Amira Hassan', country: 'Nigeria', pep_category: null, sources: ['OFAC', 'EU List'] },
  { name: 'Semion Mogilevich', country: 'Russia', pep_category: null, sources: ['OFAC', 'EU List'] },
  { name: 'Joaquin Guzman', country: 'Mexico', pep_category: null, sources: ['OFAC', 'UN Sanctions'] },
  { name: 'Abdul Qadeer Khan', country: 'Pakistan', pep_category: 'Nuclear Scientist', sources: ['UN Sanctions', 'EU List'] },
  { name: 'Haji Juma Khan', country: 'Afghanistan', pep_category: null, sources: ['OFAC'] },
  { name: 'Ali Musa Daqduq', country: 'Lebanon', pep_category: null, sources: ['OFAC', 'UN Sanctions'] },
  { name: 'Felicien Kabuga', country: 'Rwanda', pep_category: null, sources: ['UN Sanctions', 'EU List'] },
  { name: 'Matteo Messina Denaro', country: 'Italy', pep_category: null, sources: ['EU List'] },
  { name: 'Ayman Al-Zawahiri', country: 'Egypt', pep_category: null, sources: ['OFAC', 'UN Sanctions', 'EU List'] },
  { name: 'Abu Mohammed Al-Julani', country: 'Syria', pep_category: null, sources: ['OFAC', 'UN Sanctions'] },
  { name: 'Masood Azhar', country: 'Pakistan', pep_category: null, sources: ['UN Sanctions'] },
  { name: 'Ibrahim Magu', country: 'Nigeria', pep_category: 'Government Official', sources: ['PEP Database'] },
  { name: 'Diezani Alison-Madueke', country: 'Nigeria', pep_category: 'Government Official', sources: ['OFAC', 'PEP Database'] },
  { name: 'James Ibori', country: 'Nigeria', pep_category: 'Politician', sources: ['OFAC', 'EU List', 'PEP Database'] },
  { name: 'Sani Abacha', country: 'Nigeria', pep_category: 'Head of State', sources: ['OFAC', 'UN Sanctions', 'EU List', 'PEP Database'] },
  { name: 'Nawaz Sharif', country: 'Pakistan', pep_category: 'Prime Minister', sources: ['PEP Database'] },
  { name: 'Pavlo Lazarenko', country: 'Ukraine', pep_category: 'Prime Minister', sources: ['OFAC', 'PEP Database'] },
];

/**
 * Calculate fuzzy similarity between two strings (0-100).
 * Uses a simple bigram overlap approach.
 */
function fuzzyScore(str1, str2) {
  const a = str1.toLowerCase().trim();
  const b = str2.toLowerCase().trim();

  if (a === b) return 100;
  if (a.length < 2 || b.length < 2) return 0;

  const bigrams = (s) => {
    const result = new Set();
    for (let i = 0; i < s.length - 1; i++) {
      result.add(s.substring(i, i + 2));
    }
    return result;
  };

  const bigramsA = bigrams(a);
  const bigramsB = bigrams(b);
  let intersection = 0;
  bigramsA.forEach(bg => { if (bigramsB.has(bg)) intersection++; });

  const score = (2 * intersection) / (bigramsA.size + bigramsB.size) * 100;
  return Math.round(score);
}

/**
 * Local OpenSanctions matching placeholder.
 */
function localOpenSanctionsMatch(name, dob, country) {
  let bestMatch = null;
  let bestScore = 0;

  for (const entry of SANCTIONS_LIST) {
    const nameScore = fuzzyScore(name, entry.name);
    let totalScore = nameScore;

    // Bonus for matching country
    if (country && entry.country && country.toLowerCase() === entry.country.toLowerCase()) {
      totalScore = Math.min(totalScore + 5, 100);
    }

    if (totalScore > bestScore) {
      bestScore = totalScore;
      bestMatch = entry;
    }
  }

  let matchStatus = 'No Match';
  if (bestScore >= 90) matchStatus = 'Match';
  else if (bestScore >= 60) matchStatus = 'Possible Match';

  return {
    match: matchStatus,
    score: bestScore,
    matched_name: bestScore >= 60 ? bestMatch?.name : null,
    sources: bestScore >= 60 ? (bestMatch?.sources || []) : [],
    pep_category: bestScore >= 60 ? bestMatch?.pep_category : null,
  };
}

/**
 * Screen a customer against sanctions/PEP databases.
 *
 * ONE-LINE SWAP POINT — replace this block with real API call
 * When Kanwaljeet provides the API:
 * const response = await fetch(import.meta.env.VITE_SCREENING_API_URL, {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({ name, dob, country })
 * });
 * return await response.json();
 */
export async function screenCustomer(name, dob, country) {
  // ONE-LINE SWAP POINT — replace localOpenSanctionsMatch with real API call above
  return localOpenSanctionsMatch(name, dob, country);
}

export async function screenCustomerManual(payload) {
  return await apiPost('/api/customers/manual-screen', payload);
}
