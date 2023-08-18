import { ContactSearch } from "~/frontend/frontend-2/features/common/components";

const contactList: {
  name: string;
  picture: string;
}[] = [
  {
    name: "Usain Bolt",
    picture: "./new-ui-assets/a.jpg",
  },
  {
    name: "Job Smith",
    picture: "./new-ui-assets/man-1-[white].jpg",
  },
  {
    name: "Joe Smith",
    picture: "./new-ui-assets/man-2-[couple].jpg",
  },
  {
    name: "Carol Xmas",
    picture: "./new-ui-assets/girl-1.jpg",
  },
  {
    name: "Mary Little Lamb",
    picture: "./new-ui-assets/girl-2.jpg",
  },
  {
    name: "Xi Jin",
    picture: "./new-ui-assets/man-9-[asian].jpg",
  },
  {
    name: "Sebastian",
    picture: "./new-ui-assets/man-7-[white].jpg",
  },
  {
    name: "Sebastian",
    picture: "./new-ui-assets/man-7-[white].jpg",
  },
  {
    name: "Sebastian",
    picture: "./new-ui-assets/man-7-[white].jpg",
  },
  {
    name: "Sebastian",
    picture: "./new-ui-assets/man-7-[white].jpg",
  },
  {
    name: "Sebastian",
    picture: "./new-ui-assets/man-7-[white].jpg",
  },
  {
    name: "Sebastian",
    picture: "./new-ui-assets/man-7-[white].jpg",
  },
  {
    name: "Sebastian",
    picture: "./new-ui-assets/man-7-[white].jpg",
  },
];

export function TabFindContact(props: {
  search: string;
  setSearch: (s: string) => void;
}) {
  return (
    <div className="h-full">
      <div className="h-9 px-4">
        <ContactSearch onInput={(e) => props.setSearch(e.target.value)} />
      </div>

      <div className="mt-4 h-[calc(100%-(3.25rem))] space-y-3 overflow-y-auto">
        {contactList
          .filter((c) => c.name.toLowerCase().includes(props.search))
          .map((c) => (
            <Contact name={c.name} picture={c.picture} />
          ))}
      </div>
    </div>
  );
}

function Contact(props: { name: string; picture: string }) {
  return (
    <div className="flex cursor-pointer items-center px-5 py-2 hover:bg-gray-100">
      <div className="relative w-10">
        <img
          className="inline-block h-10 w-10 rounded-lg object-cover"
          src={props.picture}
        />
      </div>

      <div className="flex h-10 w-[calc(100%-2.5rem)] items-center pl-3.5">
        <div className="flex items-end justify-between">
          <p className="text-sm font-medium">{props.name}</p>
        </div>
      </div>
    </div>
  );
}
