-- Align homepage layout with public composition:
-- 1) About College above Principal
-- 2) Disable standalone Upcoming Events (events live beside Principal)
-- 3) Enable Why Choose Us (campusLife)

UPDATE academic.website_homepage_sections AS s
SET
  position = c.position,
  label = c.label,
  enabled = CASE
    WHEN c.section_key = 'upcomingEvents' THEN false
    WHEN c.section_key = 'campusLife' THEN true
    WHEN c.section_key = 'aboutCollege' THEN true
    ELSE s.enabled
  END
FROM (
  VALUES
    ('hero', 0, 'Hero'),
    ('statistics', 1, 'Statistics'),
    ('aboutCollege', 2, 'About College'),
    ('principalMessage', 3, 'Principal''s Message'),
    ('upcomingEvents', 4, 'Upcoming Events (legacy slot)'),
    ('noticeBoard', 5, 'Notice Board'),
    ('departments', 6, 'Departments'),
    ('programmes', 7, 'Programmes'),
    ('campusLife', 8, 'Why Choose Us'),
    ('news', 9, 'News'),
    ('gallery', 10, 'Gallery'),
    ('testimonials', 11, 'Testimonials'),
    ('placement', 12, 'Placement'),
    ('footer', 13, 'Footer')
) AS c(section_key, position, label)
WHERE s.section_key = c.section_key;
