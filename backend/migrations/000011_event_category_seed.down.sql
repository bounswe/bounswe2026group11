-- Removes seeded categories only if nothing references them (may fail if events exist).
DELETE FROM event_category
WHERE id IN (
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20
  )
  AND name IN (
      'Sports',
      'Music',
      'Education',
      'Technology',
      'Art',
      'Food & Drink',
      'Outdoors',
      'Fitness',
      'Networking',
      'Gaming',
      'Charity',
      'Photography',
      'Travel',
      'Workshops',
      'Conferences',
      'Movies & Cinema',
      'Theatre',
      'Books & Literature',
      'Wellness',
      'Volunteering'
  );
