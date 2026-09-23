type GlancePerson = {
  username: string;
  name?: string;
  avatarUrl: string;
  profileUrl: string;
};

export function ContributorGlance({ people }: { people: GlancePerson[] }) {
  if (people.length === 0) return null;
  return (
    <div className="flex flex-col items-center">
      <div className="flex flex-wrap items-center justify-center gap-3">
        {people.map((person) => {
          const name = person.name || person.username;
          return (
            <a
              key={person.username.toLowerCase()}
              href={person.profileUrl}
              aria-label={name}
              className="group relative"
            >
              <img
                src={person.avatarUrl}
                alt=""
                width={44}
                height={44}
                className="h-11 w-11 rounded-full bg-white/5 object-cover ring-2 ring-white/15 transition group-hover:ring-primary"
              />
              <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-[12px] font-medium text-background opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
                {name}
              </span>
            </a>
          );
        })}
      </div>
      <a className="mt-4 text-[13px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" href="/contributors">
        The people behind Qterm
      </a>
    </div>
  );
}
