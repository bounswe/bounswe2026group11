import { getEventCategoryPresentation } from './eventCategoryPresentation';

describe('getEventCategoryPresentation', () => {
  it('keeps outdoors and volunteering visually distinct', () => {
    const outdoors = getEventCategoryPresentation('Outdoors', false);
    const volunteering = getEventCategoryPresentation('Volunteering', false);

    expect(outdoors.color).toBe('#059669');
    expect(volunteering.color).toBe('#BE123C');
    expect(outdoors.color).not.toBe(volunteering.color);
  });

  it('normalizes category names with punctuation', () => {
    const presentation = getEventCategoryPresentation('Food & Drink', false);

    expect(presentation.emoji).toBe('🍽️');
    expect(presentation.color).toBe('#C2410C');
  });

  it('returns readable foreground text for bright dark-theme colors', () => {
    const presentation = getEventCategoryPresentation('Books & Literature', true);

    expect(presentation.color).toBe('#FCD34D');
    expect(presentation.textColor).toBe('#0F172A');
  });
});
