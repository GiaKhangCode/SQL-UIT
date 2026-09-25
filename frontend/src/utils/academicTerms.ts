export function academicTerms(selected = ""): string[] {
  const year = new Date().getFullYear();
  const terms = Array.from({ length: 7 }, (_, index) => year - 2 + index)
    .flatMap((value) => [1, 2, 3].map((semester) => `Semester ${semester}, ${value}`));
  return selected && !terms.includes(selected) ? [selected, ...terms] : terms;
}
