// The door's release rule, running in the browser against a fictional listing.
// It mirrors frontdoor/core in the repo: every fact is public, gated or
// private, and the answer is a lookup. Nothing here can be talked into
// releasing a gated or private fact.

export type Visibility = 'public' | 'gated' | 'private';
export type Status = 'answered' | 'held' | 'never' | 'owner';

interface Fact {
  label: string;
  value: string;
  visibility: Visibility;
  words: string[];
}

export interface Reply {
  status: Status;
  label: string;
  text: string;
}

// Order matters: the private fact is checked first, so "the lowest price"
// is never mistaken for the asking price.
const FACTS: Fact[] = [
  { label: "Seller's floor", value: '', visibility: 'private', words: ['lowest', 'floor', 'least', 'bottom line', 'walk away', 'walk-away', 'minimum', 'rock bottom', 'really take', 'actually take'] },
  { label: 'Business name', value: '', visibility: 'gated', words: ['name', 'which company', 'who is it', 'what company'] },
  { label: 'Customers', value: '', visibility: 'gated', words: ['customer', 'client', 'concentration'] },
  { label: 'Financials', value: '', visibility: 'gated', words: ['financials', 'p&l', 'tax return', 'statements', 'the books', 'bank'] },
  { label: 'Address', value: '', visibility: 'gated', words: ['address', 'exactly where', 'street'] },
  { label: 'Asking price', value: '$3,200,000', visibility: 'public', words: ['asking', 'price', 'how much', 'cost'] },
  { label: 'Revenue', value: '$4,600,000 a year', visibility: 'public', words: ['revenue', 'sales', 'top line', 'gross'] },
  { label: "Owner's earnings", value: '$1,050,000 a year', visibility: 'public', words: ['sde', 'cash flow', 'earnings', 'profit', 'ebitda', 'make'] },
  { label: 'Employees', value: '19', visibility: 'public', words: ['employee', 'staff', 'headcount', 'how many people', 'team', 'technician'] },
  { label: 'Reason for sale', value: 'The owner is retiring and will stay for a handover.', visibility: 'public', words: ['why', 'reason', 'retiring'] },
  { label: 'Where', value: 'Mid-Atlantic, a metro area of about 400,000 people.', visibility: 'public', words: ['where', 'location', 'located', 'region', 'city', 'state', 'area'] },
  { label: 'Years in business', value: '24', visibility: 'public', words: ['how long', 'how old', 'established', 'founded', 'years'] },
  { label: 'Financing', value: 'A lender has pre-reviewed it for an SBA 7(a) loan. The seller will consider a note.', visibility: 'public', words: ['sba', 'financing', 'seller note', 'loan', 'finance'] },
  { label: 'Real estate', value: 'Not included.', visibility: 'public', words: ['real estate', 'property', 'building', 'lease'] },
  { label: "Owner's role", value: 'Estimating and bank relationships. Two service managers run the day to day.', visibility: 'public', words: ['owner do', 'owner involved', 'absentee', 'owner work', 'run the'] },
];

export function ask(question: string): Reply[] {
  const q = question.toLowerCase();
  const hits = FACTS.filter((f) => f.words.some((w) => q.includes(w)));
  if (hits.length === 0) {
    return [{ status: 'owner', label: 'For the broker', text: 'That one needs a person. I have passed it on.' }];
  }
  // A question that touches the private fact gets only that answer.
  const priv = hits.find((f) => f.visibility === 'private');
  if (priv) {
    return [{ status: 'never', label: priv.label, text: 'That stays shut. For everyone, always.' }];
  }
  return hits.slice(0, 3).map((f): Reply => {
    if (f.visibility === 'gated') {
      return { status: 'held', label: f.label, text: 'Held back until you have a signed NDA, proof of funds and a verified identity.' };
    }
    return { status: 'answered', label: f.label, text: f.value };
  });
}

/** The arbiter's whole rule. */
export function blindMatch(buyerMost: number, sellerLeast: number): 'overlap' | 'no_overlap' {
  return buyerMost >= sellerLeast ? 'overlap' : 'no_overlap';
}
