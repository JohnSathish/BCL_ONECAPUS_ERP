'use client';

type Props = {
  value: string;
  options: ReadonlyArray<{ value: string; label: string }>;
};

/** Submits the surrounding GET form on change; the form's submit button covers no-JS visitors. */
export function QuestionBankSortSelect({ value, options }: Props) {
  return (
    <select
      id="qb-sort"
      name="sort"
      defaultValue={value}
      className="qb-select qb-sort-select"
      onChange={(event) => event.currentTarget.form?.requestSubmit()}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
