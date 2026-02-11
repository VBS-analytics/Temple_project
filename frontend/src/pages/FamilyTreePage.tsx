import React, { useEffect, useMemo, useRef, useState } from "react";

type FamilyTreeInfo = {
  id: string;
  name: string;
  subtitle: string;
  image?: string;
  description?: string;
  isAvailable?: boolean;
};

type Person = {
  id: string;
  name: string;
  gender: "male" | "female";
  birthYear?: number;
  deathYear?: number;
  birthPlace?: string;
  occupation?: string;
  spouseId?: string;
  fatherId?: string;
  motherId?: string;
  children?: string[];
  generation: number;
  branch?: string;
  notes?: string;
};

type ViewMode = "diagram" | "tree" | "timeline" | "table";

type SortField = "name" | "generation" | "birthYear" | "birthPlace";
type SortDirection = "asc" | "desc";

const familyTrees: FamilyTreeInfo[] = [
  {
    id: "arunachalam-sambasiva-iyr",
    name: "Arunachalam-Sambasiva Iyr",
    subtitle: "Arunachalam - Sambasiva Iyer family",
    image: "/assets/family-trees/arunachalam-sambasiva-family-tree.svg",
    description:
      "Diagram generated from the latest Arunachalam - Sambasiva Iyer family tree records.",
    isAvailable: true,
  },
  {
    id: "kadakarar-subramani-iyr",
    name: "Kadakarar Subramani Iyr",
    subtitle: "Kadakarar Subramani Iyer family",
    image: "/assets/family-trees/kadakarar-subramani-iyr-family-tree.svg",
    description:
      "Diagram generated from the latest Kadakarar Subramani Iyer family tree records.",
    isAvailable: true,
  },
  {
    id: "sundaresa-iyr-pannai-balu",
    name: "Sundaresa Iyr+ Pannai+Balu Fmly",
    subtitle: "Sundaresa Iyer, Pannai, and Balu family lineage",
    image: "/assets/family-trees/sundaresa-iyr-pannai-balu-family-tree.svg",
    description:
      "Diagram generated from the latest Sundaresa Iyer, Pannai, and Balu family lineage records.",
    isAvailable: true,
  },
  {
    id: "narayanaswamy-family",
    name: "Narayanswamy fmly",
    subtitle: "Narayanswamy family",
    image: "/assets/family-trees/narayanaswamy-fmly-family-tree.svg",
    description:
      "Diagram generated from the latest Narayanswamy family tree records.",
    isAvailable: true,
  },
  {
    id: "mangalam-periyamma-family",
    name: "Mangalam Periyamma Fmly",
    subtitle: "Mangalam Periyamma family",
    image: "/assets/family-trees/mangalam-periyamma-fmly-family-tree.svg",
    description:
      "Diagram generated from the latest Mangalam Periyamma family tree records.",
    isAvailable: true,
  },
  {
    id: "koorakattu-family",
    name: "Koorakattu Fmly",
    subtitle: "Koorakattu family",
    image: "/assets/family-trees/koorakattu-fmly-family-tree.svg",
    description:
      "Diagram generated from the latest Koorakattu family tree records.",
    isAvailable: true,
  },
  {
    id: "ramanisasti-fmly",
    name: "RamaniSastri Fmly",
    subtitle: "Ramani Sastrigal family",
    image: "/assets/family-trees/ramanisasti-fmly-family-tree.svg",
    description:
      "Diagram generated from the latest Ramani Sastrigal family tree records.",
    isAvailable: true,
  },
  {
    id: "pichu-iyr-family",
    name: "Pichu Iyr Fmly",
    subtitle: "Pichu Iyer family",
    image: "/assets/family-trees/pichu-iyr-fmly-family-tree.svg",
    description:
      "Diagram generated from the latest Pichu Iyer family tree records.",
    isAvailable: true,
  },
  {
    id: "pattamani-iyr-family",
    name: "Pattamani Iyr Fmly",
    subtitle: "Pattamani Iyer family",
    image: "/assets/family-trees/pattamani-iyr-fmly-family-tree.svg",
    description:
      "Diagram generated from the latest Pattamani Iyer family tree records.",
    isAvailable: true,
  },
];

const detailedPeopleByTree: Record<string, Person[]> = {
  "arunachalam-sambasiva-iyr": [
    {
      id: "1",
      name: "Arunachalam Iyer",
      gender: "male",
      birthYear: 1920,
      deathYear: 1990,
      birthPlace: "Kakkalani Gramam",
      occupation: "Temple Priest",
      spouseId: "2",
      children: ["3", "5", "7"],
      generation: 1,
      branch: "Root",
      notes: "Founder of this lineage.",
    },
    {
      id: "2",
      name: "Sambasiva",
      gender: "female",
      birthYear: 1922,
      deathYear: 1995,
      birthPlace: "Trichy",
      spouseId: "1",
      children: ["3", "5", "7"],
      generation: 1,
      branch: "Root",
    },
    {
      id: "3",
      name: "Raman Iyer",
      gender: "male",
      birthYear: 1945,
      birthPlace: "Chennai",
      occupation: "Engineer",
      fatherId: "1",
      motherId: "2",
      spouseId: "4",
      children: ["9", "11"],
      generation: 2,
      branch: "A",
    },
    {
      id: "4",
      name: "Lakshmi",
      gender: "female",
      birthYear: 1947,
      birthPlace: "Madurai",
      spouseId: "3",
      children: ["9", "11"],
      generation: 2,
      branch: "A",
    },
    {
      id: "5",
      name: "Priya Iyer",
      gender: "female",
      birthYear: 1948,
      birthPlace: "Kakkalani Gramam",
      fatherId: "1",
      motherId: "2",
      spouseId: "6",
      children: ["12", "13", "14"],
      generation: 2,
      branch: "B",
    },
    {
      id: "6",
      name: "Suresh Kumar",
      gender: "male",
      birthYear: 1946,
      birthPlace: "Bangalore",
      occupation: "Doctor",
      spouseId: "5",
      children: ["12", "13", "14"],
      generation: 2,
      branch: "B",
    },
    {
      id: "7",
      name: "Vijay Iyer",
      gender: "male",
      birthYear: 1950,
      birthPlace: "Chennai",
      occupation: "Teacher",
      fatherId: "1",
      motherId: "2",
      spouseId: "8",
      children: ["15"],
      generation: 2,
      branch: "C",
    },
    {
      id: "8",
      name: "Meena",
      gender: "female",
      birthYear: 1952,
      birthPlace: "Trichy",
      spouseId: "7",
      children: ["15"],
      generation: 2,
      branch: "C",
    },
    {
      id: "9",
      name: "Kumar Raman",
      gender: "male",
      birthYear: 1970,
      birthPlace: "Mumbai",
      occupation: "Software Engineer",
      fatherId: "3",
      motherId: "4",
      spouseId: "10",
      children: ["16", "17"],
      generation: 3,
      branch: "A1",
    },
    {
      id: "10",
      name: "Divya",
      gender: "female",
      birthYear: 1972,
      birthPlace: "Pune",
      spouseId: "9",
      children: ["16", "17"],
      generation: 3,
      branch: "A1",
    },
    {
      id: "11",
      name: "Anand Raman",
      gender: "male",
      birthYear: 1974,
      birthPlace: "Chennai",
      occupation: "Business Owner",
      fatherId: "3",
      motherId: "4",
      spouseId: "18",
      children: ["19"],
      generation: 3,
      branch: "A2",
    },
    {
      id: "12",
      name: "Aravind Kumar",
      gender: "male",
      birthYear: 1971,
      birthPlace: "Bangalore",
      occupation: "Architect",
      fatherId: "6",
      motherId: "5",
      children: ["20"],
      generation: 3,
      branch: "B1",
    },
    {
      id: "13",
      name: "Kavitha Kumar",
      gender: "female",
      birthYear: 1973,
      birthPlace: "Bangalore",
      occupation: "Artist",
      fatherId: "6",
      motherId: "5",
      generation: 3,
      branch: "B2",
    },
    {
      id: "14",
      name: "Deepak Kumar",
      gender: "male",
      birthYear: 1976,
      birthPlace: "Hyderabad",
      fatherId: "6",
      motherId: "5",
      generation: 3,
      branch: "B3",
    },
    {
      id: "15",
      name: "Sanjay Vijay",
      gender: "male",
      birthYear: 1975,
      birthPlace: "Chennai",
      occupation: "Professor",
      fatherId: "7",
      motherId: "8",
      spouseId: "21",
      children: ["22"],
      generation: 3,
      branch: "C1",
    },
    {
      id: "16",
      name: "Arun Kumar",
      gender: "male",
      birthYear: 1995,
      birthPlace: "Bangalore",
      fatherId: "9",
      motherId: "10",
      generation: 4,
      branch: "A1a",
    },
    {
      id: "17",
      name: "Aruna Kumar",
      gender: "female",
      birthYear: 1997,
      birthPlace: "Bangalore",
      fatherId: "9",
      motherId: "10",
      generation: 4,
      branch: "A1b",
    },
    {
      id: "18",
      name: "Radha",
      gender: "female",
      birthYear: 1976,
      birthPlace: "Coimbatore",
      spouseId: "11",
      children: ["19"],
      generation: 3,
      branch: "A2",
    },
    {
      id: "19",
      name: "Karthik Anand",
      gender: "male",
      birthYear: 2000,
      birthPlace: "Chennai",
      fatherId: "11",
      motherId: "18",
      generation: 4,
      branch: "A2a",
    },
    {
      id: "20",
      name: "Shreya Aravind",
      gender: "female",
      birthYear: 1998,
      birthPlace: "Bangalore",
      fatherId: "12",
      generation: 4,
      branch: "B1a",
    },
    {
      id: "21",
      name: "Priya Sharma",
      gender: "female",
      birthYear: 1977,
      birthPlace: "Delhi",
      spouseId: "15",
      children: ["22"],
      generation: 3,
      branch: "C1",
    },
    {
      id: "22",
      name: "Nikhil Sanjay",
      gender: "male",
      birthYear: 2002,
      birthPlace: "Chennai",
      fatherId: "15",
      motherId: "21",
      generation: 4,
      branch: "C1a",
    },
  ],
  "kadakarar-subramani-iyr": [
    {
      id: "k1",
      name: "Kadakarar Subramani",
      gender: "male",
      birthYear: 1925,
      generation: 1,
      children: ["k2", "k3"],
      branch: "Root",
    },
    {
      id: "k2",
      name: "Subramani Son 1",
      gender: "male",
      birthYear: 1950,
      fatherId: "k1",
      generation: 2,
      branch: "A",
    },
    {
      id: "k3",
      name: "Subramani Daughter 1",
      gender: "female",
      birthYear: 1952,
      fatherId: "k1",
      generation: 2,
      branch: "B",
    },
  ],
};

const rootPersonByTree: Record<string, string> = {
  "arunachalam-sambasiva-iyr": "1",
  "kadakarar-subramani-iyr": "k1",
};

const getPerson = (people: Person[], id: string): Person | undefined =>
  people.find((p) => p.id === id);

const getChildren = (people: Person[], parentId: string): Person[] =>
  people.filter((p) => p.fatherId === parentId || p.motherId === parentId);

const getSpouse = (people: Person[], personId: string): Person | undefined => {
  const person = getPerson(people, personId);
  if (!person?.spouseId) return undefined;
  return getPerson(people, person.spouseId);
};

const getSiblings = (people: Person[], personId: string): Person[] => {
  const person = getPerson(people, personId);
  if (!person || (!person.fatherId && !person.motherId)) return [];
  return people.filter(
    (p) =>
      p.id !== personId &&
      ((person.fatherId && p.fatherId === person.fatherId) ||
        (person.motherId && p.motherId === person.motherId)),
  );
};

type HierarchyNode = Omit<Person, "children"> & { children: HierarchyNode[] };

const buildHierarchy = (people: Person[], rootId: string): HierarchyNode | null => {
  const map = new Map(people.map((p) => [p.id, p]));
  const buildNode = (id: string): HierarchyNode | null => {
    const person = map.get(id);
    if (!person) return null;
    const childIds = person.children || [];
    const children = childIds
      .map((childId) => buildNode(childId))
      .filter((child): child is HierarchyNode => child !== null);
    const { children: _children, ...personWithoutChildren } = person;
    return { ...personWithoutChildren, children };
  };
  return buildNode(rootId);
};

const Icon = ({ path, className = "" }: { path: string; className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={path} />
  </svg>
);

const TreeNode = ({
  node,
  level,
  onPersonClick,
}: {
  node: HierarchyNode;
  level: number;
  onPersonClick: (person: Person) => void;
}) => {
  const [isExpanded, setIsExpanded] = useState(level < 2);
  const hasChildren = node.children.length > 0;
  const handlePersonClick = () => {
    const { children: _children, ...personData } = node;
    onPersonClick(personData);
  };

  return (
    <div>
      <div className="flex items-start gap-2">
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="mt-1 rounded p-1 transition-colors hover:bg-slate-100"
            aria-label={isExpanded ? "Collapse branch" : "Expand branch"}
          >
            <Icon
              className="h-4 w-4 text-slate-600"
              path={isExpanded ? "m19 9-7 7-7-7" : "m9 5 7 7-7 7"}
            />
          </button>
        ) : (
          <div className="w-6" />
        )}

        <div className="mb-3 flex-1" style={{ marginLeft: level > 0 ? "1rem" : "0" }}>
          <button
            type="button"
            onClick={handlePersonClick}
            className="w-full rounded-lg border-2 border-slate-200 bg-white p-3 text-left shadow-sm transition-all hover:border-blue-400 hover:shadow-md"
          >
            <div className="flex items-start gap-3">
              <div
                className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${
                  node.gender === "male" ? "bg-blue-100 text-blue-600" : "bg-rose-100 text-rose-600"
                }`}
              >
                <Icon className="h-5 w-5" path="M15.75 6.75a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.5 20.12a7.5 7.5 0 1 1 15 0" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-slate-800">{node.name}</div>
                <div className="mt-0.5 text-sm text-slate-600">
                  {node.birthYear ? `${node.birthYear}${node.deathYear ? ` - ${node.deathYear}` : ""}` : "Year unknown"}
                  {node.birthPlace ? ` | ${node.birthPlace}` : ""}
                </div>
                {node.occupation && <div className="mt-1 text-xs text-slate-500">{node.occupation}</div>}
              </div>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                Gen {node.generation}
              </span>
            </div>
          </button>

          {hasChildren && isExpanded && (
            <div className="ml-4 mt-2 border-l-2 border-slate-200 pl-4">
              {node.children.map((child) => (
                <TreeNode key={child.id} node={child} level={level + 1} onPersonClick={onPersonClick} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const TreeView = ({
  people,
  rootPersonId,
  onPersonClick,
}: {
  people: Person[];
  rootPersonId: string;
  onPersonClick: (person: Person) => void;
}) => {
  const root = useMemo(() => buildHierarchy(people, rootPersonId), [people, rootPersonId]);

  if (!root) {
    return <div className="p-8 text-center text-slate-500">No lineage data available.</div>;
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mx-auto max-w-4xl">
        <TreeNode node={root} level={0} onPersonClick={onPersonClick} />
      </div>
    </div>
  );
};

const TimelineView = ({ people, onPersonClick }: { people: Person[]; onPersonClick: (person: Person) => void }) => {
  const grouped = useMemo(() => {
    const out: Record<number, Person[]> = {};
    people.forEach((person) => {
      if (!out[person.generation]) out[person.generation] = [];
      out[person.generation].push(person);
    });
    return Object.entries(out)
      .map(([generation, persons]) => ({ generation: Number(generation), persons }))
      .sort((a, b) => a.generation - b.generation);
  }, [people]);

  return (
    <div className="p-4 sm:p-6">
      <div className="mx-auto max-w-5xl space-y-8">
        {grouped.map((group) => (
          <section key={group.generation}>
            <div className="mb-4 flex items-center gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 font-bold text-white">
                {group.generation}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-800">Generation {group.generation}</h3>
                <p className="text-sm text-slate-500">
                  {group.persons.length} {group.persons.length === 1 ? "person" : "people"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {group.persons.map((person) => {
                const spouse = person.spouseId ? getPerson(people, person.spouseId) : undefined;
                return (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => onPersonClick(person)}
                    className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all hover:border-blue-400 hover:shadow-md"
                  >
                    <div className="font-semibold text-slate-800">{person.name}</div>
                    <p className="mt-1 text-sm text-slate-600">
                      {person.birthYear || "Year unknown"}
                      {person.deathYear ? ` - ${person.deathYear}` : ""}
                    </p>
                    {person.birthPlace && <p className="text-sm text-slate-500">{person.birthPlace}</p>}
                    {spouse && <p className="mt-2 text-xs text-blue-700">Spouse: {spouse.name}</p>}
                    {(person.children?.length || 0) > 0 && (
                      <p className="text-xs text-indigo-700">Children: {person.children?.length}</p>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};

const TableView = ({ people, onPersonClick }: { people: Person[]; onPersonClick: (person: Person) => void }) => {
  const [query, setQuery] = useState("");
  const [generationFilter, setGenerationFilter] = useState<number | "all">("all");
  const [sortField, setSortField] = useState<SortField>("generation");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const generations = useMemo(() => [...new Set(people.map((p) => p.generation))].sort((a, b) => a - b), [people]);

  const rows = useMemo(() => {
    let filtered = [...people];
    const normalized = query.trim().toLowerCase();

    if (normalized) {
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(normalized) ||
          p.birthPlace?.toLowerCase().includes(normalized) ||
          p.occupation?.toLowerCase().includes(normalized) ||
          p.branch?.toLowerCase().includes(normalized),
      );
    }

    if (generationFilter !== "all") {
      filtered = filtered.filter((p) => p.generation === generationFilter);
    }

    filtered.sort((a, b) => {
      const aVal = a[sortField] ?? "";
      const bVal = b[sortField] ?? "";
      const valueA = typeof aVal === "string" ? aVal.toLowerCase() : aVal;
      const valueB = typeof bVal === "string" ? bVal.toLowerCase() : bVal;
      const cmp = valueA < valueB ? -1 : valueA > valueB ? 1 : 0;
      return sortDirection === "asc" ? cmp : -cmp;
    });

    return filtered;
  }, [people, query, generationFilter, sortField, sortDirection]);

  const onSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortField(field);
    setSortDirection("asc");
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, place, occupation..."
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
            aria-label="Search people"
          />
          <select
            value={generationFilter}
            onChange={(e) =>
              setGenerationFilter(e.target.value === "all" ? "all" : Number(e.target.value))
            }
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
            aria-label="Filter generation"
          >
            <option value="all">All Generations</option>
            {generations.map((generation) => (
              <option key={generation} value={generation}>
                Generation {generation}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-3 text-sm text-slate-600">
          Showing {rows.length} of {people.length}
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-sm text-slate-700">
                <th className="px-4 py-3">
                  <button type="button" onClick={() => onSort("name")} className="font-semibold">
                    Name
                  </button>
                </th>
                <th className="px-4 py-3">
                  <button type="button" onClick={() => onSort("generation")} className="font-semibold">
                    Generation
                  </button>
                </th>
                <th className="px-4 py-3">
                  <button type="button" onClick={() => onSort("birthYear")} className="font-semibold">
                    Birth
                  </button>
                </th>
                <th className="px-4 py-3">
                  <button type="button" onClick={() => onSort("birthPlace")} className="font-semibold">
                    Place
                  </button>
                </th>
                <th className="px-4 py-3 font-semibold">Occupation</th>
                <th className="px-4 py-3 font-semibold">Branch</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                    No matching people found.
                  </td>
                </tr>
              ) : (
                rows.map((person) => (
                  <tr
                    key={person.id}
                    className="cursor-pointer border-b border-slate-100 text-sm hover:bg-blue-50"
                    onClick={() => onPersonClick(person)}
                  >
                    <td className="px-4 py-3 font-medium text-slate-800">{person.name}</td>
                    <td className="px-4 py-3 text-slate-600">{person.generation}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {person.birthYear || "-"}
                      {person.deathYear ? ` - ${person.deathYear}` : ""}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{person.birthPlace || "-"}</td>
                    <td className="px-4 py-3 text-slate-600">{person.occupation || "-"}</td>
                    <td className="px-4 py-3 text-slate-600">{person.branch || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const PersonDetailModal = ({
  person,
  allPeople,
  onClose,
  onNavigate,
}: {
  person: Person | null;
  allPeople: Person[];
  onClose: () => void;
  onNavigate: (id: string) => void;
}) => {
  if (!person) return null;

  const spouse = getSpouse(allPeople, person.id);
  const father = person.fatherId ? getPerson(allPeople, person.fatherId) : undefined;
  const mother = person.motherId ? getPerson(allPeople, person.motherId) : undefined;
  const siblings = getSiblings(allPeople, person.id);
  const children = getChildren(allPeople, person.id);

  const JumpLink = ({ label, target }: { label: string; target: Person }) => (
    <button
      type="button"
      onClick={() => {
        onNavigate(target.id);
      }}
      className="block text-left text-sm text-blue-700 hover:underline"
    >
      {label}: {target.name}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 rounded-t-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-5 text-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">{person.name}</h2>
              <p className="text-sm text-blue-100">
                Generation {person.generation}
                {person.branch ? ` | Branch ${person.branch}` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-white/20 px-2 py-1 text-sm transition-colors hover:bg-white/30"
              aria-label="Close"
            >
              Close
            </button>
          </div>
        </div>

        <div className="space-y-5 p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-slate-50 p-3 text-sm">
              <div className="text-slate-500">Birth</div>
              <div className="font-medium text-slate-800">
                {person.birthYear || "Unknown"}
                {person.deathYear ? ` - ${person.deathYear}` : ""}
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 text-sm">
              <div className="text-slate-500">Birthplace</div>
              <div className="font-medium text-slate-800">{person.birthPlace || "Unknown"}</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 text-sm">
              <div className="text-slate-500">Occupation</div>
              <div className="font-medium text-slate-800">{person.occupation || "Not recorded"}</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 text-sm">
              <div className="text-slate-500">Gender</div>
              <div className="font-medium capitalize text-slate-800">{person.gender}</div>
            </div>
          </div>

          {person.notes && (
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800">
              {person.notes}
            </div>
          )}

          <div className="space-y-3 rounded-lg border border-slate-200 p-4">
            <h3 className="font-semibold text-slate-800">Relationships</h3>
            {spouse && <JumpLink label="Spouse" target={spouse} />}
            {father && <JumpLink label="Father" target={father} />}
            {mother && <JumpLink label="Mother" target={mother} />}
            {siblings.map((sibling) => (
              <JumpLink key={sibling.id} label="Sibling" target={sibling} />
            ))}
            {children.map((child) => (
              <JumpLink key={child.id} label="Child" target={child} />
            ))}
            {!spouse && !father && !mother && siblings.length === 0 && children.length === 0 && (
              <p className="text-sm text-slate-500">No recorded relationships.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const FamilyTreePage = () => {
  const [activeTreeId, setActiveTreeId] = useState(familyTrees[0]?.id);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [viewMode, setViewMode] = useState<ViewMode>("diagram");
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const tabsRef = useRef<HTMLDivElement>(null);

  const activeTree = familyTrees.find((tree) => tree.id === activeTreeId) ?? familyTrees[0];
  const detailedPeople = detailedPeopleByTree[activeTreeId] || [];
  const hasDetailedData = detailedPeople.length > 0;
  const rootPersonId = rootPersonByTree[activeTreeId] || "";

  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    setViewMode(isMobile ? "timeline" : "diagram");
  }, []);

  useEffect(() => {
    if (!hasDetailedData && viewMode !== "diagram") {
      setViewMode("diagram");
    }
    setSelectedPerson(null);
    setZoomLevel(100);
  }, [activeTreeId, hasDetailedData, viewMode]);

  const zoomIn = () => setZoomLevel((prev) => Math.min(prev + 25, 300));
  const zoomOut = () => setZoomLevel((prev) => Math.max(prev - 25, 50));
  const resetZoom = () => setZoomLevel(100);

  const scrollTabs = (delta: number) => {
    tabsRef.current?.scrollBy({ left: delta, behavior: "smooth" });
  };

  const navigateToPerson = (personId: string) => {
    const person = getPerson(detailedPeople, personId);
    if (person) setSelectedPerson(person);
  };

  const views: { id: ViewMode; label: string; needsData?: boolean }[] = [
    { id: "diagram", label: "Diagram" },
    { id: "tree", label: "Tree", needsData: true },
    { id: "timeline", label: "Timeline", needsData: true },
    { id: "table", label: "Table", needsData: true },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      <div className="border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <div className="space-y-3 text-center">
            <h1 className="bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-600 bg-clip-text text-3xl font-bold text-transparent sm:text-4xl lg:text-5xl">
              Kakkalani Gramam Family Tree
            </h1>
            <p className="mx-auto max-w-2xl text-base text-slate-600 sm:text-lg">
              {activeTree?.subtitle || "Explore your family heritage"}
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-12">
        <div className="mb-6">
          <div className="relative">
            <button
              type="button"
              onClick={() => scrollTabs(-220)}
              className="absolute left-0 top-1/2 z-10 -translate-y-1/2 rounded-full border border-slate-200 bg-white/90 p-2 shadow-lg backdrop-blur-sm transition-all hover:bg-white lg:hidden"
              aria-label="Scroll family trees left"
            >
              <Icon className="h-5 w-5 text-slate-600" path="m15 19-7-7 7-7" />
            </button>
            <button
              type="button"
              onClick={() => scrollTabs(220)}
              className="absolute right-0 top-1/2 z-10 -translate-y-1/2 rounded-full border border-slate-200 bg-white/90 p-2 shadow-lg backdrop-blur-sm transition-all hover:bg-white lg:hidden"
              aria-label="Scroll family trees right"
            >
              <Icon className="h-5 w-5 text-slate-600" path="m9 5 7 7-7 7" />
            </button>

            <div
              ref={tabsRef}
              className="flex gap-2 overflow-x-auto px-8 pb-2 sm:gap-3 lg:flex-wrap lg:justify-center lg:px-0 [&::-webkit-scrollbar]:hidden"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {familyTrees.map((tree) => {
                const isActive = tree.id === activeTreeId;
                return (
                  <button
                    key={tree.id}
                    type="button"
                    onClick={() => setActiveTreeId(tree.id)}
                    className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 sm:px-5 ${
                      isActive
                        ? "scale-105 bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/30"
                        : "border border-slate-300 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-md"
                    }`}
                    aria-pressed={isActive}
                  >
                    {tree.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
          {views.map((view) => {
            const disabled = Boolean(view.needsData && !hasDetailedData);
            const active = viewMode === view.id;
            return (
              <button
                key={view.id}
                type="button"
                disabled={disabled}
                onClick={() => setViewMode(view.id)}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                  active
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white"
                    : "text-slate-700 hover:bg-slate-100"
                } disabled:cursor-not-allowed disabled:opacity-40`}
              >
                {view.label}
              </button>
            );
          })}
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          {viewMode === "diagram" && (
            <>
              <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50/50 px-4 py-4 sm:px-6">
                <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
                  <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
                    <button
                      type="button"
                      onClick={zoomOut}
                      disabled={zoomLevel <= 50}
                      className="rounded-lg p-1.5 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Zoom out"
                    >
                      <Icon className="h-4 w-4 text-slate-600" path="m21 21-4.35-4.35M8 11h6m5-1a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" />
                    </button>

                    <div className="flex items-center gap-2 px-2">
                      <input
                        type="range"
                        min="50"
                        max="300"
                        step="25"
                        value={zoomLevel}
                        onChange={(e) => setZoomLevel(Number(e.target.value))}
                        className="h-2 w-24 cursor-pointer appearance-none rounded-lg bg-slate-200 accent-blue-600 sm:w-32"
                        aria-label="Zoom level"
                      />
                      <span className="min-w-[3rem] text-center text-sm font-medium text-slate-700">{zoomLevel}%</span>
                    </div>

                    <button
                      type="button"
                      onClick={zoomIn}
                      disabled={zoomLevel >= 300}
                      className="rounded-lg p-1.5 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Zoom in"
                    >
                      <Icon className="h-4 w-4 text-slate-600" path="m21 21-4.35-4.35M11 8v6m-3-3h6m5-1a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" />
                    </button>

                    <div className="mx-1 h-6 w-px bg-slate-300" />

                    <button
                      type="button"
                      onClick={resetZoom}
                      className="rounded-lg p-1.5 transition-colors hover:bg-slate-100"
                      aria-label="Reset zoom"
                      title="Reset zoom"
                    >
                      <Icon className="h-4 w-4 text-slate-600" path="M8 3H5a2 2 0 0 0-2 2v3m0 8v3a2 2 0 0 0 2 2h3m8 0h3a2 2 0 0 0 2-2v-3m0-8V5a2 2 0 0 0-2-2h-3" />
                    </button>
                  </div>

                  {hasDetailedData && (
                    <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                      Detailed data available: switch to Tree, Timeline, or Table.
                    </div>
                  )}
                </div>
              </div>

              <div className="relative">
                {activeTree?.isAvailable && activeTree.image ? (
                  <div className="bg-gradient-to-br from-slate-50 to-blue-50/30 p-4 sm:p-6">
                    <div className="overflow-auto rounded-xl border border-slate-200 bg-white shadow-inner" style={{ maxHeight: "70vh" }}>
                      <div
                        className="p-4 transition-transform duration-300 ease-out sm:p-6"
                        style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: "top center" }}
                      >
                        <img
                          src={activeTree.image}
                          alt={`Family tree diagram for ${activeTree.subtitle}`}
                          className="mx-auto block h-auto w-full"
                          loading="lazy"
                          style={{ maxWidth: "100%" }}
                        />
                      </div>
                    </div>

                    {activeTree.description && (
                      <div className="mt-4 rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
                        <div className="flex items-start gap-3">
                          <div className="h-full w-1 flex-shrink-0 rounded-full bg-gradient-to-b from-blue-500 to-indigo-500" />
                          <p className="text-sm leading-relaxed text-slate-600">{activeTree.description}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="px-6 py-24 text-center">
                    <div className="mx-auto max-w-md space-y-4">
                      <h3 className="text-xl font-semibold text-slate-800">Family Tree Coming Soon</h3>
                      <p className="text-slate-600">
                        This family tree visualization is being prepared. Share additional records with the admin team.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {viewMode !== "diagram" && !hasDetailedData && (
            <div className="p-8 text-center">
              <h3 className="text-lg font-semibold text-slate-800">Detailed lineage data is not available yet</h3>
              <p className="mt-2 text-sm text-slate-600">
                This family currently has diagram data only. Use the Diagram view for now.
              </p>
              <button
                type="button"
                onClick={() => setViewMode("diagram")}
                className="mt-4 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-medium text-white"
              >
                Switch to Diagram
              </button>
            </div>
          )}

          {viewMode === "tree" && hasDetailedData && (
            <TreeView people={detailedPeople} rootPersonId={rootPersonId} onPersonClick={setSelectedPerson} />
          )}

          {viewMode === "timeline" && hasDetailedData && (
            <TimelineView people={detailedPeople} onPersonClick={setSelectedPerson} />
          )}

          {viewMode === "table" && hasDetailedData && (
            <TableView people={detailedPeople} onPersonClick={setSelectedPerson} />
          )}
        </div>
      </div>

      <PersonDetailModal
        person={selectedPerson}
        allPeople={detailedPeople}
        onClose={() => setSelectedPerson(null)}
        onNavigate={navigateToPerson}
      />
    </div>
  );
};

export default FamilyTreePage;