import type { Cell, Person } from "@/lib/data";

export function getCellPeople(cell: Cell, people: Person[]) {
  return people.filter((person) => person.cellId === cell.id);
}

export function getCellStats(cell: Cell, people: Person[]) {
  const cellPeople = getCellPeople(cell, people);
  const present = cellPeople.filter((person) => person.cellAbsences === 0).length;
  const servicePresent = cellPeople.filter((person) => person.servicePresent).length;
  const attention = cellPeople.filter((person) => person.cellAbsences >= 2 || person.progress < 20).length;
  const averageProgress = cellPeople.length
    ? Math.round(cellPeople.reduce((sum, person) => sum + person.progress, 0) / cellPeople.length)
    : 0;

  return {
    total: cellPeople.length,
    present,
    servicePresent,
    attention,
    averageProgress,
    attendanceRate: cellPeople.length ? Math.round((present / cellPeople.length) * 100) : 0,
  };
}

export function getOverallStats(cells: Cell[], people: Person[]) {
  const visibleCellIds = new Set(cells.map((cell) => cell.id));
  const visiblePeople = people.filter((person) => visibleCellIds.has(person.cellId));
  const present = visiblePeople.filter((person) => person.cellAbsences === 0).length;
  const servicePresent = visiblePeople.filter((person) => person.servicePresent).length;
  const attention = visiblePeople.filter((person) => person.cellAbsences >= 2 || person.progress < 20).length;
  const averageProgress = visiblePeople.length
    ? Math.round(visiblePeople.reduce((sum, person) => sum + person.progress, 0) / visiblePeople.length)
    : 0;

  return {
    cells: cells.length,
    people: visiblePeople.length,
    present,
    servicePresent,
    attention,
    averageProgress,
  };
}
