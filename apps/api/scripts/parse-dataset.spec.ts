import { parseRow } from './parse-dataset';

// exceljs row.values is 1-indexed (index 0 is undefined); column A = [1].
describe('parseRow', () => {
  it('maps a standard row to prompt + rank-ordered answers with points', () => {
    const cells = [
      undefined,
      'Name a fruit',
      'Apple',
      40,
      'Banana',
      20,
      'Pear',
      15,
    ];
    expect(parseRow(cells, 'standard')).toEqual({
      kind: 'standard',
      prompt: 'Name a fruit',
      answers: [
        { text: 'Apple', points: 40, rank: 0 },
        { text: 'Banana', points: 20, rank: 1 },
        { text: 'Pear', points: 15, rank: 2 },
      ],
    });
  });

  it('stops at the first empty answer pair and trims prompt whitespace', () => {
    const cells = [undefined, '  Name a fruit  ', 'Apple', 40, '', ''];
    expect(parseRow(cells, 'standard')).toEqual({
      kind: 'standard',
      prompt: 'Name a fruit',
      answers: [{ text: 'Apple', points: 40, rank: 0 }],
    });
  });

  it('coerces numeric answer text to a string (numbers-as-answers rows)', () => {
    const cells = [undefined, 'Name a lucky number', 7, 68, 13, 26];
    expect(parseRow(cells, 'fast_money')).toEqual({
      kind: 'fast_money',
      prompt: 'Name a lucky number',
      answers: [
        { text: '7', points: 68, rank: 0 },
        { text: '13', points: 26, rank: 1 },
      ],
    });
  });

  it('returns null for a header row (no numeric points)', () => {
    const cells = [undefined, 'Question', 'Answer 1', '#1', 'Answer 2', '#2'];
    expect(parseRow(cells, 'standard')).toBeNull();
  });

  it('returns null when the prompt is empty', () => {
    expect(parseRow([undefined, '', 'Apple', 40], 'standard')).toBeNull();
  });
});
