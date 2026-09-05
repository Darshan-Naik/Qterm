import { GithubLink } from "./GithubLink";
import { MacDownloadActions } from "./MacDownloadActions";

export async function PageCta() {
  return (
    <div className="mx-auto max-w-6xl px-5 pb-20">
      <div className="flex flex-wrap items-center justify-center gap-3">
        <GithubLink />
        <MacDownloadActions className="justify-center" />
      </div>
    </div>
  );
}
