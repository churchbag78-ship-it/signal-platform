// Starter board data. Each tile has an id, label, and category (used for tile color).
// Icon/image references are placeholders — swap in real symbol library assets
// (e.g. Mulberry Symbols) once licensing is sorted.

export const coreBoard = {
  id: 'core',
  name: 'Core words',
  tiles: [
    { id: 't1', label: 'I', category: 'pronoun' },
    { id: 't2', label: 'You', category: 'pronoun' },
    { id: 't3', label: 'Want', category: 'verb' },
    { id: 't4', label: 'Go', category: 'verb' },
    { id: 't5', label: 'More', category: 'descriptor' },
    { id: 't6', label: 'Stop', category: 'verb' },
    { id: 't7', label: 'Help', category: 'verb' },
    { id: 't8', label: 'Eat', category: 'verb' },
    { id: 't9', label: 'Drink', category: 'verb' },
    { id: 't10', label: 'Play', category: 'verb' },
    { id: 't11', label: 'Happy', category: 'feeling' },
    { id: 't12', label: 'Sad', category: 'feeling' },
    { id: 't13', label: 'Yes', category: 'response' },
    { id: 't14', label: 'No', category: 'response' },
    { id: 't15', label: 'Bathroom', category: 'need' },
  ],
};

// Category -> color mapping, mirrors the mockup's tile coloring
export const categoryColors = {
  pronoun: '#378ADD',
  verb: '#1D9E75',
  descriptor: '#BA7517',
  feeling: '#D85A30',
  response: '#7F77DD',
  need: '#D4537E',
  other: '#5A6472',
};

// Higher-contrast palette for the CVI (cortical/cerebral visual impairment)
// accessibility mode: fewer, more saturated hues with more separation between
// them, per common CVI guidance (bold color, reduced palette complexity).
export const highContrastCategoryColors = {
  pronoun: '#0057B8',
  verb: '#00843D',
  descriptor: '#C46A00',
  feeling: '#D7263D',
  response: '#5B2A86',
  need: '#B8005C',
  other: '#000000',
};

export const CATEGORIES = ['pronoun', 'verb', 'descriptor', 'feeling', 'response', 'need', 'other'];
