-- Students replaced the fixed "out of 100" with their score and left Marks empty.
-- Move that score into marks obtained and set the maximum back to 100.
DO $$
DECLARE
  rec record;
  doc jsonb;
  subjects jsonb;
  subject jsonb;
  fixed jsonb;
  got text;
  max_mark numeric;
  changed boolean;
BEGIN
  FOR rec IN
    SELECT m.id, s.roll_number, p.full_name, m.subject_name, m.max_marks
    FROM academic.student_board_subject_marks m
    JOIN academic.student_board_exams e ON e.id = m.board_exam_id
    JOIN academic.students s ON s.id = e.student_id
    LEFT JOIN academic.student_profiles p ON p.student_id = s.id
    WHERE m.marks_obtained IS NULL
      AND m.max_marks IS NOT NULL
      AND m.max_marks BETWEEN 1 AND 100
      AND m.max_marks <> 100
  LOOP
    UPDATE academic.student_board_subject_marks
    SET marks_obtained = rec.max_marks,
        max_marks = 100,
        updated_at = NOW()
    WHERE id = rec.id;
    RAISE NOTICE 'Corrected Class XII mark % %: % %/100',
      COALESCE(rec.roll_number, ''),
      COALESCE(rec.full_name, ''),
      rec.subject_name,
      rec.max_marks;
  END LOOP;

  FOR rec IN
    SELECT item.id, item.new_value, s.roll_number, p.full_name
    FROM academic.student_profile_change_items item
    JOIN academic.student_profile_change_requests req ON req.id = item.request_id
    JOIN academic.students s ON s.id = req.student_id
    LEFT JOIN academic.student_profiles p ON p.student_id = s.id
    WHERE item.section_key = 'class_xii'
      AND item.field_key = 'boardExam'
      AND item.new_value IS NOT NULL
  LOOP
    BEGIN
      doc := rec.new_value::jsonb;
    EXCEPTION WHEN others THEN
      CONTINUE;
    END;
    subjects := doc -> 'subjects';
    IF subjects IS NULL OR jsonb_typeof(subjects) <> 'array' THEN
      CONTINUE;
    END IF;
    fixed := '[]'::jsonb;
    changed := false;
    FOR subject IN SELECT value FROM jsonb_array_elements(subjects)
    LOOP
      got := subject ->> 'marksObtained';
      BEGIN
        max_mark := NULLIF(subject ->> 'maxMarks', '')::numeric;
      EXCEPTION WHEN others THEN
        max_mark := NULL;
      END;
      IF (got IS NULL OR btrim(got) = '' OR lower(got) = 'null')
         AND max_mark IS NOT NULL
         AND max_mark BETWEEN 1 AND 100
         AND max_mark <> 100 THEN
        RAISE NOTICE 'Corrected pending Class XII submission % %: % %/100',
          COALESCE(rec.roll_number, ''),
          COALESCE(rec.full_name, ''),
          COALESCE(subject ->> 'subjectName', ''),
          max_mark::int;
        subject := jsonb_set(subject, '{marksObtained}', to_jsonb(max_mark::int), true);
        subject := jsonb_set(subject, '{maxMarks}', '100'::jsonb, true);
        changed := true;
      END IF;
      fixed := fixed || jsonb_build_array(subject);
    END LOOP;
    IF changed THEN
      UPDATE academic.student_profile_change_items
      SET new_value = jsonb_set(doc, '{subjects}', fixed, true)::text,
          updated_at = NOW()
      WHERE id = rec.id;
    END IF;
  END LOOP;
END $$;
